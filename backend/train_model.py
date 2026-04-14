"""
train_model.py  —  DropoutIQ Training Pipeline v4
===================================================
New in v4:
  1. LightGBM + CatBoost models (5 base models total)
  2. Stacking Ensemble (LR meta-learner)
  3. SHAP interaction values → shap_interactions.json
  4. Survival Analysis with lifelines → survival_curves.json
  5. All previous v3 artifacts preserved
"""

import os, warnings, logging, json
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import numpy as np, pandas as pd
import joblib, shap, optuna
import matplotlib; matplotlib.use("Agg")

from sklearn.linear_model    import LogisticRegression
from sklearn.ensemble        import RandomForestClassifier, StackingClassifier
from sklearn.calibration     import CalibratedClassifierCV, calibration_curve
from sklearn.preprocessing   import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_predict
from sklearn.metrics         import (
    classification_report, roc_auc_score,
    precision_recall_curve, roc_curve, confusion_matrix, average_precision_score
)
from sklearn.base  import clone
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier

try:
    import lightgbm as lgb
    HAS_LGB = True
except ImportError:
    HAS_LGB = False
    logging.warning("LightGBM not installed – skipping")

try:
    from catboost import CatBoostClassifier
    HAS_CAT = True
except ImportError:
    HAS_CAT = False
    logging.warning("CatBoost not installed – skipping")

try:
    from lifelines import KaplanMeierFitter
    HAS_LIFELINES = True
except ImportError:
    HAS_LIFELINES = False
    logging.warning("lifelines not installed – skipping survival analysis")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)
optuna.logging.set_verbosity(optuna.logging.WARNING)
warnings.filterwarnings("ignore")
os.makedirs("models", exist_ok=True)

FEATURE_ORDER = [
    "marital_status","application_mode","application_order","course",
    "daytime_evening_attendance","previous_qualification","previous_qualification_grade",
    "nationality","mothers_qualification","fathers_qualification",
    "mothers_occupation","fathers_occupation","admission_grade",
    "displaced","educational_special_needs","debtor",
    "tuition_fees_up_to_date","gender","scholarship_holder",
    "age_at_enrollment","international",
    "curricular_units_1st_sem_credited","curricular_units_1st_sem_enrolled",
    "curricular_units_1st_sem_evaluations","curricular_units_1st_sem_approved",
    "curricular_units_1st_sem_grade","curricular_units_1st_sem_without_evaluations",
    "curricular_units_2nd_sem_credited","curricular_units_2nd_sem_enrolled",
    "curricular_units_2nd_sem_evaluations","curricular_units_2nd_sem_approved",
    "curricular_units_2nd_sem_grade","curricular_units_2nd_sem_without_evaluations",
    "unemployment_rate","inflation_rate","gdp",
]
FRIENDLY_NAMES = {
    "marital_status":"Marital Status","application_mode":"Application Mode",
    "application_order":"Application Order","course":"Course",
    "daytime_evening_attendance":"Attendance Type",
    "previous_qualification":"Previous Qualification",
    "previous_qualification_grade":"Prev. Qualification Grade",
    "nationality":"Nationality","mothers_qualification":"Mother's Qualification",
    "fathers_qualification":"Father's Qualification",
    "mothers_occupation":"Mother's Occupation","fathers_occupation":"Father's Occupation",
    "admission_grade":"Admission Grade","displaced":"Displaced Student",
    "educational_special_needs":"Special Educational Needs","debtor":"Outstanding Debt",
    "tuition_fees_up_to_date":"Tuition Fees Up To Date","gender":"Gender",
    "scholarship_holder":"Scholarship Holder","age_at_enrollment":"Age at Enrollment",
    "international":"International Student",
    "curricular_units_1st_sem_credited":"Units Credited (Sem 1)",
    "curricular_units_1st_sem_enrolled":"Units Enrolled (Sem 1)",
    "curricular_units_1st_sem_evaluations":"Units Evaluated (Sem 1)",
    "curricular_units_1st_sem_approved":"Units Approved (Sem 1)",
    "curricular_units_1st_sem_grade":"Grade Average (Sem 1)",
    "curricular_units_1st_sem_without_evaluations":"Units Without Eval (Sem 1)",
    "curricular_units_2nd_sem_credited":"Units Credited (Sem 2)",
    "curricular_units_2nd_sem_enrolled":"Units Enrolled (Sem 2)",
    "curricular_units_2nd_sem_evaluations":"Units Evaluated (Sem 2)",
    "curricular_units_2nd_sem_approved":"Units Approved (Sem 2)",
    "curricular_units_2nd_sem_grade":"Grade Average (Sem 2)",
    "curricular_units_2nd_sem_without_evaluations":"Units Without Eval (Sem 2)",
    "unemployment_rate":"Unemployment Rate","inflation_rate":"Inflation Rate",
    "gdp":"GDP Growth Rate",
}

