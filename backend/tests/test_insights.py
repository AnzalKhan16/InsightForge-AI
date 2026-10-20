import uuid

import pytest

from app.core.insights import (
    extract_structured_facts,
    generate_deterministic_insights,
    generate_insights_for_analysis,
    generate_llm_insights,
)
from app.db.enums import Severity


@pytest.fixture
def sample_analytics_result():
    return {
        "metrics": {
            "order_count": 250,
            "revenue": 50000.0,
            "profit": 12500.0,
            "customer_count": 180,
            "aov": 200.0,
        },
        "time_series": [
            {"date": "2023-01-01", "value": 10000.0},
            {"date": "2023-02-01", "value": 15000.0},
            {"date": "2023-03-01", "value": 25000.0},
        ],
        "breakdowns": {
            "product_category": [
                {"label": "Electronics", "value": 35000.0},
                {"label": "Books", "value": 10000.0},
                {"label": "Home", "value": 5000.0},
            ]
        },
        "detected_schema": {
            "dimensions": ["product_category"],
            "metrics": ["revenue"],
            "date_columns": ["date"],
        },
    }


def test_fact_extraction(sample_analytics_result):
    facts = extract_structured_facts(sample_analytics_result)

    assert "core_facts" in facts
    assert facts["core_facts"]["order_count"] == 250
    assert facts["core_facts"]["revenue"] == 50000.0
    assert facts["core_facts"]["profit"] == 12500.0
    assert facts["core_facts"]["profit_margin_pct"] == 25.0
    assert facts["core_facts"]["aov"] == 200.0
    assert facts["core_facts"]["orders_per_customer"] == round(250 / 180, 2)

    assert "trend_facts" in facts
    trend = facts["trend_facts"]
    assert trend["periods_count"] == 3
    assert trend["start_value"] == 10000.0
    assert trend["end_value"] == 25000.0
    assert trend["percentage_change"] == 150.0  # +150% growth
    assert trend["trend_direction"] == "growth"
    assert trend["peak_period"]["date"] == "2023-03-01"

    assert "breakdown_facts" in facts
    bdowns = facts["breakdown_facts"]
    assert "product_category" in bdowns
    cat = bdowns["product_category"]
    assert cat["total_value"] == 50000.0
    assert cat["top_segment"]["label"] == "Electronics"
    assert cat["top_segment"]["share_pct"] == 70.0  # 35k / 50k = 70%
    assert cat["concentration_risk"] is True
    assert cat["runner_up"]["label"] == "Books"
    assert cat["lowest_segment"]["label"] == "Home"


def test_deterministic_insights_generation(sample_analytics_result):
    facts = extract_structured_facts(sample_analytics_result)
    insights = generate_deterministic_insights(facts)

    assert len(insights) >= 3

    # Check that each insight has proper categories and non-empty sections
    categories = [i.category for i in insights]
    assert "Topline Momentum" in categories
    assert "Portfolio Concentration" in categories
    assert "Unit Economics & Customers" in categories

    concentration_insight = next(i for i in insights if i.category == "Portfolio Concentration")
    # 70% share should trigger CRITICAL severity
    assert concentration_insight.severity == Severity.CRITICAL
    assert "Electronics" in concentration_insight.title
    assert "70.0%" in concentration_insight.title

    # Check 4-part structure in formatted body
    body = concentration_insight.format_body()
    assert "### 📊 Observed Facts" in body
    assert "### 📐 Calculated Metrics" in body
    assert "### 💡 Strategic Interpretation" in body
    assert "### 🎯 Actionable Recommendations" in body

    # Check evidence traceability
    assert concentration_insight.evidence["top_segment"]["label"] == "Electronics"
    assert concentration_insight.evidence["top_segment_share_pct"] == 70.0


def test_llm_fallback_behavior(sample_analytics_result):
    facts = extract_structured_facts(sample_analytics_result)
    # Without API keys configured, it should seamlessly produce grounded deterministic insights
    insights = generate_llm_insights(facts)
    assert len(insights) >= 3
    assert all(i.title for i in insights)
    assert all(i.interpretation for i in insights)
    assert all(len(i.recommendations) > 0 for i in insights)


def test_generate_insights_for_analysis_models(sample_analytics_result):
    ws_id = uuid.uuid4()
    ver_id = uuid.uuid4()
    an_id = uuid.uuid4()

    db_insights = generate_insights_for_analysis(
        workspace_id=ws_id,
        version_id=ver_id,
        analysis_id=an_id,
        analytics_result=sample_analytics_result,
    )

    assert len(db_insights) >= 3
    for ins in db_insights:
        assert ins.workspace_id == ws_id
        assert ins.version_id == ver_id
        assert ins.analysis_id == an_id
        assert ins.title
        assert ins.body
        assert "evidence" in ins.__dict__ or ins.evidence is not None
        assert "### 📊 Observed Facts" in ins.body
        assert "### 🎯 Actionable Recommendations" in ins.body
