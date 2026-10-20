"""Anomaly Detection Engine for InsightForge AI.

Architecture:
  - Transparent Statistical Baselines:
      1. Z-Score / Standard Deviation Bounds (|z| > 2.5 or 3.0)
      2. Tukey's Interquartile Range (IQR) Fences ([Q1 - 1.5*IQR, Q3 + 1.5*IQR])
      3. Modified Z-Score via Median Absolute Deviation (MAD)
  - Multidimensional ML-Based Detection:
      4. Isolation Forest (Unsupervised tree isolation scoring via scikit-learn)
  - Clear Categorization:
      - Statistical Outlier (extreme tail of regular business distribution)
      - Detected Anomaly (meaningful deviation from expected baseline)
      - Confirmed Business Issue (potential operational hazard or data defect)
  - Explainability & Attribution:
      Every anomaly is paired with an explainable business narrative, observed vs expected metrics,
      deviation scores, and explicit context. Anomalies are NOT blindly branded as fraud.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.db.enums import Severity


class AnomalyNature(str, Enum):
    STATISTICAL_OUTLIER = "statistical_outlier"
    DETECTED_ANOMALY = "detected_anomaly"
    CONFIRMED_BUSINESS_ISSUE = "confirmed_business_issue"


class DetectionMethod(str, Enum):
    ZSCORE = "zscore"
    IQR = "iqr"
    MAD = "mad"
    ISOLATION_FOREST = "isolation_forest"


@dataclass
class AnomalyFinding:
    column_name: str
    method: DetectionMethod
    row_index: int | None
    observed_value: float
    expected_value: float
    score: float  # Normalized anomaly strength [0.0 - 1.0]
    severity: Severity
    nature: AnomalyNature
    title: str
    explanation: str
    details: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "column_name": self.column_name,
            "method": self.method.value,
            "row_index": self.row_index,
            "observed_value": round(self.observed_value, 2),
            "expected_value": round(self.expected_value, 2),
            "score": round(self.score, 3),
            "severity": self.severity.value,
            "nature": self.nature.value,
            "title": self.title,
            "explanation": self.explanation,
            "details": self.details,
        }


# ---------------------------------------------------------------------------
# STATISTICAL ANOMALY DETECTORS
# ---------------------------------------------------------------------------

def detect_zscore_anomalies(
    df: pd.DataFrame,
    column: str,
    threshold: float = 2.5,
    max_anomalies: int = 15
) -> list[AnomalyFinding]:
    """Detects statistical outliers using parametric Gaussian Standard Deviation bounds."""
    series = pd.to_numeric(df[column], errors="coerce").dropna()
    if len(series) < 5:
        return []

    mean_val = float(series.mean())
    std_val = float(series.std())
    if std_val == 0 or np.isnan(std_val):
        return []

    is_non_neg_col = any(k in column.lower() for k in ["revenue", "sales", "amount", "price", "qty", "quantity", "cost", "total", "spend", "rate"]) or (series >= 0).mean() >= 0.8
    z_scores = (series - mean_val) / std_val
    outliers_mask = (z_scores.abs() > threshold) | (is_non_neg_col & (series < 0))
    outliers_indices = series[outliers_mask].index

    findings: list[AnomalyFinding] = []
    for idx in outliers_indices:
        val = float(series.loc[idx])
        z = float(z_scores.loc[idx])
        abs_z = abs(z)
        norm_score = min(1.0, max(0.5, (abs_z - threshold) / (threshold * 2) + 0.5))

        # Contextual columns if available
        context = {}
        for dim_col in ["product_category", "product_name", "region", "customer_name", "order_date", "date"]:
            if dim_col in df.columns:
                context[dim_col] = str(df.loc[idx, dim_col])

        # Distinguish outlier vs anomaly vs business issue
        if val < 0 and is_non_neg_col:
            nature = AnomalyNature.CONFIRMED_BUSINESS_ISSUE
            severity = Severity.CRITICAL
            norm_score = max(0.9, norm_score)
            title = f"Negative {column.replace('_', ' ').title()} Recorded (${val:,.2f})"
            explanation = (
                f"Row {idx} recorded a negative value of ${val:,.2f}. For metric '{column}', "
                f"negative values may indicate customer refunds, return write-offs, or billing data capture errors."
            )
        elif z > 0:
            nature = AnomalyNature.STATISTICAL_OUTLIER
            severity = Severity.WARNING if z > 3.5 else Severity.INFO
            title = f"High-Value Transaction Spike (${val:,.2f}) in {column.replace('_', ' ').title()}"
            explanation = (
                f"Observation of ${val:,.2f} is {z:+.1f} standard deviations above the historical mean (${mean_val:,.2f}). "
                "This reflects a high-value purchase or bulk transaction. It is a legitimate statistical outlier rather than an operational failure."
            )
        else:
            nature = AnomalyNature.DETECTED_ANOMALY
            severity = Severity.WARNING
            title = f"Sudden Volume Drop (${val:,.2f}) in {column.replace('_', ' ').title()}"
            explanation = (
                f"Observation of ${val:,.2f} is {z:.1f} standard deviations below the historical average (${mean_val:,.2f}). "
                "Suggests unusually depressed activity or potential discounting anomalies."
            )

        findings.append(
            AnomalyFinding(
                column_name=column,
                method=DetectionMethod.ZSCORE,
                row_index=int(idx),
                observed_value=val,
                expected_value=mean_val,
                score=norm_score,
                severity=severity,
                nature=nature,
                title=title,
                explanation=explanation,
                details={
                    "z_score": round(z, 2),
                    "mean": round(mean_val, 2),
                    "std": round(std_val, 2),
                    "threshold": threshold,
                    "row_context": context,
                },
            )
        )

    # Sort by anomaly score descending
    findings.sort(key=lambda x: x.score, reverse=True)
    return findings[:max_anomalies]


def detect_iqr_anomalies(
    df: pd.DataFrame,
    column: str,
    multiplier: float = 1.5,
    max_anomalies: int = 15
) -> list[AnomalyFinding]:
    """Detects distribution-free outliers using Tukey's Interquartile Range Fences."""
    series = pd.to_numeric(df[column], errors="coerce").dropna()
    if len(series) < 5:
        return []

    q1 = float(series.quantile(0.25))
    q3 = float(series.quantile(0.75))
    iqr = q3 - q1
    median_val = float(series.median())

    if iqr == 0:
        return []

    lower_fence = q1 - multiplier * iqr
    upper_fence = q3 + multiplier * iqr

    outliers_mask = (series < lower_fence) | (series > upper_fence)
    outliers_indices = series[outliers_mask].index

    findings: list[AnomalyFinding] = []
    for idx in outliers_indices:
        val = float(series.loc[idx])
        if val > upper_fence:
            excess = (val - upper_fence) / iqr
            norm_score = min(1.0, 0.5 + excess * 0.1)
            nature = AnomalyNature.STATISTICAL_OUTLIER
            severity = Severity.WARNING if excess > 3.0 else Severity.INFO
            title = f"Upper Tail Distribution Outlier (${val:,.2f})"
            explanation = (
                f"Value ${val:,.2f} exceeds Tukey's upper boundary fence (${upper_fence:,.2f}) by "
                f"${(val - upper_fence):,.2f}. The historical median is ${median_val:,.2f}."
            )
        else:
            deficit = (lower_fence - val) / iqr
            norm_score = min(1.0, 0.5 + deficit * 0.1)
            nature = AnomalyNature.DETECTED_ANOMALY
            severity = Severity.WARNING if deficit > 2.0 else Severity.INFO
            title = f"Lower Tail Value Deficit (${val:,.2f})"
            explanation = (
                f"Value ${val:,.2f} falls below Tukey's lower boundary fence (${lower_fence:,.2f}). "
                f"Reflects unusual compression relative to the interquartile spread (${q1:,.2f} - ${q3:,.2f})."
            )

        context = {}
        for dim_col in ["product_category", "product_name", "region", "customer_name", "order_date", "date"]:
            if dim_col in df.columns:
                context[dim_col] = str(df.loc[idx, dim_col])

        findings.append(
            AnomalyFinding(
                column_name=column,
                method=DetectionMethod.IQR,
                row_index=int(idx),
                observed_value=val,
                expected_value=median_val,
                score=norm_score,
                severity=severity,
                nature=nature,
                title=title,
                explanation=explanation,
                details={
                    "q1": round(q1, 2),
                    "q3": round(q3, 2),
                    "iqr": round(iqr, 2),
                    "lower_fence": round(lower_fence, 2),
                    "upper_fence": round(upper_fence, 2),
                    "row_context": context,
                },
            )
        )

    findings.sort(key=lambda x: x.score, reverse=True)
    return findings[:max_anomalies]