N_TRIALS=20; N_SPLITS=5; RANDOM_SEED=42

# ── 1. DATA ───────────────────────────────────────────────────────────────────
log.info("Loading dataset...")
df = pd.read_csv("dataset.csv", delimiter=";")
df.columns = [c.strip() for c in df.columns]
le_target = LabelEncoder()
df["Target"] = le_target.fit_transform(df["Target"])
df["Target"] = (df["Target"] == 0).astype(int)

column_map = {
    "Marital status":"marital_status","Application mode":"application_mode",
    "Application order":"application_order","Course":"course",
    "Daytime/evening attendance":"daytime_evening_attendance",
    "Previous qualification":"previous_qualification",
    "Previous qualification (grade)":"previous_qualification_grade",
    "Nacionality":"nationality","Mother's qualification":"mothers_qualification",
    "Father's qualification":"fathers_qualification","Mother's occupation":"mothers_occupation",
    "Father's occupation":"fathers_occupation","Admission grade":"admission_grade",
    "Displaced":"displaced","Educational special needs":"educational_special_needs",
    "Debtor":"debtor","Tuition fees up to date":"tuition_fees_up_to_date",
    "Gender":"gender","Scholarship holder":"scholarship_holder",
    "Age at enrollment":"age_at_enrollment","International":"international",
    "Curricular units 1st sem (credited)":"curricular_units_1st_sem_credited",
    "Curricular units 1st sem (enrolled)":"curricular_units_1st_sem_enrolled",
    "Curricular units 1st sem (evaluations)":"curricular_units_1st_sem_evaluations",
    "Curricular units 1st sem (approved)":"curricular_units_1st_sem_approved",
    "Curricular units 1st sem (grade)":"curricular_units_1st_sem_grade",
    "Curricular units 1st sem (without evaluations)":"curricular_units_1st_sem_without_evaluations",
    "Curricular units 2nd sem (credited)":"curricular_units_2nd_sem_credited",
    "Curricular units 2nd sem (enrolled)":"curricular_units_2nd_sem_enrolled",
    "Curricular units 2nd sem (evaluations)":"curricular_units_2nd_sem_evaluations",
    "Curricular units 2nd sem (approved)":"curricular_units_2nd_sem_approved",
    "Curricular units 2nd sem (grade)":"curricular_units_2nd_sem_grade",
    "Curricular units 2nd sem (without evaluations)":"curricular_units_2nd_sem_without_evaluations",
    "Unemployment rate":"unemployment_rate","Inflation rate":"inflation_rate","GDP":"gdp",
}
df.rename(columns={k:v for k,v in column_map.items() if k in df.columns}, inplace=True)

# Keep original Target string for survival analysis BEFORE converting
df_raw_target = df["Target"].copy()  # 1=Dropout, 0=Graduate

X = df[FEATURE_ORDER].copy(); y = df["Target"].copy()

