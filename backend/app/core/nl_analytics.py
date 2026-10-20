"""Natural Language Analytics Engine for InsightForge AI.

Architecture:
  Natural Language Query
  -> Guarded Intent & Analytical Plan Extraction (LLM or deterministic pattern matcher)
  -> Strict Schema Validation & Column Whitelisting (Guards against arbitrary execution)
  -> Deterministic Data Querying & Aggregation via Pandas (NO raw SQL / code execution)
  -> Structured Analytical Results & Evidence Table
  -> Grounded Natural Language Explanation & Chart Recommendation

Guardrails:
  - Zero arbitrary code or SQL execution.
  - All metrics and dimensions strictly validated against dataset schema.
  - Row processing limits and output size clamps.
  - Tenant / workspace isolation enforced at API route boundary.
"""
import json
import logging
from enum import Enum
from typing import Any

import httpx
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class NLQueryOperation(str, Enum):
    METRIC_SUMMARY = "metric_summary"
    RANKING = "ranking"
    TIME_TREND = "time_trend"
    PERIOD_COMPARISON = "period_comparison"
    ROOT_CAUSE = "root_cause"
    GENERAL_QUERY = "general_query"


class NLQueryPlan(BaseModel):
    operation: NLQueryOperation = NLQueryOperation.METRIC_SUMMARY
    metric_column: str | None = None
    dimension_column: str | None = None
    time_column: str | None = None
    time_filter: str | None = None  # e.g., 'last_month', 'this_quarter', 'previous_quarter'
    limit: int = Field(default=10, ge=1, le=50)
    ascending: bool = False
    comparison_type: str | None = None  # e.g., 'quarter_over_quarter', 'month_over_month'
    confidence: float = 1.0


class NLQueryResponse(BaseModel):
    question: str
    operation: NLQueryOperation
    interpreted_intent: str
    answer_markdown: str
    data: list[dict[str, Any]] = Field(default_factory=list)
    columns: list[str] = Field(default_factory=list)
    chart_suggestion: dict[str, Any] | None = None
    summary_metrics: dict[str, Any] = Field(default_factory=dict)
    suggested_followups: list[str] = Field(default_factory=list)
    plan: NLQueryPlan


# Semantic Aliases for Column Resolution
COMMON_METRIC_ALIASES: dict[str, list[str]] = {
    "revenue": ["revenue", "sales", "total_sales", "amount", "total_amount", "price", "total_price", "turnover", "invoiced"],
    "profit": ["profit", "net_profit", "margin", "earnings", "net_margin"],
    "order_count": ["order_id", "order", "orders", "transaction_id", "transaction", "transactions", "count"],
    "cost": ["cost", "cogs", "expense", "expenses"],
    "quantity": ["quantity", "qty", "volume", "units", "items_sold"],
    "discount": ["discount", "discount_amount"],
}

COMMON_DIMENSION_ALIASES: dict[str, list[str]] = {
    "product": ["product", "product_name", "item", "item_name", "product_category", "category", "sku", "service"],
    "category": ["category", "product_category", "department", "segment", "type"],
    "customer": ["customer", "customer_name", "customer_id", "client", "buyer", "user", "account", "company"],
    "region": ["region", "country", "state", "city", "market", "area", "territory", "location", "zone"],
    "channel": ["channel", "acquisition_channel", "medium", "source", "platform"],
}

COMMON_DATE_ALIASES: list[str] = [
    "date", "order_date", "created_at", "timestamp", "transaction_date", "invoice_date", "time", "purchase_date"
]


def resolve_column(query_term: str | None, available_columns: list[str], alias_map: dict[str, list[str]]) -> str | None:
    """Deterministically resolves a natural language term or alias to an actual dataset column."""
    if not available_columns:
        return None

    norm_cols = {c.lower().strip().replace(" ", "_"): c for c in available_columns}

    if query_term:
        term_clean = query_term.lower().strip().replace(" ", "_")
        # Direct exact match
        if term_clean in norm_cols:
            return norm_cols[term_clean]
        
        # Substring match
        for norm_c, orig_c in norm_cols.items():
            if term_clean in norm_c or norm_c in term_clean:
                return orig_c

    # Alias map fallback
    if query_term and query_term.lower() in alias_map:
        candidates = alias_map[query_term.lower()]
        for cand in candidates:
            if cand in norm_cols:
                return norm_cols[cand]
            for norm_c, orig_c in norm_cols.items():
                if cand in norm_c:
                    return orig_c

    return None


