import csv
import json
import random
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

# Deterministic seed for reproducible enterprise records
random.seed(42)

COMPANIES = [
    ("Apex Global Logistics", "Logistics & Supply Chain", "North America"),
    ("Vertex Cloud Infrastructure", "Enterprise Software", "North America"),
    ("Quantum Dynamics Labs", "Aerospace & Defense", "North America"),
    ("Solaris Health Systems", "Healthcare & Life Sciences", "North America"),
    ("Horizon Media Group", "Media & Entertainment", "North America"),
    ("Nordic FinTech Solutions", "Finance & FinTech", "EMEA"),
    ("Bavaria Auto Automation", "Manufacturing & Automotive", "EMEA"),
    ("Helvetia Wealth Partners", "Finance & FinTech", "EMEA"),
    ("Lumina Biopharma", "Healthcare & Life Sciences", "EMEA"),
    ("Aether Telecom UK", "Telecommunications", "EMEA"),
    ("Tokyo Robotics Corp", "Manufacturing & Robotics", "APAC"),
    ("Singapore Capital Holdings", "Finance & FinTech", "APAC"),
    ("Pacific Rim Retail Ltd", "Retail & Ecommerce", "APAC"),
    ("Seoul AI Diagnostics", "Healthcare & Life Sciences", "APAC"),
    ("Indus AgriTech Innovations", "Agriculture & IoT", "APAC"),
    ("Sao Paulo Payments Inc", "Finance & FinTech", "Latin America"),
    ("Andes Energy Logistics", "Energy & Utilities", "Latin America"),
    ("Maya Consumer Products", "Retail & Ecommerce", "Latin America"),
    ("Crestview Financial", "Finance & FinTech", "North America"),
    ("Starlight CyberSec", "Enterprise Software", "North America"),
    ("Titanium Metals Global", "Manufacturing & Heavy Industry", "North America"),
    ("Cobalt Cloud Networks", "Telecommunications", "EMEA"),
    ("Kyoto Precision Instruments", "Manufacturing & Robotics", "APAC"),
    ("Panama Shipping Lines", "Logistics & Supply Chain", "Latin America"),
    ("Aura BioSystems", "Healthcare & Life Sciences", "EMEA"),
    ("Pinnacle Asset Management", "Finance & FinTech", "North America"),
    ("Beacon Retail Enterprises", "Retail & Ecommerce", "North America"),
    ("CyberShield Europe", "Enterprise Software", "EMEA"),
    ("Oceanic Data Services", "Telecommunications", "APAC"),
    ("BioGenetics Australasia", "Healthcare & Life Sciences", "APAC"),
]

PRODUCT_TIERS = [
    ("Enterprise Elite Suite", 185000, 280000),
    ("Professional Cloud Core", 75000, 145000),
    ("AI Predictive Engine", 95000, 190000),
    ("Growth Accelerator Tier", 35000, 68000),
    ("Essential Analytics Pack", 18000, 32000),
]

PAYMENT_STATUSES = ["Completed", "Completed", "Completed", "Renewed", "Pending"]
CONTRACT_LENGTHS = [12, 24, 36]
CHURN_RISKS = ["Minimal", "Low", "Low", "Medium", "Elevated"]

records = []
start_date = datetime(2023, 1, 15)

for i in range(1, 55):
    comp_name, sector, region = random.choice(COMPANIES)
    prod_tier, min_rev, max_rev = random.choice(PRODUCT_TIERS)
    
    # Generate realistic dates across 2023 to early 2024
    days_offset = int((i / 55.0) * 410) + random.randint(-5, 5)
    rec_date = start_date + timedelta(days=max(0, days_offset))
    date_str = rec_date.strftime("%Y-%m-%d")
    
    arr_usd = round(random.uniform(min_rev, max_rev), 2)
    contract_mo = random.choice(CONTRACT_LENGTHS)
    status = random.choice(PAYMENT_STATUSES)
    churn_risk = random.choice(CHURN_RISKS)
    nps = random.randint(7, 10) if churn_risk in ["Minimal", "Low"] else random.randint(4, 7)
    usage_units = random.randint(350, 4800)
    
    records.append({
        "transaction_id": f"NXSP-{2023 + (1 if rec_date.year == 2024 else 0)}-{i:04d}",
        "customer_name": comp_name,
        "industry_sector": sector,
        "region": region,
        "product_tier": prod_tier,
        "order_date": date_str,
        "revenue_usd": arr_usd,
        "contract_months": contract_mo,
        "payment_status": status,
        "nps_score": nps,
        "monthly_usage_units_k": usage_units,
        "churn_risk_level": churn_risk
    })

# Sort chronologically
records.sort(key=lambda r: r["order_date"])