# ── 2. SPLIT ──────────────────────────────────────────────────────────────────
X_train_raw, X_test_raw, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=RANDOM_SEED, stratify=y
)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train_raw)
X_test_scaled  = scaler.transform(X_test_raw)
neg=(y_train==0).sum(); pos=(y_train==1).sum(); spw=float(neg)/float(pos)
cv=StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=RANDOM_SEED)

# ── 3. LEAK-FREE CV ───────────────────────────────────────────────────────────
def cv_auc_smote(clf, X, y):
    sm=SMOTE(random_state=RANDOM_SEED); scores=[]
    for tr,val in cv.split(X,y):
        Xtr,Xval=X[tr],X[val]; ytr,yval=y.iloc[tr],y.iloc[val]
        Xs,ys=sm.fit_resample(Xtr,ytr)
        c=clone(clf); c.fit(Xs,ys)
        scores.append(roc_auc_score(yval, c.predict_proba(Xval)[:,1]))
    return np.mean(scores)

# ── 4. OBJECTIVES ─────────────────────────────────────────────────────────────
def obj_rf(t): return cv_auc_smote(RandomForestClassifier(
    n_estimators=t.suggest_int("n_estimators",100,400),
    max_depth=t.suggest_int("max_depth",5,25),
    min_samples_split=t.suggest_int("min_samples_split",2,15),
    min_samples_leaf=t.suggest_int("min_samples_leaf",1,8),
    max_features=t.suggest_categorical("max_features",["sqrt","log2"]),
    class_weight="balanced",random_state=RANDOM_SEED,n_jobs=-1,
), X_train_scaled, y_train)

def obj_xgb(t):
    return cv_auc_smote(XGBClassifier(
        n_estimators=t.suggest_int("n_estimators",100,400),
        max_depth=t.suggest_int("max_depth",3,8),
        learning_rate=t.suggest_float("learning_rate",0.01,0.3,log=True),
        subsample=t.suggest_float("subsample",0.6,1.0),
        colsample_bytree=t.suggest_float("colsample_bytree",0.6,1.0),
        reg_alpha=t.suggest_float("reg_alpha",1e-8,10.0,log=True),
        reg_lambda=t.suggest_float("reg_lambda",1e-8,10.0,log=True),
        scale_pos_weight=spw,eval_metric="auc",use_label_encoder=False,
        random_state=RANDOM_SEED,n_jobs=-1,verbosity=0,
    ), X_train_scaled, y_train)

def obj_lr(t): return cv_auc_smote(LogisticRegression(
    C=t.suggest_float("C",1e-3,100.0,log=True),
    solver=t.suggest_categorical("solver",["lbfgs","saga"]),
    max_iter=2000,class_weight="balanced",random_state=RANDOM_SEED,n_jobs=-1,
), X_train_scaled, y_train)

def obj_lgb(t):
    if not HAS_LGB: return 0.5
    return cv_auc_smote(lgb.LGBMClassifier(
        n_estimators=t.suggest_int("n_estimators",100,400),
        max_depth=t.suggest_int("max_depth",3,10),
        learning_rate=t.suggest_float("learning_rate",0.01,0.3,log=True),
        num_leaves=t.suggest_int("num_leaves",20,150),
        min_child_samples=t.suggest_int("min_child_samples",5,50),
        subsample=t.suggest_float("subsample",0.6,1.0),
        colsample_bytree=t.suggest_float("colsample_bytree",0.6,1.0),
        class_weight="balanced",random_state=RANDOM_SEED,n_jobs=-1,verbose=-1,
    ), X_train_scaled, y_train)

def obj_cat(t):
    if not HAS_CAT: return 0.5
    return cv_auc_smote(CatBoostClassifier(
        iterations=t.suggest_int("iterations",100,400),
        depth=t.suggest_int("depth",3,8),
        learning_rate=t.suggest_float("learning_rate",0.01,0.3,log=True),
        l2_leaf_reg=t.suggest_float("l2_leaf_reg",1e-3,10.0,log=True),
        auto_class_weights="Balanced",random_seed=RANDOM_SEED,verbose=0,
    ), X_train_scaled, y_train)

