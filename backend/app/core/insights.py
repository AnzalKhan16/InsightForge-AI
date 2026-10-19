"""AI & Deterministic Business Insight Engine.

Architecture:
  Raw Dataset / Cleaned Artifact
  -> Deterministic Analytics (BusinessAnalyticsEngine)
  -> Structured Findings (Verified facts & calculated metrics)
  -> AI Interpretation (Grounding prompt / LLM or resilient deterministic generator)
  -> Business Insight (Persisted in PostgreSQL `insights` table)

Constraints:
- The LLM is NEVER responsible for numerical calculations.
- All numbers, sums, ratios, percentages, deltas, and segment distributions are calculated deterministically.
- Full traceability: Every insight contains an `evidence` dictionary linking directly to source facts.
- Explicit 4-part structure for business clarity:
    1. Observed Facts
    2. Calculated Metrics
    3. Strategic Interpretation
    4. Actionable Recommendations
- Graceful degradation: If LLM API call fails or is unconfigured, fallback to high-quality deterministic interpretation.
"""
import json
import logging
import uuid
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.db.enums import InsightSource, Severity
from app.db.models.analytics import Insight

logger = logging.getLogger(__name__)

PROMPT_VERSION = "v1.0"


class InsightPayload(BaseModel):
    title: str
    category: str
    severity: Severity = Severity.INFO
    source: InsightSource = InsightSource.DETERMINISTIC
    observed_facts: List[str] = Field(default_factory=list)
    calculated_metrics: Dict[str, Any] = Field(default_factory=dict)
    interpretation: str
    recommendations: List[str] = Field(default_factory=list)
    evidence: Dict[str, Any] = Field(default_factory=dict)
    model_name: Optional[str] = None
    prompt_version: str = PROMPT_VERSION

    def format_body(self) -> str:
        """Render a standardized 4-part business narrative."""
        sections = []

        if self.observed_facts:
            facts_list = "\n".join(f"- {fact}" for fact in self.observed_facts)
            sections.append(f"### 📊 Observed Facts\n{facts_list}")

        if self.calculated_metrics:
            metrics_list = "\n".join(
                f"- **{k.replace('_', ' ').title()}**: {v if isinstance(v, (int, str)) else f'{v:,.2f}'}"
                for k, v in self.calculated_metrics.items()
            )
            sections.append(f"### 📐 Calculated Metrics\n{metrics_list}")

        if self.interpretation:
            sections.append(f"### 💡 Strategic Interpretation\n{self.interpretation}")

        if self.recommendations:
            rec_list = "\n".join(f"{i+1}. {rec}" for i, rec in enumerate(self.recommendations))
            sections.append(f"### 🎯 Actionable Recommendations\n{rec_list}")

        return "\n\n".join(sections)


