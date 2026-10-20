# Phase 11 — Time-Series Forecasting Architecture & Methodology

## 1. Overview & Business Context

InsightForge AI introduces deterministic, interpretable time-series forecasting to project forward-looking indicators such as:
- **Revenue & Invoiced Sales**
- **Order Volume & Transaction Throughput**
- **Unit Demand & Sales Quantity**
- **Net Operating Margin & Profit**

Rather than treating forecasting as a black box or ungrounded generative task, InsightForge AI adheres to strict data-suitability guardrails, rigorous mathematical backtesting, and uncertainty modeling.

---

## 2. Temporal Suitability & Frequency Regularization

Before any forecast can be computed, the dataset is evaluated by `detect_temporal_schema()`:
1. **Temporal Column Requirement**: A valid date or timestamp column (`order_date`, `created_at`, `timestamp`) must exist.
2. **Numeric Target Metric**: The target column must be numeric and represent an aggregate business metric.
3. **Contiguous History Constraint**: The series must contain at least **5 distinct historical observations**. If the series contains insufficient points or no temporal column, the engine raises `TimeSeriesSuitabilityError` with a clear user explanation.
4. **Cadence Ingestion**:
   - Spans > 180 days: Grouped at **Monthly Start (`MS`)** cadence.
   - Spans between 45 and 180 days: Grouped at **Weekly (`W-MON`)** cadence.
   - Spans < 45 days: Regularized at **Daily (`D`)** cadence.
   - Flow metrics (revenue, orders) are aggregated via `sum()`. Missing intermediate dates are imputed deterministically with 0.0.

---

## 3. Forecasting Models

The system evaluates three interpretable baseline approaches:

### 3.1 Holt's Linear Exponential Smoothing (`HOLT_LINEAR`)
Models both current baseline level and additive trend over time:
$$\ell_t = \alpha y_t + (1 - \alpha)(\ell_{t-1} + b_{t-1})$$
$$b_t = \beta (\ell_t - \ell_{t-1}) + (1 - \beta) b_{t-1}$$
$$\hat{y}_{T+h} = \ell_T + h \cdot b_T$$

- Optimal smoothing parameters $\alpha \in [0.1, 0.7]$ and $\beta \in [0.05, 0.3]$ are selected automatically via exhaustive grid-search minimization over Mean Squared Error (MSE).
- Well-suited for business metrics exhibiting recent momentum or velocity changes.

### 3.2 Ordinary Least Squares (OLS) Linear Trend (`LINEAR_TREND`)
Decomposes long-term linear drift via closed-form OLS regression:
$$\hat{y}_t = \alpha + \beta \cdot t$$
$$\beta = \frac{\sum (t - \bar{t})(y - \bar{y})}{\sum (t - \bar{t})^2}, \quad \alpha = \bar{y} - \beta \bar{t}$$

- Produces an interpretable velocity metric ($\Delta \text{Revenue} / \text{Period}$) and residual variance estimate.
- Robust against short-term transient spikes.

### 3.3 Moving Average with Historical Drift (`MOVING_AVERAGE`)
Takes a trailing local window (3 periods) and extrapolates according to historical net drift:
$$\hat{y}_{T+h} = \text{MA}_w + h \cdot \left(\frac{y_T - y_1}{T - 1}\right)$$

---

## 4. Historical Backtesting & Evaluation

InsightForge AI **does not claim accuracy without empirical evidence**.

Before finalizing projections, candidate models undergo out-of-sample backtesting:
- **Holdout Split**: The final 20% of periods (at least 1 to 2 periods) are held out as an unseen test set.
- **Model Fit**: Each candidate model is trained strictly on the preceding training partition.
- **Evaluation Metrics**:
  - **MAE** (Mean Absolute Error): Average absolute magnitude of errors:
    $$\text{MAE} = \frac{1}{H} \sum_{i=1}^H |y_i - \hat{y}_i|$$
  - **RMSE** (Root Mean Squared Error): Penalizes larger prediction misses:
    $$\text{RMSE} = \sqrt{\frac{1}{H} \sum_{i=1}^H (y_i - \hat{y}_i)^2}$$
  - **MAPE** (Mean Absolute Percentage Error): Scaled relative percentage discrepancy:
    $$\text{MAPE} = \frac{100\%}{H} \sum_{i=1}^H \left| \frac{y_i - \hat{y}_i}{y_i} \right|$$
- **Auto Model Selection**: When `model_type="auto"`, the system selects the model achieving the lowest validation RMSE.

---

## 5. Confidence Intervals & Horizon Uncertainty

Forecast uncertainty naturally expands as the projection looks further into the future.

Given the residual standard error $\sigma = \sqrt{\frac{\sum e_i^2}{n - 2}}$, prediction intervals at horizon step $h$ are:
$$\text{Margin}_{95\%}(h) = 1.96 \cdot \sigma \cdot \sqrt{1 + 0.15 \cdot h}$$
$$\text{Margin}_{80\%}(h) = 1.282 \cdot \sigma \cdot \sqrt{1 + 0.15 \cdot h}$$
$$\text{Upper Bound} = \hat{y}_{T+h} + \text{Margin}(h)$$
$$\text{Lower Bound} = \max\left(0, \hat{y}_{T+h} - \text{Margin}(h)\right)$$

Non-negative metrics (e.g., revenue, orders) have their lower confidence bound clamped at $0.0$.

---

## 6. Assumptions & Limitations

### Assumptions
1. **Continuity of Dynamics**: Historical business growth or contraction patterns are assumed to continue over the selected horizon without structural macroeconomic or regulatory breaks.
2. **Regular Interval Cadence**: Observations are mapped into evenly spaced intervals (Daily, Weekly, Monthly) through cumulative aggregation.
3. **Normally Distributed Residuals**: Uncertainty bounds assume white-noise Gaussian error distribution around the fitted path.

### Limitations
1. **Unmodeled Exogenous Shocks**: The baseline model does not ingest external marketing spend campaigns, competitor price drops, or global supply chain halts.
2. **Short History Sensitivity**: If a dataset contains fewer than 8 periods, confidence bands will appropriately widen to reflect parameter estimation uncertainty.
3. **Structural Trend Shifts**: A sudden shift in product line or business model requires several periods of new data before the smoothing parameters adjust.