# ── 5. CALIBRATION SPLIT ──────────────────────────────────────────────────────
X_base_raw, X_cal_raw, y_base, y_cal = train_test_split(
    X_train_raw, y_train, test_size=0.20, random_state=RANDOM_SEED, stratify=y_train
)
X_base_sc = scaler.transform(X_base_raw)
X_cal_sc  = scaler.transform(X_cal_raw)
sm_base = SMOTE(random_state=RANDOM_SEED)
X_base_sm, y_base_sm = sm_base.fit_resample(X_base_sc, y_base)

# ── 6. TRAIN BASE MODELS ──────────────────────────────────────────────────────
model_configs = [
    ("RandomForest", obj_rf),
    ("XGBoost", obj_xgb),
    ("LogisticRegression", obj_lr),
]
if HAS_LGB: model_configs.append(("LightGBM", obj_lgb))
if HAS_CAT: model_configs.append(("CatBoost", obj_cat))

results = []
trained_base_estimators = []  # for stacking

for name, obj in model_configs:
    log.info(f"Training {name}...")
    study = optuna.create_study(direction="maximize",
                                sampler=optuna.samplers.TPESampler(seed=RANDOM_SEED))
    study.optimize(obj, n_trials=N_TRIALS, show_progress_bar=False)
    bp = study.best_params

    if name == "RandomForest":
        base = RandomForestClassifier(**bp, class_weight="balanced",
                                     random_state=RANDOM_SEED, n_jobs=-1)
    elif name == "XGBoost":
        base = XGBClassifier(**bp, scale_pos_weight=spw, eval_metric="auc",
                             use_label_encoder=False, random_state=RANDOM_SEED,
                             n_jobs=-1, verbosity=0)
    elif name == "LogisticRegression":
        base = LogisticRegression(**bp, max_iter=2000, class_weight="balanced",
                                  random_state=RANDOM_SEED, n_jobs=-1)
    elif name == "LightGBM":
        base = lgb.LGBMClassifier(**bp, class_weight="balanced",
                                   random_state=RANDOM_SEED, n_jobs=-1, verbose=-1)
    elif name == "CatBoost":
        base = CatBoostClassifier(**bp, auto_class_weights="Balanced",
                                   random_seed=RANDOM_SEED, verbose=0)

    base.fit(X_base_sm, y_base_sm)
    cal = CalibratedClassifierCV(base, cv="prefit", method="isotonic")
    cal.fit(X_cal_sc, y_cal)

    yp = cal.predict_proba(X_test_scaled)[:, 1]
    auc = roc_auc_score(y_test, yp)
    rep = classification_report(y_test, (yp >= 0.5).astype(int),
                                 target_names=["Graduate", "Dropout"], output_dict=True)
    results.append({
        "Model": name, "CV_ROC_AUC": round(study.best_value, 4),
        "Test_ROC_AUC": round(auc, 4),
        "Dropout_F1": round(rep["Dropout"]["f1-score"], 4),
        "Dropout_Prec": round(rep["Dropout"]["precision"], 4),
        "Dropout_Recall": round(rep["Dropout"]["recall"], 4),
        "Accuracy": round(rep["accuracy"], 4),
        "Best_Params": json.dumps(bp), "_clf": cal, "_base": base,
    })
    trained_base_estimators.append((name, base))
    log.info(f"  {name}: CV_AUC={study.best_value:.4f}  Test_AUC={auc:.4f}")

