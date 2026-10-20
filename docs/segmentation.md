# Phase 13 — Customer & Product Segmentation Architecture

## 1. Overview & Business Rationale

To drive targeted growth, businesses must understand the structural composition of their customer base and product catalog.

InsightForge AI implements a multi-model segmentation suite:
1. **RFM (Recency, Frequency, Monetary) Customer Segmentation**: Pinpoints behavioral lifecycle stages (Champions, Loyalists, At Risk, Can't Lose Them, Dormant).
2. **K-Means Multidimensional Clustering**: Identifies latent patterns across multiple continuous feature dimensions with automated $k$ optimization via Silhouette Score analysis.
3. **ABC / Pareto Product Catalog Analysis**: Decomposes catalog revenue into vital core drivers (Class A: top 80%), mid-tier contributors (Class B: next 15%), and long-tail items (Class C: final 5%).

---

## 2. Segmentation Methodologies

### 2.1 RFM (Recency, Frequency, Monetary) Analysis
Evaluates customer value along three empirical behavioral vectors:
- **Recency ($R$)**: Elapsed calendar days between an entity's most recent transaction and the reference date ($t_{\text{ref}} = \max(\text{Date}) + 1\text{ day}$). Lower days indicate higher engagement.
- **Frequency ($F$)**: Total number of distinct orders or transactions attributable to the entity.
- **Monetary ($M$)**: Cumulative historical gross invoiced revenue or spend.

#### Tie-Resistant Percentile Scoring
Rather than rigid equal-width bins which fail on skewed transactional ledgers, scores $1 \dots 5$ are computed using rank percentiles:
$$s_R = \lceil \text{Rank}_{\text{desc}}(R) \times 5 \rceil \in [1, 5]$$
$$s_F = \lceil \text{Rank}_{\text{asc}}(F) \times 5 \rceil \in [1, 5]$$
$$s_M = \lceil \text{Rank}_{\text{asc}}(M) \times 5 \rceil \in [1, 5]$$

#### Deterministic Tier Mapping
- **Champions** ($R \ge 4, F \ge 4, M \ge 4$): Highest spenders, buy recently and frequently.
- **Loyal Customers** ($R \ge 3, F \ge 3$): Consistent recurring buyers responsive to cross-selling.
- **Potential Loyalists** ($R \ge 4, F \le 2$): High upside recent buyers needing habit-building touchpoints.
- **Recent Customers** ($R \ge 4, F = 1$): First-time buyers requiring onboarding and reassurance.
- **Promising** ($R = 3, F \le 2$): Moderate engagement; targets for re-engagement nurture.
- **Need Attention** ($R \approx 2-3, F \ge 2, M \ge 3$): Above-average spenders beginning to slip.
- **At Risk** ($R \le 2, F \ge 3, M \ge 3$): Formerly active high-value spenders slipping into churn.
- **Can't Lose Them** ($R = 1, F \ge 4, M \ge 4$): Past VIP accounts now inactive; requires executive intervention.
- **Hibernating** ($R \le 2, F \le 2, M \le 2$): Low value, low activity.
- **Lost** ($R = 1, F = 1, M = 1$): Churned accounts.

---

### 2.2 K-Means Clustering with Silhouette Score Validation
- **Feature Scaling**: Numerical dimensions are standardized using `StandardScaler` to equalize variance across dissimilar units (e.g. currency vs unit quantity).
- **Optimal $k$ Selection**: If $k$ is not explicitly specified, candidate clusters $k \in [2, \min(6, N - 1)]$ are evaluated via **Silhouette Score**:
  $$s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}$$
  where $a(i)$ is mean intra-cluster distance and $b(i)$ is mean nearest-cluster distance.
- **Centroid Profiling**: Evaluates cluster means against global dataset baselines ($\Delta\%$) to derive explainable business labels (e.g., "High-Value Growth Drivers", "High-Volume / Velocity", "Low-Engagement Long-Tail").

---

### 2.3 ABC / Pareto Product & Catalog Segmentation
Sorts catalog items descending by total revenue and computes cumulative revenue shares:
- **Class A (Top 80% Cumulative Revenue)**: The core revenue engines. Inventory availability, supplier agreements, and fulfillment quality must be protected.
- **Class B (Next 15% Cumulative Revenue, 80%–95%)**: Consistent secondary offerings. Standard automated reorder points and moderate safety stock.
- **Class C (Final 5% Cumulative Revenue, 95%–100%)**: Long-tail catalog. Review carrying costs, prune unprofitable SKUs, or bundle with Class A drivers.

---

## 3. API Endpoints

### 3.1 Schema Detection
`GET /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/segmentation/schema`
- Returns detected candidate entity columns, date columns, monetary columns, and suitability flags (`rfm_supported`, `abc_supported`, `kmeans_supported`).

### 3.2 Execute Segmentation Run
`POST /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/segmentation`
- **Request Body**:
  ```json
  {
    "method": "auto", // "rfm", "kmeans", "abc_pareto", or "auto"
    "entity_column": "customer_id", // optional override
    "date_column": "order_date", // optional override
    "monetary_column": "revenue", // optional override
    "feature_columns": ["revenue", "quantity"], // for kmeans
    "k": 3 // for kmeans
  }
  ```
- **Returns**: `run_id`, segments with profiles, contribution percentages, recommendations, and sample member entities.
- **Persistence**: Persists records into the `segments` database table grouped by `run_id`.

### 3.3 List Segments
`GET /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/segments`
- Retrieves the latest run's segment definitions, profiles, and recommendations.

---

## 4. Assumptions & Limitations

1. **Entity Identification**: RFM and ABC analysis require an identifier column (`customer_id`, `product_name`) to group transactions into distinct profiles.
2. **Chronological Requirement**: RFM requires parseable timestamp/date fields.
3. **Deterministic Integrity**: All segment assignments, cluster centroids, and rank boundaries are computed deterministically without generative approximations.
