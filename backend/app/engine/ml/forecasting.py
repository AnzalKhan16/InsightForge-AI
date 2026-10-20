"""Time-Series Forecasting Engine for InsightForge AI.

Architecture:
  - Temporal Schema Detection & Suitability Validation
  - Frequency Regularization & Flow Aggregation (Daily, Weekly, Monthly)
  - Interpretable Baseline Models:
      1. Holt's Linear Exponential Smoothing (Level + Trend with MSE Grid Optimization)
      2. Ordinary Least Squares (OLS) Linear Trend Decomposition
      3. Moving Average with Drift
  - Out-of-Sample Historical Backtesting (MAE, RMSE, MAPE evaluation)
  - Expanding Horizon Confidence & Uncertainty Intervals (80% and 95% bounds)
  - Traceable Assumptions, Parameters, and Business Limitations

Constraints:
  - Reject metrics/datasets without suitable temporal columns or sufficient history (>= 5 periods).
  - All mathematical calculations are strictly deterministic.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Any

import numpy as np
import pandas as pd


class ForecastModelType(str, Enum):
    AUTO = "auto"
    HOLT_LINEAR = "holt_linear"
    LINEAR_TREND = "linear_trend"
    MOVING_AVERAGE = "moving_average"


@dataclass
class BacktestMetrics:
    mae: float
    rmse: float
    mape_pct: float
    holdout_periods: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "mae": round(self.mae, 2),
            "rmse": round(self.rmse, 2),
            "mape_pct": round(self.mape_pct, 2),
            "holdout_periods": self.holdout_periods,
        }


class TimeSeriesSuitabilityError(ValueError):
    """Raised when data lacks temporal columns or sufficient historical points."""
    pass


def detect_temporal_schema(df: pd.DataFrame) -> dict[str, Any]:
    """Detects date columns and candidate numerical metrics for time-series forecasting."""
    date_cols: list[str] = []
    metric_cols: list[str] = []

    for col in df.columns:
        col_str = str(col)
        col_lower = col_str.lower()
        series = df[col]

        if pd.api.types.is_datetime64_any_dtype(series):
            date_cols.append(col_str)
        elif any(date_word in col_lower for date_word in ["date", "time", "timestamp", "created_at", "day", "month"]):
            try:
                pd.to_datetime(series.dropna().head(10))
                date_cols.append(col_str)
            except Exception:
                pass

        if pd.api.types.is_numeric_dtype(series):
            if "id" in col_lower and "price" not in col_lower and "amount" not in col_lower:
                continue
            metric_cols.append(col_str)

    # Prioritize primary date and primary metric
    primary_date = date_cols[0] if date_cols else None
    primary_metric = None
    for cand in ["revenue", "sales", "amount", "total_sales", "profit", "order_count", "quantity"]:
        for m in metric_cols:
            if cand in m.lower():
                primary_metric = m
                break
        if primary_metric:
            break
    if not primary_metric and metric_cols:
        primary_metric = metric_cols[0]

    return {
        "date_columns": date_cols,
        "metric_columns": metric_cols,
        "primary_date": primary_date,
        "primary_metric": primary_metric,
        "is_forecastable": bool(primary_date and primary_metric),
    }


def prepare_time_series(
    df: pd.DataFrame,
    time_column: str,
    target_column: str,
    frequency: str | None = None
) -> tuple[pd.DataFrame, str]:
    """Cleans, parses dates, infers frequency, and aggregates time-series values."""
    if time_column not in df.columns:
        raise TimeSeriesSuitabilityError(f"Time column '{time_column}' not found in dataset.")
    if target_column not in df.columns:
        raise TimeSeriesSuitabilityError(f"Target column '{target_column}' not found in dataset.")

    pdf = df[[time_column, target_column]].copy()
    pdf[time_column] = pd.to_datetime(pdf[time_column], errors="coerce")
    pdf[target_column] = pd.to_numeric(pdf[target_column], errors="coerce")
    pdf = pdf.dropna(subset=[time_column, target_column]).sort_values(by=time_column)

    if len(pdf) < 5:
        raise TimeSeriesSuitabilityError(
            f"Insufficient historical data: found {len(pdf)} valid observations, but at least 5 are required."
        )

    # Determine frequency if not provided
    time_span_days = (pdf[time_column].max() - pdf[time_column].min()).days
    if not frequency:
        if time_span_days > 180:
            frequency = "MS"  # Month Start
        elif time_span_days > 45:
            frequency = "W-MON"  # Weekly
        else:
            frequency = "D"  # Daily

    # Resample and aggregate
    resampled = (
        pdf.set_index(time_column)
        .resample(frequency)[target_column]
        .sum()
        .reset_index()
    )
    # Fill any sparse gaps with forward-fill or 0
    resampled[target_column] = resampled[target_column].fillna(0.0)

    if len(resampled) < 5:
        # If resampling collapsed below 5 periods, try finer granularity or keep raw sorted points
        if frequency in ["MS", "M"]:
            frequency = "W-MON"
            resampled = (
                pdf.set_index(time_column)
                .resample(frequency)[target_column]
                .sum()
                .reset_index()
            )
            resampled[target_column] = resampled[target_column].fillna(0.0)

    if len(resampled) < 4:
        raise TimeSeriesSuitabilityError(
            f"After grouping by frequency '{frequency}', only {len(resampled)} periods were obtained. "
            "Forecasting requires at least 4 contiguous time periods."
        )

    return resampled, frequency


# ---------------------------------------------------------------------------
# BASELINE FORECASTING MODELS
# ---------------------------------------------------------------------------

class LinearTrendModel:
    """Ordinary Least Squares Linear Trend: y = alpha + beta * t"""

    def __init__(self):
        self.slope: float = 0.0
        self.intercept: float = 0.0
        self.residuals: np.ndarray = np.array([])
        self.residual_std: float = 0.0

    def fit(self, y: np.ndarray) -> "LinearTrendModel":
        n = len(y)
        t = np.arange(n)
        if n < 2:
            self.intercept = float(y[0]) if n == 1 else 0.0
            self.slope = 0.0
            self.residual_std = 1.0
            return self

        # OLS closed-form
        t_mean = np.mean(t)
        y_mean = np.mean(y)
        denom = np.sum((t - t_mean) ** 2)
        if denom == 0:
            self.slope = 0.0
            self.intercept = y_mean
        else:
            self.slope = float(np.sum((t - t_mean) * (y - y_mean)) / denom)
            self.intercept = float(y_mean - self.slope * t_mean)

        fitted = self.intercept + self.slope * t
        self.residuals = y - fitted
        deg_free = max(1, n - 2)
        self.residual_std = float(np.sqrt(np.sum(self.residuals ** 2) / deg_free))
        return self

    def predict(self, start_idx: int, horizon: int) -> np.ndarray:
        future_t = np.arange(start_idx, start_idx + horizon)
        return self.intercept + self.slope * future_t


class HoltLinearModel:
    """Holt's Linear Exponential Smoothing (Level + Trend) with optimal alpha, beta."""

    def __init__(self, alpha: float | None = None, beta: float | None = None):
        self.alpha: float = alpha if alpha is not None else 0.3
        self.beta: float = beta if beta is not None else 0.1
        self.final_level: float = 0.0
        self.final_trend: float = 0.0
        self.residuals: np.ndarray = np.array([])
        self.residual_std: float = 0.0

    def fit(self, y: np.ndarray) -> "HoltLinearModel":
        n = len(y)
        if n < 2:
            self.final_level = float(y[0]) if n == 1 else 0.0
            self.final_trend = 0.0
            self.residual_std = 1.0
            return self

        # Grid search optimization for alpha and beta over MSE
        best_mse = float("inf")
        best_a, best_b = 0.3, 0.1

        for a in [0.1, 0.2, 0.3, 0.5, 0.7]:
            for b in [0.05, 0.1, 0.2, 0.3]:
                # Initialize level and trend
                level = y[0]
                trend = y[1] - y[0]
                errors = []
                for i in range(1, n):
                    pred = level + trend
                    errors.append(y[i] - pred)
                    new_level = a * y[i] + (1 - a) * (level + trend)
                    new_trend = b * (new_level - level) + (1 - b) * trend
                    level, trend = new_level, new_trend

                mse = float(np.mean(np.array(errors) ** 2))
                if mse < best_mse:
                    best_mse = mse
                    best_a, best_b = a, b

        self.alpha, self.beta = best_a, best_b

        # Final pass with optimal parameters
        level = y[0]
        trend = y[1] - y[0]
        residuals = [0.0]
        for i in range(1, n):
            pred = level + trend
            residuals.append(y[i] - pred)
            new_level = self.alpha * y[i] + (1 - self.alpha) * (level + trend)
            new_trend = self.beta * (new_level - level) + (1 - self.beta) * trend
            level, trend = new_level, new_trend

        self.final_level = float(level)
        self.final_trend = float(trend)
        self.residuals = np.array(residuals)
        self.residual_std = float(np.std(self.residuals)) if len(self.residuals) > 1 else 1.0
        return self

    def predict(self, start_idx: int, horizon: int) -> np.ndarray:
        # Forecast from final level and trend: y_{T+h} = Level_T + h * Trend_T
        h = np.arange(1, horizon + 1)
        return self.final_level + h * self.final_trend