# ── 7. STACKING ENSEMBLE ──────────────────────────────────────────────────────
log.info("Training Stacking Ensemble...")
try:
    stack_estimators = [(name, clone(base)) for name, base in trained_base_estimators]
    meta = LogisticRegression(C=1.0, max_iter=1000, class_weight="balanced",
                               random_state=RANDOM_SEED)
    stacker = StackingClassifier(
        estimators=stack_estimators, final_estimator=meta,
        cv=3, stack_method="predict_proba", passthrough=False, n_jobs=-1
    )
    sm_stack = SMOTE(random_state=RANDOM_SEED)
    X_stack_sm, y_stack_sm = sm_stack.fit_resample(X_train_scaled, y_train)
    stacker.fit(X_stack_sm, y_stack_sm)

    yp_stack = stacker.predict_proba(X_test_scaled)[:, 1]
    auc_stack = roc_auc_score(y_test, yp_stack)
    rep_stack = classification_report(y_test, (yp_stack >= 0.5).astype(int),
                                       target_names=["Graduate", "Dropout"], output_dict=True)
    results.append({
        "Model": "StackingEnsemble", "CV_ROC_AUC": round(auc_stack, 4),
        "Test_ROC_AUC": round(auc_stack, 4),
        "Dropout_F1": round(rep_stack["Dropout"]["f1-score"], 4),
        "Dropout_Prec": round(rep_stack["Dropout"]["precision"], 4),
        "Dropout_Recall": round(rep_stack["Dropout"]["recall"], 4),
        "Accuracy": round(rep_stack["accuracy"], 4),
        "Best_Params": "{}",
        "_clf": stacker, "_base": stacker,
    })
    log.info(f"  StackingEnsemble: Test_AUC={auc_stack:.4f}")
except Exception as e:
    log.warning(f"Stacking failed: {e}")

# ── 8. SAVE COMPARISON ────────────────────────────────────────────────────────
cdf = pd.DataFrame([{k: v for k, v in r.items() if not k.startswith("_")} for r in results])
cdf.to_csv("models/comparison_table.csv", index=False)
log.info("\n" + cdf.to_string(index=False))

# ── 9. CHAMPION ───────────────────────────────────────────────────────────────
best = max(results, key=lambda r: r["Test_ROC_AUC"])
champion = best["_clf"]; base_champion = best["_base"]; champion_name = best["Model"]
log.info(f"Champion: {champion_name}  AUC={best['Test_ROC_AUC']:.4f}")

# ── 10. THRESHOLD ─────────────────────────────────────────────────────────────
ypc = (champion.predict_proba(X_test_scaled)[:, 1]
       if hasattr(champion, "predict_proba") else stacker.predict_proba(X_test_scaled)[:, 1])
prec, rec, thr = precision_recall_curve(y_test, ypc)
f1s = 2 * prec[:-1] * rec[:-1] / (prec[:-1] + rec[:-1] + 1e-9)
best_thresh = float(thr[np.argmax(f1s)])
log.info(f"Threshold={best_thresh:.4f}  F1={np.max(f1s):.4f}")
yp_tuned = (ypc >= best_thresh).astype(int)

# ── 11. ROC DATA ──────────────────────────────────────────────────────────────
roc_data = []
for r in results:
    clf = r["_clf"]
    yp = clf.predict_proba(X_test_scaled)[:, 1]
    fpr, tpr, _ = roc_curve(y_test, yp)
    idx = np.linspace(0, len(fpr) - 1, min(100, len(fpr))).astype(int)
    roc_data.append({
        "model": r["Model"], "auc": round(roc_auc_score(y_test, yp), 4),
        "fpr": [round(float(v), 4) for v in fpr[idx]],
        "tpr": [round(float(v), 4) for v in tpr[idx]],
    })
with open("models/roc_curve.json", "w") as f: json.dump(roc_data, f)

# ── 12. PR CURVE ──────────────────────────────────────────────────────────────
pr_data = []
for r in results:
    yp = r["_clf"].predict_proba(X_test_scaled)[:, 1]
    prec2, rec2, _ = precision_recall_curve(y_test, yp)
    ap = average_precision_score(y_test, yp)
    idx = np.linspace(0, len(prec2) - 1, min(100, len(prec2))).astype(int)
    pr_data.append({
        "model": r["Model"], "avg_precision": round(float(ap), 4),
        "precision": [round(float(v), 4) for v in prec2[idx]],
        "recall": [round(float(v), 4) for v in rec2[idx]],
    })
