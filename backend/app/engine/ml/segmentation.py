"""Customer & Product Segmentation Engine for InsightForge AI.

Architecture:
  - Deterministic RFM (Recency, Frequency, Monetary) Customer Segmentation:
      - Groups entities by Customer/Client ID.
      - Calculates Recency (days since latest dataset date), Frequency (transaction count),
        and Monetary (cumulative spend).
      - Quantile-based scoring with tie-resistant rank-percentiles.
      - Maps to standard, explainable business tiers: Champions, Loyal Customers,
        Potential Loyalists, Recent Customers, Promising, Need Attention, At Risk,
        Can't Lose Them, Hibernating, Lost.
  - Multidimensional K-Means Clustering:
      - Scales features with StandardScaler.
      - Automated optimal-k selection via Silhouette Score evaluation over k in [2, 6].
      - Profiles cluster centroids in original feature units and derives explainable business labels.
  - ABC / Pareto Product & Catalog Segmentation:
      - Cumulative revenue distribution ranking (Class A: top 80%, Class B: next 15%, Class C: final 5%).
      - Actionable inventory, supply-chain, and margin recommendations per class.
  - Explainability & Guardrails:
      - Strict deterministic calculations (No LLM math or ungrounded clustering).
      - Transparent assumptions, limitations, and actionable business playbooks per segment.
"""
from enum import Enum
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


class SegmentationMethod(str, Enum):
    RFM = "rfm"
    KMEANS = "kmeans"
    ABC_PARETO = "abc_pareto"
    AUTO = "auto"


class SegmentationSuitabilityError(Exception):
    """Raised when a dataset lacks required columns or minimum observations for segmentation."""
    pass


# ---------------------------------------------------------------------------
# SCHEMA DETECTION
# ---------------------------------------------------------------------------

ENTITY_KEYWORDS = [
    "customer_id", "customer_name", "customer", "client_id", "client", "account_id",
    "account", "user_id", "shopper_id", "company_name", "buyer", "product_id",
    "product_name", "product", "item_id", "item_name", "item", "sku", "service"
]

CUSTOMER_KEYWORDS = [
    "customer_id", "customer_name", "customer", "client_id", "client", "account_id",
    "account", "user_id", "shopper_id", "company_name", "buyer"
]

PRODUCT_KEYWORDS = [
    "product_id", "product_name", "product", "item_id", "item_name", "item", "sku", "service"
]

DATE_KEYWORDS = [
    "order_date", "transaction_date", "invoice_date", "date", "created_at",
    "timestamp", "purchase_date", "event_date"
]

MONETARY_KEYWORDS = [
    "revenue", "sales", "amount", "total_price", "price", "total", "margin", "spend", "cost"
]