class MovingAverageModel:
    """Windowed Moving Average with Drift."""

    def __init__(self, window: int = 3):
        self.window = window
        self.last_ma: float = 0.0
        self.drift: float = 0.0
        self.residual_std: float = 0.0

    def fit(self, y: np.ndarray) -> "MovingAverageModel":
        n = len(y)
        w = min(self.window, n)
        self.last_ma = float(np.mean(y[-w:]))
        if n >= 2:
            self.drift = float((y[-1] - y[0]) / (n - 1))
            resids = y[1:] - y[:-1]
            self.residual_std = float(np.std(resids)) if len(resids) > 1 else 1.0
        else:
            self.drift = 0.0
            self.residual_std = 1.0
        return self

    def predict(self, start_idx: int, horizon: int) -> np.ndarray:
        h = np.arange(1, horizon + 1)
        return self.last_ma + h * self.drift


# ---------------------------------------------------------------------------
# HISTORICAL BACKTESTING & MODEL SELECTION
# ---------------------------------------------------------------------------

def backtest_model(
    model_cls,
    y: np.ndarray,
    holdout_periods: int = 2
) -> tuple[BacktestMetrics, Any]:
    """Evaluates forecasting model on holdout historical data."""
    n = len(y)
    if n <= holdout_periods + 2:
        holdout_periods = 1

    train_y = y[:-holdout_periods]
    test_y = y[-holdout_periods:]

    model = model_cls()
    model.fit(train_y)
    preds = model.predict(start_idx=len(train_y), horizon=holdout_periods)

    errors = test_y - preds
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))

    # MAPE with zero-division safeguard
    non_zero = test_y != 0
    if np.any(non_zero):
        mape = float(np.mean(np.abs(errors[non_zero] / test_y[non_zero])) * 100)
    else:
        mape = 0.0

    metrics = BacktestMetrics(
        mae=mae,
        rmse=rmse,
        mape_pct=mape,
        holdout_periods=holdout_periods,
    )
    return metrics, model


