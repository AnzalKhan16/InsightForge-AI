# Phase 14 — Prescriptive Recommendations & Executive Briefing Reports

## 1. Overview & Business Rationale

Operational dashboards often overwhelm leadership with disconnected graphs, anomaly lists, and raw model projections.

Phase 14 delivers the final synthesis layer of InsightForge AI:
1. **Prescriptive Recommendations Engine**: Translates findings from deterministic metrics, AI insights, forecasts, anomalies, and customer/product segments into prioritized, evidence-backed strategic actions.
2. **Automated Executive Briefing Generator**: Compiles boardroom-ready executive briefings featuring KPI summaries, dimensional analyses, forward projections, data integrity audits, segment distributions, and an actionable roadmap in both structured JSON and publishable GitHub-Flavored Markdown.
3. **Artifact Persistence & Export**: Persists briefing records in the database (`Report` model) and stores rendered Markdown and export artifacts in object storage with direct download endpoints.

---

## 2. Prescriptive Recommendation Architecture

Rather than generic boilerplate advice, recommendations are triggered dynamically based on cross-layer empirical evidence:

| Strategic Category | Trigger Conditions | Priority | Example Recommendation |
| :--- | :--- | :---: | :--- |
| **Risk Mitigation** (`risk_mitigation`) | Confirmed business issues (e.g. negative values in non-negative revenue columns). | `CRITICAL` | **Triage Invariant Violations**: Audit payment gateway reversal webhooks for negative transactions. |
| **Customer Retention** (`customer_retention`) | High-value RFM accounts classified as *At Risk*, *Can't Lose Them*, or *Need Attention*. | `HIGH` | **VIP Win-Back Outreach**: Deploy executive outreach to protect historical spend from churn. |
| **Revenue Growth** (`revenue_growth`) | *Champions* or high-momentum cohorts with high frequency and recency. | `HIGH` | **Loyalty Momentum Expansion**: Introduce VIP advisory councils and multi-year enterprise contracts. |
| **Operational Efficiency** (`operational_efficiency`) | Forecast indicating strong forward growth (e.g., > 5% over horizon) or severe transaction troughs. | `HIGH` | **Capacity & Lead Time Scaling**: Increase supplier blanket POs to prevent stockouts during peak volume. |
| **Inventory Optimization** (`inventory_optimization`) | ABC Pareto Class C products with low velocity yet high catalog overhead. | `MEDIUM` | **Long-Tail SKU Rationalization**: Bundle aged Class C items with Class A drivers or switch to make-to-order. |

Every recommendation includes:
- **Title**: Actionable imperative headline.
- **Priority**: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`.
- **Expected Impact**: Direct quantitative estimation (e.g. "Protects $34,500 recurring revenue against churn").
- **Empirical Evidence**: Exact metrics, affected entity counts, or row references.
- **Action Plan**: Ordered list of practical operational execution steps.

---

## 3. Executive Report Generator

The `generate_executive_report` orchestrator builds a cohesive briefing containing:
1. **Header & Metadata**: Dataset name, version identifier, generation timestamp.
2. **Executive Summary**: High-level narrative synthesizing macro performance, operational health, and outlook.
3. **KPI Table**: Headline performance indicators (Total Revenue, Transaction Count, AOV, Active Entities).
4. **Analytical Findings**: Fact-grounded insights and dimensional drivers.
5. **Forward Projections**: Time-series forecast with 80% and 95% confidence bands.
6. **Data Integrity Audit**: Anomaly detection audit separating confirmed issues from non-defective outliers.
7. **Cohort Breakdown**: RFM or ABC Pareto segment distributions with revenue shares.
8. **Action Matrix**: Prioritized matrix of prescriptive recommendations.
9. **Full Markdown**: Formatted GitHub-Flavored Markdown ready for export.

---

## 4. API Endpoints

### 4.1 Synthesize Recommendations
`GET /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/recommendations`
- Dynamically gathers current metrics, forecasts, anomalies, and segments to generate prioritized recommendations.

### 4.2 Generate Executive Briefing Report
`POST /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/reports`
- **Request Body**: `{"title": "Q1 Executive Strategic Briefing"}`
- Generates the report, uploads the markdown file to object storage (`reports/{workspace_id}/{report_id}.md`), and records metadata in the database.

### 4.3 List Reports
`GET /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/reports`
- Returns all generated reports for the dataset.

### 4.4 Get Report Details
`GET /api/v1/workspaces/{workspace_id}/reports/{report_id}`
- Returns full structured report content and markdown text.

### 4.5 Download Report
`GET /api/v1/workspaces/{workspace_id}/reports/{report_id}/download`
- Streams the raw markdown document as an attachment file (`.md`).
