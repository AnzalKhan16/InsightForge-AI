import io
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core.nl_analytics import (
    detect_dataset_schema,
    execute_nl_query,
    NLQueryOperation,
    parse_query_plan_deterministic,
)


@pytest.fixture
def sales_df():
    data = {
        "order_date": [
            "2023-01-15", "2023-01-20", "2023-02-10", "2023-02-25",
            "2023-03-05", "2023-03-28", "2023-04-12", "2023-04-22",
            "2023-05-15", "2023-05-29", "2023-06-10", "2023-06-25",
        ],
        "product_category": [
            "Electronics", "Books", "Electronics", "Home & Garden",
            "Electronics", "Books", "Electronics", "Home & Garden",
            "Electronics", "Books", "Home & Garden", "Books"
        ],
        "region": [
            "North", "South", "North", "East",
            "West", "South", "East", "West",
            "North", "South", "East", "West"
        ],
        "customer_name": [
            "Acme Corp", "Beta LLC", "Gamma Inc", "Delta Co",
            "Acme Corp", "Beta LLC", "Epsilon Ltd", "Delta Co",
            "Acme Corp", "Zeta Enterprises", "Eta Group", "Theta Inc"
        ],
        "revenue": [
            1200.0, 450.0, 3100.0, 800.0,
            2400.0, 320.0, 1800.0, 650.0,
            900.0, 410.0, 550.0, 380.0
        ],
        "profit": [
            300.0, 120.0, 800.0, 200.0,
            600.0, 80.0, 450.0, 150.0,
            220.0, 100.0, 120.0, 90.0
        ]
    }
    df = pd.DataFrame(data)
    df["order_date"] = pd.to_datetime(df["order_date"])
    return df


def test_detect_dataset_schema(sales_df):
    schema = detect_dataset_schema(sales_df)
    assert "revenue" in schema["metrics"]
    assert "profit" in schema["metrics"]
    assert "product_category" in schema["dimensions"]
    assert "region" in schema["dimensions"]
    assert "customer_name" in schema["dimensions"]
    assert "order_date" in schema["date_columns"]
    assert schema["primary_metric"] == "revenue"
    assert schema["primary_date"] == "order_date"


def test_metric_summary_query(sales_df):
    res = execute_nl_query(sales_df, "What was our total revenue?")
    assert res.operation == NLQueryOperation.METRIC_SUMMARY
    assert res.summary_metrics["total"] == pytest.approx(12960.0, 0.01)
    assert "12,960.00" in res.answer_markdown
    assert res.chart_suggestion is not None
    assert res.chart_suggestion["type"] == "metric_card"


def test_ranking_products_query(sales_df):
    res = execute_nl_query(sales_df, "Which products generated the most revenue?")
    assert res.operation == NLQueryOperation.RANKING
    assert res.plan.dimension_column == "product_category"
    assert res.plan.metric_column == "revenue"
    assert len(res.data) > 0
    # Electronics is the top seller
    assert res.data[0]["product_category"] == "Electronics"
    assert res.data[0]["total_value"] > 5000.0
    assert "Electronics" in res.answer_markdown
    assert res.chart_suggestion["type"] == "bar_chart"


def test_ranking_top_customers_query(sales_df):
    res = execute_nl_query(sales_df, "What were our top customers?")
    assert res.operation == NLQueryOperation.RANKING
    assert res.plan.dimension_column == "customer_name"
    assert len(res.data) > 0
    assert res.data[0]["customer_name"] == "Acme Corp"
    assert "Acme Corp" in res.answer_markdown


def test_fastest_growing_region_query(sales_df):
    res = execute_nl_query(sales_df, "Which region grew the fastest?")
    assert res.operation == NLQueryOperation.PERIOD_COMPARISON
    assert res.plan.dimension_column == "region"
    assert len(res.data) > 0
    assert "Growth Rate" in res.answer_markdown or "grew" in res.answer_markdown


def test_period_comparison_query(sales_df):
    res = execute_nl_query(sales_df, "Compare this quarter with the previous quarter")
    assert res.operation == NLQueryOperation.PERIOD_COMPARISON
    assert "Quarter-over-Quarter" in res.answer_markdown or "Comparison" in res.answer_markdown
    assert "delta" in res.summary_metrics


def test_root_cause_revenue_query(sales_df):
    res = execute_nl_query(sales_df, "Why did revenue decrease?")
    assert res.operation == NLQueryOperation.ROOT_CAUSE
    assert "Root-Cause Analysis" in res.answer_markdown
    assert len(res.data) > 0
    assert "Primary Driver" in res.answer_markdown


def test_arbitrary_injection_safety(sales_df):
    # Malicious injection attempt with fake columns and raw SQL keywords
    malicious_query = "SELECT * FROM users WHERE 1=1; DROP TABLE users; revenue from nonexistent_column"
    res = execute_nl_query(sales_df, malicious_query)
    # The engine should safely map to validated metrics/dimensions and not throw errors
    assert res.plan.metric_column in sales_df.columns
    assert res.answer_markdown is not None
    assert len(res.data) > 0


def test_nl_query_api_endpoint(client: TestClient, session):
    # 1. Register & login
    client.post("/api/v1/auth/register", json={
        "email": "nluser@example.com",
        "password": "securepassword",
        "full_name": "NL User"
    })
    login_resp = client.post("/api/v1/auth/login", data={
        "username": "nluser@example.com",
        "password": "securepassword"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get workspace
    ws_resp = client.get("/api/v1/workspaces", headers=headers)
    ws_id = ws_resp.json()[0]["id"]

    # 3. Upload CSV
    csv_bytes = (
        b"order_date,product_category,region,revenue\n"
        b"2023-01-01,Electronics,North,500.0\n"
        b"2023-01-02,Books,South,150.0\n"
        b"2023-02-01,Electronics,North,800.0\n"
        b"2023-02-02,Books,South,200.0\n"
    )
    files = {"file": ("sales.csv", io.BytesIO(csv_bytes), "text/csv")}
    upload_res = client.post(f"/api/v1/workspaces/{ws_id}/datasets", headers=headers, files=files, data={"name": "Sales Data"})
    assert upload_res.status_code == 200
    dataset_id = upload_res.json()["id"]

    # 4. Query NL endpoint
    q_res = client.post(
        f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/nl-query",
        headers=headers,
        json={"question": "Which products generated the most revenue?"}
    )
    assert q_res.status_code == 200
    data = q_res.json()
    assert data["operation"] == "ranking"
    assert "Electronics" in data["answer_markdown"]
    assert len(data["data"]) == 2