def extract_structured_facts(analytics_result: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministically extracts verified facts and pre-computed metrics from analytics output."""
    raw_metrics = analytics_result.get("metrics") or {}
    raw_time_series = analytics_result.get("time_series") or []
    raw_breakdowns = analytics_result.get("breakdowns") or {}

    # 1. Core Metrics & Ratios
    order_count = int(raw_metrics.get("order_count") or 0)
    revenue = float(raw_metrics.get("revenue")) if raw_metrics.get("revenue") is not None else None
    profit = float(raw_metrics.get("profit")) if raw_metrics.get("profit") is not None else None
    customer_count = int(raw_metrics.get("customer_count")) if raw_metrics.get("customer_count") is not None else None
    aov = float(raw_metrics.get("aov")) if raw_metrics.get("aov") is not None else None

    profit_margin_pct = None
    if profit is not None and revenue and revenue > 0:
        profit_margin_pct = round((profit / revenue) * 100, 2)

    orders_per_customer = None
    if customer_count and customer_count > 0 and order_count > 0:
        orders_per_customer = round(order_count / customer_count, 2)

    core_facts = {
        "order_count": order_count,
        "revenue": revenue,
        "profit": profit,
        "customer_count": customer_count,
        "aov": aov,
        "profit_margin_pct": profit_margin_pct,
        "orders_per_customer": orders_per_customer,
    }

    # 2. Time Series & Growth Velocity Facts
    trend_facts = None
    if raw_time_series and len(raw_time_series) >= 2:
        start_pt = raw_time_series[0]
        end_pt = raw_time_series[-1]
        start_val = float(start_pt.get("value") or 0)
        end_val = float(end_pt.get("value") or 0)
        abs_change = round(end_val - start_val, 2)

        pct_change = None
        if start_val > 0:
            pct_change = round(((end_val - start_val) / start_val) * 100, 2)

        sorted_pts = sorted(raw_time_series, key=lambda x: float(x.get("value") or 0), reverse=True)
        peak_pt = sorted_pts[0]
        trough_pt = sorted_pts[-1]

        direction = "stable"
        if pct_change is not None:
            if pct_change > 5.0:
                direction = "growth"
            elif pct_change < -5.0:
                direction = "contraction"

        trend_facts = {
            "periods_count": len(raw_time_series),
            "start_date": start_pt.get("date"),
            "end_date": end_pt.get("date"),
            "start_value": start_val,
            "end_value": end_val,
            "absolute_change": abs_change,
            "percentage_change": pct_change,
            "peak_period": {"date": peak_pt.get("date"), "value": float(peak_pt.get("value") or 0)},
            "trough_period": {"date": trough_pt.get("date"), "value": float(trough_pt.get("value") or 0)},
            "trend_direction": direction,
        }

    # 3. Categorical Breakdowns & Concentration Facts
    breakdown_facts = {}
    for dim_name, items in raw_breakdowns.items():
        if not items:
            continue
        total_dim_value = sum(float(it.get("value") or 0) for it in items)
        if total_dim_value <= 0:
            continue

        sorted_items = sorted(items, key=lambda x: float(x.get("value") or 0), reverse=True)
        top = sorted_items[0]
        top_val = float(top.get("value") or 0)
        top_share = round((top_val / total_dim_value) * 100, 2)

        runner_up = None
        if len(sorted_items) > 1:
            ru = sorted_items[1]
            ru_val = float(ru.get("value") or 0)
            runner_up = {
                "label": str(ru.get("label")),
                "value": ru_val,
                "share_pct": round((ru_val / total_dim_value) * 100, 2),
            }

        lowest = sorted_items[-1]
        lowest_val = float(lowest.get("value") or 0)
        lowest_segment = {
            "label": str(lowest.get("label")),
            "value": lowest_val,
            "share_pct": round((lowest_val / total_dim_value) * 100, 2),
        }

        breakdown_facts[dim_name] = {
            "dimension": dim_name,
            "total_value": round(total_dim_value, 2),
            "segment_count": len(sorted_items),
            "top_segment": {
                "label": str(top.get("label")),
                "value": top_val,
                "share_pct": top_share,
            },
            "runner_up": runner_up,
            "lowest_segment": lowest_segment,
            "top_segment_share_pct": top_share,
            "concentration_risk": top_share >= 50.0,
        }

    return {
        "core_facts": core_facts,
        "trend_facts": trend_facts,
        "breakdown_facts": breakdown_facts,
    }


def generate_deterministic_insights(structured_facts: Dict[str, Any]) -> List[InsightPayload]:
    """Generates rigorous, professional business insights grounded in verified deterministic facts."""
    insights: List[InsightPayload] = []
    core = structured_facts.get("core_facts") or {}
    trend = structured_facts.get("trend_facts")
    breakdowns = structured_facts.get("breakdown_facts") or {}

    # Insight 1: Trajectory & Growth Dynamics
    if trend and trend.get("percentage_change") is not None:
        pct = trend["percentage_change"]
        abs_change = trend["absolute_change"]
        direction = trend["trend_direction"]
        start_d, end_d = trend["start_date"], trend["end_date"]
        start_v, end_v = trend["start_value"], trend["end_value"]
        peak = trend["peak_period"]

        if pct < -15.0:
            severity = Severity.CRITICAL
            title = f"Significant Revenue Contraction ({pct:+.1f}%) Across Reporting Window"
            interp = (
                f"Topline performance experienced an acute decline from {start_v:,.2f} to {end_v:,.2f} between {start_d} and {end_d}. "
                f"Peak volume occurred in {peak['date']} at {peak['value']:,.2f}, followed by a persistent downturn. "
                "This indicates potential market softness, churn acceleration, or seasonal demand drop requiring intervention."
            )
            recs = [
                "Conduct cohort-level churn analysis to isolate whether the contraction is driven by volume drop or deal size shrinkage.",
                "Review promotional and sales pipeline health to re-engage lapsed customer segments.",
                "Implement short-term retention incentives before the next quarterly cycle.",
            ]
        elif pct < 0.0:
            severity = Severity.WARNING
            title = f"Moderate Topline Headwind ({pct:+.1f}%) Detected Over Time"
            interp = (
                f"Metrics trended slightly downward ({abs_change:,.2f} net decrease) from {start_v:,.2f} to {end_v:,.2f}. "
                "While not yet critical, the negative trajectory suggests emerging friction in transaction velocity or category demand."
            )
            recs = [
                "Evaluate marketing channel efficiency to verify if customer acquisition cost is increasing.",
                "Test targeted bundles to protect average basket value during slower periods.",
            ]
        else:
            severity = Severity.INFO
            title = f"Healthy Upward Trajectory: +{pct:.1f}% Growth from {start_d} to {end_d}"
            interp = (
                f"The business demonstrates positive momentum, expanding by {pct:.1f}% ({abs_change:+,.2f}) over the recorded timeline. "
                f"The highest single period was recorded on {peak['date']} with {peak['value']:,.2f} in activity."
            )
            recs = [
                "Double down on the top acquisition channels active during the peak period to sustain compounding gains.",
                "Stress-test fulfillment and operational capacity to ensure customer satisfaction scales with volume.",
            ]

        insights.append(
            InsightPayload(
                title=title,
                category="Topline Momentum",
                severity=severity,
                source=InsightSource.DETERMINISTIC,
                observed_facts=[
                    f"Measured over {trend['periods_count']} reporting periods between {start_d} and {end_d}.",
                    f"Baseline period generated {start_v:,.2f}; final period recorded {end_v:,.2f}.",
                    f"Peak activity achieved on {peak['date']} at {peak['value']:,.2f}.",
                ],
                calculated_metrics={
                    "percentage_growth": f"{pct:+.2f}%",
                    "absolute_change": abs_change,
                    "trend_direction": direction.title(),
                },
                interpretation=interp,
                recommendations=recs,
                evidence=trend,
                model_name="deterministic-rule-v1",
            )
        )

    # Insight 2: Category / Dimension Concentration & Exposure
    if breakdowns:
        # Choose primary dimension with highest total or concentration
        primary_dim = next(iter(breakdowns.values()))
        top = primary_dim["top_segment"]
        total_val = primary_dim["total_value"]
        share = primary_dim["top_segment_share_pct"]
        dim_label = primary_dim["dimension"].replace("_", " ").title()
        ru = primary_dim.get("runner_up")

        if share >= 60.0:
            severity = Severity.CRITICAL
            title = f"Critical Portfolio Concentration: '{top['label']}' Drives {share:.1f}% of {dim_label}"
            interp = (
                f"'{top['label']}' accounts for {top['value']:,.2f} out of {total_val:,.2f} total ({share:.1f}% share). "
                f"The business exhibits severe single-segment reliance. Any supply chain shock, competitive disruption, or demand shift "
                f"affecting '{top['label']}' poses an asymmetric downside risk to total enterprise revenue."
            )
            recs = [
                f"Establish strategic hedging by accelerating product investment and distribution for secondary segments.",
                f"Review supplier/vendor contracts tied to '{top['label']}' to prevent single-point-of-failure exposure.",
                f"Test cross-promotions bundling '{top['label']}' with '{ru['label'] if ru else 'secondary offerings'}' to balance revenue mix.",
            ]
        elif share >= 40.0:
            severity = Severity.WARNING
            title = f"Moderate Portfolio Concentration in '{top['label']}' ({share:.1f}% Share)"
            interp = (
                f"'{top['label']}' is the dominant revenue pillar with {share:.1f}% market share across {primary_dim['segment_count']} categories. "
                "While leadership in this segment provides strong positioning, diversifying the revenue foundation will improve long-term enterprise resilience."
            )
            recs = [
                f"Allocate incremental marketing budget to cultivate underrepresented categories.",
                f"Conduct customer surveys to determine why adoption is concentrated in '{top['label']}'.",
            ]
        else:
            severity = Severity.INFO
            title = f"Well-Diversified Portfolio Across {dim_label} (Leader Holds {share:.1f}%)"
            interp = (
                f"Revenue is healthily distributed across {primary_dim['segment_count']} segments, led by '{top['label']}' at {share:.1f}%. "
                "This diversified footprint shields the business from concentrated vulnerability."
            )
            recs = [
                "Maintain broad category coverage while identifying niche growth sub-segments.",
            ]

        insights.append(
            InsightPayload(
                title=title,
                category="Portfolio Concentration",
                severity=severity,
                source=InsightSource.DETERMINISTIC,
                observed_facts=[
                    f"Detected {primary_dim['segment_count']} distinct segments within dimension '{dim_label}'.",
                    f"Total cumulative value across all segments is {total_val:,.2f}.",
                    f"Top segment '{top['label']}' generated {top['value']:,.2f}.",
                    f"Second highest segment '{ru['label']}' generated {ru['value']:,.2f} ({ru['share_pct']}%)" if ru else "Single dominant segment detected.",
                ],
                calculated_metrics={
                    "top_segment_share_pct": f"{share:.2f}%",
                    "concentration_risk": "High" if share >= 50 else "Moderate" if share >= 35 else "Low",
                    "total_category_value": total_val,
                },
                interpretation=interp,
                recommendations=recs,
                evidence=primary_dim,
                model_name="deterministic-rule-v1",
            )
        )

    # Insight 3: Unit Economics & Transaction Dynamics
    if core.get("order_count", 0) > 0:
        orders = core["order_count"]
        revenue = core.get("revenue")
        customers = core.get("customer_count")
        aov = core.get("aov")
        orders_per_cust = core.get("orders_per_customer")

        observed = [f"Processed {orders:,} total transactions in current dataset."]
        calc = {}

        if revenue is not None:
            observed.append(f"Cumulative revenue reached {revenue:,.2f}.")
        if aov is not None:
            calc["average_order_value"] = f"${aov:,.2f}"
        if customers is not None:
            observed.append(f"Identified {customers:,} unique active customers.")
        if orders_per_cust is not None:
            calc["orders_per_customer"] = orders_per_cust

        if orders_per_cust and orders_per_cust < 1.15 and customers and customers > 20:
            severity = Severity.WARNING
            title = f"Low Repeat Transaction Rate ({orders_per_cust:.2f} Orders/Customer)"
            interp = (
                f"With {customers:,} unique accounts driving {orders:,} transactions, repeat frequency stands at just {orders_per_cust:.2f}. "
                "This indicates that the business is primarily reliant on net-new acquisition rather than recurring lifetime value (LTV). "
                "Customer acquisition costs will erode margins if repeat purchase cadence remains low."
            )
            recs = [
                "Implement automated lifecycle email workflows (e.g. 14-day post-purchase replenishment or cross-sell).",
                "Introduce a tiered loyalty or subscription program to incentivize subsequent purchases.",
                "Survey one-time buyers to diagnose blockers preventing repeat engagement.",
            ]
        elif aov is not None:
            severity = Severity.INFO
            title = f"Unit Economics: Average Order Value Established at ${aov:,.2f}"
            interp = (
                f"Across {orders:,} orders, customer expenditure averages ${aov:,.2f}. "
                "Optimizing checkout basket size through pricing thresholds (e.g. free shipping or bundle tiers) offers a direct lever to lift topline without increasing ad spend."
            )
            recs = [
                f"Set a threshold incentive (e.g. free priority shipping) approximately 20% above current AOV (~${(aov * 1.2):,.2f}).",
                "Introduce checkout upsells for complementary low-friction add-ons.",
            ]
        else:
            severity = Severity.INFO
            title = f"Operational Throughput: {orders:,} Transactions Processed"
            interp = f"The dataset reflects steady operational volume across {orders:,} recorded instances."
            recs = ["Maintain order fulfillment SLA benchmarks to sustain operational reliability."]

        insights.append(
            InsightPayload(
                title=title,
                category="Unit Economics & Customers",
                severity=severity,
                source=InsightSource.DETERMINISTIC,
                observed_facts=observed,
                calculated_metrics=calc,
                interpretation=interp,
                recommendations=recs,
                evidence=core,
                model_name="deterministic-rule-v1",
            )
        )

    # Insight 4: Profitability & Margins (if profit available)
    if core.get("profit") is not None and core.get("profit_margin_pct") is not None:
        margin = core["profit_margin_pct"]
        profit_val = core["profit"]
        rev_val = core.get("revenue") or 0.0

        if margin < 10.0:
            severity = Severity.WARNING
            title = f"Compressed Profit Margin ({margin:.1f}%): Cost Controls Required"
            interp = (
                f"Net profitability is currently {profit_val:,.2f} on revenue of {rev_val:,.2f}, yielding a thin {margin:.1f}% margin. "
                "Any unexpected shipping, COGS, or marketing cost increases could push unit economics into negative territory."
            )
            recs = [
                "Audit vendor and supplier costs to renegotiate volume discount pricing.",
                "Review discounting policies and retire low-margin promotional codes.",
            ]
        else:
            severity = Severity.INFO
            title = f"Healthy Operating Margin ({margin:.1f}%): ${profit_val:,.2f} Net Profit"
            interp = (
                f"The business demonstrates solid capital efficiency with a {margin:.1f}% net margin, providing adequate cash buffer "
                "to reinvest in customer acquisition and product development."
            )
            recs = [
                "Reinvest a fraction of operating profit into high-return experimentation channels.",
            ]

        insights.append(
            InsightPayload(
                title=title,
                category="Profitability & Margins",
                severity=severity,
                source=InsightSource.DETERMINISTIC,
                observed_facts=[
                    f"Total recorded profit: ${profit_val:,.2f}.",
                    f"Total recorded revenue: ${rev_val:,.2f}.",
                ],
                calculated_metrics={
                    "profit_margin": f"{margin:.2f}%",
                    "net_profit": profit_val,
                },
                interpretation=interp,
                recommendations=recs,
                evidence={"profit": profit_val, "revenue": rev_val, "margin_pct": margin},
                model_name="deterministic-rule-v1",
            )
        )

    return insights


def generate_llm_insights(structured_facts: Dict[str, Any]) -> List[InsightPayload]:
    """Generates AI insights using LLM interpreting strictly pre-computed facts.
    
    Falls back gracefully to deterministic generation if keys are absent or API fails.
    """
    settings = get_settings()

    # If no API key configured, use deterministic generation immediately
    if not settings.openai_api_key and not settings.gemini_api_key:
        logger.info("No LLM API key configured; generating deterministic business insights")
        return generate_deterministic_insights(structured_facts)

    prompt = (
        "You are an executive Chief Strategy Officer and Data Insights Analyst.\n"
        "Analyze the following VERIFIED business analytics facts and pre-calculated metrics.\n\n"
        "CRITICAL RULES:\n"
        "1. DO NOT perform basic numerical calculations or invent numbers. Use ONLY the calculated metrics provided below.\n"
        "2. Ground every insight in the provided evidence.\n"
        "3. Provide exactly 3 to 4 executive-grade insights addressing growth, concentration risk, and customer dynamics.\n"
        "4. Format each insight strictly with:\n"
        "   - title: Clear, high-impact business headline\n"
        "   - category: One of 'Topline Momentum', 'Portfolio Concentration', 'Unit Economics', 'Profitability'\n"
        "   - severity: 'info', 'warning', or 'critical'\n"
        "   - observed_facts: list of strings stating raw observations\n"
        "   - calculated_metrics: object with metric name to value\n"
        "   - interpretation: detailed business meaning, strategic risks/opportunities\n"
        "   - recommendations: list of actionable strategic steps\n\n"
        f"STRUCTURED FACTS (VERIFIED):\n{json.dumps(structured_facts, indent=2)}\n\n"
        "OUTPUT FORMAT:\n"
        "Respond ONLY with a valid JSON array of objects matching the schema."
    )

    try:
        # OpenAI or compatible provider
        if settings.openai_api_key:
            client = httpx.Client(timeout=30.0)
            url = f"{settings.openai_api_base.rstrip('/')}/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": settings.openai_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a senior business strategist. You output only valid JSON without markdown wrapping."
                    },
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
            }
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            raw_text = resp.json()["choices"][0]["message"]["content"].strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]
                raw_text = raw_text.strip()
            
            data = json.loads(raw_text)
            llm_insights = []
            for item in data:
                sev_str = item.get("severity", "info").lower()
                sev = Severity.CRITICAL if sev_str == "critical" else (Severity.WARNING if sev_str == "warning" else Severity.INFO)
                
                llm_insights.append(
                    InsightPayload(
                        title=item.get("title", "Business Insight"),
                        category=item.get("category", "General"),
                        severity=sev,
                        source=InsightSource.AI,
                        observed_facts=item.get("observed_facts", []),
                        calculated_metrics=item.get("calculated_metrics", {}),
                        interpretation=item.get("interpretation", ""),
                        recommendations=item.get("recommendations", []),
                        evidence=structured_facts,
                        model_name=settings.openai_model,
                        prompt_version=PROMPT_VERSION,
                    )
                )
            if llm_insights:
                return llm_insights

    except Exception as e:
        logger.warning(f"LLM insight generation failed or timed out ({e}); falling back to deterministic engine.")

    # Graceful fallback
    return generate_deterministic_insights(structured_facts)


def generate_insights_for_analysis(
    workspace_id: uuid.UUID,
    version_id: uuid.UUID,
    analysis_id: Optional[uuid.UUID],
    analytics_result: Dict[str, Any],
) -> List[Insight]:
    """Orchestrates fact extraction, interpretation generation, and creates DB Insight models."""
    facts = extract_structured_facts(analytics_result)
    payloads = generate_llm_insights(facts)

    models: List[Insight] = []
    for p in payloads:
        insight = Insight(
            workspace_id=workspace_id,
            version_id=version_id,
            analysis_id=analysis_id,
            source=p.source,
            severity=p.severity,
            category=p.category,
            title=p.title,
            body=p.format_body(),
            evidence={
                "observed_facts": p.observed_facts,
                "calculated_metrics": p.calculated_metrics,
                "evidence_context": p.evidence,
                "interpretation": p.interpretation,
                "recommendations": p.recommendations,
            },
            model_name=p.model_name,
            prompt_version=p.prompt_version,
        )
        models.append(insight)

    return models
