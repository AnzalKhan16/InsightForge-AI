# Phase 10 — Natural Language Analytics Architecture

## 1. Overview & Core Philosophy

The Natural Language (NL) Analytics system in InsightForge AI allows business users and executives to query their datasets conversationally using plain English questions, such as:

- *"What was our revenue last month?"*
- *"Which products generated the most revenue?"*
- *"Which region grew the fastest?"*
- *"Why did revenue decrease?"*
- *"What were our top customers?"*
- *"Compare this quarter with the previous quarter."*

### The Anti-Hallucination Guardrail

A fundamental failure mode of naive AI analytics is allowing LLMs to directly execute generated SQL or arbitrary Python code against databases. This invites SQL injection, computational exhaustion, and numerical hallucination.

**InsightForge AI enforces a deterministic execution sandbox:**
```
User Natural Language Question
          │
          ▼
Semantic Intent & Query Plan Parser (Schema-Constrained)
          │
          ▼
Query Validation & Column Whitelist Guardrail
          │
          ▼
Deterministic Query Engine (Pandas Vectorized Aggregations)
          │
          ▼
Structured Evidence Table & Verification
          │
          ▼
Grounded Business Explanation & Recommended Visualization
```

The LLM is **never permitted** to perform numerical arithmetic or execute unvalidated queries. All numbers, rankings, growth rates, variance deltas, and contribution shares are calculated deterministically.

---

## 2. Query Lifecycle & Operations

The engine supports five primary business query operations defined in `NLQueryOperation`:

1. **`METRIC_SUMMARY`**:
   - Calculates totals, means, transaction counts, minima, and maxima.
   - Outputs executive summary KPI cards.
2. **`RANKING`**:
   - Aggregates metrics grouped by any categorical dimension (products, categories, regions, customers).
   - Computes segment portfolio share (`share_pct`), order counts, and identifies the market leader.
3. **`TIME_TREND`**:
   - Groups metrics across temporal periods (daily, monthly, quarterly).
   - Computes velocity, percentage change between start and end horizons, and renders timeline charts.
4. **`PERIOD_COMPARISON`**:
   - Evaluates period-over-period dynamics (Quarter-over-Quarter, Month-over-Month).
   - Computes net variance deltas and rates of growth across dimensions (e.g., fastest-growing region).
5. **`ROOT_CAUSE`**:
   - Decomposes topline changes (decreases or increases) across secondary dimensions.
   - Calculates exact attribution: which category or segment suffered the largest drop and what percentage of total drag it represented.

---

## 3. Strict Security & Guardrails

### 3.1 Workspace Isolation
- Query execution occurs strictly within the scope of authenticated workspaces:
  `_check_workspace_access(session, workspace_id, current_user.id)`
- Datasets are bound to tenant workspaces and verified through tenant-scoped repositories.

### 3.2 Schema Whitelisting & Column Mapping
- Columns requested in natural language are resolved against the dataset's detected schema:
  - Numerical metrics whitelist (`metrics`)
  - Categorical dimensions whitelist (`dimensions`)
  - Temporal date columns whitelist (`date_columns`)
- Attempted injection of non-existent or disallowed columns falls back to deterministic defaults or is safely rejected.

### 3.3 Resource Limits
- Processing limits: Results are capped (e.g., top 10/20 segments, max 50).
- Memory & timeouts: Operations run on vectorized pandas operations within constrained memory buffers.

---

## 4. API Specification

### Endpoint: `POST /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/nl-query`

**Request Payload:**
```json
{
  "question": "Which products generated the most revenue?"
}
```

**Response Payload:**
```json
{
  "question": "Which products generated the most revenue?",
  "operation": "ranking",
  "interpreted_intent": "Operation: Ranking on metric 'revenue' grouped by 'product_category'",
  "answer_markdown": "### 🏆 Top 3 Product Category by Revenue\n...",
  "data": [
    {
      "product_category": "Electronics",
      "total_value": 7500.0,
      "order_count": 6,
      "share_pct": 57.87
    }
  ],
  "columns": ["product_category", "total_value", "order_count", "share_pct"],
  "chart_suggestion": {
    "type": "bar_chart",
    "x_axis": "product_category",
    "y_axis": "total_value",
    "title": "Top Product Category by Revenue",
    "series_name": "Revenue"
  },
  "summary_metrics": {
    "top_segment": "Electronics",
    "top_value": 7500.0,
    "top_share_pct": 57.87,
    "total_portfolio": 12960.0
  },
  "suggested_followups": [
    "Why did Electronics lead performance?",
    "Compare product category growth across quarters",
    "What was the lowest performing product category?"
  ],
  "plan": {
    "operation": "ranking",
    "metric_column": "revenue",
    "dimension_column": "product_category",
    "time_column": "order_date",
    "limit": 10,
    "ascending": false,
    "confidence": 0.92
  }
}
```

---

## 5. UI Integration

The Natural Language interface is embedded directly inside the dataset analytics dashboard:
- Dedicated **"Natural Language Analytics"** tab with conversational prompt bar.
- Pre-populated prompt pills for instant exploration:
  - *Revenue last month*
  - *Top revenue products*
  - *Fastest growing region*
  - *Quarter-over-Quarter comparison*
  - *Why did revenue decrease?*
- Dynamic visualization rendering (Recharts BarChart, LineChart, or KPI cards based on `chart_suggestion`).
- Interactive follow-up question pills allowing conversational deep-dives into data.