def detect_dataset_schema(df: pd.DataFrame) -> dict[str, Any]:
    """Detects available metric, dimension, and date columns."""
    metric_cols = []
    dimension_cols = []
    date_cols = []

    for col in df.columns:
        series = df[col]
        col_lower = str(col).lower()
        if pd.api.types.is_numeric_dtype(series):
            # Exclude id-like numeric columns unless they are clearly amounts
            if "id" in col_lower and "price" not in col_lower and "amount" not in col_lower:
                continue
            metric_cols.append(str(col))
        elif pd.api.types.is_datetime64_any_dtype(series):
            date_cols.append(str(col))
        else:
            # Check if parseable as date
            if any(date_word in col_lower for date_word in ["date", "time", "created_at", "timestamp"]):
                try:
                    pd.to_datetime(series.dropna().head(10))
                    date_cols.append(str(col))
                    continue
                except Exception:
                    pass
            dimension_cols.append(str(col))

    # Priority mapping for primary metric and date
    primary_metric = None
    for target in ["revenue", "sales", "amount", "profit", "price"]:
        resolved = resolve_column(target, metric_cols, COMMON_METRIC_ALIASES)
        if resolved:
            primary_metric = resolved
            break
    if not primary_metric and metric_cols:
        primary_metric = metric_cols[0]

    primary_date = None
    for cand in date_cols:
        primary_date = cand
        break

    return {
        "metrics": metric_cols,
        "dimensions": dimension_cols,
        "date_columns": date_cols,
        "primary_metric": primary_metric,
        "primary_date": primary_date,
    }


