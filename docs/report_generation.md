# Phase 15 — Business Report Generation & Multi-Format Intelligence Export

## 1. Executive Summary & Objective

Phase 15 implements the **Business Report Generation** system of InsightForge AI. It synthesizes all intelligence layers—deterministic KPIs, dimensional visual distributions, analytical findings, AI insights, out-of-sample backtested forecasts, multi-method anomaly audits, customer/catalog segmentation, and prescriptive recommendations—into boardroom-grade business reports.

The report generator strictly satisfies all governance and compliance guidelines:
- **Zero Hallucination / Unsupported Conclusions**: All mathematical aggregations, confidence intervals, and metrics are deterministically validated with 0 LLM arithmetic.
- **Mandatory Identifications**:
  - **Dataset**: Name, version, and unique dataset identifier.
  - **Reporting Period**: Automatically resolved empirical observation window (e.g. `January 15, 2023 – December 28, 2023`) or `Cross-Sectional Baseline (Snapshot Analysis)` when temporal columns are absent.
  - **Generated Time**: Exact ISO 8601 UTC timestamp and human-formatted UTC date.
  - **Analytical Scope**: Explicit ledger record count, dimensions analyzed, and target metric coverage.
  - **Important Assumptions & Limitations**: Key modeling assumptions (e.g., non-negativity invariants, Pareto concentration, backtested algorithm selection) and operational scope boundaries (e.g., external macroeconomic factors).
- **Multi-Format Export**:
  - **Boardroom HTML (`.html`)**: Self-contained executive HTML document with responsive grid styling, progress bars, card components, and `@media print` CSS for print-to-PDF.
  - **GitHub-Flavored Markdown (`.md`)**: Full structured Markdown for documentation wikis, GitHub PRs, and Slack/Teams digests.
  - **Structured JSON (`.json`)**: Programmatic payload containing raw numerical arrays, confidence bounds, and recommendation objects.
  - **Inline Presentation View (`/view`)**: Dedicated browser display tab rendered directly by the backend or frontend.

---

## 2. Report Synthesizer Architecture

```
 Raw Dataset Ledger
        │
        ▼
 Deterministic Profiling & Invariant Checks
        │
        ├──────────────────────┬──────────────────────┬──────────────────────┐
        ▼                      ▼                      ▼                      ▼
  Core Analytics       Time-Series Model     Anomaly Detection       Segmentation
  (KPIs, Breakdowns,   (Holt-Linear, OLS,    (Isolation Forest,     (RFM, K-Means,
   Fact Extraction)     Moving Average)       Tukey IQR, Z-Score)    ABC Pareto)
        │                      │                      │                      │
        └──────────────────────┼──────────────────────┴──────────────────────┘
                               ▼
                   AI Insight Synthesis
                               │
                               ▼
               Prescriptive Recommendations Engine
                               │
                               ▼
        ┌────────────────────────────────────────────────────────┐
        │       generate_executive_report() Orchestrator         │
        ├────────────────────────────────────────────────────────┤
        │ • Detect Reporting Period & Analytical Scope           │
        │ • Format Header & Compliance Disclosures               │
        │ • Render Markdown (Tables, Progress Bars, Quotes)      │
        │ • Compile Boardroom HTML with Print Stylesheet         │
        │ • Bundle Structured JSON Metadata Payload              │
        └────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
      Markdown (.md)       HTML (.html)       JSON (.json)
```

---

## 3. Mandatory Identification Specifications

Every generated executive report includes standardized header metadata:

