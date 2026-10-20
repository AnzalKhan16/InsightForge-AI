"""Seed script to bootstrap a rich demo environment with realistic transactions, analytics, forecasts, anomalies, segments, and executive reports."""
import io
import sys
import os
from datetime import datetime, timedelta
import random

# Ensure app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.db.base import Base
from app.db.session import get_engine

def seed():
    print("--- Initializing database tables ---")
    Base.metadata.create_all(bind=get_engine())

    client = TestClient(app)

    print("--- Registering or logging in demo user ---")
    demo_email = "demo@insightforge.ai"
    demo_password = "password123"
    
    # Try register
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": demo_email,
        "password": demo_password,
        "full_name": "Executive Demo User"
    })
    
    login_resp = client.post("/api/v1/auth/login", data={
        "username": demo_email,
        "password": demo_password
    })
    
    if login_resp.status_code != 200:
        print(f"Failed to login: {login_resp.text}")
        return

    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get Workspace
    ws_resp = client.get("/api/v1/workspaces", headers=headers)
    workspaces = ws_resp.json()
    if not workspaces:
        print("No workspace found!")
        return
    workspace_id = workspaces[0]["id"]
    print(f"Using Workspace: {workspaces[0]['name']} (ID: {workspace_id})")

    # Check if dataset already exists
    ds_list_resp = client.get(f"/api/v1/workspaces/{workspace_id}/datasets", headers=headers)
    datasets = ds_list_resp.json()
    
    if datasets:
        dataset_id = datasets[0]["id"]
        print(f"Using existing dataset: {datasets[0]['name']} (ID: {dataset_id})")
    else:
        print("--- Generating Realistic Retail Transaction Dataset ---")
        categories = ["Electronics", "Apparel", "Home & Kitchen", "Footwear", "Office Supplies"]
        regions = ["North America", "Europe", "Asia Pacific", "Latin America"]
        customers = [
            "Acme Corp", "Apex Technologies", "Starlight Media", "BlueWave Logistics",
            "OmniRetail Global", "Beacon Enterprises", "Quantum Dynamic", "Zenith Retail",
            "Vanguard Partners", "Horizon Capital", "Pinnacle Brands", "Solstice Supply"
        ]

        rows = ["order_id,customer_name,order_date,revenue,quantity,product_category,region"]
        base_date = datetime(2023, 1, 15)
        
        # 100 historical orders with consistent seasonal growth
        for i in range(1, 101):
            date = base_date + timedelta(days=int(i * 3.4))
            date_str = date.strftime("%Y-%m-%d")
            cust = random.choice(customers)
            cat = random.choice(categories)
            reg = random.choice(regions)
            qty = random.randint(1, 8)
            # base revenue with slight upward trend
            rev = round(random.uniform(120.0, 950.0) + (i * 4.2), 2)
            
            # Add one outlier negative return and one massive VIP order for anomaly/segmentation detection
            if i == 45:
                rev = -180.00  # Invariant violation refund
            elif i == 88:
                rev = 4850.00  # High-volume VIP purchase

            rows.append(f"{1000 + i},{cust},{date_str},{rev},{qty},{cat},{reg}")

        csv_content = "\n".join(rows).encode("utf-8")
        files = {'file': ('global_retail_sales_2023.csv', io.BytesIO(csv_content), 'text/csv')}
        data = {'name': 'Global Retail & E-Commerce 2023'}

        upload_resp = client.post(
            f"/api/v1/workspaces/{workspace_id}/datasets",
            headers=headers,
            files=files,
            data=data
        )
        if upload_resp.status_code != 200:
            print(f"Failed to upload dataset: {upload_resp.text}")
            return
        dataset = upload_resp.json()
        dataset_id = dataset["id"]
        print(f"Created dataset: {dataset['name']} (ID: {dataset_id})")

    # 1. Run Analytics profiling
    print("--- Computing Deterministic Analytics & KPI Visuals ---")
    an_res = client.post(f"/api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/analyze", headers=headers)
    if an_res.status_code == 200 and "job_id" in an_res.json():
        from app.core.analytics_task import analyze_dataset_task
        import uuid as _uuid
        analyze_dataset_task(_uuid.UUID(an_res.json()["job_id"]))

    # 2. Generate Grounded AI Insights
    print("--- Synthesizing Grounded Strategic Insights ---")
    ins_res = client.post(f"/api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/insights/generate", headers=headers)
    if ins_res.status_code == 200 and "job_id" in ins_res.json():
        from app.core.insights_task import generate_insights_task
        import uuid as _uuid
        generate_insights_task(_uuid.UUID(ins_res.json()["job_id"]))

    # 3. Generate Forecast
    print("--- Running Time-Series Forecast ---")
    client.post(f"/api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/forecast", headers=headers, json={
        "target_column": "revenue",
        "horizon": 6,
        "model_type": "auto"
    })

    # 4. Detect Anomalies
    print("--- Running Multi-Method Anomaly Detection ---")
    client.post(f"/api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/anomalies/detect", headers=headers, json={
        "target_column": "revenue",
        "method": "all"
    })

    # 5. Customer Segmentation
    print("--- Running RFM Customer Segmentation ---")
    client.post(f"/api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/segmentation", headers=headers, json={
        "method": "rfm",
        "entity_column": "customer_name",
        "monetary_column": "revenue",
        "date_column": "order_date"
    })

    # 6. Generate Executive Report
    print("--- Compiling Boardroom Executive Briefing ---")
    client.post(f"/api/v1/workspaces/{workspace_id}/datasets/{dataset_id}/reports", headers=headers, json={
        "title": "2023-2024 Boardroom Strategic Performance Briefing"
    })

    print("\n=======================================================")
    print("SUCCESS: Demo environment seeded!")
    print(f"Login Credentials:")
    print(f"  Email:    {demo_email}")
    print(f"  Password: {demo_password}")
    print(f"Direct Analytics URL:")
    print(f"  http://localhost:3000/workspaces/{workspace_id}/datasets/{dataset_id}/analytics")
    print("=======================================================\n")

if __name__ == "__main__":
    seed()
