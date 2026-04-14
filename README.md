# 🎓 DropoutIQ — Student Dropout Risk Intelligence Platform

<div align="center">

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)
![XGBoost](https://img.shields.io/badge/XGBoost-Ensemble-FF6600?style=for-the-badge)
![SHAP](https://img.shields.io/badge/SHAP-Explainability-important?style=for-the-badge)

**A research-grade, full-stack ML platform for early identification and intervention of at-risk students using a stacking ensemble pipeline, SHAP explainability, and survival analysis.**

</div>

---

## 📌 Table of Contents

1. [Project Overview](#-project-overview)
2. [Working Principle](#-working-principle)
3. [Proposed Methodology](#-proposed-methodology)
4. [Models Used](#-models-used)
5. [Dataset](#-dataset)
6. [Features & Pages](#-features--pages)
7. [Architecture](#-architecture)
8. [Tech Stack](#-tech-stack)
9. [Project Structure](#-project-structure)
10. [Setup & Execution](#-setup--execution)
11. [Environment Variables](#-environment-variables)
12. [Database Schema](#-database-schema)
13. [API Endpoints](#-api-endpoints)
14. [ML Artifacts Generated](#-ml-artifacts-generated)

---

## 🔭 Project Overview

**DropoutIQ** is an end-to-end student dropout prediction platform designed for academic institutions. It allows administrators and advisors to:

- Predict which students are at risk of dropping out using a trained ML ensemble.
- Understand *why* a student is at risk through SHAP-based feature explanations.
- Simulate interventions using What-If and Counterfactual analysis.
- Track risk progression over semesters with Survival Analysis.
- Run batch predictions from uploaded CSV files.
- Audit model fairness across demographic groups.
- Actively label uncertain predictions to continuously improve the model.

---

## 🧠 Working Principle

The platform works as a **3-layer intelligent pipeline**:

### Layer 1 — Data Ingestion & Preprocessing
- Raw student data (~36 features) is ingested from a CSV dataset.
- Column names are normalized and mapped to a standard FEATURE_ORDER.
- The target variable (`Dropout` / `Graduate` / `Enrolled`) is binarized: **1 = Dropout, 0 = Non-Dropout**.
- All features are standardized using `StandardScaler`.
- **SMOTE** (Synthetic Minority Oversampling Technique) is applied to handle class imbalance.

### Layer 2 — Model Training & Stacking
- Five base models are trained independently with Bayesian hyperparameter search via **Optuna**.
- Each model is calibrated using **Isotonic Regression** to produce accurate probability estimates.
- A **Stacking Ensemble** (with Logistic Regression as meta-learner) is trained on predictions from all base models.
- The **champion model** — the one with the highest Test ROC-AUC — is selected automatically.
- The decision threshold is tuned to maximize the **F1-score** on the test set.

### Layer 3 — Explainability & Insights
- **SHAP values** are computed for the champion model:
  - `TreeExplainer` for tree-based models (RF, XGBoost, LightGBM, CatBoost)
  - `LinearExplainer` for Logistic Regression
  - `KernelExplainer` as a fallback (model-agnostic)
- **Kaplan-Meier Survival Curves** are computed per risk cohort (Low/Medium/High/Critical).
- **SHAP Interaction values** reveal which feature pairs jointly drive dropout risk.
- **Calibration curves** validate probability reliability across all models.

---

## 📐 Proposed Methodology

```
Raw Dataset (CSV)
      │
      ▼
┌─────────────────────────────────────────────┐
│ 1. Preprocessing                            │
│    • Column renaming & normalization        │
│    • Binary target encoding (Dropout=1)     │
│    • Train/Test split (80/20, stratified)   │
│    • StandardScaler normalization           │
│    • SMOTE oversampling on training set     │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│ 2. Bayesian Hyperparameter Optimization     │
│    • Optuna (TPE Sampler, 20 trials each)   │
│    • 5-Fold Stratified Cross-Validation     │
│    • Leak-free CV (SMOTE inside each fold)  │
│    • Optimized metric: ROC-AUC              │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│ 3. Base Model Training & Calibration        │
│    • RandomForest   (class_weight=balanced) │
│    • XGBoost        (scale_pos_weight)      │
│    • LogisticRegression (balanced)          │
│    • LightGBM       (balanced)              │
│    • CatBoost       (auto class weights)    │
│    Each: CalibratedClassifierCV (isotonic)  │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│ 4. Stacking Ensemble                        │
│    • Meta-learner: LogisticRegression       │
│    • stack_method: predict_proba            │
│    • cv=3 internal folds                    │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│ 5. Champion Selection & Threshold Tuning    │
│    • Best Test ROC-AUC wins                 │
│    • Threshold tuned for max F1-Score       │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│ 6. Explainability & Analytics               │
│    • SHAP global importance (top-20)        │
│    • SHAP interaction heatmap (top-10×10)   │
│    • ROC curves, PR curves, Confusion matrix│
│    • Calibration curves (all models)        │
│    • Kaplan-Meier survival analysis         │
└─────────────────────────────────────────────┘
      │
      ▼
  Model Artifacts Saved → Served by FastAPI → React Dashboard
```

---

## 🤖 Models Used

| Model | Type | Class Imbalance Handling | Hyperparameter Search |
|---|---|---|---|
| **Random Forest** | Bagging Ensemble | `class_weight="balanced"` | Optuna (n_estimators, max_depth, min_samples_split, min_samples_leaf, max_features) |
| **XGBoost** | Gradient Boosting | `scale_pos_weight` | Optuna (n_estimators, max_depth, learning_rate, subsample, colsample_bytree, reg_alpha, reg_lambda) |
| **Logistic Regression** | Linear Classifier | `class_weight="balanced"` | Optuna (C, solver) |
| **LightGBM** | Gradient Boosting | `class_weight="balanced"` | Optuna (n_estimators, max_depth, num_leaves, learning_rate, min_child_samples, subsample) |
| **CatBoost** | Gradient Boosting | `auto_class_weights="Balanced"` | Optuna (iterations, depth, learning_rate, l2_leaf_reg) |
| **Stacking Ensemble** | Meta-Learner | SMOTE on training | Logistic Regression meta-learner on base model outputs |

> 💡 The **Stacking Ensemble** combines predictions from all 5 base models as input features to a Logistic Regression meta-learner, capturing the complementary strengths of each model.

### On What Basis Does It Predict?

The model uses **36 student features** in 4 categories:

| Category | Features |
|---|---|
| **Demographics** | Age at enrollment, Gender, Nationality, Marital status, International student, Displaced student |
| **Academic Background** | Previous qualification & grade, Admission grade, Application mode & order, Course, Special needs |
| **Curricular Performance** | Units credited/enrolled/evaluated/approved/grade/without-evaluation for Sem 1 & Sem 2 |
| **Socioeconomic Factors** | Debtor status, Tuition fees up-to-date, Scholarship holder, Mother's & Father's qualification & occupation, GDP, Inflation rate, Unemployment rate |

---

## 📊 Dataset

- **Source**: UCI Machine Learning Repository — [Predict Students' Dropout and Academic Success](https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success)
- **Instances**: ~4,424 student records
- **Features**: 36 input features + 1 target (Dropout / Graduate / Enrolled)
- **Task**: Binary classification (Dropout vs. Non-Dropout)
- **Format**: Semicolon-delimited CSV (`dataset.csv`)

---

## 🖥️ Features & Pages

| Page | Description |
|---|---|
| **Dashboard** | Overview cards: total students, high-risk count, average risk, model accuracy. Recent predictions table. |
| **Predict** | Single student manual prediction with all 36 feature inputs. Returns risk score, SHAP waterfall chart, and actionable recommendations. |
| **Batch Predict** | Upload a CSV file to run predictions on hundreds of students at once. Download results. |
| **Model Insights** | ROC curves, PR curves, SHAP importance bar chart, SHAP interaction heatmap, calibration curves, confusion matrix — for all models. |
| **Analytics** | Dropout trends, risk distribution, demographic breakdowns, feature correlation heatmap. |
| **History** | Full log of all past predictions with filters. View per-student timelines. |
| **Student Detail** | Per-student risk profile, multi-semester risk timeline, notes. |
| **Survival Analysis** | Kaplan-Meier curves per risk cohort (Low/Medium/High/Critical) showing semester-wise retention probability. |
| **Fairness Audit** | Demographic parity and equalized odds metrics across gender, scholarship, age groups. |
| **What-If Simulator** | Adjust feature values for a student and instantly see how the risk changes. |
| **Counterfactuals** | Automatically generate the minimum feature changes needed to move a student from Dropout to Graduate. |
| **Threshold Optimizer** | Slide-to-tune prediction threshold with live F1/Precision/Recall/Accuracy feedback. |
| **Active Learning** | Advisors label uncertain predictions. Labelled data is stored for future retraining loops. |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│   React 18 + Vite + TailwindCSS + Recharts          │
│   Auth: Clerk (JWT)                                  │
│   Pages: 13 feature pages                           │
└───────────────────────┬──────────────────────────────┘
                        │ HTTP/REST (JWT-authenticated)
┌───────────────────────▼──────────────────────────────┐
│                    BACKEND                           │
│   FastAPI (Python 3.10+)                             │
│   • JWT Verification via Clerk JWKS                  │
│   • prediction, batch, SHAP, fairness endpoints      │
│   • Model loaded from .pkl artifacts                 │
└──────────┬────────────────────────┬──────────────────┘
           │                        │
┌──────────▼──────────┐  ┌──────────▼──────────────────┐
│   ML Models (.pkl)  │  │   Supabase (PostgreSQL)      │
│   dropout_model.pkl │  │   • predictions              │
│   scaler.pkl        │  │   • risk_timeline            │
│   shap_*.json       │  │   • active_learning_labels   │
│   roc_curve.json    │  │   • alerts_log               │
│   survival*.json    │  │   • user_roles               │
└─────────────────────┘  └──────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
| Tool | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Runtime |
| FastAPI | 0.111.0 | REST API framework |
| Uvicorn | 0.29.0 | ASGI server |
| scikit-learn | 1.4.2 | ML models, preprocessing, calibration |
| XGBoost | 2.0.3 | Gradient boosting model |
| LightGBM | 4.3.0 | Fast gradient boosting |
| CatBoost | 1.2.5 | Categorical boosting |
| SHAP | 0.45.1 | Model explainability |
| Optuna | 3.6.1 | Bayesian hyperparameter optimization |
| imbalanced-learn | 0.12.2 | SMOTE oversampling |
| lifelines | 0.29.0 | Kaplan-Meier survival analysis |
| fairlearn | 0.10.0 | Fairness metrics |
| dice-ml | 0.11 | Counterfactual generation |
| Supabase | 2.4.3 | Database (PostgreSQL) client |
| python-jose | 3.3.0 | JWT verification (Clerk) |
| ReportLab | 4.1.0 | PDF report generation |
| aiosmtplib | 3.0.1 | Async email alerts |
| slack-sdk | 3.27.2 | Slack notifications |

### Frontend
| Tool | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| Vite | 5.2.13 | Build tool & dev server |
| TailwindCSS | 3.4.4 | Utility-first CSS |
| Recharts | 2.15.4 | Data visualization charts |
| React Router | 6.23.1 | Client-side routing |
| Clerk React | 5.2.0 | Authentication & user management |
| Lucide React | 0.383.0 | Icon library |

---

## 📁 Project Structure

```
dropout/
├── backend/
│   ├── main.py                  # FastAPI application (all endpoints)
│   ├── train_model.py           # Full ML training pipeline
│   ├── dataset.csv              # Raw student dataset
│   ├── requirements.txt         # Python dependencies
│   ├── supabase_schema.sql      # Database schema for Supabase
│   ├── .env                     # Backend environment variables (not committed)
│   └── models/                  # Auto-generated ML artifacts
│       ├── dropout_model.pkl    # Trained champion model
│       ├── scaler.pkl           # Feature scaler
│       ├── label_encoder.pkl    # Label encoder
│       ├── shap_explainer.pkl   # SHAP explainer object
│       ├── shap_global.json     # Top-20 SHAP feature importances
│       ├── shap_interactions.json # SHAP feature interaction heatmap
│       ├── roc_curve.json       # ROC curve data (all models)
│       ├── pr_curve.json        # Precision-Recall curve data
│       ├── calibration_curve.json # Calibration curve data
│       ├── confusion_matrix.json # Confusion matrix
│       ├── survival_curves.json # Kaplan-Meier survival data
│       ├── comparison_table.csv # Model comparison metrics
│       ├── best_threshold.txt   # Optimal decision threshold
│       ├── feature_names.txt    # Ordered feature list
│       └── champion_model_name.txt # Name of champion model
│
├── frontend/
│   ├── index.html               # HTML entry point
│   ├── package.json             # Node.js dependencies
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.js       # Tailwind configuration
│   ├── .env                     # Frontend env variables (not committed)
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Router & layout
│       ├── index.css            # Global styles
│       ├── components/
│       │   └── Layout.jsx       # Sidebar navigation layout
│       ├── lib/                 # API utilities / helpers
│       └── pages/
│           ├── Dashboard.jsx
│           ├── Predict.jsx
│           ├── BatchPredict.jsx
│           ├── ModelInsights.jsx
│           ├── Analytics.jsx
│           ├── History.jsx
│           ├── StudentDetail.jsx
│           ├── SurvivalAnalysis.jsx
│           ├── FairnessAudit.jsx
│           ├── WhatIf.jsx
│           ├── Counterfactuals.jsx
│           ├── ThresholdOptimizer.jsx
│           └── ActiveLearning.jsx
│
└── README.md
```

---

## ⚙️ Setup & Execution

### Prerequisites

- Python 3.10 or higher
- Node.js 18+ and npm
- A [Supabase](https://supabase.com) account and project
- A [Clerk](https://clerk.com) account and application

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/<your-username>/dropoutiq.git
cd dropoutiq
```

---

### Step 2 — Setup the Database

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Open the **SQL Editor**
3. Copy the contents of `backend/supabase_schema.sql` and run it
4. This creates all required tables: `predictions`, `risk_timeline`, `active_learning_labels`, `alerts_log`, `user_roles`

---

### Step 3 — Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create the `.env` file in the `backend/` directory:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
CLERK_JWKS_URL=https://your-clerk-frontend-api/.well-known/jwks.json
```

---

### Step 4 — Train the ML Model

> ⚠️ This step is **required** before starting the backend server. Training takes **~15–30 minutes** depending on hardware.

```bash
cd backend
python train_model.py
```

This will:
- Train 5 base models + 1 stacking ensemble
- Auto-select the champion model
- Save all artifacts to `backend/models/`

You will see output like:
```
✅ Done! Champion: StackingEnsemble | AUC: 0.9124
Models saved to ./models/
```

---

### Step 5 — Start the Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be live at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

---

### Step 6 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

Create `.env` in the `frontend/` directory:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
VITE_API_BASE_URL=http://localhost:8000
```

---

### Step 7 — Start the Frontend Dev Server

```bash
cd frontend
npm run dev
```

The app will open at: `http://localhost:5173`

> **Login with your Clerk account to access the dashboard.**

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase `anon` public key |
| `CLERK_JWKS_URL` | Clerk JWKS URL for JWT verification |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (from Clerk dashboard) |
| `VITE_API_BASE_URL` | Backend API base URL (e.g., `http://localhost:8000`) |

---

## 🗄️ Database Schema

```sql
-- Core prediction log
predictions (id, student_id, student_name, prediction, dropout_probability,
             risk_level, intervention_score, input_features, notes, created_at, user_id)

-- Per-semester risk tracking
risk_timeline (id, student_id, semester, dropout_probability, risk_level,
               prediction_id, created_at)

-- Active learning labels from advisors
active_learning_labels (id, prediction_id, true_label, labeled_by, notes, created_at)

-- Email/Slack alert logs
alerts_log (id, student_id, student_name, alert_type, channel, sent_at, payload)

-- Role-based access control
user_roles (user_id, role, created_at)   -- 'admin' | 'advisor'
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/predict` | Single student prediction |
| `POST` | `/batch-predict` | CSV batch prediction |
| `GET` | `/model-metrics` | Champion model metrics |
| `GET` | `/model-comparison` | All model comparison table |
| `GET` | `/shap-global` | SHAP global feature importances |
| `GET` | `/shap-interactions` | SHAP feature interaction heatmap |
| `GET` | `/roc-curve` | ROC curve data (all models) |
| `GET` | `/pr-curve` | Precision-Recall curve data |
| `GET` | `/calibration-curve` | Calibration curves |
| `GET` | `/confusion-matrix` | Confusion matrix |
| `GET` | `/survival-curves` | Kaplan-Meier survival data |
| `GET` | `/fairness-audit` | Fairness metrics by demographics |
| `POST` | `/counterfactual` | Counterfactual explanation |
| `GET` | `/predictions` | History (user-scoped) |
| `GET` | `/student/{id}` | Student detail + risk timeline |
| `POST` | `/active-learning/label` | Submit advisor label |
| `GET` | `/active-learning/queue` | Get uncertain predictions for labeling |
| `POST` | `/alert/email` | Send email alert |
| `POST` | `/alert/slack` | Send Slack alert |

All endpoints (except `/health`) require a valid **Clerk JWT** in the `Authorization: Bearer <token>` header.

---

## 📦 ML Artifacts Generated

After running `train_model.py`, the following files are saved to `backend/models/`:

| File | Description |
|---|---|
| `dropout_model.pkl` | Serialized champion model |
| `scaler.pkl` | StandardScaler fitted on training data |
| `label_encoder.pkl` | Target label encoder |
| `shap_explainer.pkl` | SHAP explainer object |
| `shap_global.json` | Top-20 mean absolute SHAP values |
| `shap_interactions.json` | 10×10 SHAP interaction matrix |
| `roc_curve.json` | FPR/TPR arrays for all models |
| `pr_curve.json` | Precision/Recall arrays for all models |
| `calibration_curve.json` | Calibration reliability data |
| `confusion_matrix.json` | TP/TN/FP/FN at tuned threshold |
| `survival_curves.json` | Kaplan-Meier per risk cohort |
| `comparison_table.csv` | Full model benchmark table |
| `best_threshold.txt` | Optimal decision threshold (float) |
| `feature_names.txt` | Ordered feature list used at inference |
| `champion_model_name.txt` | Name of the selected champion model |

---

## 🧑‍💻 Authors

| Name | Institution |
|---|---|
| **Kartik G** | RV Institute of Technology and Management, Bengaluru, Karnataka — 560072 |
| **Kalavathi V A** | RV Institute of Technology and Management, Bengaluru, Karnataka — 560072 |
| **Pruthvi N K** | RV Institute of Technology and Management, Bengaluru, Karnataka — 560072 |

> Developed as part of an ML Assignment on **Student Dropout Prediction** using real-world higher education data.

---

## 📜 License

MIT License

Copyright (c) 2026 Kartik G, Kalavathi V A, Pruthvi N K  
RV Institute of Technology and Management, Bengaluru, Karnataka 560072

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

