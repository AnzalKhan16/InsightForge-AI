import pandas as pd
from app.core.analytics import BusinessAnalyticsEngine

def test_analytics_engine():
    # Realistic dataset mock
    df = pd.DataFrame({
        "order_id": [1, 2, 3, 4, 5],
        "customer_email": ["a@b.com", "b@b.com", "a@b.com", "c@b.com", "d@b.com"],
        "order_date": ["2023-01-01", "2023-01-15", "2023-02-05", "2023-02-20", "2023-03-10"],
        "revenue": [100.0, 150.0, 200.0, 50.0, 300.0],
        "product_category": ["Electronics", "Books", "Electronics", "Home", "Books"]
    })

    engine = BusinessAnalyticsEngine(df)
    result = engine.analyze()

    assert "detected_schema" in result
    assert "revenue" in result["detected_schema"]["metrics"]
    assert "product_category" in result["detected_schema"]["dimensions"]
    assert "order_date" in result["detected_schema"]["date_columns"]

    metrics = result["metrics"]
    assert metrics["order_count"] == 5
    assert metrics["revenue"] == 800.0
    assert metrics["customer_count"] == 4
    assert metrics["aov"] == 800.0 / 5

    ts = result["time_series"]
    assert len(ts) == 3
    assert ts[0]["value"] == 250.0  # Jan
    assert ts[1]["value"] == 250.0  # Feb
    assert ts[2]["value"] == 300.0  # Mar

    breakdowns = result["breakdowns"]
    assert "product_category" in breakdowns
    cats = {b["label"]: b["value"] for b in breakdowns["product_category"]}
    assert cats["Electronics"] == 300.0
    assert cats["Books"] == 450.0
    assert cats["Home"] == 50.0
