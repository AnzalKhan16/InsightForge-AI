import pandas as pd
import numpy as np
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class BusinessAnalyticsEngine:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        
        # Standardize column names for easier mapping
        self.cols_lower = {col: col.lower() for col in self.df.columns}
        self.dimensions = []
        self.metrics = []
        self.date_cols = []
        self.identify_column_types()

    def identify_column_types(self):
        for col in self.df.columns:
            dtype = self.df[col].dtype
            unique_count = self.df[col].nunique()
            
            if pd.api.types.is_datetime64_any_dtype(dtype):
                self.date_cols.append(col)
            elif pd.api.types.is_numeric_dtype(dtype):
                # ID columns might be numeric, we shouldn't use them as metrics normally, but let's keep it simple
                if "id" not in col.lower():
                    self.metrics.append(col)
                if unique_count < 50: # could be categorical
                    self.dimensions.append(col)
            else:
                if unique_count < 50: # categorical
                    self.dimensions.append(col)
                
                # Check if it could be a date column that wasn't parsed
                if "date" in col.lower() or "time" in col.lower():
                    try:
                        self.df[col] = pd.to_datetime(self.df[col])
                        self.date_cols.append(col)
                        if col in self.dimensions:
                            self.dimensions.remove(col)
                    except:
                        pass
                        
    def get_core_metrics(self) -> Dict[str, Any]:
        result = {
            "order_count": len(self.df),
            "revenue": None,
            "profit": None,
            "customer_count": None,
            "aov": None
        }
        
        revenue_aliases = ["revenue", "sales", "price", "amount", "total"]
        profit_aliases = ["profit", "cost", "margin"]
        customer_aliases = ["customer", "user", "client", "email", "account"]
        
        revenue_col = None
        
        # Calculate revenue
        for col, lower in self.cols_lower.items():
            if any(alias in lower for alias in revenue_aliases) and pd.api.types.is_numeric_dtype(self.df[col]):
                result["revenue"] = float(self.df[col].sum())
                revenue_col = col
                break
                
        # Calculate profit
        for col, lower in self.cols_lower.items():
            if any(alias in lower for alias in profit_aliases) and pd.api.types.is_numeric_dtype(self.df[col]):
                if "cost" in lower and revenue_col:
                    result["profit"] = float(self.df[revenue_col].sum() - self.df[col].sum())
                else:
                    result["profit"] = float(self.df[col].sum())
                break
                
        # Customer count
        for col, lower in self.cols_lower.items():
            if any(alias in lower for alias in customer_aliases):
                result["customer_count"] = int(self.df[col].nunique())
                break
                
        if result["revenue"] is not None and result["order_count"] > 0:
            result["aov"] = result["revenue"] / result["order_count"]
            
        return result
        
    def get_time_series(self) -> List[Dict[str, Any]]:
        if not self.date_cols:
            return []
            
        date_col = self.date_cols[0]
        metric_col = self.metrics[0] if self.metrics else None
        
        if metric_col:
            # Group by month
            ts = self.df.set_index(date_col).resample('ME')[metric_col].sum().reset_index()
            # Convert timestamps to string format for JSON serialization
            ts[date_col] = ts[date_col].dt.strftime('%Y-%m-%d')
            # Handle NaNs
            ts = ts.fillna(0)
            
            records = ts.to_dict(orient="records")
            return [
                {
                    "date": rec[date_col],
                    "value": rec[metric_col]
                } for rec in records
            ]
        return []
        
    def get_dimension_breakdowns(self) -> Dict[str, List[Dict[str, Any]]]:
        breakdowns = {}
        metric_col = self.metrics[0] if self.metrics else None
        
        if not metric_col:
            # If no metric, just do value counts
            for dim in self.dimensions:
                counts = self.df[dim].value_counts().head(10)
                breakdowns[dim] = [{"label": str(k), "value": int(v)} for k, v in counts.items()]
            return breakdowns
            
        for dim in self.dimensions:
            # Group by dimension and sum metric
            grouped = self.df.groupby(dim)[metric_col].sum().sort_values(ascending=False).head(10)
            breakdowns[dim] = [{"label": str(k), "value": float(v)} for k, v in grouped.items()]
            
        return breakdowns

    def analyze(self) -> Dict[str, Any]:
        return {
            "metrics": self.get_core_metrics(),
            "time_series": self.get_time_series(),
            "breakdowns": self.get_dimension_breakdowns(),
            "detected_schema": {
                "dimensions": self.dimensions,
                "metrics": self.metrics,
                "date_columns": self.date_cols
            }
        }