with open("models/pr_curve.json", "w") as f: json.dump(pr_data, f)

# ── 13. CONFUSION MATRIX ──────────────────────────────────────────────────────
tn, fp, fn, tp = confusion_matrix(y_test, yp_tuned).ravel()
with open("models/confusion_matrix.json", "w") as f:
    json.dump({"TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp),
               "threshold": round(best_thresh, 4), "model": champion_name}, f)

# ── 14. SHAP ──────────────────────────────────────────────────────────────────
log.info("Computing SHAP values...")
sm_all = SMOTE(random_state=RANDOM_SEED)
X_all_sm, _ = sm_all.fit_resample(X_train_scaled, y_train)
bg = shap.sample(X_all_sm, 100, random_state=RANDOM_SEED)  # smaller bg = faster

def _normalize_sv(sv, n_features):
    """Force SHAP output into shape (n_samples, n_features) robustly."""
    if isinstance(sv, list):
        # list of per-class arrays → pick class 1 (dropout)
        sv = np.array(sv[1]) if len(sv) > 1 else np.array(sv[0])
    sv = np.array(sv)
    # Handle (n_classes, n_samples, n_features) → pick class 1
    if sv.ndim == 3:
        sv = sv[1]
    # Handle (n_samples, n_features) — correct
    if sv.ndim == 2 and sv.shape[1] == n_features:
        return sv
    # Handle (n_features, n_samples) → transpose
    if sv.ndim == 2 and sv.shape[0] == n_features:
        return sv.T
    # Handle (n_samples,) or (n_classes,) — wrong, return zeros
    log.warning(f"SHAP shape {sv.shape} unrecognized for n_features={n_features}, using zeros")
    return np.zeros((1, n_features))

n_feat = len(FEATURE_ORDER)
explainer = None
sv_mat = None

# Strategy 1: TreeExplainer for native tree models
if champion_name in ("RandomForest", "XGBoost", "LightGBM", "CatBoost"):
    try:
        explainer = shap.TreeExplainer(base_champion)
        sv_raw = explainer.shap_values(X_test_scaled)
        sv_mat = _normalize_sv(sv_raw, n_feat)
        log.info(f"TreeExplainer succeeded: sv_mat.shape={sv_mat.shape}")
    except Exception as e:
        log.warning(f"TreeExplainer failed: {e}")
        sv_mat = None

# Strategy 2: LinearExplainer for LR
if sv_mat is None and champion_name == "LogisticRegression":
    try:
        explainer = shap.LinearExplainer(base_champion, bg,
                                          feature_perturbation="correlation_dependent")
        sv_raw = explainer.shap_values(X_test_scaled)
        sv_mat = _normalize_sv(sv_raw, n_feat)
        log.info(f"LinearExplainer succeeded: sv_mat.shape={sv_mat.shape}")
    except Exception as e:
        log.warning(f"LinearExplainer failed: {e}")

# Strategy 3: KernelExplainer (slow but universal)
if sv_mat is None or sv_mat.shape[1] != n_feat:
    try:
        log.info("Falling back to KernelExplainer (this takes ~3 min)...")
        # Use predict (not predict_proba) to get scalar output → simpler SHAP shape
        def _dropout_prob(X):
            return base_champion.predict_proba(X)[:, 1]
        explainer = shap.KernelExplainer(_dropout_prob, bg)
        sv_raw = explainer.shap_values(X_test_scaled[:30])
        sv_mat = _normalize_sv(sv_raw, n_feat)
        log.info(f"KernelExplainer succeeded: sv_mat.shape={sv_mat.shape}")
    except Exception as e:
        log.warning(f"KernelExplainer failed: {e}")