def detect_segmentation_schema(df: pd.DataFrame) -> dict[str, Any]:
    """Inspects dataset structure and determines suitability for RFM, K-Means, and ABC Pareto."""
    col_names = [str(c) for c in df.columns]
    col_lower = {c: c.lower().strip() for c in col_names}

    # Find customer entity columns
    customer_cols = []
    for c, low in col_lower.items():
        if any(kw in low for kw in CUSTOMER_KEYWORDS):
            customer_cols.append(c)

    # Find product entity columns
    product_cols = []
    for c, low in col_lower.items():
        if any(kw in low for kw in PRODUCT_KEYWORDS):
            product_cols.append(c)

    all_entity_cols = list(dict.fromkeys(customer_cols + product_cols))
    if not all_entity_cols:
        # Fallback to categorical/string columns with reasonable cardinality
        for c in col_names:
            if df[c].dtype == object or pd.api.types.is_string_dtype(df[c]):
                unique_ratio = df[c].nunique() / max(1, len(df))
                if 0.01 <= unique_ratio <= 0.95 and df[c].nunique() >= 3:
                    all_entity_cols.append(c)

    # Find date columns
    date_cols = []
    for c, low in col_lower.items():
        if any(kw in low for kw in DATE_KEYWORDS):
            date_cols.append(c)
    if not date_cols:
        for c in col_names:
            if pd.api.types.is_datetime64_any_dtype(df[c]):
                date_cols.append(c)
            else:
                try:
                    sample = df[c].dropna().head(10)
                    if len(sample) > 0 and pd.to_datetime(sample, errors="coerce").notnull().all():
                        date_cols.append(c)
                except Exception:
                    pass

    # Find monetary and numeric columns
    numeric_cols = [c for c in col_names if pd.api.types.is_numeric_dtype(df[c]) and "id" not in col_lower[c]]
    monetary_cols = []
    for c in numeric_cols:
        low = col_lower[c]
        if any(kw in low for kw in MONETARY_KEYWORDS):
            monetary_cols.append(c)
    if not monetary_cols and numeric_cols:
        monetary_cols = [numeric_cols[0]]

    # Determine method suitability
    rfm_supported = bool(all_entity_cols and date_cols and monetary_cols and len(df) >= 5)
    abc_supported = bool((product_cols or all_entity_cols) and monetary_cols and len(df) >= 3)
    kmeans_supported = bool(len(numeric_cols) >= 2 and len(df) >= 5)

    # Suggest default method
    if rfm_supported and customer_cols:
        suggested_method = SegmentationMethod.RFM.value
        suggested_entity = customer_cols[0]
    elif abc_supported and product_cols:
        suggested_method = SegmentationMethod.ABC_PARETO.value
        suggested_entity = product_cols[0]
    elif kmeans_supported:
        suggested_method = SegmentationMethod.KMEANS.value
        suggested_entity = all_entity_cols[0] if all_entity_cols else None
    else:
        suggested_method = SegmentationMethod.RFM.value if rfm_supported else SegmentationMethod.KMEANS.value
        suggested_entity = all_entity_cols[0] if all_entity_cols else None

    return {
        "entity_columns": all_entity_cols,
        "customer_columns": customer_cols,
        "product_columns": product_cols,
        "date_columns": date_cols,
        "monetary_columns": monetary_cols,
        "numeric_columns": numeric_cols,
        "rfm_supported": rfm_supported,
        "abc_supported": abc_supported,
        "kmeans_supported": kmeans_supported,
        "suggested_method": suggested_method,
        "suggested_entity_column": suggested_entity,
        "suggested_date_column": date_cols[0] if date_cols else None,
        "suggested_monetary_column": monetary_cols[0] if monetary_cols else None,
    }


# ---------------------------------------------------------------------------
# 1. RFM CUSTOMER SEGMENTATION
# ---------------------------------------------------------------------------