def parse_query_plan_deterministic(question: str, schema: dict[str, Any]) -> NLQueryPlan:
    """Deterministic intent recognition and query planner for standard business queries."""
    q = question.lower()
    metrics = schema.get("metrics") or []
    dimensions = schema.get("dimensions") or []
    primary_metric = schema.get("primary_metric")
    primary_date = schema.get("primary_date")

    # 1. Identify Target Metric
    target_metric = None
    for alias_key, aliases in COMMON_METRIC_ALIASES.items():
        if alias_key in q or any(a in q for a in aliases):
            target_metric = resolve_column(alias_key, metrics, COMMON_METRIC_ALIASES)
            if target_metric:
                break
    if not target_metric:
        target_metric = primary_metric

    # 2. Identify Target Dimension
    target_dimension = None
    for alias_key, aliases in COMMON_DIMENSION_ALIASES.items():
        if alias_key in q or any(a in q for a in aliases):
            target_dimension = resolve_column(alias_key, dimensions, COMMON_DIMENSION_ALIASES)
            if target_dimension:
                break
    
    # 3. Check for Root Cause analysis ("why did revenue decrease/drop/fall")
    if any(phrase in q for phrase in ["why did", "reason for", "what caused", "why is", "why was", "root cause"]):
        # Find best dimension to decompose
        if not target_dimension and dimensions:
            target_dimension = dimensions[0]
        return NLQueryPlan(
            operation=NLQueryOperation.ROOT_CAUSE,
            metric_column=target_metric,
            dimension_column=target_dimension,
            time_column=primary_date,
            confidence=0.9,
        )

    # 4. Check for Period Comparison ("compare this quarter with previous quarter", "quarter over quarter", "month over month")
    if any(phrase in q for phrase in ["compare", "versus", "vs", "quarter over quarter", "month over month", "growth rate", "grew the fastest"]):
        if "fastest" in q or "grew" in q or "fast" in q:
            # Ranking by growth
            if not target_dimension:
                for target in ["region", "product", "category"]:
                    resolved = resolve_column(target, dimensions, COMMON_DIMENSION_ALIASES)
                    if resolved:
                        target_dimension = resolved
                        break
                if not target_dimension and dimensions:
                    target_dimension = dimensions[0]

            return NLQueryPlan(
                operation=NLQueryOperation.PERIOD_COMPARISON,
                metric_column=target_metric,
                dimension_column=target_dimension,
                time_column=primary_date,
                comparison_type="growth_by_dimension",
                confidence=0.9,
            )
        
        comp_type = "quarter_over_quarter" if "quarter" in q else "month_over_month"
        return NLQueryPlan(
            operation=NLQueryOperation.PERIOD_COMPARISON,
            metric_column=target_metric,
            dimension_column=target_dimension,
            time_column=primary_date,
            comparison_type=comp_type,
            confidence=0.95,
        )

    # 5. Check for Rankings ("which products generated the most revenue", "top customers", "best performing")
    if any(phrase in q for phrase in ["top", "most", "highest", "best", "which", "leaders", "lowest", "bottom", "worst"]):
        if not target_dimension:
            for target in ["product", "customer", "category", "region"]:
                resolved = resolve_column(target, dimensions, COMMON_DIMENSION_ALIASES)
                if resolved:
                    target_dimension = resolved
                    break
            if not target_dimension and dimensions:
                target_dimension = dimensions[0]

        is_bottom = any(word in q for word in ["lowest", "bottom", "worst", "least"])
        limit = 5 if ("5" in q or "five" in q) else 10
        return NLQueryPlan(
            operation=NLQueryOperation.RANKING,
            metric_column=target_metric,
            dimension_column=target_dimension,
            time_column=primary_date,
            limit=limit,
            ascending=is_bottom,
            confidence=0.92,
        )

    # 6. Check for Time Trends ("over time", "monthly trend", "daily", "timeline")
    if any(word in q for word in ["trend", "over time", "timeline", "monthly", "weekly", "history", "trajectory"]):
        return NLQueryPlan(
            operation=NLQueryOperation.TIME_TREND,
            metric_column=target_metric,
            time_column=primary_date,
            confidence=0.88,
        )

    # 7. Default to Metric Summary ("what was our revenue", "total sales", "how much")
    time_filter = None
    if "last month" in q:
        time_filter = "last_month"
    elif "this quarter" in q:
        time_filter = "this_quarter"
    elif "last quarter" in q:
        time_filter = "previous_quarter"
    elif "this year" in q:
        time_filter = "this_year"

    return NLQueryPlan(
        operation=NLQueryOperation.METRIC_SUMMARY,
        metric_column=target_metric,
        dimension_column=target_dimension,
        time_column=primary_date,
        time_filter=time_filter,
        confidence=0.85,
    )