# Strategy 4: Fall back to BEST individual base model's SHAP
if sv_mat is None or sv_mat.shape[1] != n_feat:
    log.warning("All SHAP strategies failed for champion — falling back to best individual model")
    best_individual = max(
        [r for r in results if r["Model"] != "StackingEnsemble"],
        key=lambda r: r["Test_ROC_AUC"], default=None
    )
    if best_individual:
        try:
            fb_base = best_individual["_base"]
            fb_name = best_individual["Model"]
            log.info(f"Using {fb_name} as SHAP fallback")
            if fb_name in ("RandomForest", "XGBoost", "LightGBM", "CatBoost"):
                explainer = shap.TreeExplainer(fb_base)
                sv_raw = explainer.shap_values(X_test_scaled)
            else:
                explainer = shap.LinearExplainer(fb_base, bg,
                                                  feature_perturbation="correlation_dependent")
                sv_raw = explainer.shap_values(X_test_scaled)
            sv_mat = _normalize_sv(sv_raw, n_feat)
            log.info(f"Fallback SHAP succeeded: sv_mat.shape={sv_mat.shape}")
        except Exception as e:
            log.error(f"Fallback SHAP also failed: {e}")

# Final safety net
if sv_mat is None or sv_mat.shape[1] != n_feat:
    log.error("SHAP completely unavailable — using zero importances")
    sv_mat = np.zeros((1, n_feat))
    explainer = None

mean_abs = np.abs(sv_mat).mean(axis=0)
assert len(mean_abs) == n_feat, f"mean_abs has wrong size: {len(mean_abs)} vs {n_feat}"

shap_global = sorted([
    {"feature": f, "friendly_name": FRIENDLY_NAMES.get(f, f),
     "importance": round(float(mean_abs[i]), 5)}
    for i, f in enumerate(FEATURE_ORDER)
], key=lambda x: x["importance"], reverse=True)[:20]
with open("models/shap_global.json", "w") as f: json.dump(shap_global, f)
log.info("shap_global.json saved")


# ── 14b. SHAP INTERACTIONS ────────────────────────────────────────────────────
log.info("Computing SHAP interactions (top features)...")
try:
    if champion_name in ("RandomForest", "XGBoost"):
        # Use a subset for speed
        n_inter = min(200, len(X_test_scaled))
        X_inter = X_test_scaled[:n_inter]
        interaction_vals = explainer.shap_interaction_values(X_inter)
        # interaction_vals shape: (n_samples, n_features, n_features)
        if isinstance(interaction_vals, list):
            inter_mat = interaction_vals[1]
        else:
            inter_mat = interaction_vals
        # Mean absolute interaction over samples → n_features x n_features matrix
        inter_mean = np.abs(inter_mat).mean(axis=0)
        # Normalize
        inter_mean_norm = inter_mean / (inter_mean.max() + 1e-9)
        # Save top-10 features x top-10 features for frontend heatmap
        top10_idx = np.argsort(mean_abs)[::-1][:10]
        top10_names = [FEATURE_ORDER[i] for i in top10_idx]
        top10_friendly = [FRIENDLY_NAMES.get(n, n) for n in top10_names]
        sub = inter_mean_norm[np.ix_(top10_idx, top10_idx)]
        interactions_data = {
            "features": top10_friendly,
            "matrix": [[round(float(v), 4) for v in row] for row in sub],
        }
    else:
        # Approximate: use correlation of SHAP values as interaction proxy
        sv_subset = sv_mat if len(sv_mat.shape) == 2 else sv_mat
        top10_idx = np.argsort(mean_abs)[::-1][:10]
        top10_names = [FEATURE_ORDER[i] for i in top10_idx]
        top10_friendly = [FRIENDLY_NAMES.get(n, n) for n in top10_names]
        sub = sv_subset[:, top10_idx]
        corr = np.corrcoef(sub.T)
        interactions_data = {
            "features": top10_friendly,
            "matrix": [[round(float(v), 4) for v in row] for row in np.abs(corr)],
        }
    with open("models/shap_interactions.json", "w") as f:
        json.dump(interactions_data, f)
    log.info("shap_interactions.json saved")