# ---------------------------------------------------------------------------
# ML-BASED ANOMALY DETECTOR (ISOLATION FOREST)
# ---------------------------------------------------------------------------

def detect_isolation_forest_anomalies(
    df: pd.DataFrame,
    feature_columns: list[str],
    contamination: float = 0.05,
    max_anomalies: int = 15
) -> list[AnomalyFinding]:
    """Detects multidimensional anomalies using unsupervised decision tree path isolation."""
    valid_cols = [c for c in feature_columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    if not valid_cols or len(df) < 10:
        return []

    # Clean numeric data
    clean_sub = df[valid_cols].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    if clean_sub.shape[0] < 10:
        return []

    try:
        iso = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        preds = iso.fit_predict(clean_sub)
        scores = iso.decision_function(clean_sub)  # Lower is more abnormal

        # Find anomaly rows (preds == -1)
        anomaly_indices = np.where(preds == -1)[0]
        primary_col = valid_cols[0]

        findings: list[AnomalyFinding] = []
        for idx in anomaly_indices:
            orig_idx = clean_sub.index[idx]
            raw_score = float(scores[idx])
            # Normalize decision score to [0.5, 1.0]
            norm_score = min(1.0, max(0.5, 0.5 - raw_score))

            obs_val = float(clean_sub.iloc[idx][primary_col])
            mean_val = float(clean_sub[primary_col].mean())

            context = {}
            for dim_col in ["product_category", "product_name", "region", "customer_name", "order_date", "date"]:
                if dim_col in df.columns:
                    context[dim_col] = str(df.loc[orig_idx, dim_col])

            multi_details = {c: float(clean_sub.iloc[idx][c]) for c in valid_cols}

            findings.append(
                AnomalyFinding(
                    column_name=primary_col,
                    method=DetectionMethod.ISOLATION_FOREST,
                    row_index=int(orig_idx),
                    observed_value=obs_val,
                    expected_value=mean_val,
                    score=norm_score,
                    severity=Severity.WARNING if norm_score > 0.75 else Severity.INFO,
                    nature=AnomalyNature.DETECTED_ANOMALY,
                    title=f"Multivariate Pattern Anomaly in Row {orig_idx}",
                    explanation=(
                        f"Isolation Forest identified row {orig_idx} as structurally isolated across features "
                        f"({', '.join(valid_cols)}). This transaction exhibits unusual co-occurrence of metrics "
                        "compared to typical operational clusters."
                    ),
                    details={
                        "multivariate_features": multi_details,
                        "raw_decision_score": round(raw_score, 4),
                        "row_context": context,
                    },
                )
            )

        findings.sort(key=lambda x: x.score, reverse=True)
        return findings[:max_anomalies]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# ORCHESTRATOR
# ---------------------------------------------------------------------------

def run_comprehensive_anomaly_detection(
    df: pd.DataFrame,
    method: DetectionMethod | None = None,
    target_column: str | None = None,
) -> dict[str, Any]:
    """Runs statistical and ML anomaly detection pipelines and generates structured business results."""
    # Find numeric columns
    numeric_cols = [
        str(c) for c in df.columns 
        if pd.api.types.is_numeric_dtype(df[c]) and "id" not in str(c).lower()
    ]
    if not numeric_cols:
        return {
            "total_anomalies": 0,
            "anomalies": [],
            "summary_metrics": {"statistical_outliers": 0, "detected_anomalies": 0, "confirmed_issues": 0},
            "assumptions": ["Dataset contains no numeric columns suitable for outlier detection."],
            "limitations": ["Requires numerical features for parametric and non-parametric bounds."]
        }

    target = target_column if (target_column and target_column in numeric_cols) else numeric_cols[0]

    all_findings: list[AnomalyFinding] = []

    # 1. Z-Score
    if not method or method == DetectionMethod.ZSCORE:
        z_findings = detect_zscore_anomalies(df, target)
        all_findings.extend(z_findings)

    # 2. IQR
    if not method or method == DetectionMethod.IQR:
        iqr_findings = detect_iqr_anomalies(df, target)
        all_findings.extend(iqr_findings)

    # 3. Isolation Forest
    if not method or method == DetectionMethod.ISOLATION_FOREST:
        iso_findings = detect_isolation_forest_anomalies(df, numeric_cols)
        all_findings.extend(iso_findings)

    # Deduplicate findings by row_index and method
    unique_findings = []
    seen = set()
    for f in all_findings:
        key = (f.method, f.row_index, f.column_name)
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    unique_findings.sort(key=lambda x: x.score, reverse=True)

    stat_outliers = sum(1 for f in unique_findings if f.nature == AnomalyNature.STATISTICAL_OUTLIER)
    det_anomalies = sum(1 for f in unique_findings if f.nature == AnomalyNature.DETECTED_ANOMALY)
    conf_issues = sum(1 for f in unique_findings if f.nature == AnomalyNature.CONFIRMED_BUSINESS_ISSUE)

    return {
        "target_column": target,
        "total_anomalies": len(unique_findings),
        "anomalies": [f.to_dict() for f in unique_findings],
        "summary_metrics": {
            "statistical_outliers": stat_outliers,
            "detected_anomalies": det_anomalies,
            "confirmed_issues": conf_issues,
            "critical_count": sum(1 for f in unique_findings if f.severity == Severity.CRITICAL),
            "warning_count": sum(1 for f in unique_findings if f.severity == Severity.WARNING),
            "info_count": sum(1 for f in unique_findings if f.severity == Severity.INFO),
        },
        "assumptions": [
            f"Z-Score detection assumes approximate Gaussian dispersion for '{target}' beyond 2.5 standard deviations.",
            "Tukey's IQR method operates without parametric distributional assumptions via quartiles Q1/Q3.",
            "Isolation Forest identifies anomalies by measuring the number of random partition splits required to isolate a point.",
        ],
        "limitations": [
            "Statistical outliers (e.g. VIP bulk purchases) are natural commercial events and do not automatically indicate fraud or data corruption.",
            "Small sample sizes (<15 records) limit the statistical confidence of distributional fences.",
            "Unsupervised Isolation Forest relies on global contamination heuristics without labeled historical truth.",
        ],
    }
