import io
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.db.enums import Severity, AnomalyStatus
from app.engine.ml.anomaly import (
    detect_zscore_anomalies,
    detect_iqr_anomalies,
    detect_isolation_forest_anomalies,
    run_comprehensive_anomaly_detection,
    DetectionMethod,
    AnomalyNature,
)


@pytest.fixture
def transactions_df():
    # 20 standard transactions (~$100 - $300), 1 extreme high VIP transaction ($4,500), 1 negative refund (-$250)
    revs = [120, 150, 180, 200, 210, 140, 160, 190, 220, 250, 130, 170, 195, 230, 185, 215, 175, 165, 190, 205, 4500, -250]
    qtys = [1, 2, 2, 3, 2, 1, 2, 2, 3, 3, 1, 2, 2, 3, 2, 3, 2, 2, 2, 3, 50, 1]
    return pd.DataFrame({
        "revenue": revs,
        "quantity": qtys,
        "product_category": ["Retail"] * len(revs),
        "region": ["North"] * len(revs),
    })


def test_zscore_anomaly_detection(transactions_df):
    findings = detect_zscore_anomalies(transactions_df, "revenue", threshold=2.0)
    assert len(findings) >= 2

    # VIP transaction ($4,500)
    vip = next(f for f in findings if f.observed_value == 4500.0)
    assert vip.nature == AnomalyNature.STATISTICAL_OUTLIER
    assert "High-Value Transaction Spike" in vip.title
    assert "rather than an operational failure" in vip.explanation

    # Negative refund (-$250)
    negative = next(f for f in findings if f.observed_value == -250.0)
    assert negative.nature == AnomalyNature.CONFIRMED_BUSINESS_ISSUE
    assert negative.severity == Severity.CRITICAL
    assert "Negative Revenue" in negative.title


def test_iqr_anomaly_detection(transactions_df):
    findings = detect_iqr_anomalies(transactions_df, "revenue", multiplier=1.5)
    assert len(findings) >= 1
    # $4500 is way above upper fence
    high_outlier = next(f for f in findings if f.observed_value == 4500.0)
    assert high_outlier.method == DetectionMethod.IQR
    assert high_outlier.details["iqr"] > 0
    assert high_outlier.details["upper_fence"] < 4500.0


def test_isolation_forest_detection(transactions_df):
    findings = detect_isolation_forest_anomalies(transactions_df, ["revenue", "quantity"])
    assert len(findings) > 0
    assert findings[0].method == DetectionMethod.ISOLATION_FOREST
    assert "multivariate_features" in findings[0].details


def test_comprehensive_anomaly_orchestration(transactions_df):
    res = run_comprehensive_anomaly_detection(transactions_df, target_column="revenue")
    assert res["total_anomalies"] > 0
    assert "summary_metrics" in res
    assert res["summary_metrics"]["statistical_outliers"] > 0
    assert res["summary_metrics"]["confirmed_issues"] > 0
    assert len(res["assumptions"]) > 0
    assert len(res["limitations"]) > 0


def test_anomaly_api_endpoints(client: TestClient, session):
    # 1. Register & login
    client.post("/api/v1/auth/register", json={
        "email": "anomuser@example.com",
        "password": "securepassword",
        "full_name": "Anomaly User"
    })
    login_resp = client.post("/api/v1/auth/login", data={
        "username": "anomuser@example.com",
        "password": "securepassword"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get workspace
    ws_resp = client.get("/api/v1/workspaces", headers=headers)
    ws_id = ws_resp.json()[0]["id"]

    # 3. Upload CSV with outliers
    csv_bytes = (
        b"revenue,quantity\n"
        b"100.0,1\n110.0,1\n105.0,1\n95.0,1\n120.0,2\n"
        b"102.0,1\n98.0,1\n115.0,2\n108.0,1\n100.0,1\n"
        b"5000.0,50\n-100.0,1\n"
    )
    files = {"file": ("anom_data.csv", io.BytesIO(csv_bytes), "text/csv")}
    upload_res = client.post(f"/api/v1/workspaces/{ws_id}/datasets", headers=headers, files=files, data={"name": "Anom Test"})
    assert upload_res.status_code == 200
    dataset_id = upload_res.json()["id"]

    # 4. Trigger anomaly detection endpoint
    detect_res = client.post(
        f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/anomalies/detect",
        headers=headers,
        json={"target_column": "revenue"}
    )
    assert detect_res.status_code == 200
    det_data = detect_res.json()
    assert det_data["total_anomalies"] > 0
    anomaly_id = det_data["anomalies"][0]["id"]

    # 5. List anomalies endpoint
    list_res = client.get(f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/anomalies", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert items[0]["id"] == anomaly_id
    assert items[0]["status"] == "open"

    # 6. Update anomaly status endpoint (reviewed)
    patch_res = client.patch(
        f"/api/v1/workspaces/{ws_id}/anomalies/{anomaly_id}",
        headers=headers,
        json={"status": "reviewed"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "reviewed"

    # Verify status changed in list
    list_res2 = client.get(f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/anomalies", headers=headers)
    updated_item = next(i for i in list_res2.json() if i["id"] == anomaly_id)
    assert updated_item["status"] == "reviewed"