# 1. Output CSV file
csv_path = Path(r"e:\GitHub Works\InsightForge-AI\datasets_sample\NexusSphere_Enterprise_Sales_2023_2024.csv")
with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(records[0].keys()))
    writer.writeheader()
    writer.writerows(records)

print(f"Generated CSV with {len(records)} records at: {csv_path}")

# Calculate summaries
total_revenue = sum(r["revenue_usd"] for r in records)
avg_revenue = total_revenue / len(records)
avg_nps = sum(r["nps_score"] for r in records) / len(records)
region_counts = {}
region_rev = {}
for r in records:
    reg = r["region"]
    region_counts[reg] = region_counts.get(reg, 0) + 1
    region_rev[reg] = region_rev.get(reg, 0.0) + r["revenue_usd"]

# 2. Output HTML file for Edge PDF compilation
html_path = Path(r"e:\GitHub Works\InsightForge-AI\datasets_sample\NexusSphere_Enterprise_Sales_2023_2024.html")
pdf_path = Path(r"e:\GitHub Works\InsightForge-AI\datasets_sample\NexusSphere_Enterprise_Sales_2023_2024.pdf")

rows_html = ""
for idx, r in enumerate(records):
    risk_color = "#10b981" if r["churn_risk_level"] in ["Minimal", "Low"] else ("#f59e0b" if r["churn_risk_level"] == "Medium" else "#ef4444")
    risk_bg = "#ecfdf5" if r["churn_risk_level"] in ["Minimal", "Low"] else ("#fffbeb" if r["churn_risk_level"] == "Medium" else "#fef2f2")
    
    status_badge = f'<span style="background: #f1f5f9; color: #334155; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 600;">{r["payment_status"]}</span>'
    if r["payment_status"] == "Renewed":
        status_badge = f'<span style="background: #e0e7ff; color: #4338ca; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 600;">{r["payment_status"]}</span>'
        
    bg_row = "#ffffff" if idx % 2 == 0 else "#f8fafc"
    rows_html += f"""
    <tr style="background-color: {bg_row}; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 7px 10px; font-family: monospace; font-weight: 600; color: #0f172a;">{r["transaction_id"]}</td>
        <td style="padding: 7px 10px; font-weight: 600; color: #1e293b;">{r["customer_name"]}</td>
        <td style="padding: 7px 10px; color: #475569;">{r["industry_sector"]}</td>
        <td style="padding: 7px 10px; color: #475569;">{r["region"]}</td>
        <td style="padding: 7px 10px; color: #1e293b; font-weight: 500;">{r["product_tier"]}</td>
        <td style="padding: 7px 10px; color: #64748b; font-family: monospace;">{r["order_date"]}</td>
        <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #047857; font-family: monospace;">${r["revenue_usd"]:,.2f}</td>
        <td style="padding: 7px 10px; text-align: center; color: #475569;">{r["contract_months"]} mo</td>
        <td style="padding: 7px 10px; text-align: center;">{status_badge}</td>
        <td style="padding: 7px 10px; text-align: center; font-weight: 600;">{r["nps_score"]}/10</td>
        <td style="padding: 7px 10px; text-align: center;">
            <span style="background: {risk_bg}; color: {risk_color}; border: 1px solid {risk_color}40; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700;">
                {r["churn_risk_level"]}
            </span>
        </td>
    </tr>
    """

