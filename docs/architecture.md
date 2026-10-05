# InsightForge AI - Product Blueprint & Architecture

## Phase 0: Product & Architecture Planning

**Date:** October 5, 2026
**Status:** Initial Draft

---

## 1. Problem Statement
Many small to medium enterprises (SMEs) and business users have valuable data locked in spreadsheets (CSV, Excel) but lack the data science, data engineering, and analytics expertise to extract meaningful, actionable insights. Existing BI tools often require complex setup, SQL knowledge, or data modeling, while raw LLMs struggle with large datasets, lack deterministic mathematical accuracy, and can hallucinate when performing numerical aggregations. There is a need for a platform that bridges the gap, allowing users to simply upload data and automatically receive deterministic analytics, ML-driven forecasts, and natural language AI insights.

## 2. Target Users
- **Business Analysts & Managers:** Professionals needing quick insights and reports without writing code or writing complex SQL.
- **Founders & Executives in SMEs:** Leaders seeking data-driven decisions from their sales, marketing, or operational data without hiring a data team.
- **Marketing & Sales Teams:** Users looking for customer segmentation, campaign performance analysis, and revenue forecasting.

## 3. User Personas
- **"Data-curious" Dave (Marketing):** A marketing manager with a CSV of campaign results. He knows Excel but wants deeper insights (segmentation, trends) and an AI to "tell him what this means".
- **"Strategic" Sarah (CEO):** CEO of a small startup. She uploads monthly financial data and wants the AI to provide a clear summary report, highlight anomalies, and forecast next quarter's runway.
- **"Time-poor" Tom (Sales):** Sales director with extensive CRM exports. He wants to know quickly which regions are underperforming and why, without building complex dashboards.

## 4. Main User Journeys
1. **Onboarding & Upload:** User signs in, creates a new project, and uploads a dataset (CSV or Excel).
2. **Data Profiling & Cleaning:** The system profiles the data (types, missing values, distributions), standardizes it, and saves it in an optimized format.
3. **Exploratory Analytics (Automated):** User views automatically generated charts (trends, distributions, correlations) tailored to the specific data types detected.
4. **AI Insight Generation:** User views an AI-generated executive summary explaining key drivers, anomalies, and underlying patterns.
5. **Conversational Analytics (Q&A):** User asks questions like "What drove the drop in sales in Q3?" and the system provides contextual charts and text answers.
6. **Advanced ML Application:** User requests a forecast on a time-series column or segmentation on customer data.

## 5. Core Features
- Dataset upload (CSV, Excel) with robust parsing and validation.
- Automated data profiling (descriptive statistics, missing values, type inference).
- Data cleaning (imputation, standardization).
- Automated visualization generation based on data context.
- Deterministic statistical and ML tools (time-series forecasting, anomaly detection, clustering).
- AI-generated executive summaries and natural language business insights.
- Chat-based conversational interface for asking data questions.

## 6. MVP Features
- File upload (CSV only initially, max 50MB limit).
- Basic data profiling (row count, column types, null counts, min/max/mean).
- Simple automated charts (bar charts for categories, line charts for dates).
- LLM-powered data summary (sending data schema and basic stats as context to LLM).
- Simple chat interface utilizing predefined deterministic tools (e.g., filtering, grouping) to answer basic user questions.
- Time-series forecasting for simple date-value pairs.

## 7. Future Features
- Connectors to live databases (PostgreSQL, Snowflake, BigQuery) and SaaS tools (Salesforce, Stripe).
- Support for complex multi-table relational datasets.
- Advanced predictive modeling (classification, regression on custom targets).
- Exportable/shareable interactive dashboards.
- Team collaboration and role-based access control (RBAC).
- Scheduled reports delivered via email or Slack.
- Agentic workflows (e.g., "Monitor this metric and alert me if it drops by 10%").

---

## Architecture Design

### 8. System Architecture
The platform follows a modern decoupled architecture:
- **Frontend Presentation Layer:** Next.js application handling the UI, visualizations, and user interactions.
- **API/Application Layer:** Python/FastAPI backend handling routing, validation, business logic, and orchestration.
- **Data Processing/ML Layer:** Dedicated backend workers using Pandas and Scikit-learn for heavy data manipulation and machine learning tasks.
- **AI/LLM Layer:** Orchestration layer interfacing with external LLM APIs, strictly grounded by deterministic data context and safe tool calling.
- **Storage Layer:** PostgreSQL for application state and metadata; Cloud Object Storage (S3-compatible) for raw and processed datasets.

