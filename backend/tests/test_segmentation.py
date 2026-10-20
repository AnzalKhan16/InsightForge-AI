import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.engine.ml.segmentation import (
    SegmentationMethod,
    SegmentationSuitabilityError,
    calculate_abc_pareto_segmentation,
    calculate_kmeans_segmentation,
    calculate_rfm_segmentation,
    detect_segmentation_schema,
)


@pytest.fixture
def sales_df():
    # 20 transactions across 6 customers and 5 products
    customers = [
        "Alice", "Bob", "Charlie", "Alice", "David", "Eve",
        "Alice", "Bob", "Frank", "Charlie", "Alice", "Bob",
        "David", "Eve", "Frank", "Alice", "Bob", "Charlie",
        "David", "Eve"
    ]
    dates = [
        "2026-01-05", "2026-01-08", "2026-01-12", "2026-02-01", "2026-02-15", "2026-02-20",
        "2026-03-01", "2026-03-10", "2026-03-15", "2026-04-01", "2026-04-05", "2026-04-20",
        "2026-05-01", "2026-05-15", "2026-05-20", "2026-06-01", "2026-06-05", "2026-06-10",
        "2026-06-15", "2026-06-20"
    ]
    revenues = [
        500.0, 150.0, 200.0, 600.0, 50.0, 80.0,
        750.0, 200.0, 30.0, 250.0, 900.0, 180.0,
        70.0, 100.0, 40.0, 850.0, 220.0, 300.0,
        60.0, 110.0
    ]
    quantities = [
        5, 2, 2, 6, 1, 1,
        7, 2, 1, 3, 9, 2,
        1, 1, 1, 8, 2, 3,
        1, 1
    ]
    products = [
        "Enterprise Suite", "Basic Plan", "Pro Plan", "Enterprise Suite", "Addon A", "Addon B",
        "Enterprise Suite", "Basic Plan", "Addon A", "Pro Plan", "Enterprise Suite", "Basic Plan",
        "Addon B", "Pro Plan", "Addon A", "Enterprise Suite", "Basic Plan", "Pro Plan",
        "Addon A", "Addon B"
    ]
    return pd.DataFrame({
        "customer_name": customers,
        "order_date": dates,
        "revenue": revenues,
        "quantity": quantities,
        "product_name": products,
    })


def test_detect_segmentation_schema(sales_df):
    schema = detect_segmentation_schema(sales_df)
    assert "customer_name" in schema["customer_columns"]
    assert "product_name" in schema["product_columns"]
    assert "order_date" in schema["date_columns"]
    assert "revenue" in schema["monetary_columns"]
    assert schema["rfm_supported"] is True
    assert schema["abc_supported"] is True
    assert schema["kmeans_supported"] is True
    assert schema["suggested_method"] == SegmentationMethod.RFM.value


def test_rfm_customer_segmentation(sales_df):
    result = calculate_rfm_segmentation(
        sales_df,
        entity_col="customer_name",
        date_col="order_date",
        monetary_col="revenue",
    )
    assert result["method"] == "rfm"
    assert result["total_entities"] == 6  # 6 distinct customers
    assert result["total_monetary"] > 0
    assert len(result["segments"]) > 0

    top_segment = result["segments"][0]
    assert top_segment["total_monetary"] > 0
    assert top_segment["percentage_of_monetary"] > 0
    assert "avg_recency_days" in top_segment["profile"]
    assert "avg_frequency" in top_segment["profile"]
    assert len(top_segment["sample_members"]) > 0


def test_kmeans_clustering(sales_df):
    result = calculate_kmeans_segmentation(
        sales_df,
        feature_cols=["revenue", "quantity"],
        entity_col="customer_name",
        k=2,
    )
    assert result["method"] == "kmeans"
    assert result["k"] == 2
    assert result["total_entities"] == 6
    assert len(result["segments"]) == 2
    assert result["silhouette_score"] >= -1.0
    for seg in result["segments"]:
        assert "centroids" in seg["profile"]
        assert "revenue" in seg["profile"]["centroids"]
        assert "quantity" in seg["profile"]["centroids"]


def test_abc_pareto_segmentation(sales_df):
    result = calculate_abc_pareto_segmentation(
        sales_df,
        product_col="product_name",
        monetary_col="revenue",
    )
    assert result["method"] == "abc_pareto"
    assert result["total_products"] == 5
    assert len(result["segments"]) >= 1

    class_a = next((s for s in result["segments"] if "Class A" in s["label"]), None)
    assert class_a is not None
    # Enterprise Suite generates bulk of revenue
    sample_prods = [m["product"] for m in class_a["sample_members"]]
    assert "Enterprise Suite" in sample_prods
    assert class_a["percentage_of_monetary"] >= 50.0


def test_segmentation_suitability_error():
    empty_df = pd.DataFrame({"col_a": [1, 2]})
    with pytest.raises(SegmentationSuitabilityError):
        calculate_rfm_segmentation(empty_df, "cust", "date", "rev")


def test_segmentation_api_endpoints(client: TestClient, session):
    # 1. Register & login
    client.post("/api/v1/auth/register", json={
        "email": "seguser@example.com",
        "password": "securepassword",
        "full_name": "Seg User"
    })
    login_resp = client.post("/api/v1/auth/login", data={
        "username": "seguser@example.com",
        "password": "securepassword"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Workspace
    ws_resp = client.get("/api/v1/workspaces", headers=headers)
    ws_id = ws_resp.json()[0]["id"]

    # 3. Upload dataset
    csv_bytes = (
        b"customer_id,order_date,revenue,quantity,product_name\n"
        b"C1,2026-01-01,100.0,1,Widget A\n"
        b"C2,2026-01-05,200.0,2,Widget B\n"
        b"C1,2026-02-01,500.0,5,Widget A\n"
        b"C3,2026-02-15,50.0,1,Widget C\n"
        b"C4,2026-03-01,150.0,2,Widget B\n"
        b"C1,2026-03-20,600.0,6,Widget A\n"
        b"C2,2026-04-01,250.0,2,Widget B\n"
        b"C5,2026-04-10,30.0,1,Widget C\n"
    )
    files = {"file": ("segment_test.csv", io.BytesIO(csv_bytes), "text/csv")}
    upload_res = client.post(f"/api/v1/workspaces/{ws_id}/datasets", headers=headers, files=files, data={"name": "Segmentation Test"})
    assert upload_res.status_code == 200
    dataset_id = upload_res.json()["id"]

    # 4. Schema endpoint
    schema_res = client.get(f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/segmentation/schema", headers=headers)
    assert schema_res.status_code == 200
    schema_data = schema_res.json()
    assert schema_data["rfm_supported"] is True

    # 5. Run segmentation endpoint (RFM)
    seg_res = client.post(
        f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/segmentation",
        headers=headers,
        json={"method": "rfm"}
    )
    assert seg_res.status_code == 200
    seg_data = seg_res.json()
    assert "run_id" in seg_data
    assert len(seg_data["segments"]) > 0

    # 6. List segments endpoint
    list_res = client.get(f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/segments", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["run_id"] == seg_data["run_id"]
    assert len(list_data["segments"]) == len(seg_data["segments"])
