import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.engine.ml.forecasting import (
    ForecastModelType,
    TimeSeriesSuitabilityError,
    detect_temporal_schema,
    generate_forecast,
    prepare_time_series,
)


@pytest.fixture
def monthly_sales_df():
    # 12 months of progressive sales data
    dates = pd.date_range(start="2023-01-01", periods=12, freq="MS")
    # Linear upward trend with slight noise
    revenue = [10000, 11500, 12800, 13400, 15000, 16200, 17800, 18500, 20100, 21400, 22900, 24500]
    orders = [100, 110, 125, 130, 145, 155, 170, 175, 190, 205, 220, 235]
    return pd.DataFrame({
        "order_date": dates,
        "revenue": revenue,
        "order_count": orders,
        "category": ["Retail"] * 12
    })


@pytest.fixture
def non_temporal_df():
    return pd.DataFrame({
        "product_id": [1, 2, 3, 4],
        "category": ["A", "B", "C", "D"],
        "price": [10.0, 20.0, 30.0, 40.0]
    })


def test_detect_temporal_schema(monthly_sales_df, non_temporal_df):
    temporal_schema = detect_temporal_schema(monthly_sales_df)
    assert temporal_schema["is_forecastable"] is True
    assert "order_date" in temporal_schema["date_columns"]
    assert "revenue" in temporal_schema["metric_columns"]
    assert temporal_schema["primary_metric"] == "revenue"

    non_temp_schema = detect_temporal_schema(non_temporal_df)
    assert non_temp_schema["is_forecastable"] is False
    assert len(non_temp_schema["date_columns"]) == 0


def test_prepare_time_series(monthly_sales_df):
    resampled, freq = prepare_time_series(monthly_sales_df, "order_date", "revenue")
    assert len(resampled) == 12
    assert "revenue" in resampled.columns


def test_insufficient_points_error():
    tiny_df = pd.DataFrame({
        "order_date": pd.to_datetime(["2023-01-01", "2023-02-01"]),
        "revenue": [1000.0, 1200.0]
    })
    with pytest.raises(TimeSeriesSuitabilityError):
        prepare_time_series(tiny_df, "order_date", "revenue")


def test_generate_forecast_auto(monthly_sales_df):
    res = generate_forecast(
        df=monthly_sales_df,
        time_column="order_date",
        target_column="revenue",
        horizon=6,
        preferred_model=ForecastModelType.AUTO,
    )

    assert res["target_column"] == "revenue"
    assert res["time_column"] == "order_date"
    assert res["horizon"] == 6
    assert len(res["historical_points"]) == 12
    assert len(res["forecast_points"]) == 6

    # Verify forecast points structure & confidence intervals
    first_fc = res["forecast_points"][0]
    last_fc = res["forecast_points"][-1]

    assert "forecast" in first_fc
    assert first_fc["lower_bound_80"] <= first_fc["forecast"] <= first_fc["upper_bound_80"]
    assert first_fc["lower_bound_95"] <= first_fc["forecast"] <= first_fc["upper_bound_95"]
    assert first_fc["lower_bound_95"] <= first_fc["lower_bound_80"]

    # Verify uncertainty expands with horizon
    first_margin_95 = first_fc["upper_bound_95"] - first_fc["lower_bound_95"]
    last_margin_95 = last_fc["upper_bound_95"] - last_fc["lower_bound_95"]
    assert last_margin_95 >= first_margin_95

    # Out-of-sample backtesting metrics
    metrics = res["validation_metrics"]
    assert "mae" in metrics
    assert "rmse" in metrics
    assert "mape_pct" in metrics
    assert metrics["rmse"] >= 0.0

    # Model comparisons present
    assert "all_model_evaluations" in res
    assert len(res["all_model_evaluations"]) == 3
    assert len(res["assumptions"]) > 0
    assert len(res["limitations"]) > 0


def test_generate_forecast_linear_trend(monthly_sales_df):
    res = generate_forecast(
        df=monthly_sales_df,
        time_column="order_date",
        target_column="revenue",
        horizon=3,
        preferred_model=ForecastModelType.LINEAR_TREND,
    )
    assert res["selected_model"] == "Linear Trend (OLS)"
    assert "slope" in res["model_parameters"]
    assert res["model_parameters"]["slope"] > 0  # Upward trend


def test_forecast_api_endpoints(client: TestClient, session):
    # 1. Register & login
    client.post("/api/v1/auth/register", json={
        "email": "forecaster@example.com",
        "password": "securepassword",
        "full_name": "Forecast User"
    })
    login_resp = client.post("/api/v1/auth/login", data={
        "username": "forecaster@example.com",
        "password": "securepassword"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get workspace
    ws_resp = client.get("/api/v1/workspaces", headers=headers)
    ws_id = ws_resp.json()[0]["id"]

    # 3. Upload dataset
    csv_bytes = (
        b"order_date,revenue,orders\n"
        b"2023-01-01,1000.0,10\n"
        b"2023-02-01,1200.0,12\n"
        b"2023-03-01,1350.0,13\n"
        b"2023-04-01,1500.0,15\n"
        b"2023-05-01,1700.0,17\n"
        b"2023-06-01,1900.0,19\n"
        b"2023-07-01,2100.0,21\n"
    )
    files = {"file": ("timeseries.csv", io.BytesIO(csv_bytes), "text/csv")}
    upload_res = client.post(f"/api/v1/workspaces/{ws_id}/datasets", headers=headers, files=files, data={"name": "TS Sales"})
    assert upload_res.status_code == 200
    dataset_id = upload_res.json()["id"]

    # 4. Check schema endpoint
    schema_res = client.get(f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/forecast/schema", headers=headers)
    assert schema_res.status_code == 200
    s_data = schema_res.json()
    assert s_data["is_forecastable"] is True
    assert "order_date" in s_data["date_columns"]

    # 5. Run forecast endpoint
    fc_res = client.post(
        f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/forecast",
        headers=headers,
        json={"target_column": "revenue", "horizon": 4, "model_type": "auto"}
    )
    assert fc_res.status_code == 200
    fc_data = fc_res.json()
    assert fc_data["status"] == "success"
    assert len(fc_data["forecast_points"]) == 4
    forecast_id = fc_data["id"]

    # 6. List forecasts endpoint
    list_res = client.get(f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/forecasts", headers=headers)
    assert list_res.status_code == 200
    records = list_res.json()
    assert len(records) >= 1
    assert records[0]["id"] == forecast_id
    assert records[0]["target_column"] == "revenue"