### 9. Frontend Architecture
- **Framework:** Next.js (App Router) with React and TypeScript.
- **Styling:** Tailwind CSS + UI components (e.g., shadcn/ui) for a premium look and feel.
- **State Management:** Zustand or React Context for global state, React Query for server state, polling, and caching.
- **Visualizations:** Recharts or Chart.js for rendering responsive, interactive, and aesthetic charts.
- **Deployment:** Vercel.

### 10. Backend Architecture
- **Framework:** FastAPI (Python).
- **Concurrency:** Async/await for high concurrency IO-bound tasks (API calls, DB queries).
- **Task Queue:** Celery with Redis broker for asynchronous data processing, profiling, and ML jobs to prevent blocking the API.
- **API Design:** RESTful principles with OpenAPI (Swagger) documentation generated automatically.
- **Deployment:** Render (Web Service for API, Background Worker for processing).

### 11. Database Architecture
- **Primary DB:** PostgreSQL (managed).
- **Schema Design:**
  - `Users` / `Organizations`
  - `Projects`
  - `Datasets` (Metadata: S3 URI, schema definition, profiling stats, row counts)
  - `Analyses` / `Reports` (Generated insights, user queries)
  - `ChatHistory` (Logs of user conversational analytics interactions)
- **ORM:** SQLAlchemy or SQLModel for database interactions and migrations (Alembic).

### 12. Dataset/File-Storage Architecture
- **Storage:** S3-compatible object storage (e.g., AWS S3, Cloudflare R2).
- **Structure:**
  - `raw/` - Original uploaded files (immutable).
  - `processed/` - Cleaned, standardized files stored as Parquet for efficient Pandas loading and columnar operations.
- **Security:** Pre-signed URLs for frontend access (if needed), secure IAM roles for backend access.

### 13. Data-Processing Architecture
- **Engine:** Pandas and NumPy in Python.
- **Workflow:**
  1. File Upload -> Stored in S3 `raw/`.
  2. Backend triggers asynchronous background job.
  3. Worker loads data -> Infers types -> Calculates stats (min, max, mean, nulls, unique values).
  4. Worker saves metadata to PostgreSQL.
  5. Worker saves cleaned dataset to S3 `processed/` as `.parquet`.
- **Boundary:** Raw data is manipulated purely in memory on the backend. LLMs *never* see raw rows, only the schema and aggregated stats.

### 14. Analytics Architecture
- **Deterministic Calculation:** All aggregations (GROUP BY), pivots, filtering, and metric calculations are executed deterministically using Pandas.
- **Visualization Definitions:** The backend generates JSON payloads defining charts (e.g., axes, data points, chart type) based on heuristics (e.g., Date + Numeric = Line Chart).
- **Delivery:** Frontend receives these structured chart definitions and renders them using the charting library.

### 15. AI Architecture
- **Context Generation:** The backend synthesizes a context string for the LLM containing: dataset schema, profiling stats, and specifically requested aggregated data.
- **Insight Generation:** LLM generates a narrative summary and business insights based purely on the provided context.
- **Conversational Analytics (Text-to-Query):**
  - User asks a question.
  - LLM decides which predefined analytical tool/function to call (e.g., `aggregate_sales_by_region()`).
  - Backend executes the tool (Pandas code) safely.
  - Backend returns the computed result to the LLM.
  - LLM generates a natural language explanation of the result.
- **Provider:** OpenAI API (GPT-4o) or Anthropic Claude (Claude 3.5 Sonnet) via LangChain or direct API.

### 16. ML Architecture
- **Libraries:** Scikit-learn, Statsmodels (or Prophet).
- **Execution:** Runs deterministically on backend data workers.
- **Features:**
  - **Forecasting:** ARIMA or Prophet applied to time-series data.
  - **Anomaly Detection:** Isolation Forest or Z-score on numeric distributions.
  - **Segmentation:** K-Means clustering on user-selected dimensions (e.g., RFM analysis).
- **Integration:** ML outputs are appended as new columns to the dataset or stored as separate metadata to be queried by the AI and visualized.

### 17. Security Architecture
- **Data Privacy:** Datasets belong strictly to the tenant. The LLM provider must have a zero-data-retention policy via API.
- **Data Leakage Boundary:** Hard boundary enforced by the backend: Raw dataset rows are *never* included in LLM prompts. Only schemas, metadata, and aggregated metrics are sent.
- **Code Execution:** Strict prohibition against passing arbitrary LLM-generated code (e.g., `eval()`) to the data environment. Instead, utilize structured API tool calling (OpenAI Function Calling) to map user intents to predefined, safe Python functions.
- **API Security:** CORS, rate limiting, authentication (future phase), and rigorous input validation using Pydantic.

