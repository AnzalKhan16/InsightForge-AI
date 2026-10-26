# InsightForge AI - Cloud Deployment Guide (Vercel + Render / Railway)

This guide walks you through deploying **InsightForge AI** into production using the recommended modern PaaS stack:
- **Frontend**: **Vercel** (Next.js 15, Global Edge CDN, automated SSL)
- **Backend**: **Render.com** or **Railway.app** (FastAPI, Python 3.11)
- **Database**: **Render Managed PostgreSQL 16** (Persistent storage with automatic connection string)

---

## Architecture Topology

```
   [ Users / Browsers ]
            │
            ▼ (HTTPS)
┌────────────────────────┐
│   Vercel Edge Network  │ ──► Next.js 15 Frontend
│  (Global CDN / SSL)    │     https://your-app.vercel.app
└────────────────────────┘
            │  REST API Calls
            │  (NEXT_PUBLIC_API_BASE_URL)
            ▼ (HTTPS)
┌────────────────────────┐
│    Render.com Service  │ ──► FastAPI Backend (Port 8000 / $PORT)
│  (Auto-scaling Web)    │     https://your-backend.onrender.com
└────────────────────────┘
            │
            ├────────────────────────┐
            ▼                        ▼
┌────────────────────────┐   ┌────────────────────────┐
│  Render Managed Postgres│   │ Local / S3 Storage     │
│   (Database Cluster)   │   │  (Dataset Artifacts)   │
└────────────────────────┘   └────────────────────────┘
```

---

## Prerequisites

1. Your code pushed to a GitHub repository:
   ```bash
   git add .
   git commit -m "chore: prepare for production deployment"
   git push origin main
   ```
2. Free account on [GitHub](https://github.com)
3. Free account on [Render.com](https://render.com)
4. Free account on [Vercel.com](https://vercel.com)

---

## Step 1: Deploy Database & Backend on Render (5 Minutes)

We have provided a complete Infrastructure-as-Code blueprint file in the repository root: [`render.yaml`](../render.yaml).

### Method A: 1-Click Blueprint (Recommended)
1. Navigate to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** (top right) and select **Blueprint**.
3. Select your `InsightForge-AI` GitHub repository.
4. Render will detect `render.yaml` and display:
   - **Database**: `insightforge-db` (PostgreSQL 16)
   - **Web Service**: `insightforge-backend` (FastAPI)
5. Click **Apply**.
6. Render will automatically:
   - Provision the PostgreSQL database.
   - Install Python dependencies from `backend/requirements.txt`.
   - Run `python scripts/seed_demo.py` to create tables and pre-load the enterprise demo datasets.
   - Start the Uvicorn web server.
7. Once deployed (green checkmark), copy your Backend URL:
   `https://insightforge-backend-xxxx.onrender.com`

### Method B: Manual Render Setup (If not using Blueprint)
1. **Create PostgreSQL**:
   - Click **New +** -> **PostgreSQL**.
   - Name: `insightforge-db`, Database: `insightforge`, User: `insightforge`.
   - Copy the **Internal Database URL**.
2. **Create Web Service**:
   - Click **New +** -> **Web Service**.
   - Root Directory: `backend`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python scripts/seed_demo.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Add Environment Variables:
     - `IF_ENVIRONMENT`: `production`
     - `IF_DEBUG`: `false`
     - `IF_SECRET_KEY`: *(click Generate)*
     - `IF_DATABASE_URL`: *(paste Internal Database URL)*
     - `IF_CORS_ORIGINS`: `*` (or your Vercel URL once created)
     - `IF_STORAGE_BACKEND`: `local`
     - `IF_STORAGE_LOCAL_DIR`: `/tmp/data/raw`

---

## Step 2: Deploy Frontend on Vercel (3 Minutes)

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your `InsightForge-AI` GitHub repository.
4. In the **Configure Project** screen:
   - **Framework Preset**: Next.js (automatically detected).
   - **Root Directory**: Click **Edit** and choose `frontend`.
5. Expand **Environment Variables** and add:
   - **Key**: `NEXT_PUBLIC_API_BASE_URL`
   - **Value**: `https://insightforge-backend-xxxx.onrender.com` *(your Render backend URL from Step 1, without trailing slash)*
6. Click **Deploy**.
7. Vercel will build the Next.js application, optimize assets, and deploy to their global edge network in ~60 seconds.
8. Click the assigned deployment URL:
   `https://insightforge-ai-xxxx.vercel.app`

---

## Step 3: Link CORS Security & Finalize

1. Go back to your [Render Dashboard](https://dashboard.render.com).
2. Click on `insightforge-backend` -> **Environment**.
3. Update `IF_CORS_ORIGINS` with your live Vercel domain:
   ```ini
   IF_CORS_ORIGINS=https://insightforge-ai-xxxx.vercel.app,http://localhost:3000
   ```
4. Render will automatically redeploy the backend with updated CORS rules in ~30 seconds.

---

## Step 4: Verify Your Live Production Deployment

1. Open your Vercel URL in your browser: `https://your-app.vercel.app`.
2. The landing page will load with the Cryptox dark obsidian theme.
3. Test logging in or viewing the pre-seeded enterprise workspace:
   - **Email**: `demo@insightforge.ai`
   - **Password**: `password123`
4. Access the Analytics Suite:
   `https://your-app.vercel.app/workspaces/88e9b75e-944d-4031-8d00-d3d5d1541818/datasets/6655e6d0-8986-4d4d-a0b1-2bb30f5ceada/analytics`
5. Test uploading a new CSV dataset or the sample PDF dataset (`NexusSphere_Enterprise_Sales_2023_2024.pdf`).

---

## Optional: Alternative 1-Click Deployment on Railway.app

If you prefer deploying everything on a single platform:
1. Log into [Railway.app](https://railway.app).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select `InsightForge-AI`.
4. Railway will create services for the database and web app based on your repository.
5. Add PostgreSQL and Redis from the Railway palette with 1 click.
6. Connect environment variables and deploy.