region_summary_html = ""
for reg, rev in sorted(region_rev.items(), key=lambda x: x[1], reverse=True):
    share = (rev / total_revenue) * 100
    cnt = region_counts[reg]
    region_summary_html += f"""
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">{reg}</td>
        <td style="padding: 8px 12px; text-align: center; color: #475569;">{cnt} accounts</td>
        <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #047857;">${rev:,.2f}</td>
        <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: #4338ca;">{share:.1f}%</td>
    </tr>
    """

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>NexusSphere Technologies, Inc. - Enterprise Sales & Revenue Ledger</title>
<style>
    @page {{
        size: letter landscape;
        margin: 12mm 10mm 12mm 10mm;
    }}
    body {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        margin: 0;
        padding: 0;
        line-height: 1.4;
    }}
    .header-box {{
        background: linear-gradient(135deg, #090d16 0%, #151b28 100%);
        color: #ffffff;
        padding: 20px 24px;
        border-radius: 12px;
        margin-bottom: 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }}
    .badge {{
        display: inline-block;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        background: rgba(255, 60, 2, 0.2);
        color: #ff7b52;
        border: 1px solid rgba(255, 60, 2, 0.4);
    }}
    .stats-grid {{
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }}
    .stat-card {{
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px 16px;
    }}
    .stat-label {{
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.05em;
    }}
    .stat-val {{
        font-size: 19px;
        font-weight: 800;
        color: #0f172a;
        margin-top: 4px;
    }}
    .table-container {{
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
    }}
    .table-container th {{
        background: #0f172a;
        color: #f8fafc;
        padding: 9px 10px;
        text-align: left;
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }}
    .section-title {{
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #1e293b;
        margin: 20px 0 8px 0;
        display: flex;
        align-items: center;
        gap: 6px;
    }}
    .section-title::before {{
        content: "";
        display: inline-block;
        width: 4px;
        height: 14px;
        background: #ff3c02;
        border-radius: 2px;
    }}
    .meta-box {{
        background: #f1f5f9;
        border-left: 4px solid #ff3c02;
        padding: 10px 14px;
        border-radius: 0 8px 8px 0;
        font-size: 11px;
        color: #334155;
        margin-bottom: 16px;
    }}
    .footer-box {{
        margin-top: 24px;
        padding-top: 12px;
        border-top: 1px solid #cbd5e1;
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #64748b;
    }}
</style>
</head>
<body>

<div class="header-box">
    <div>
        <div class="badge">Official Corporate Dataset • Confidential Benchmark</div>
        <h1 style="margin: 6px 0 2px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">
            NexusSphere Technologies, Inc. (NASDAQ: NXSP)
        </h1>
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
            Enterprise Customer Subscriptions, Transaction Ledger & Regional Revenue Dataset (FY2023 - FY2024)
        </p>
    </div>
    <div style="text-align: right;">
        <div style="font-size: 11px; color: #94a3b8;">Generated: October 2026</div>
        <div style="font-size: 11px; color: #94a3b8;">Scope: 54 Enterprise Accounts</div>
        <div style="font-size: 11px; color: #94a3b8;">Format: Deterministic Relational Schema</div>
    </div>
</div>

<div class="meta-box">
    <strong>Dataset Overview:</strong> This certified enterprise dataset records annualized contract value (ARR), subscription product tiers, retention indices, customer satisfaction (NPS), and telemetry usage volume for NexusSphere's global B2B client portfolio. Designed for advanced regression forecasting, cohort segmentation, and anomaly detection audits.
</div>

<div class="stats-grid">
    <div class="stat-card">
        <div class="stat-label">Total Contract Value (ARR)</div>
        <div class="stat-val" style="color: #047857;">${total_revenue:,.2f}</div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Average Contract Size</div>
        <div class="stat-val">${avg_revenue:,.2f}</div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Mean Net Promoter Score</div>
        <div class="stat-val" style="color: #4338ca;">{avg_nps:.1f} / 10</div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Total Client Entities</div>
        <div class="stat-val">{len(records)} Accounts</div>
    </div>
</div>

<div class="section-title">Regional Distribution & Revenue Share Summary</div>
<table style="width: 100%; max-width: 650px; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <thead>
        <tr style="background: #1e293b; color: #f8fafc; font-size: 10.5px; text-transform: uppercase;">
            <th style="padding: 7px 12px; text-align: left;">Global Region</th>
            <th style="padding: 7px 12px; text-align: center;">Account Count</th>
            <th style="padding: 7px 12px; text-align: right;">Total Monetized Value</th>
            <th style="padding: 7px 12px; text-align: right;">Contribution</th>
        </tr>
    </thead>
    <tbody>
        {region_summary_html}
    </tbody>
</table>

<div class="section-title">Complete Tabular Enterprise Ledger (54 Transactions)</div>
<table class="table-container">
    <thead>
        <tr>
            <th>Txn ID</th>
            <th>Client Account</th>
            <th>Industry Sector</th>
            <th>Region</th>
            <th>Product Tier</th>
            <th>Order Date</th>
            <th style="text-align: right;">Revenue (ARR)</th>
            <th style="text-align: center;">Duration</th>
            <th style="text-align: center;">Status</th>
            <th style="text-align: center;">NPS</th>
            <th style="text-align: center;">Risk Level</th>
        </tr>
    </thead>
    <tbody>
        {rows_html}
    </tbody>
</table>

<div class="footer-box">
    <div><strong>NexusSphere Data Platform</strong> • Austin, TX 78701 • Verification Hash: SHA256-NXSP-882194</div>
    <div>Page 1 of 1 • Internal Commercial Dataset • Machine-Readable & Ingestion-Ready</div>
</div>

</body>
</html>
"""

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Generated HTML template at: {html_path}")

# 3. Compile to PDF using Microsoft Edge headless
edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
cmd = [
    edge_exe,
    "--headless",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    f"--print-to-pdf={pdf_path}",
    f"file:///{html_path.resolve().as_posix()}"
]

print("Compiling PDF with Microsoft Edge...")
res = subprocess.run(cmd, capture_output=True, text=True)
if pdf_path.exists():
    print(f"SUCCESS: Created PDF at {pdf_path} (size: {pdf_path.stat().st_size} bytes)")
else:
    print(f"Error compiling PDF: {res.stderr}")