def calculate_rfm_segmentation(
    df: pd.DataFrame,
    entity_col: str,
    date_col: str,
    monetary_col: str,
) -> dict[str, Any]:
    """Calculates deterministic Recency, Frequency, and Monetary quintile scores and business tiers."""
    if entity_col not in df.columns or date_col not in df.columns or monetary_col not in df.columns:
        raise SegmentationSuitabilityError(
            f"Missing required columns for RFM. Available: {list(df.columns)}"
        )

    # Clean data
    clean_df = df[[entity_col, date_col, monetary_col]].dropna().copy()
    if len(clean_df) < 5:
        raise SegmentationSuitabilityError("Dataset must have at least 5 valid records for RFM segmentation.")

    clean_df[date_col] = pd.to_datetime(clean_df[date_col], errors="coerce")
    clean_df[monetary_col] = pd.to_numeric(clean_df[monetary_col], errors="coerce")
    clean_df = clean_df.dropna()

    if len(clean_df) == 0:
        raise SegmentationSuitabilityError("No valid rows remaining after date and numeric coercion.")

    ref_date = clean_df[date_col].max() + pd.Timedelta(days=1)

    # Group by customer
    rfm = clean_df.groupby(entity_col).agg(
        recency=(date_col, lambda d: int((ref_date - d.max()).days)),
        frequency=(date_col, "count"),
        monetary=(monetary_col, "sum"),
    ).reset_index()

    total_customers = len(rfm)
    if total_customers < 3:
        raise SegmentationSuitabilityError(f"RFM requires at least 3 distinct entities, found {total_customers}.")

    # Score R, F, M from 1 to 5 using rank percentiles (robust against duplicate values)
    # Recency: lower days is better -> descending rank
    r_pct = rfm["recency"].rank(pct=True, ascending=False)
    rfm["r_score"] = np.ceil(r_pct * 5).astype(int).clip(1, 5)

    # Frequency: higher count is better -> ascending rank
    f_pct = rfm["frequency"].rank(pct=True, ascending=True)
    rfm["f_score"] = np.ceil(f_pct * 5).astype(int).clip(1, 5)

    # Monetary: higher total spend is better -> ascending rank
    m_pct = rfm["monetary"].rank(pct=True, ascending=True)
    rfm["m_score"] = np.ceil(m_pct * 5).astype(int).clip(1, 5)

    # Deterministic Business Tier Mapping
    def assign_rfm_segment(row) -> tuple[str, str, str]:
        r = row["r_score"]
        f = row["f_score"]
        m = row["m_score"]

        if r >= 4 and f >= 4 and m >= 4:
            return (
                "Champions",
                "High Spenders & Highly Active",
                "Reward their loyalty with exclusive perks, early product previews, and premium concierge service."
            )
        elif r >= 3 and f >= 3:
            return (
                "Loyal Customers",
                "Regular High-Value Buyers",
                "Upsell higher-value offerings, offer referral incentives, and solicit reviews/testimonials."
            )
        elif r >= 4 and f <= 2:
            return (
                "Potential Loyalists",
                "Recent Buyers with Growth Potential",
                "Offer personalized recommendations and engagement incentives to build repeat transaction habits."
            )
        elif r >= 4 and f == 1:
            return (
                "Recent Customers",
                "First-Time Buyers",
                "Provide seamless onboarding, verify customer satisfaction, and offer welcome-back incentives."
            )
        elif r == 3 and f <= 2:
            return (
                "Promising",
                "Average Recency & Moderate Spend",
                "Deliver targeted educational content and brand awareness touches to maintain interest."
            )
        elif r in (2, 3) and f >= 2 and m >= 3:
            return (
                "Need Attention",
                "Above Average Spenders Slipping",
                "Share limited-time reactivation discounts and solicit feedback to address potential friction."
            )
        elif r <= 2 and f >= 3 and m >= 3:
            return (
                "At Risk",
                "Formerly Active High Spenders Inactive",
                "Send proactive win-back offers and conduct direct outreach to prevent customer churn."
            )
        elif r == 1 and f >= 4 and m >= 4:
            return (
                "Can't Lose Them",
                "Past VIP Customers Now Inactive",
                "Prioritize executive outreach, direct consultation, and significant incentives to re-engage."
            )
        elif r <= 2 and f <= 2 and m <= 2:
            return (
                "Hibernating",
                "Low-Value Infrequent Inactive Buyers",
                "Include in automated re-engagement email drips; avoid high-cost acquisition spend."
            )
        else:
            return (
                "Lost / Inactive",
                "Lowest Engagement and Value",
                "Conduct minimal automated re-engagement or consider archiving from high-frequency campaigns."
            )

    tier_results = [assign_rfm_segment(row) for _, row in rfm.iterrows()]
    rfm["segment"] = [t[0] for t in tier_results]
    rfm["segment_subtitle"] = [t[1] for t in tier_results]
    rfm["playbook"] = [t[2] for t in tier_results]

    total_monetary = float(rfm["monetary"].sum())

    # Build structured segment summaries
    segments: list[dict[str, Any]] = []
    for seg_name, group in rfm.groupby("segment"):
        count = len(group)
        seg_monetary = float(group["monetary"].sum())
        pct_count = round((count / total_customers) * 100, 1)
        pct_monetary = round((seg_monetary / max(1e-9, total_monetary)) * 100, 1)

        mean_rec = round(float(group["recency"].mean()), 1)
        mean_freq = round(float(group["frequency"].mean()), 1)
        mean_mon = round(float(group["monetary"].mean()), 2)

        # Sample members
        sample_entities = group.sort_values(by="monetary", ascending=False).head(5)
        samples = [
            {
                "entity": str(r[entity_col]),
                "recency_days": int(r["recency"]),
                "frequency": int(r["frequency"]),
                "monetary": round(float(r["monetary"]), 2),
                "r_score": int(r["r_score"]),
                "f_score": int(r["f_score"]),
                "m_score": int(r["m_score"]),
            }
            for _, r in sample_entities.iterrows()
        ]

        subtitle = group["segment_subtitle"].iloc[0]
        playbook = group["playbook"].iloc[0]

        segments.append({
            "label": seg_name,
            "subtitle": subtitle,
            "member_count": count,
            "percentage_of_members": pct_count,
            "total_monetary": round(seg_monetary, 2),
            "percentage_of_monetary": pct_monetary,
            "profile": {
                "avg_recency_days": mean_rec,
                "avg_frequency": mean_freq,
                "avg_monetary": mean_mon,
                "avg_r_score": round(float(group["r_score"].mean()), 1),
                "avg_f_score": round(float(group["f_score"].mean()), 1),
                "avg_m_score": round(float(group["m_score"].mean()), 1),
            },
            "recommendation": playbook,
            "sample_members": samples,
        })

    # Sort segments by total monetary value descending
    segments.sort(key=lambda s: s["total_monetary"], reverse=True)

    return {
        "method": SegmentationMethod.RFM.value,
        "entity_column": entity_col,
        "date_column": date_col,
        "monetary_column": monetary_col,
        "total_entities": total_customers,
        "total_monetary": round(total_monetary, 2),
        "segments": segments,
        "reference_date": ref_date.strftime("%Y-%m-%d"),
        "assumptions": [
            f"Reference date for recency calculation is {ref_date.strftime('%Y-%m-%d')} (latest date in dataset + 1 day).",
            "Customer transaction counts and values are grouped by unique entity values.",
            "Recency, Frequency, and Monetary indicators are scored on a standardized 1-5 scale using robust percentile ranking.",
        ],
        "limitations": [
            "RFM treats all transaction categories equally; seasonal variation is not explicitly isolated.",
            "Customers with only 1 historical transaction have minimal frequency variance.",
        ]
    }