### 18. Deployment Architecture
- **Frontend:** Vercel.
- **Backend (API):** Render Web Service (Dockerized).
- **Worker (Processing):** Render Background Worker (Dockerized).
- **Database:** Render Managed PostgreSQL.
- **Cache/Queue:** Render Managed Redis.
- **Storage:** AWS S3.

### 19. CI/CD Strategy
- **Version Control:** GitHub.
- **Pipelines:** GitHub Actions.
  - **PR Checks:** Run linters (ESLint, Ruff), formatters (Prettier, Black), and unit tests on every Pull Request.
  - **Deployment:** Vercel automatically deploys the `main` branch. Render automatically deploys upon successful GitHub Action workflows on `main`.

### 20. Testing Strategy
- **Frontend:** Jest for utility functions, React Testing Library for components.
- **Backend:** Pytest for API endpoints, DB operations, and background worker logic.
- **Data/ML Testing:** Specific unit tests for edge cases in data profiling (empty files, completely null columns, malformed date formats) to ensure robust, non-crashing processing pipelines.

### 21. Monitoring Strategy
- **Application Logging:** Standardized JSON logging in Python.
- **Error Tracking:** Sentry integrated into both Next.js and FastAPI for real-time exception tracking.
- **AI Monitoring:** Log LLM prompts, tool calls, responses, token usage, and latency to monitor API costs and audit for hallucinations.

### 22. Scalability Considerations
- **Data Size Limits:** Initial file size limits (50MB) ensure processing fits comfortably in memory (Pandas).
- **Horizontal Scaling:** The FastAPI backend is stateless and scales horizontally. Celery data processing workers scale independently based on queue length.
- **Storage Shift:** For future iterations with larger datasets, the architecture will transition from in-memory Pandas to out-of-core tools like Polars or DuckDB.
- **Async Operations:** The frontend utilizes polling or WebSockets to get the status of an uploaded dataset, maintaining a responsive UI while heavy background processing occurs.

---

## Project Strategy

### Architectural Decisions
1. **Strict Data/AI Boundary:** Deterministic math is handled exclusively by Python/Pandas. The AI is utilized solely for *interpretation*, *intent mapping (tool calling)*, and *narrative generation*. This prevents hallucinations in financial or business metrics.
2. **Processed Format:** Convert all uploaded data to `.parquet` internally. This standardizes the internal data representation, compresses file size, and drastically speeds up read times for subsequent analytical queries.
3. **API-First Design:** The Next.js frontend is purely a presentation layer consuming the FastAPI backend. It holds no direct database or S3 connections.

### Assumptions
- Target users have small to medium datasets that can fit into the memory of a reasonable worker instance (e.g., < 1GB).
- Users are willing to wait for asynchronous processing for complex insights (e.g., waiting a few seconds/minutes for full profiling and ML to run).

### Risks
- **LLM Hallucinations:** The AI might hallucinate insights if the context is poorly constructed.
  *Mitigation:* Strictly constrain prompts, ground them exclusively in generated data profiling stats, and limit the LLM's role to summarizing deterministic outputs.
- **Messy Data:** Real-world CSVs are notoriously malformed (mixed types, missing headers, trailing commas).
  *Mitigation:* The parsing/profiling engine must be highly fault-tolerant, with a strategy to gracefully skip or stringify unparseable columns rather than crashing the pipeline.

### Unresolved Decisions
- **Conversational Interface Capabilities:** Should the natural language chat interface use purely deterministic predefined functions (safe but limited) or generate dynamic Pandas code via a secure sandbox (powerful but complex to secure)?
  *Recommendation:* Start with predefined function calling (Agent tools) for the MVP. Re-evaluate sandboxed execution for future iterations.
- **Frontend Charting Library:** Which specific charting library to adopt?
  *Recommendation:* Start with `Recharts` for high initial velocity and React compatibility.

### Recommended Development Order
1. **Phase 1: Foundation:** Set up Next.js frontend repository, FastAPI backend repository, PostgreSQL database, and S3 storage buckets. Establish CI/CD pipelines.
2. **Phase 2: Data Pipeline:** Implement file upload, robust Pandas parsing, data profiling (stats generation), and persistence to Parquet and PostgreSQL.
3. **Phase 3: Automated Analytics:** Build endpoints to serve profiling stats and chart definitions. Implement chart rendering on the frontend.
4. **Phase 4: AI Insights:** Integrate LLM to generate narrative executive summaries based on the profiling metadata.
5. **Phase 5: ML Models:** Add basic ML workers for time-series forecasting and anomaly detection upon user request.
6. **Phase 6: Conversational Analytics:** Implement the chat interface utilizing structured LLM tool-calling to query the processed datasets.
