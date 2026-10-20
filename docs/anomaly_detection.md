# Phase 12 — Anomaly Detection Architecture & Business Taxonomy

## 1. Overview & Business Rationale

Operational datasets frequently contain unexpected data points—ranging from high-value VIP transactions and viral promotional sales to corrupted sensor readings, negative invoice reversals, and fraudulent activity.

A major pitfall in enterprise analytics is treating **every deviation as fraud or data corruption**. Doing so creates alarm fatigue for business operators and discounts legitimate, high-performing outliers (such as bulk enterprise contracts).

InsightForge AI introduces a multi-tiered anomaly detection framework combining:
1. **Parametric Statistical Baselines (Z-Score)**
2. **Distribution-Free Non-Parametric Fences (Tukey's IQR)**
3. **Multidimensional Unsupervised Isolation (Isolation Forest)**
4. **Contextual Classification into Explicit Business Taxonomies**

---

## 2. Anomaly Classification Taxonomy

Every detected observation is categorized into one of three distinct business classifications:

| Category | Definition | Business Meaning & Tone | Example |
| :--- | :--- | :--- | :--- |
| **Statistical Outlier** (`statistical_outlier`) | Points situated in extreme statistical tails that remain operationally valid. | Celebratory or informational; not an operational failure or bug. | $4,500 enterprise software license in a dataset with an average of $200. |
| **Detected Anomaly** (`detected_anomaly`) | Substantial deviation from historical moving baselines or multivariate correlations. | Warning / investigative; warrants operator review without pre-judging guilt or defect. | A sudden drop to $0.05 revenue for an item typically retailing at $50.00. |
| **Confirmed Business Issue** (`confirmed_business_issue`) | Violations of domain invariants or logical consistency. | Critical defect / alert; immediate data pipeline or accounting triage required. | Negative transaction revenue (-$250) in a non-negative sales ledger. |

---

## 3. Detection Algorithms

### 3.1 Z-Score / Standard Deviation Bounds (`ZSCORE`)
Parametric evaluation assuming an underlying Gaussian distribution:
$$z = \frac{x_i - \mu}{\sigma}$$

- **Threshold**: Configurable, default $|z| > 2.5$ or $|z| > 3.0$.
- **Guardrail**: If the target column is a known non-negative business metric (revenue, price, units) and negative values occur, they are immediately prioritized as `CONFIRMED_BUSINESS_ISSUE` even if high-variance outliers skew the standard deviation $\sigma$.

### 3.2 Tukey's Interquartile Range Fences (`IQR`)
Distribution-free, non-parametric detection robust against skewed operational data:
$$\text{IQR} = Q_3 - Q_1$$
$$\text{Lower Fence} = Q_1 - 1.5 \times \text{IQR}, \quad \text{Upper Fence} = Q_3 + 1.5 \times \text{IQR}$$

- Avoids the distortion caused by extreme outliers on the sample mean and variance.
- Computes deviation excess or deficit relative to quartile spreads.

### 3.3 Isolation Forest (`ISOLATION_FOREST`)
Unsupervised multidimensional tree ensemble via `scikit-learn`:
- Randomly partitions feature space to isolate observations.
- Points requiring fewer tree splits are structurally isolated and assigned a higher anomaly score $s \in [0.5, 1.0]$.
- Evaluates co-occurrence across multiple numeric dimensions (e.g., abnormally high quantity paired with abnormally low revenue).

---

## 4. API Endpoints

### 4.1 Trigger Detection
`POST /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/anomalies/detect`
- **Payload**:
  ```json
  {
    "target_column": "revenue",
    "method": "zscore" // optional: "zscore", "iqr", "isolation_forest", or null for comprehensive
  }
  ```
- **Returns**: Total count, structured anomaly findings, summary counts by nature, and operational limitations.
- **Persistence**: Automatically stores findings into the `anomalies` table tied to the dataset version.

### 4.2 List Anomalies
`GET /api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/anomalies`
- Retrieves all detected anomalies sorted by anomaly score descending.

### 4.3 Update Status (Triage)
`PATCH /api/v1/workspaces/{workspace_id}/anomalies/{anomaly_id}`
- **Payload**: `{"status": "reviewed"}` or `{"status": "dismissed"}`
- Allows operators to track resolution without modifying original raw data.

---

## 5. Assumptions & Limitations

1. **Numeric Feature Requirement**: Statistical and tree-based detection require numeric columns. Identifier columns (`id`, `user_id`) are excluded from metric calculations.
2. **Sample Size**: Datasets with fewer than 5 rows cannot compute reliable standard deviations or quartiles; Isolation Forest requires at least 10 rows.
3. **No Automatic Fraud Accusation**: All explanations provide neutral, context-rich statements explaining *why* the data point differs mathematically from typical patterns.