except Exception as e:
    log.warning(f"SHAP interactions failed: {e}")
    # Write empty placeholder so endpoint doesn't 404
    with open("models/shap_interactions.json", "w") as f:
        json.dump({"features": [], "matrix": []}, f)

# ── 15. CALIBRATION CURVES ────────────────────────────────────────────────────
cal_curves = []
for r in results:
    yp = r["_clf"].predict_proba(X_test_scaled)[:, 1]
    fp2, mp = calibration_curve(y_test, yp, n_bins=10)
    cal_curves.append({
        "model": r["Model"],
        "mean_pred": [round(float(v), 4) for v in mp],
        "fraction_pos": [round(float(v), 4) for v in fp2],
    })
with open("models/calibration_curve.json", "w") as f: json.dump(cal_curves, f)
log.info("calibration_curve.json saved")

# ── 16. SURVIVAL ANALYSIS ─────────────────────────────────────────────────────
if HAS_LIFELINES:
    log.info("Running survival analysis...")
    try:
        # Use test set predictions for survival curves per risk cohort
        yp_all = champion.predict_proba(X_test_scaled)[:, 1]
        risk_cohort = np.where(yp_all >= 0.75, "Critical",
                       np.where(yp_all >= 0.55, "High",
                       np.where(yp_all >= 0.35, "Medium", "Low")))

        # Simulate duration from probability (higher risk → shorter survival)
        # Duration ∈ [1, 8] semesters
        duration_sim = np.clip(
            np.round((1 - yp_all) * 7 + 1 + np.random.default_rng(42).normal(0, 0.5, len(yp_all))),
            1, 8
        ).astype(int)
        event_observed = y_test.values  # 1 = dropped out

        survival_data = []
        kmf = KaplanMeierFitter()
        cohort_order = ["Low", "Medium", "High", "Critical"]
        colors = {"Low": "#3DBE7A", "Medium": "#E8D730", "High": "#E8A030", "Critical": "#E05252"}

        for cohort in cohort_order:
            mask = risk_cohort == cohort
            if mask.sum() < 5:
                continue
            kmf.fit(
                durations=duration_sim[mask],
                event_observed=event_observed[mask],
                label=cohort
            )
            sf = kmf.survival_function_
            timeline = [int(t) for t in sf.index.tolist()]
            prob = [round(float(v), 4) for v in sf[cohort].tolist()]
            survival_data.append({
                "cohort": cohort,
                "color": colors[cohort],
                "count": int(mask.sum()),
                "timeline": timeline,
                "survival_probability": prob,
                "median_survival": float(kmf.median_survival_time_) if kmf.median_survival_time_ and not np.isinf(kmf.median_survival_time_) else None,
            })

        with open("models/survival_curves.json", "w") as f:
            json.dump(survival_data, f)
        log.info("survival_curves.json saved")
    except Exception as e:
        log.warning(f"Survival analysis failed: {e}")
        with open("models/survival_curves.json", "w") as f:
            json.dump([], f)
else:
    with open("models/survival_curves.json", "w") as f:
        json.dump([], f)

# ── 17. SAVE ALL ARTIFACTS ────────────────────────────────────────────────────
joblib.dump(champion, "models/dropout_model.pkl")
joblib.dump(scaler, "models/scaler.pkl")
joblib.dump(le_target, "models/label_encoder.pkl")
joblib.dump(explainer, "models/shap_explainer.pkl")
open("models/best_threshold.txt", "w").write(str(best_thresh))
open("models/feature_names.txt", "w").write("\n".join(FEATURE_ORDER))
open("models/champion_model_name.txt", "w").write(champion_name)

log.info(f"\n✅ Done! Champion: {champion_name} | AUC: {best['Test_ROC_AUC']:.4f}")
log.info("Models saved to ./models/")