def parse_query_plan_llm(question: str, schema: dict[str, Any]) -> NLQueryPlan:
    """Uses LLM to understand nuance in question, mapped strictly to validated schema columns."""
    settings = get_settings()
    if not settings.openai_api_key:
        return parse_query_plan_deterministic(question, schema)

    prompt = (
        "You are an analytical query parser. Extract an analytical query plan from the user's business question.\n"
        f"AVAILABLE SCHEMA:\n"
        f"- Metrics (numerical): {schema.get('metrics', [])}\n"
        f"- Dimensions (categorical): {schema.get('dimensions', [])}\n"
        f"- Date Columns: {schema.get('date_columns', [])}\n\n"
        "ALLOWED OPERATIONS: 'metric_summary', 'ranking', 'time_trend', 'period_comparison', 'root_cause'\n\n"
        f"USER QUESTION: \"{question}\"\n\n"
        "Return ONLY a JSON object with:\n"
        "{\n"
        "  \"operation\": \"...\",\n"
        "  \"metric_column\": \"exact column name from metrics or null\",\n"
        "  \"dimension_column\": \"exact column name from dimensions or null\",\n"
        "  \"time_column\": \"exact column name from date_columns or null\",\n"
        "  \"time_filter\": \"last_month | this_quarter | previous_quarter | null\",\n"
        "  \"comparison_type\": \"quarter_over_quarter | month_over_month | growth_by_dimension | null\",\n"
        "  \"limit\": 10,\n"
        "  \"ascending\": false\n"
        "}"
    )

    try:
        client = httpx.Client(timeout=15.0)
        url = f"{settings.openai_api_base.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.openai_model,
            "messages": [
                {"role": "system", "content": "You are a precise analytics schema parser. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.0,
        }
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        
        # Guardrail: Verify column names match schema
        metric = data.get("metric_column")
        if metric and metric not in schema.get("metrics", []):
            metric = resolve_column(metric, schema.get("metrics", []), COMMON_METRIC_ALIASES)
        dimension = data.get("dimension_column")
        if dimension and dimension not in schema.get("dimensions", []):
            dimension = resolve_column(dimension, schema.get("dimensions", []), COMMON_DIMENSION_ALIASES)
        time_col = data.get("time_column")
        if time_col and time_col not in schema.get("date_columns", []):
            time_col = schema.get("primary_date")

        op_str = data.get("operation", "metric_summary")
        try:
            op = NLQueryOperation(op_str)
        except Exception:
            op = NLQueryOperation.METRIC_SUMMARY

        return NLQueryPlan(
            operation=op,
            metric_column=metric or schema.get("primary_metric"),
            dimension_column=dimension,
            time_column=time_col,
            time_filter=data.get("time_filter"),
            comparison_type=data.get("comparison_type"),
            limit=min(max(int(data.get("limit") or 10), 1), 50),
            ascending=bool(data.get("ascending", False)),
            confidence=0.98,
        )
    except Exception as e:
        logger.warning(f"LLM query plan extraction failed ({e}), falling back to deterministic parser")
        return parse_query_plan_deterministic(question, schema)


def execute_deterministic_plan(df: pd.DataFrame, plan: NLQueryPlan, schema: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str], dict[str, Any], str, dict[str, Any] | None, list[str]]:
    """Executes the validated analytical plan strictly using deterministic operations."""
    working_df = df.copy()
    metric = plan.metric_column or schema.get("primary_metric")
    dimension = plan.dimension_column
    time_col = plan.time_column or schema.get("primary_date")

    # Clean dates if time_col present
    if time_col and time_col in working_df.columns:
        working_df[time_col] = pd.to_datetime(working_df[time_col], errors="coerce")
        working_df = working_df.dropna(subset=[time_col])

    # 1. Operation: METRIC_SUMMARY
    if plan.operation == NLQueryOperation.METRIC_SUMMARY:
        if not metric or metric not in working_df.columns:
            # Row count summary
            total_rows = len(working_df)
            answer = f"The dataset contains a total of **{total_rows:,}** recorded entries."
            return (
                [{"metric": "Total Records", "value": total_rows}],
                ["metric", "value"],
                {"total_records": total_rows},
                answer,
                {"type": "metric_card", "title": "Total Records", "primary_metric": total_rows},
                ["Which products are most popular?", "Show monthly transaction volume", "Break down by region"]
            )

        val_series = pd.to_numeric(working_df[metric], errors="coerce").dropna()
        total_val = float(val_series.sum())
        avg_val = float(val_series.mean())
        count_val = int(val_series.count())
        min_val = float(val_series.min()) if count_val > 0 else 0.0
        max_val = float(val_series.max()) if count_val > 0 else 0.0

        data = [
            {"metric": "Total " + metric.replace("_", " ").title(), "value": round(total_val, 2)},
            {"metric": "Average (Mean)", "value": round(avg_val, 2)},
            {"metric": "Transaction Count", "value": count_val},
            {"metric": "Minimum", "value": round(min_val, 2)},
            {"metric": "Maximum", "value": round(max_val, 2)},
        ]
        columns = ["metric", "value"]
        summary = {
            "total": total_val,
            "average": avg_val,
            "count": count_val,
            "min": min_val,
            "max": max_val,
        }
        metric_label = metric.replace("_", " ").title()
        answer = (
            f"### 📊 {metric_label} Summary\n\n"
            f"- **Total {metric_label}:** ${total_val:,.2f} across {count_val:,} records.\n"
            f"- **Average per record:** ${avg_val:,.2f}.\n"
            f"- **Range:** ${min_val:,.2f} (lowest) to ${max_val:,.2f} (highest).\n"
        )
        chart = {
            "type": "metric_card",
            "title": f"Total {metric_label}",
            "primary_metric": f"${total_val:,.2f}",
            "secondary_metric": f"Avg: ${avg_val:,.2f} | Count: {count_val:,}"
        }
        followups = [
            f"Which products generated the most {metric.replace('_', ' ')}?",
            f"Show {metric.replace('_', ' ')} trend over time",
            f"Break down {metric.replace('_', ' ')} by region",
        ]
        return data, columns, summary, answer, chart, followups

    # 2. Operation: RANKING
    if plan.operation == NLQueryOperation.RANKING:
        if not dimension or dimension not in working_df.columns:
            dimension = schema.get("dimensions", [None])[0]

        if not dimension:
            # Fallback to metric summary
            plan.operation = NLQueryOperation.METRIC_SUMMARY
            return execute_deterministic_plan(working_df, plan, schema)

        grouped = (
            working_df.groupby(dimension)[metric]
            .agg(["sum", "count", "mean"])
            .reset_index()
        )
        grouped.columns = [dimension, "total_value", "order_count", "average_value"]
        grouped = grouped.sort_values(by="total_value", ascending=plan.ascending)
        
        total_portfolio = grouped["total_value"].sum()
        grouped["share_pct"] = (grouped["total_value"] / total_portfolio * 100).round(2) if total_portfolio > 0 else 0.0

        top_df = grouped.head(plan.limit)
        data = top_df.to_dict(orient="records")
        # Format values for serialization
        for row in data:
            row["total_value"] = round(float(row["total_value"]), 2)
            row["average_value"] = round(float(row["average_value"]), 2)
            row["order_count"] = int(row["order_count"])

        columns = [dimension, "total_value", "order_count", "share_pct"]
        leader = top_df.iloc[0] if len(top_df) > 0 else None
        
        dim_title = dimension.replace("_", " ").title()
        metric_title = metric.replace("_", " ").title()

        answer_lines = [f"### 🏆 Top {len(top_df)} {dim_title} by {metric_title}\n"]
        if leader is not None:
            answer_lines.append(
                f"**{leader[dimension]}** leads the ranking, generating **${float(leader['total_value']):,.2f}** "
                f"({leader['share_pct']}% of total {metric_title.lower()}) across {int(leader['order_count'])} transactions.\n"
            )
        answer_lines.append("| Rank | " + dim_title + " | " + metric_title + " | Share | Transactions |")
        answer_lines.append("| :--- | :--- | :--- | :--- | :--- |")
        for i, row in enumerate(data, 1):
            answer_lines.append(f"| #{i} | **{row[dimension]}** | ${row['total_value']:,.2f} | {row['share_pct']}% | {row['order_count']:,} |")

        answer = "\n".join(answer_lines)
        chart = {
            "type": "bar_chart",
            "x_axis": dimension,
            "y_axis": "total_value",
            "title": f"Top {dim_title} by {metric_title}",
            "series_name": metric_title,
        }
        summary = {
            "top_segment": str(leader[dimension]) if leader is not None else None,
            "top_value": float(leader["total_value"]) if leader is not None else 0.0,
            "top_share_pct": float(leader["share_pct"]) if leader is not None else 0.0,
            "total_portfolio": float(total_portfolio),
        }
        followups = [
            f"Why did {leader[dimension]} lead performance?",
            f"Compare {dim_title.lower()} growth across quarters",
            f"What was the lowest performing {dim_title.lower()}?",
        ]
        return data, columns, summary, answer, chart, followups

    # 3. Operation: TIME_TREND
    if plan.operation == NLQueryOperation.TIME_TREND:
        if not time_col or time_col not in working_df.columns:
            plan.operation = NLQueryOperation.METRIC_SUMMARY
            return execute_deterministic_plan(working_df, plan, schema)

        working_df["period"] = working_df[time_col].dt.to_period("M").astype(str)
        ts = working_df.groupby("period")[metric].agg(["sum", "count"]).reset_index()
        ts.columns = ["period", "total_value", "count"]
        ts = ts.sort_values(by="period")

        data = ts.to_dict(orient="records")
        for row in data:
            row["total_value"] = round(float(row["total_value"]), 2)
            row["count"] = int(row["count"])

        columns = ["period", "total_value", "count"]
        start_pt = data[0] if data else None
        end_pt = data[-1] if data else None

        pct_change = 0.0
        if start_pt and end_pt and start_pt["total_value"] > 0:
            pct_change = round(((end_pt["total_value"] - start_pt["total_value"]) / start_pt["total_value"]) * 100, 2)

        metric_title = metric.replace("_", " ").title()
        answer = (
            f"### 📈 {metric_title} Historical Trend\n\n"
            f"Tracked across **{len(data)} reporting periods** (from {start_pt['period'] if start_pt else 'N/A'} to {end_pt['period'] if end_pt else 'N/A'}).\n"
            f"- **Initial Period ({start_pt['period'] if start_pt else ''}):** ${start_pt['total_value']:,.2f}\n"
            f"- **Latest Period ({end_pt['period'] if end_pt else ''}):** ${end_pt['total_value']:,.2f}\n"
            f"- **Net Trajectory:** {pct_change:+.1f}% over the evaluated window.\n"
        )
        chart = {
            "type": "line_chart",
            "x_axis": "period",
            "y_axis": "total_value",
            "title": f"{metric_title} Over Time",
            "series_name": metric_title,
        }
        summary = {
            "start_period": start_pt["period"] if start_pt else None,
            "end_period": end_pt["period"] if end_pt else None,
            "percentage_change": pct_change,
        }
        followups = [
            f"Why did {metric.replace('_', ' ')} change over time?",
            "Forecast the next 3 months",
            "Check for anomalies in this timeline",
        ]
        return data, columns, summary, answer, chart, followups

    # 4. Operation: PERIOD_COMPARISON & GROWTH
    if plan.operation == NLQueryOperation.PERIOD_COMPARISON:
        if plan.comparison_type == "growth_by_dimension" and dimension and dimension in working_df.columns and time_col:
            # Find earliest half vs latest half or periods
            working_df["period"] = working_df[time_col].dt.to_period("Q").astype(str)
            unique_periods = sorted(working_df["period"].unique())
            if len(unique_periods) >= 2:
                p_prev, p_curr = unique_periods[-2], unique_periods[-1]
                df_prev = working_df[working_df["period"] == p_prev].groupby(dimension)[metric].sum()
                df_curr = working_df[working_df["period"] == p_curr].groupby(dimension)[metric].sum()
                growth_df = pd.DataFrame({"prev": df_prev, "curr": df_curr}).fillna(0)
                growth_df["abs_change"] = growth_df["curr"] - growth_df["prev"]
                growth_df["pct_growth"] = np.where(
                    growth_df["prev"] > 0,
                    ((growth_df["curr"] - growth_df["prev"]) / growth_df["prev"]) * 100,
                    0.0
                ).round(2)
                growth_df = growth_df.sort_values(by="pct_growth", ascending=False).reset_index()

                data = growth_df.head(plan.limit).to_dict(orient="records")
                for row in data:
                    row["prev"] = round(float(row["prev"]), 2)
                    row["curr"] = round(float(row["curr"]), 2)
                    row["abs_change"] = round(float(row["abs_change"]), 2)
                    row["pct_growth"] = round(float(row["pct_growth"]), 2)

                columns = [dimension, "prev", "curr", "abs_change", "pct_growth"]
                fastest = data[0] if data else None

                dim_title = dimension.replace("_", " ").title()
                metric_title = metric.replace("_", " ").title()
                answer = (
                    f"### 🚀 Fastest Growing {dim_title} ({p_prev} vs {p_curr})\n\n"
                    f"**{fastest[dimension] if fastest else 'N/A'}** grew the fastest with **{fastest['pct_growth']:+.1f}%** growth "
                    f"(from ${fastest['prev']:,.2f} to ${fastest['curr']:,.2f}, net delta ${fastest['abs_change']:+,.2f}).\n\n"
                    f"| {dim_title} | Baseline ({p_prev}) | Current ({p_curr}) | Net Delta | Growth Rate |\n"
                    f"| :--- | :--- | :--- | :--- | :--- |\n"
                )
                for row in data:
                    answer += f"| **{row[dimension]}** | ${row['prev']:,.2f} | ${row['curr']:,.2f} | ${row['abs_change']:+,.2f} | **{row['pct_growth']:+.1f}%** |\n"

                chart = {
                    "type": "bar_chart",
                    "x_axis": dimension,
                    "y_axis": "pct_growth",
                    "title": f"{dim_title} Growth Rate (%)",
                    "series_name": "Growth %",
                }
                summary = {"fastest_growing": fastest[dimension] if fastest else None, "max_growth_pct": fastest["pct_growth"] if fastest else 0.0}
                followups = [
                    f"What drove {fastest[dimension]}'s expansion?",
                    "Which category declined the most?",
                    "What is the projected revenue for next quarter?",
                ]
                return data, columns, summary, answer, chart, followups

        # Generic Quarter-over-Quarter or Month-over-Month comparison
        if time_col and time_col in working_df.columns:
            freq = "Q" if plan.comparison_type == "quarter_over_quarter" else "M"
            working_df["period"] = working_df[time_col].dt.to_period(freq).astype(str)
            periods = sorted(working_df["period"].unique())
            if len(periods) >= 2:
                p_prev, p_curr = periods[-2], periods[-1]
                v_prev = float(working_df[working_df["period"] == p_prev][metric].sum())
                v_curr = float(working_df[working_df["period"] == p_curr][metric].sum())
                delta = round(v_curr - v_prev, 2)
                pct = round(((v_curr - v_prev) / v_prev * 100), 2) if v_prev > 0 else 0.0

                data = [
                    {"period": p_prev, "metric_value": round(v_prev, 2), "status": "Previous"},
                    {"period": p_curr, "metric_value": round(v_curr, 2), "status": "Current"},
                ]
                columns = ["period", "metric_value", "status"]
                metric_title = metric.replace("_", " ").title()
                period_label = "Quarter" if freq == "Q" else "Month"

                answer = (
                    f"### ⚖️ {period_label}-over-{period_label} Comparison ({metric_title})\n\n"
                    f"- **{p_prev} (Previous {period_label}):** ${v_prev:,.2f}\n"
                    f"- **{p_curr} (Current {period_label}):** ${v_curr:,.2f}\n"
                    f"- **Net Variance:** ${delta:+,.2f} (**{pct:+.2f}%** change)\n\n"
                    f"{'Growth momentum remains positive.' if delta >= 0 else 'Topline experienced contraction between periods.'}"
                )
                chart = {
                    "type": "comparison_cards",
                    "previous_period": p_prev,
                    "previous_value": f"${v_prev:,.2f}",
                    "current_period": p_curr,
                    "current_value": f"${v_curr:,.2f}",
                    "delta": f"${delta:+,.2f}",
                    "pct_change": f"{pct:+.2f}%",
                }
                summary = {"previous_value": v_prev, "current_value": v_curr, "delta": delta, "pct_change": pct}
                followups = [
                    f"Why did {metric_title.lower()} {'decrease' if delta < 0 else 'increase'}?",
                    f"Which products drove the variance between {p_prev} and {p_curr}?",
                    "Show monthly breakdown",
                ]
                return data, columns, summary, answer, chart, followups

    # 5. Operation: ROOT_CAUSE ("Why did revenue decrease?")
    if plan.operation == NLQueryOperation.ROOT_CAUSE:
        dim = dimension or (schema.get("dimensions", [None])[0])
        if not time_col or not dim or time_col not in working_df.columns or dim not in working_df.columns:
            plan.operation = NLQueryOperation.RANKING
            return execute_deterministic_plan(working_df, plan, schema)

        working_df["period"] = working_df[time_col].dt.to_period("M").astype(str)
        periods = sorted(working_df["period"].unique())
        if len(periods) >= 2:
            p_prev, p_curr = periods[-2], periods[-1]
            tot_prev = float(working_df[working_df["period"] == p_prev][metric].sum())
            tot_curr = float(working_df[working_df["period"] == p_curr][metric].sum())
            net_change = tot_curr - tot_prev

            # Group by dimension
            g_prev = working_df[working_df["period"] == p_prev].groupby(dim)[metric].sum()
            g_curr = working_df[working_df["period"] == p_curr].groupby(dim)[metric].sum()
            decomp = pd.DataFrame({"prev": g_prev, "curr": g_curr}).fillna(0)
            decomp["delta"] = decomp["curr"] - decomp["prev"]
            decomp["abs_delta"] = decomp["delta"].abs()
            decomp = decomp.sort_values(by="delta", ascending=True).reset_index()

            data = decomp.head(plan.limit).to_dict(orient="records")
            for row in data:
                row["prev"] = round(float(row["prev"]), 2)
                row["curr"] = round(float(row["curr"]), 2)
                row["delta"] = round(float(row["delta"]), 2)
                row["contribution_share_pct"] = (
                    round((row["delta"] / net_change) * 100, 1) if net_change != 0 else 0.0
                )

            columns = [dim, "prev", "curr", "delta", "contribution_share_pct"]
            biggest_drop = data[0] if data else None

            dim_title = dim.replace("_", " ").title()
            metric_title = metric.replace("_", " ").title()

            direction = "decreased" if net_change < 0 else "increased"
            answer = (
                f"### 🔍 Root-Cause Analysis: {metric_title} {direction.title()} ({p_prev} ➔ {p_curr})\n\n"
                f"Across the portfolio, total {metric_title.lower()} {direction} by **${abs(net_change):,.2f}** "
                f"({((tot_curr - tot_prev) / tot_prev * 100):+.1f}%) from ${tot_prev:,.2f} to ${tot_curr:,.2f}.\n\n"
                f"**Primary Driver:** Category **'{biggest_drop[dim]}'** accounted for the largest drag, "
                f"falling by **${biggest_drop['delta']:+,.2f}** (from ${biggest_drop['prev']:,.2f} down to ${biggest_drop['curr']:,.2f}).\n\n"
                f"| {dim_title} | Baseline ({p_prev}) | Current ({p_curr}) | Net Variance | Contribution to Delta |\n"
                f"| :--- | :--- | :--- | :--- | :--- |\n"
            )
            for row in data:
                answer += f"| **{row[dim]}** | ${row['prev']:,.2f} | ${row['curr']:,.2f} | **${row['delta']:+,.2f}** | {row['contribution_share_pct']}% |\n"

            chart = {
                "type": "bar_chart",
                "x_axis": dim,
                "y_axis": "delta",
                "title": f"Variance Contribution by {dim_title}",
                "series_name": "Net Variance ($)",
            }
            summary = {
                "primary_driver": biggest_drop[dim] if biggest_drop else None,
                "driver_delta": biggest_drop["delta"] if biggest_drop else 0.0,
                "net_change": net_change,
            }
            followups = [
                f"Why did {biggest_drop[dim]} drop specifically?",
                "What customer accounts stopped purchasing?",
                "Suggest corrective strategies to reverse this drop",
            ]
            return data, columns, summary, answer, chart, followups

    # Default fallback to Ranking or Metric summary
    plan.operation = NLQueryOperation.RANKING
    return execute_deterministic_plan(working_df, plan, schema)


def execute_nl_query(df: pd.DataFrame, question: str) -> NLQueryResponse:
    """End-to-end natural language analytics query runner.
    
    Guaranteed:
      - Validated against schema
      - Zero raw code / SQL execution
      - Strictly deterministic math
      - Return grounded markdown answer, data table, and interactive chart suggestion
    """
    schema = detect_dataset_schema(df)
    plan = parse_query_plan_llm(question, schema)
    
    data, columns, summary, answer, chart, followups = execute_deterministic_plan(df, plan, schema)

    interpreted = f"Operation: {plan.operation.value.title()} on metric '{plan.metric_column}'"
    if plan.dimension_column:
        interpreted += f" grouped by '{plan.dimension_column}'"
    if plan.time_column:
        interpreted += f" across timeline '{plan.time_column}'"

    return NLQueryResponse(
        question=question,
        operation=plan.operation,
        interpreted_intent=interpreted,
        answer_markdown=answer,
        data=data,
        columns=columns,
        chart_suggestion=chart,
        summary_metrics=summary,
        suggested_followups=followups,
        plan=plan,
    )