| Metadata Field | Extraction Mechanism | Example |
| :--- | :--- | :--- |
| **Dataset** | Dataset entity name and UUID | `Global Retail Transactions (ID: 88e9b75e-944d)` |
| **Reporting Period** | Evaluates datetime series min/max, forecast historical points, or metric time-series | `January 15, 2023 – December 28, 2023` |
| **Generated Time** | UTC clock reading formatted as ISO 8601 & human UTC | `2026-10-20T13:00:00Z` (`October 20, 2026, 13:00 UTC`) |
| **Analytical Scope** | Formatted ledger rows and key dimension lists | `1,250 Transaction Ledger Records \| Dimensions: Region, Category, Channel` |
| **Modeling Assumptions** | Deterministic disclosures of invariant rules, backtest selection, and distribution assumptions | Invariant non-negativity, Holt-Linear RMSE selection, 80/20 Pareto distribution |
| **Scope Limitations** | Explicit operational boundaries and external dynamics | Exogenous macroeconomic dynamics excluded, forecast interval expansion over horizons |

---

## 4. Multi-Layer Report Sections

1. **Header & Context Metadata**: Identifies dataset, reporting period, timestamp, scope, and validation grounding.
2. **Executive Summary**: Synthesized briefing narrative contextualizing top-level performance and trajectory.
3. **Key Performance Indicators (KPIs)**: Deterministic summary cards with operational context (Total Revenue, Order Volume, AOV, Active Entities).
4. **Dimensional Visual Distributions**: ASCII progress bar charts (`make_ascii_bar`) and HTML progress indicators showing category/region volume and share.
5. **AI-Synthesized Business Insights**: Severity-badged narrative findings backed by empirical fact citations.
6. **Forward-Looking Projections**: Time-series projections displaying 80% and 95% confidence intervals alongside empirical out-of-sample RMSE.
7. **Anomaly Detection & Data Integrity**: Audit distinguishing confirmed business invariant issues, statistical deviations, and high-value outliers.
8. **Cohort & Catalog Segmentation**: RFM or ABC Pareto distribution tables with member and monetary share percentages.
9. **Strategic Action Matrix**: Prioritized recommendations (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) with quantifiable expected impact and multi-step action plans.
10. **Assumptions & Disclosures**: Complete methodology assumptions and statistical boundary disclosures.

---

## 5. API Endpoints

### 5.1 Generate Business Report
`POST /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/reports`
- **Payload**: `{"title": "Q1 2026 Boardroom Review"}`
- **Response**: Full report object with `status: "ready"`, `content`, and storage identifiers.

### 5.2 Multi-Format Report Download
`GET /api/v1/workspaces/{workspace_id}/reports/{report_id}/download?format={markdown|html|json}`
- **`format=markdown`**: Returns `text/markdown` attachment (`.md`).
- **`format=html`**: Returns `text/html` attachment (`.html`) with embedded styling.
- **`format=json`**: Returns `application/json` attachment (`.json`) with report ID, workspace ID, and raw payload.

### 5.3 Inline Presentation View
`GET /api/v1/workspaces/{workspace_id}/reports/{report_id}/view`
- Returns `text/html` with `Content-Disposition: inline` for immediate boardroom browser display and instant PDF printing.

---

## 6. Multi-Dataset Validation Matrix

The report generation engine was validated against diverse real-world dataset structures:

| Dataset Profile | Characteristics | Validation Outcome |
| :--- | :--- | :--- |
| **Temporal E-Commerce** | Contains date, customer ID, revenue, category, quantity | Detects exact empirical date range, builds Holt-Linear forecast with confidence bands, generates RFM segmentation. |
| **Cross-Sectional Dataset** | No temporal columns (e.g. Employee HR compensation, survey records) | Gracefully falls back to `Cross-Sectional Baseline (Snapshot Analysis)`, suppresses forecast safely, retains dimensional analysis and recommendations. |
| **Anomaly-Free Dataset** | Clean ledger with zero invariant violations or outliers | Confirms data integrity with explicit positive disclosure ("No statistical anomalies detected") without crashing. |
| **Single-Metric Dataset** | Single numeric sensor telemetry stream without dimensions | Evaluates univariate distribution, flags statistical outliers, and compiles complete report without division errors. |
