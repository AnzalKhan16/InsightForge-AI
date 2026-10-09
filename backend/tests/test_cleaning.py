import pandas as pd
from app.core.cleaning import apply_cleaning_operation

def test_cleaning_pipeline():
    df = pd.DataFrame({
        "id": [1, 2, 3, 4, 1],
        "name": ["John", " Jane ", "Bob", "Alice", "John"],
        "age": ["28", "", "45", "32", "28"],
        "revenue": [1000.5, 2000.0, None, 1500.75, 1000.5]
    })

    # Test trim whitespace
    df = apply_cleaning_operation(df, "trim_whitespace", ["name"], None)
    assert df["name"].iloc[1] == "Jane"

    # Test convert type
    df = apply_cleaning_operation(df, "convert_type", ["age"], {"type": "numeric"})
    assert pd.isna(df["age"].iloc[1])
    assert df["age"].iloc[0] == 28.0

    # Test drop duplicates
    df = apply_cleaning_operation(df, "drop_duplicates", None, None)
    assert len(df) == 4

    # Test drop na
    df = apply_cleaning_operation(df, "drop_na", ["revenue"], None)
    assert len(df) == 3

    # Test fill na
    df = apply_cleaning_operation(df, "fill_na", ["age"], {"value": 0})
    assert df["age"].iloc[1] == 0.0

