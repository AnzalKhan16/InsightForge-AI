import io
import pytest
from fastapi.testclient import TestClient

from app.core.reports import (
    generate_prescriptive_recommendations,
    generate_executive_report,
    RecommendationPriority,
    RecommendationCategory,
)


@pytest.fixture
def mock_analytical_assets():
    metrics = {
        "total_revenue": 154200.0,
        "total_orders": 1250,
        "avg_order_value": 123.36,
        "unique_customers": 420,
    }
    insights = [
        {
            "severity": "warning",
            "title": "Revenue Concentration in Top Product",
            "body": "Top product drives 52% of total sales volume.",
            "evidence": {"observed_facts": ["Product A generates $80,184."]},
        }
    ]
    forecast = {
        "selected_model": "HOLT_LINEAR",
        "horizon": 6,
        "validation_metrics": {"rmse": 1240.50},
        "historical_points": [{"date": "2026-01-01", "value": 20000.0}],
        "forecast_points": [
            {
                "period_index": 1,
                "date": "2026-02-01",
                "forecast": 24000.0,
                "lower_bound_80": 22000.0,
                "upper_bound_80": 26000.0,
                "lower_bound_95": 21000.0,
                "upper_bound_95": 27000.0,
            }
        ],
    }
    anomalies = [
        {
            "nature": "confirmed_business_issue",
            "column_name": "revenue",
            "observed_value": -250.0,
            "expected_value": 120.0,
            "status": "open",
        }
    ]
    segments = {
        "method": "rfm",
        "total_entities": 420,
        "segments": [
            {
                "label": "Champions",
                "subtitle": "High Spenders & Highly Active",
                "member_count": 42,
                "percentage_of_members": 10.0,
                "total_monetary": 82000.0,
                "percentage_of_monetary": 53.2,
            },
            {
                "label": "At Risk",
                "subtitle": "Formerly Active VIP Accounts Slipping",
                "member_count": 25,
                "percentage_of_members": 6.0,
                "total_monetary": 24000.0,
                "percentage_of_monetary": 15.6,
            },
            {
                "label": "Class C (Low Velocity)",
                "subtitle": "Long tail items",
                "member_count": 150,
                "percentage_of_members": 50.0,
                "total_monetary": 3000.0,
                "percentage_of_monetary": 1.9,
            },
        ],
    }
    return metrics, insights, forecast, anomalies, segments


def test_generate_prescriptive_recommendations(mock_analytical_assets):
    metrics, insights, forecast, anomalies, segments = mock_analytical_assets
    recs = generate_prescriptive_recommendations(
        metrics=metrics,
        insights=insights,
        forecast=forecast,
        anomalies=anomalies,
        segments=segments,
    )
    assert len(recs) >= 3

    # Critical invariant triage recommendation
    crit = next((r for r in recs if r["priority"] == RecommendationPriority.CRITICAL), None)
    assert crit is not None
    assert "Invariant Violation" in crit["title"]
    assert crit["category"] == RecommendationCategory.RISK_MITIGATION

    # At risk churn prevention recommendation
    churn_rec = next((r for r in recs if r["category"] == RecommendationCategory.CUSTOMER_RETENTION), None)
    assert churn_rec is not None
    assert "Win-Back" in churn_rec["title"]

    # Champion upsell recommendation
    champ_rec = next((r for r in recs if "Champions" in r["title"] or "Loyalty" in r["title"]), None)
    assert champ_rec is not None


def test_generate_executive_report(mock_analytical_assets):
    metrics, insights, forecast, anomalies, segments = mock_analytical_assets
    report = generate_executive_report(
        dataset_name="Quarterly Financials",
        dataset_id="test-ds-id",
        version_id="test-ver-id",
        metrics=metrics,
        insights=insights,
        forecast=forecast,
        anomalies=anomalies,
        segments=segments,
    )
    assert "Quarterly Financials" in report["title"]
    assert len(report["kpis"]) >= 3
    assert len(report["recommendations"]) >= 3
    assert "# Executive Strategic Briefing: Quarterly Financials" in report["markdown_content"]
    assert "## 1. Executive Summary" in report["markdown_content"]
    assert "## 3. Forward-Looking Projections" in report["markdown_content"]
    assert "## 4. Anomaly Detection & Data Integrity" in report["markdown_content"]
    assert "## 6. Strategic Action Matrix" in report["markdown_content"]


def test_report_and_recommendation_api_endpoints(client: TestClient, session):
    # 1. Register & login
    client.post("/api/v1/auth/register", json={
        "email": "reportuser@example.com",
        "password": "securepassword",
        "full_name": "Report User"
    })
    login_resp = client.post("/api/v1/auth/login", data={
        "username": "reportuser@example.com",
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
        b"C3,2026-02-15,-50.0,1,Widget C\n"
        b"C4,2026-03-01,150.0,2,Widget B\n"
        b"C1,2026-03-20,600.0,6,Widget A\n"
    )
    files = {"file": ("report_test.csv", io.BytesIO(csv_bytes), "text/csv")}
    upload_res = client.post(f"/api/v1/workspaces/{ws_id}/datasets", headers=headers, files=files, data={"name": "Report Test"})
    assert upload_res.status_code == 200
    dataset_id = upload_res.json()["id"]

    # 4. Get Recommendations endpoint
    recs_res = client.get(f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/recommendations", headers=headers)
    assert recs_res.status_code == 200
    recs_data = recs_res.json()
    assert "recommendations" in recs_data
    assert len(recs_data["recommendations"]) > 0

    # 5. Generate Report endpoint
    create_rep_res = client.post(
        f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/reports",
        headers=headers,
        json={"title": "Q1 Executive Performance Review"}
    )
    assert create_rep_res.status_code == 200
    report_data = create_rep_res.json()
    assert report_data["title"] == "Q1 Executive Performance Review"
    assert report_data["status"] == "ready"
    assert "markdown_content" in report_data["content"]
    report_id = report_data["id"]

    # 6. List Reports endpoint
    list_rep_res = client.get(f"/api/v1/workspaces/{ws_id}/datasets/{dataset_id}/reports", headers=headers)
    assert list_rep_res.status_code == 200
    reps = list_rep_res.json()
    assert len(reps) >= 1
    assert reps[0]["id"] == report_id

    # 7. Get Specific Report endpoint
    single_res = client.get(f"/api/v1/workspaces/{ws_id}/reports/{report_id}", headers=headers)
    assert single_res.status_code == 200
    assert single_res.json()["id"] == report_id

    # 8. Download Report Markdown endpoint
    down_res = client.get(f"/api/v1/workspaces/{ws_id}/reports/{report_id}/download", headers=headers)
    assert down_res.status_code == 200
    assert down_res.headers["content-type"].startswith("text/markdown")
    assert b"# Q1 Executive Performance Review" in down_res.content