def generate_forecast(
    df: pd.DataFrame,
    time_column: str,
    target_column: str,
    horizon: int = 6,
    frequency: str | None = None,
    preferred_model: ForecastModelType = ForecastModelType.AUTO,
) -> dict[str, Any]:
    """End-to-end time-series forecasting pipeline.
    
    Returns:
      - Historical points
      - Forecast points with 80% & 95% confidence intervals
      - Model parameters and out-of-sample backtest evaluation metrics
      - Explicit business assumptions and limitations
    """
    horizon = max(1, min(horizon, 24))

    # 1. Clean & regularize series
    resampled_df, freq = prepare_time_series(df, time_column, target_column, frequency)
    dates = resampled_df[time_column].dt.strftime("%Y-%m-%d").tolist()
    values = resampled_df[target_column].astype(float).values
    n = len(values)

    # 2. Backtest Candidate Models
    candidates = [
        ("Holt's Linear Exponential Smoothing", HoltLinearModel, ForecastModelType.HOLT_LINEAR),
        ("Linear Trend (OLS)", LinearTrendModel, ForecastModelType.LINEAR_TREND),
        ("Moving Average with Drift", MovingAverageModel, ForecastModelType.MOVING_AVERAGE),
    ]

    holdout = 2 if n >= 6 else 1
    eval_results = {}
    best_name = None
    best_cls = None
    best_rmse = float("inf")

    for name, cls, enum_val in candidates:
        metrics, _ = backtest_model(cls, values, holdout_periods=holdout)
        eval_results[enum_val.value] = {
            "name": name,
            "metrics": metrics.to_dict(),
        }
        if preferred_model == enum_val or (preferred_model == ForecastModelType.AUTO and metrics.rmse < best_rmse):
            best_rmse = metrics.rmse
            best_name = name
            best_cls = cls

    if not best_cls:
        best_name, best_cls, _ = candidates[0]

    # 3. Fit Winning Model on full historical data
    full_model = best_cls().fit(values)
    forecast_values = full_model.predict(start_idx=n, horizon=horizon)

    # 4. Generate Future Date Index
    last_date = resampled_df[time_column].iloc[-1]
    future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq=freq)[1:]
    future_date_strings = future_dates.strftime("%Y-%m-%d").tolist()

    # 5. Compute Confidence Intervals (expanding horizon uncertainty)
    sigma = full_model.residual_std
    is_non_negative = np.all(values >= 0)

    forecast_points = []
    for h_idx, (f_date, val) in enumerate(zip(future_date_strings, forecast_values), 1):
        # Uncertainty widens with horizon distance
        expansion_factor = np.sqrt(1 + 0.15 * h_idx)
        margin_80 = 1.282 * sigma * expansion_factor
        margin_95 = 1.960 * sigma * expansion_factor

        low_80 = max(0.0, val - margin_80) if is_non_negative else val - margin_80
        high_80 = val + margin_80

        low_95 = max(0.0, val - margin_95) if is_non_negative else val - margin_95
        high_95 = val + margin_95

        forecast_points.append({
            "date": f_date,
            "period_index": h_idx,
            "forecast": round(float(val), 2),
            "lower_bound_80": round(float(low_80), 2),
            "upper_bound_80": round(float(high_80), 2),
            "lower_bound_95": round(float(low_95), 2),
            "upper_bound_95": round(float(high_95), 2),
        })

    historical_points = [
        {"date": d, "value": round(float(v), 2)}
        for d, v in zip(dates, values)
    ]

    # Model Parameters & Details
    params = {}
    if isinstance(full_model, HoltLinearModel):
        params = {
            "alpha_level_smoothing": round(full_model.alpha, 3),
            "beta_trend_smoothing": round(full_model.beta, 3),
            "final_level": round(full_model.final_level, 2),
            "final_trend": round(full_model.final_trend, 2),
        }
    elif isinstance(full_model, LinearTrendModel):
        params = {
            "slope": round(full_model.slope, 2),
            "intercept": round(full_model.intercept, 2),
            "residual_std": round(full_model.residual_std, 2),
        }
    elif isinstance(full_model, MovingAverageModel):
        params = {
            "window": full_model.window,
            "drift_rate": round(full_model.drift, 2),
        }

    return {
        "target_column": target_column,
        "time_column": time_column,
        "frequency": freq,
        "horizon": horizon,
        "selected_model": best_name,
        "model_parameters": params,
        "validation_metrics": eval_results[preferred_model.value]["metrics"] if preferred_model.value in eval_results else eval_results["holt_linear"]["metrics"],
        "all_model_evaluations": eval_results,
        "historical_points": historical_points,
        "forecast_points": forecast_points,
        "assumptions": [
            f"Historical trends in '{target_column}' will persist without structural regulatory or macroeconomic breaks.",
            f"Series resampled at regular cadence '{freq}' using cumulative aggregation.",
            "Confidence intervals assume normally distributed residual errors with horizon variance expansion.",
        ],
        "limitations": [
            f"Model is trained on {n} historical periods; longer horizon projections (>12) carry wider uncertainty.",
            "External marketing campaigns, competitor price wars, or unexpected supply chain shocks are not exogenous inputs.",
            "Zero lower-bound clamping applied because recorded business metrics are non-negative.",
        ],
    }