# ---------------------------------------------------------------------------
# 2. K-MEANS MULTIDIMENSIONAL CLUSTERING
# ---------------------------------------------------------------------------

def calculate_kmeans_segmentation(
    df: pd.DataFrame,
    feature_cols: list[str],
    entity_col: str | None = None,
    k: int | None = None,
) -> dict[str, Any]:
    """Clusters entities or records across continuous numerical dimensions using scikit-learn KMeans."""
    valid_features = [c for c in feature_cols if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    if len(valid_features) < 2:
        raise SegmentationSuitabilityError(
            f"K-Means clustering requires at least 2 numeric feature dimensions. Found: {valid_features}"
        )

    # If entity column is provided, aggregate by entity first
    if entity_col and entity_col in df.columns:
        agg_rules = {}
        for f in valid_features:
            low = f.lower()
            if any(kw in low for kw in ["revenue", "sales", "amount", "total", "spend", "cost"]):
                agg_rules[f] = "sum"
            elif any(kw in low for kw in ["qty", "quantity"]):
                agg_rules[f] = "sum"
            else:
                agg_rules[f] = "mean"
        working_df = df.groupby(entity_col).agg(agg_rules).reset_index().dropna()
    else:
        working_df = df[valid_features].dropna().copy()
        working_df["entity_id"] = [f"Item #{i}" for i in range(len(working_df))]
        entity_col = "entity_id"

    n_samples = len(working_df)
    if n_samples < 5:
        raise SegmentationSuitabilityError(f"Insufficient entities ({n_samples}) for K-Means clustering (minimum 5 required).")

    X = working_df[valid_features].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Determine optimal k if not provided
    best_k = k
    silhouette = 0.0
    evaluations: dict[int, float] = {}

    max_k = min(6, n_samples - 1)
    if not best_k or best_k < 2 or best_k > max_k:
        best_score = -2.0
        best_k = 3 if max_k >= 3 else 2

        for candidate_k in range(2, max_k + 1):
            km = KMeans(n_clusters=candidate_k, random_state=42, n_init=10)
            labels = km.fit_predict(X_scaled)
            try:
                score = float(silhouette_score(X_scaled, labels))
                evaluations[candidate_k] = round(score, 3)
                if score > best_score:
                    best_score = score
                    best_k = candidate_k
            except Exception:
                evaluations[candidate_k] = 0.0

        silhouette = max(0.0, best_score)
    else:
        km = KMeans(n_clusters=best_k, random_state=42, n_init=10)
        labels = km.fit_predict(X_scaled)
        try:
            silhouette = round(float(silhouette_score(X_scaled, labels)), 3)
        except Exception:
            silhouette = 0.0

    # Final fit with best_k
    final_km = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    working_df["cluster"] = final_km.fit_predict(X_scaled)

    # Global averages for feature comparison
    global_means = {f: float(working_df[f].mean()) for f in valid_features}

    # Derive cluster business labels and profiles
    segments: list[dict[str, Any]] = []
    primary_metric = valid_features[0]
    total_primary = float(working_df[primary_metric].sum()) if total_primary_sum_valid(working_df[primary_metric]) else 1.0

    for cluster_id in range(best_k):
        c_df = working_df[working_df["cluster"] == cluster_id]
        count = len(c_df)
        pct_members = round((count / n_samples) * 100, 1)

        c_means = {f: round(float(c_df[f].mean()), 2) for f in valid_features}
        c_primary_sum = round(float(c_df[primary_metric].sum()), 2)
        pct_primary = round((c_primary_sum / max(1e-9, total_primary)) * 100, 1)

        # Derive human-friendly cluster label based on dominant standardized features
        label, subtitle, rec = generate_cluster_label(cluster_id, c_means, global_means, valid_features)

        # Sample members
        sample_recs = c_df.sort_values(by=primary_metric, ascending=False).head(5)
        samples = [
            {
                "entity": str(r[entity_col]),
                **{f: round(float(r[f]), 2) for f in valid_features}
            }
            for _, r in sample_recs.iterrows()
        ]

        segments.append({
            "label": label,
            "subtitle": subtitle,
            "member_count": count,
            "percentage_of_members": pct_members,
            "total_monetary": c_primary_sum,
            "percentage_of_monetary": pct_primary,
            "profile": {
                "centroids": c_means,
                "global_averages": {f: round(global_means[f], 2) for f in valid_features},
                "cluster_index": cluster_id,
            },
            "recommendation": rec,
            "sample_members": samples,
        })

    # Sort segments by total monetary/primary contribution descending
    segments.sort(key=lambda s: s["total_monetary"], reverse=True)

    return {
        "method": SegmentationMethod.KMEANS.value,
        "k": best_k,
        "silhouette_score": round(silhouette, 3),
        "cluster_evaluations": evaluations,
        "feature_columns": valid_features,
        "entity_column": entity_col,
        "total_entities": n_samples,
        "segments": segments,
        "assumptions": [
            f"Features ({', '.join(valid_features)}) were standardized with unit variance via StandardScaler prior to clustering.",
            f"Evaluated k-cluster configurations; selected k={best_k} with silhouette score of {round(silhouette, 3)}.",
            "Centroids reflect average metric levels per cluster relative to global dataset means.",
        ],
        "limitations": [
            "K-Means assumes spherical cluster geometry and Euclidean distance metric.",
            "Extreme outliers can influence centroid centers even after standard scaling.",
        ]
    }


def total_primary_sum_valid(series: pd.Series) -> bool:
    try:
        s = float(series.sum())
        return s > 0
    except Exception:
        return False


def generate_cluster_label(
    cluster_idx: int,
    cluster_means: dict[str, float],
    global_means: dict[str, float],
    features: list[str]
) -> tuple[str, str, str]:
    """Derives intuitive business labels and recommendations by contrasting cluster means to global means."""
    diffs = {}
    for f in features:
        gm = global_means.get(f, 0.0)
        cm = cluster_means.get(f, 0.0)
        diffs[f] = (cm - gm) / max(1e-6, abs(gm))

    # Identify primary differentiator
    max_f = max(diffs, key=lambda k: diffs[k])
    min_f = min(diffs, key=lambda k: diffs[k])

    if diffs[max_f] > 0.35 and diffs.get("revenue", 0.0) > 0.2:
        return (
            f"Cluster {cluster_idx + 1}: High-Value Growth Drivers",
            f"High {max_f.replace('_', ' ').title()} Core Performers",
            "Allocate dedicated account resources, nurture engagement, and cross-sell complementary services."
        )
    elif diffs[min_f] < -0.35 and diffs.get("revenue", 0.0) < -0.2:
        return (
            f"Cluster {cluster_idx + 1}: Low-Engagement Long-Tail",
            f"Below-Average {min_f.replace('_', ' ').title()} Base",
            "Streamline service costs with self-service tooling and light re-activation marketing."
        )
    elif diffs.get("quantity", 0.0) > 0.3:
        return (
            f"Cluster {cluster_idx + 1}: High-Volume / Velocity",
            "High Quantity Bulk Segment",
            "Optimize logistics and bulk pricing tiers to maximize unit economics."
        )
    else:
        return (
            f"Cluster {cluster_idx + 1}: Standard Core Segment",
            "Balanced Performance Cluster",
            "Maintain consistent operational cadences and standard marketing playbooks."
        )


# ---------------------------------------------------------------------------
# 3. ABC / PARETO PRODUCT & INVENTORY SEGMENTATION
# ---------------------------------------------------------------------------

def calculate_abc_pareto_segmentation(
    df: pd.DataFrame,
    product_col: str,
    monetary_col: str,
) -> dict[str, Any]:
    """Calculates classic 80/15/5 Pareto ABC catalog segmentation for products or services."""
    if product_col not in df.columns or monetary_col not in df.columns:
        raise SegmentationSuitabilityError(
            f"Missing product ({product_col}) or monetary ({monetary_col}) column for ABC segmentation."
        )

    clean_df = df[[product_col, monetary_col]].dropna().copy()
    clean_df[monetary_col] = pd.to_numeric(clean_df[monetary_col], errors="coerce").fillna(0.0)

    # Group by product and sum monetary value
    agg_df = clean_df.groupby(product_col)[monetary_col].sum().reset_index()
    agg_df = agg_df.sort_values(by=monetary_col, ascending=False).reset_index(drop=True)

    total_products = len(agg_df)
    total_revenue = float(agg_df[monetary_col].sum())

    if total_products < 2:
        raise SegmentationSuitabilityError("ABC analysis requires at least 2 distinct products.")

    if total_revenue <= 0:
        raise SegmentationSuitabilityError("ABC analysis requires positive cumulative revenue.")

    # Calculate cumulative distribution
    agg_df["cumulative_revenue"] = agg_df[monetary_col].cumsum()
    agg_df["cumulative_pct"] = (agg_df["cumulative_revenue"] / total_revenue) * 100.0

    # Assign classes
    def get_class(row_idx, cum_pct):
        # Guarantee first top item is in Class A even if it alone exceeds 80%
        if row_idx == 0 or cum_pct <= 80.0:
            return "Class A"
        elif cum_pct <= 95.0:
            return "Class B"
        else:
            return "Class C"

    agg_df["abc_class"] = [get_class(i, pct) for i, pct in enumerate(agg_df["cumulative_pct"])]

    class_meta = {
        "Class A": {
            "title": "Class A — Core Revenue Drivers (Top 80%)",
            "subtitle": "Vital few products generating the vast majority of business cash flow.",
            "recommendation": (
                "Protect inventory availability at all costs. Maintain tight supplier relationships, "
                "prioritize continuous quality assurance, and prevent any out-of-stock events."
            ),
        },
        "Class B": {
            "title": "Class B — Steady Mid-Tier Contributors (Next 15%)",
            "subtitle": "Secondary offerings supporting product breadth and consistent margin.",
            "recommendation": (
                "Automate standard replenishment orders. Monitor for products showing velocity "
                "momentum that could graduate into Class A, and maintain moderate safety stock."
            ),
        },
        "Class C": {
            "title": "Class C — Long-Tail / Low-Velocity (Final 5%)",
            "subtitle": "Long-tail catalog items with minimal revenue contribution.",
            "recommendation": (
                "Review carrying and storage costs. Rationalize slow-moving SKUs, consider make-to-order "
                "fulfillment, and bundle with Class A drivers to clear aged inventory."
            ),
        },
    }

    segments: list[dict[str, Any]] = []
    for cls_name in ["Class A", "Class B", "Class C"]:
        sub_df = agg_df[agg_df["abc_class"] == cls_name]
        count = len(sub_df)
        if count == 0:
            continue
        cls_rev = float(sub_df[monetary_col].sum())
        pct_catalog = round((count / total_products) * 100, 1)
        pct_rev = round((cls_rev / total_revenue) * 100, 1)
        avg_rev = round(cls_rev / count, 2)

        # Sample members
        samples = [
            {
                "product": str(r[product_col]),
                "revenue": round(float(r[monetary_col]), 2),
                "cumulative_pct": round(float(r["cumulative_pct"]), 1),
            }
            for _, r in sub_df.head(5).iterrows()
        ]

        meta = class_meta.get(cls_name, {})
        segments.append({
            "label": meta.get("title", cls_name),
            "subtitle": meta.get("subtitle", ""),
            "member_count": count,
            "percentage_of_members": pct_catalog,
            "total_monetary": round(cls_rev, 2),
            "percentage_of_monetary": pct_rev,
            "profile": {
                "class_code": cls_name,
                "avg_revenue_per_product": avg_rev,
                "catalog_count": count,
            },
            "recommendation": meta.get("recommendation", ""),
            "sample_members": samples,
        })

    return {
        "method": SegmentationMethod.ABC_PARETO.value,
        "product_column": product_col,
        "monetary_column": monetary_col,
        "total_products": total_products,
        "total_monetary": round(total_revenue, 2),
        "segments": segments,
        "assumptions": [
            "Pareto cumulative revenue boundaries: Class A (0% - 80%), Class B (80% - 95%), Class C (95% - 100%).",
            "Products are evaluated by cumulative invoiced revenue in descending rank order.",
        ],
        "limitations": [
            "Does not account for product profit margins, carrying costs, or lead-time volatility.",
            "New product launches with low historical revenue are categorized into Class C regardless of potential.",
        ]
    }


# ---------------------------------------------------------------------------
# 4. ORCHESTRATOR
# ---------------------------------------------------------------------------

def run_segmentation(
    df: pd.DataFrame,
    method: str = "auto",
    entity_col: str | None = None,
    date_col: str | None = None,
    monetary_col: str | None = None,
    feature_cols: list[str] | None = None,
    k: int | None = None,
) -> dict[str, Any]:
    """Orchestrates segmentation runs by inspecting schema and executing chosen or auto-selected model."""
    schema = detect_segmentation_schema(df)

    # Resolve target method
    chosen_method = method.lower() if method else "auto"
    if chosen_method == "auto":
        chosen_method = schema["suggested_method"]

    if chosen_method == SegmentationMethod.RFM.value:
        resolved_entity = entity_col or schema["suggested_entity_column"]
        resolved_date = date_col or schema["suggested_date_column"]
        resolved_monetary = monetary_col or schema["suggested_monetary_column"]

        if not resolved_entity or not resolved_date or not resolved_monetary:
            raise SegmentationSuitabilityError(
                "RFM segmentation requires entity, date, and monetary columns. "
                f"Detected: entity={resolved_entity}, date={resolved_date}, monetary={resolved_monetary}"
            )
        return calculate_rfm_segmentation(df, resolved_entity, resolved_date, resolved_monetary)

    elif chosen_method == SegmentationMethod.ABC_PARETO.value:
        resolved_product = entity_col or (schema["product_columns"][0] if schema["product_columns"] else schema["suggested_entity_column"])
        resolved_monetary = monetary_col or schema["suggested_monetary_column"]

        if not resolved_product or not resolved_monetary:
            raise SegmentationSuitabilityError(
                "ABC Pareto segmentation requires product entity and monetary columns."
            )
        return calculate_abc_pareto_segmentation(df, resolved_product, resolved_monetary)

    elif chosen_method == SegmentationMethod.KMEANS.value:
        resolved_features = feature_cols or schema["numeric_columns"]
        resolved_entity = entity_col or schema["suggested_entity_column"]
        return calculate_kmeans_segmentation(df, resolved_features, resolved_entity, k=k)

    else:
        raise SegmentationSuitabilityError(f"Unsupported segmentation method: {chosen_method}")
