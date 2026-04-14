

from fastapi import FastAPI, Depends, HTTPException, status, Response, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

import joblib
import numpy as np
import os
import logging
import httpx
import json
import io
from dotenv import load_dotenv
from datetime import datetime, timedelta

from jose import jwt, JWTError, ExpiredSignatureError
load_dotenv()
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Student Dropout Prediction API", version="4.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

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
    "daytime_evening_attendance":"Attendance Type","previous_qualification":"Previous Qualification",
    "previous_qualification_grade":"Prev. Qualification Grade","nationality":"Nationality",
    "mothers_qualification":"Mother's Qualification","fathers_qualification":"Father's Qualification",
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
    "unemployment_rate":"Unemployment Rate","inflation_rate":"Inflation Rate","gdp":"GDP Growth Rate",
}

LABEL_MAPS = {
    "marital_status": {1:"Single",2:"Married",3:"Widower",4:"Divorced",5:"Facto Union",6:"Legally Separated"},
    "application_mode": {
        1:"1st phase - general contingent",2:"Ordinance No. 612/93",5:"1st phase - Azores special",
        7:"Holders of other higher courses",10:"Ordinance No. 854-B/99",15:"International student (bachelor)",
        16:"1st phase - Madeira special",17:"2nd phase - general contingent",
        18:"3rd phase - general contingent",26:"Ordinance No. 533-A/99 b2",
        27:"Ordinance No. 533-A/99 b3",39:"Over 23 years old",42:"Transfer",43:"Change of course",
        44:"Technological specialization diploma holders",51:"Change of institution/course",
        53:"Short cycle diploma holders",57:"Change of institution/course (International)",
    },
    "daytime_evening_attendance": {1:"Daytime",0:"Evening"},
    "previous_qualification": {
        1:"Secondary education",2:"Bachelor degree",3:"Degree",4:"Master's",5:"Doctorate",
        6:"Higher education frequency",9:"12th year - not completed",10:"11th year - not completed",
        12:"Other - 11th year",14:"10th year",15:"10th year - not completed",
        19:"Basic 3rd cycle",38:"Basic 2nd cycle",39:"Technological specialization",
        40:"Degree 1st cycle",42:"Professional higher technical",43:"Master 2nd cycle",
    },
    "gender": {1:"Male",0:"Female"},
    "displaced": {0:"No",1:"Yes"},
    "educational_special_needs": {0:"No",1:"Yes"},
    "debtor": {0:"No",1:"Yes"},
    "tuition_fees_up_to_date": {1:"Yes, paid up",0:"No, overdue"},
    "scholarship_holder": {0:"No",1:"Yes"},
    "international": {0:"No",1:"Yes"},
    "course": {
        33:"Biofuel Production Technologies",171:"Animation and Multimedia Design",
        8014:"Social Service (evening)",9003:"Agronomy",9070:"Communication Design",
        9085:"Veterinary Nursing",9119:"Informatics Engineering",9130:"Equinculture",
        9147:"Management",9238:"Social Service",9254:"Tourism",9500:"Nursing",
        9556:"Oral Hygiene",9670:"Advertising and Marketing Management",
        9773:"Journalism and Communication",9853:"Basic Education",9991:"Management (evening)",
    },
    "mothers_qualification": {
        1:"Secondary Education",2:"Bachelor",3:"Degree",4:"Master's",5:"Doctorate",
        6:"Higher education frequency",9:"12th year - not completed",10:"11th year - not completed",
        19:"Basic 3rd Cycle",34:"Unknown",35:"Cannot read or write",
        37:"Basic 1st cycle",38:"Basic 2nd cycle",40:"Degree 1st cycle",
        43:"Master 2nd cycle",44:"Doctorate 3rd cycle",
    },
    "fathers_qualification": {
        1:"Secondary Education",2:"Bachelor",3:"Degree",4:"Master's",5:"Doctorate",
        6:"Higher education frequency",9:"12th year - not completed",10:"11th year - not completed",
        19:"Basic 3rd Cycle",34:"Unknown",35:"Cannot read or write",
        37:"Basic 1st cycle",38:"Basic 2nd cycle",40:"Degree 1st cycle",
        43:"Master 2nd cycle",44:"Doctorate 3rd cycle",
    },
    "mothers_occupation": {
        0:"Student",1:"Executive/Director",2:"Intellectual/Scientific",3:"Technical/Associate Prof",
        4:"Administrative",5:"Services/Security",6:"Agriculture/Fishing",7:"Skilled Trades",
        8:"Machine Operators",9:"Unskilled Workers",10:"Armed Forces",90:"Other",99:"Blank",
        122:"Healthcare",123:"Teachers",125:"ICT Specialists",131:"Science Technicians",
        132:"Health Technicians",134:"Legal/Social workers",141:"Office Assistants",
        143:"Data clerks",144:"Customer service",151:"Personal care",152:"Sellers",
        153:"Market sellers",171:"Construction",172:"Metalworking",174:"Electrical trades",
        175:"Food processing",181:"Machine operators",191:"Cleaning workers",
        192:"Unskilled agriculture",193:"Industrial labourers",194:"Drivers",195:"Armed forces",
    },
}
LABEL_MAPS["fathers_occupation"] = LABEL_MAPS["mothers_occupation"]

MODEL_PATH     = os.getenv("MODEL_PATH",     "models/dropout_model.pkl")
SCALER_PATH    = os.getenv("SCALER_PATH",    "models/scaler.pkl")
LABEL_ENC_PATH = os.getenv("LABEL_ENCODER_PATH", "models/label_encoder.pkl")
EXPLAINER_PATH = os.getenv("EXPLAINER_PATH", "models/shap_explainer.pkl")
THRESHOLD_PATH = os.getenv("THRESHOLD_PATH", "models/best_threshold.txt")
CHAMPION_PATH  = os.getenv("CHAMPION_PATH",  "models/champion_model_name.txt")

model=None; scaler=None; label_encoder=None; shap_explainer=None
decision_threshold=0.5; champion_name="Unknown"

try:
    model=joblib.load(MODEL_PATH); scaler=joblib.load(SCALER_PATH)
    label_encoder=joblib.load(LABEL_ENC_PATH); logger.info("Model loaded")
except Exception as e: logger.warning(f"Model load failed: {e}")

try:
    shap_explainer=joblib.load(EXPLAINER_PATH); logger.info("SHAP loaded")
except Exception as e: logger.warning(f"SHAP load failed: {e}")

try:
    with open(THRESHOLD_PATH) as f: decision_threshold=float(f.read().strip())
except: pass

try:
    with open(CHAMPION_PATH) as f: champion_name=f.read().strip()
except: pass

SUPABASE_URL=os.getenv("SUPABASE_URL",""); SUPABASE_KEY=os.getenv("SUPABASE_SERVICE_KEY","")
supabase: Optional[Client]=None
if SUPABASE_URL and SUPABASE_KEY:
    try: supabase=create_client(SUPABASE_URL,SUPABASE_KEY)
    except Exception as e: logger.error(f"Supabase init failed: {e}")

SMTP_HOST=os.getenv("SMTP_HOST","smtp.gmail.com")
SMTP_PORT=int(os.getenv("SMTP_PORT","587"))
SMTP_USER=os.getenv("SMTP_USER","")
SMTP_PASS=os.getenv("SMTP_PASS","")
SMTP_FROM=os.getenv("SMTP_FROM","")
SLACK_WEBHOOK=os.getenv("SLACK_WEBHOOK","")

CLERK_JWKS_URL=os.getenv("CLERK_JWKS_URL",""); CLERK_ISSUER=os.getenv("CLERK_ISSUER","")
_jwks_cache: dict={}

async def _get_clerk_jwks() -> dict:
    if _jwks_cache: return _jwks_cache
    if not CLERK_JWKS_URL: return {}
    async with httpx.AsyncClient() as client:
        resp=await client.get(CLERK_JWKS_URL,timeout=5.0); resp.raise_for_status()
        _jwks_cache.update(resp.json())
    return _jwks_cache

security=HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials=Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    token=credentials.credentials
    if CLERK_JWKS_URL:
        try:
            jwks=await _get_clerk_jwks()
            payload=jwt.decode(token,jwks,algorithms=["RS256"],
                               issuer=CLERK_ISSUER or None,options={"verify_exp":True,"verify_aud":False})
            return {"user_id":payload.get("sub"),"payload":payload}
        except ExpiredSignatureError:
            raise HTTPException(status_code=401,detail="Token expired.")
        except JWTError as e:
            raise HTTPException(status_code=401,detail=f"Invalid JWT: {e}")
        except Exception as e:
            logger.error(f"JWKS error: {e}")
            raise HTTPException(status_code=503,detail="Auth service unavailable.")
    else:
        logger.warning("CLERK_JWKS_URL not set - permissive auth mode.")
        # Try to decode without verification to get user_id
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            return {"user_id": payload.get("sub", "anonymous"), "payload": payload}
        except:
            return {"user_id": "anonymous", "token": token}

class StudentInput(BaseModel):
    marital_status: int=Field(...,ge=1,le=6)
    age_at_enrollment: int=Field(...,ge=15,le=70)
    gender: int=Field(...,ge=0,le=1)
    international: int=Field(0,ge=0,le=1)
    displaced: int=Field(0,ge=0,le=1)
    educational_special_needs: int=Field(0,ge=0,le=1)
    application_mode: int=Field(...,ge=1)
    application_order: int=Field(...,ge=0,le=9)
    course: int=Field(...,ge=1)
    daytime_evening_attendance: int=Field(1,ge=0,le=1)
    previous_qualification: int=Field(...,ge=1)
    previous_qualification_grade: float=Field(12.0,ge=0,le=200)
    nationality: int=Field(1,ge=1)
    mothers_qualification: int=Field(...,ge=1)
    fathers_qualification: int=Field(...,ge=1)
    mothers_occupation: int=Field(...,ge=0)
    fathers_occupation: int=Field(...,ge=0)
    admission_grade: float=Field(12.0,ge=0,le=200)
    debtor: int=Field(0,ge=0,le=1)
    tuition_fees_up_to_date: int=Field(1,ge=0,le=1)
    scholarship_holder: int=Field(0,ge=0,le=1)
    curricular_units_1st_sem_credited: int=Field(0,ge=0)
    curricular_units_1st_sem_enrolled: int=Field(...,ge=0)
    curricular_units_1st_sem_evaluations: int=Field(...,ge=0)
    curricular_units_1st_sem_approved: int=Field(...,ge=0)
    curricular_units_1st_sem_grade: float=Field(...,ge=0,le=200)
    curricular_units_1st_sem_without_evaluations: int=Field(0,ge=0)
    curricular_units_2nd_sem_credited: int=Field(0,ge=0)
    curricular_units_2nd_sem_enrolled: int=Field(...,ge=0)
    curricular_units_2nd_sem_evaluations: int=Field(...,ge=0)
    curricular_units_2nd_sem_approved: int=Field(...,ge=0)
    curricular_units_2nd_sem_grade: float=Field(...,ge=0,le=200)
    curricular_units_2nd_sem_without_evaluations: int=Field(0,ge=0)
    unemployment_rate: float=Field(...,ge=0)
    inflation_rate: float=Field(...)
    gdp: float=Field(...)
    student_id: Optional[str]=None
    student_name: Optional[str]=None
    notes: Optional[str]=None

class SHAPFactor(BaseModel):
    feature: str; friendly_name: str; shap_value: float
    feature_value: float; direction: str; severity: str

class PredictionResponse(BaseModel):
    model_config={"protected_namespaces":()}
    prediction: str; dropout_probability: float; graduate_probability: float
    risk_level: str; decision_threshold: float; model_used: str
    risk_factors: List[SHAPFactor]; protective_factors: List[SHAPFactor]
    recommendation: str; intervention_score: float
    prediction_id: Optional[str]=None; timestamp: str
    smote_note: str = "SMOTE applied inside each CV fold to prevent data leakage."

class BatchStudentInput(BaseModel):
    students: List[StudentInput]
    include_shap: bool = False

class RiskTimelineEntry(BaseModel):
    student_id: str
    semester: int = Field(..., ge=1, le=20)
    dropout_probability: float
    risk_level: str
    prediction_id: Optional[str] = None

class AlertRequest(BaseModel):
    student_id: str
    student_name: Optional[str] = None
    risk_level: str
    dropout_probability: float
    channel: str = "email"
    recipient: Optional[str] = None

class ActiveLearningLabel(BaseModel):
    prediction_id: str
    true_label: str
    notes: Optional[str] = None

class CounterfactualRequest(BaseModel):
    student_data: StudentInput
    desired_outcome: str = "Graduate"
    num_counterfactuals: int = Field(3, ge=1, le=5)

def extract_feature_vector(s: StudentInput) -> np.ndarray:
    d=s.dict(); return np.array([[d[f] for f in FEATURE_ORDER]])

def mock_predict(features):
    i1=FEATURE_ORDER.index("curricular_units_1st_sem_approved")
    i2=FEATURE_ORDER.index("curricular_units_2nd_sem_approved")
    it=FEATURE_ORDER.index("tuition_fees_up_to_date")
    base=0.30
    if features[0][i1]==0: base+=0.25
    if features[0][i2]==0: base+=0.25
    if features[0][it]==0: base+=0.15
    p=min(base,0.97); return np.array([[1-p,p]])

def compute_shap_factors(features_scaled, raw_values):
    if shap_explainer is None: return _rule_based_factors(raw_values),[]
    try:
        sv=shap_explainer.shap_values(features_scaled)
        shap_vals=sv[1][0] if isinstance(sv,list) else sv[0]
        factors=[]
        for i,feat in enumerate(FEATURE_ORDER):
            sv_i=float(shap_vals[i]); abs_sv=abs(sv_i)
            severity="high" if abs_sv>0.05 else ("medium" if abs_sv>0.02 else "low")
            factors.append(SHAPFactor(
                feature=feat, friendly_name=FRIENDLY_NAMES.get(feat,feat),
                shap_value=round(sv_i,4), feature_value=float(raw_values.get(feat,0)),
                direction="increases_risk" if sv_i>0 else "decreases_risk", severity=severity,
            ))
        factors.sort(key=lambda x:abs(x.shap_value),reverse=True)
        return [f for f in factors if f.direction=="increases_risk"][:5], \
               [f for f in factors if f.direction=="decreases_risk"][:3]
    except Exception as e:
        logger.error(f"SHAP error: {e}"); return _rule_based_factors(raw_values),[]

def _rule_based_factors(d):
    out=[]
    if d.get("curricular_units_2nd_sem_approved",99)==0:
        out.append(SHAPFactor(feature="curricular_units_2nd_sem_approved",
            friendly_name="Units Approved (Sem 2)",shap_value=0.25,feature_value=0,
            direction="increases_risk",severity="high"))
    if d.get("tuition_fees_up_to_date")==0:
        out.append(SHAPFactor(feature="tuition_fees_up_to_date",
            friendly_name="Tuition Fees Up To Date",shap_value=0.15,feature_value=0,
            direction="increases_risk",severity="high"))
    if not out:
        out.append(SHAPFactor(feature="overall",friendly_name="No major risk flags",
            shap_value=0.0,feature_value=0,direction="increases_risk",severity="low"))
    return out

def get_recommendation(risk_level):
    if risk_level=="Critical": return "Immediate intervention required. Schedule urgent meeting with academic advisor and financial support office."
    elif risk_level=="High": return "Proactive outreach recommended. Connect student with tutoring services and review financial situation."
    elif risk_level=="Medium": return "Monitor closely. Consider optional check-in with academic advisor before semester end."
    return "Student appears on track. Continue regular monitoring each semester."

def compute_intervention_score(dropout_prob: float, risk_factors: list) -> float:
    base = dropout_prob * 70
    high_count = sum(1 for f in risk_factors if getattr(f,'severity',None)=='high' or (isinstance(f,dict) and f.get('severity')=='high'))
    medium_count = sum(1 for f in risk_factors if getattr(f,'severity',None)=='medium' or (isinstance(f,dict) and f.get('severity')=='medium'))
    return min(round(base + high_count*10 + medium_count*3, 1), 100.0)

def _load_json(path):
    if not os.path.exists(path): return None
    with open(path) as f: return json.load(f)

def _generate_pdf_report(student_name, student_id, prediction, dropout_prob, risk_level,
                          risk_factors, protective_factors, recommendation, timestamp, model_used):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.colors import HexColor, black, white
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import mm

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm,
                                leftMargin=20*mm, rightMargin=20*mm)
        styles = getSampleStyleSheet()
        story = []
        ACCENT = HexColor("#5B8AF0"); DANGER = HexColor("#E05252")
        SAFE = HexColor("#3DBE7A"); WARN = HexColor("#E8A030")
        risk_color = {"Critical":DANGER,"High":WARN,"Medium":HexColor("#E8D730"),"Low":SAFE}.get(risk_level, ACCENT)
        title_s = ParagraphStyle("t", fontSize=22, textColor=ACCENT, spaceAfter=4, fontName="Helvetica-Bold")
        h2_s = ParagraphStyle("h2", fontSize=13, textColor=black, spaceBefore=12, spaceAfter=6, fontName="Helvetica-Bold")
        body_s = ParagraphStyle("b", fontSize=10, textColor=black, spaceAfter=4, fontName="Helvetica")
        small_s = ParagraphStyle("s", fontSize=8, textColor=HexColor("#888888"), fontName="Helvetica")
        story.append(Paragraph("DropoutIQ - Student Risk Report", title_s))
        story.append(Paragraph(f"Generated: {timestamp} | Model: {model_used}", small_s))
        story.append(Spacer(1, 8*mm))
        info = [["Student Name", student_name or "N/A"],["Student ID", student_id or "N/A"],["Date", timestamp[:10]]]
        info_t = Table(info, colWidths=[60*mm, 110*mm])
        info_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(0,-1),HexColor("#f0f4ff")),("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),
            ("FONTSIZE",(0,0),(-1,-1),10),("BOX",(0,0),(-1,-1),0.5,HexColor("#cccccc")),
            ("GRID",(0,0),(-1,-1),0.3,HexColor("#e0e0e0")),("PADDING",(0,0),(-1,-1),6),
        ]))
        story.append(info_t); story.append(Spacer(1, 6*mm))
        story.append(Paragraph("Risk Summary", h2_s))
        risk_d = [["Prediction",prediction],["Dropout Probability",f"{round(dropout_prob*100,1)}%"],["Risk Level",risk_level]]
        risk_t = Table(risk_d, colWidths=[60*mm, 110*mm])
        risk_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(0,-1),HexColor("#f0f4ff")),("FONTNAME",(0,0),(-1,-1),"Helvetica-Bold"),
            ("FONTSIZE",(0,0),(-1,-1),11),("TEXTCOLOR",(1,2),(1,2),risk_color),
            ("TEXTCOLOR",(1,1),(1,1),DANGER if dropout_prob>0.5 else SAFE),
            ("BOX",(0,0),(-1,-1),0.5,HexColor("#cccccc")),
            ("GRID",(0,0),(-1,-1),0.3,HexColor("#e0e0e0")),("PADDING",(0,0),(-1,-1),7),
        ]))
        story.append(risk_t); story.append(Spacer(1, 6*mm))
        if risk_factors:
            story.append(Paragraph("Top Risk Drivers (SHAP)", h2_s))
            rf_d = [["Feature","SHAP Value","Severity"]]
            for f in risk_factors:
                rf_d.append([f.friendly_name, f"+{abs(f.shap_value)*100:.1f}%", f.severity.upper()])
            rf_t = Table(rf_d, colWidths=[90*mm,40*mm,40*mm])
            rf_t.setStyle(TableStyle([
                ("BACKGROUND",(0,0),(-1,0),DANGER),("TEXTCOLOR",(0,0),(-1,0),white),
                ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),9),
                ("ROWBACKGROUNDS",(0,1),(-1,-1),[HexColor("#fff5f5"),white]),
                ("BOX",(0,0),(-1,-1),0.5,HexColor("#cccccc")),
                ("GRID",(0,0),(-1,-1),0.3,HexColor("#e0e0e0")),("PADDING",(0,0),(-1,-1),5),
            ]))
            story.append(rf_t); story.append(Spacer(1, 4*mm))
        story.append(Paragraph("Recommended Action", h2_s))
        story.append(Paragraph(recommendation, body_s))
        story.append(Spacer(1, 8*mm))
        story.append(Paragraph("Note: This report is AI-generated and should be reviewed by a qualified academic advisor.", small_s))
        doc.build(story)
        buffer.seek(0)
        return buffer.read(), "application/pdf"
    except ImportError:
        lines = ["DropoutIQ - Student Risk Report","="*50,
                 f"Generated: {timestamp}",f"Model: {model_used}","",
                 f"Student: {student_name or 'N/A'}",f"ID: {student_id or 'N/A'}","",
                 f"Prediction: {prediction}",f"Dropout Probability: {round(dropout_prob*100,1)}%",
                 f"Risk Level: {risk_level}","","TOP RISK DRIVERS","-"*30]
        for f in risk_factors:
            lines.append(f"  {f.friendly_name}: +{abs(f.shap_value)*100:.1f}% ({f.severity})")
        lines += ["","RECOMMENDATION","-"*30,recommendation]
        return "\n".join(lines).encode("utf-8"), "text/plain"

@app.get("/health")
async def health():
    return {"status":"ok","model_loaded":model is not None,"shap_loaded":shap_explainer is not None,
            "champion_model":champion_name,"decision_threshold":decision_threshold,
            "db_connected":supabase is not None,"clerk_jwks_configured":bool(CLERK_JWKS_URL),
            "version":"4.0.0"}

@app.get("/me/role")
async def get_my_role(user=Depends(get_current_user)):
    user_id = user.get("user_id", "anonymous")
    if not supabase:
        return {"role": "admin", "user_id": user_id}
    try:
        result = supabase.table("user_roles").select("role").eq("user_id", user_id).execute()
        if result.data:
            return {"role": result.data[0]["role"], "user_id": user_id}
        supabase.table("user_roles").insert({"user_id": user_id, "role": "advisor"}).execute()
        return {"role": "advisor", "user_id": user_id}
    except Exception as e:
        logger.error(f"Role lookup failed: {e}")
        return {"role": "advisor", "user_id": user_id}

@app.put("/me/role")
async def set_user_role(body: dict, user=Depends(get_current_user)):
    caller_id = user.get("user_id", "anonymous")
    if not supabase:
        raise HTTPException(503, "Database not connected")
    role_res = supabase.table("user_roles").select("role").eq("user_id", caller_id).execute()
    caller_role = role_res.data[0]["role"] if role_res.data else "advisor"
    if caller_role != "admin":
        raise HTTPException(403, "Admin only")
    target_id = body.get("user_id")
    new_role = body.get("role", "advisor")
    supabase.table("user_roles").upsert({"user_id": target_id, "role": new_role}).execute()
    return {"ok": True, "user_id": target_id, "role": new_role}

@app.get("/analytics/summary")
async def get_analytics_summary(user=Depends(get_current_user)):
    if not supabase:
        return {"total": 0, "dropouts": 0, "graduates": 0,
                "critical": 0, "high": 0, "medium": 0, "low": 0, "avg_risk": 0}
    user_id = user.get("user_id", "anonymous")
    try:
        total_res = supabase.table("predictions").select("id", count="exact").eq("user_id", user_id).execute()
        total = total_res.count or 0

        dropout_res = supabase.table("predictions").select("id", count="exact").eq("user_id", user_id).eq("prediction", "Dropout").execute()
        dropouts = dropout_res.count or 0

        critical_res = supabase.table("predictions").select("id", count="exact").eq("user_id", user_id).eq("risk_level", "Critical").execute()
        critical = critical_res.count or 0

        high_res = supabase.table("predictions").select("id", count="exact").eq("user_id", user_id).eq("risk_level", "High").execute()
        high = high_res.count or 0

        medium_res = supabase.table("predictions").select("id", count="exact").eq("user_id", user_id).eq("risk_level", "Medium").execute()
        medium = medium_res.count or 0

        low_res = supabase.table("predictions").select("id", count="exact").eq("user_id", user_id).eq("risk_level", "Low").execute()
        low = low_res.count or 0

        sample_res = supabase.table("predictions").select("dropout_probability").eq("user_id", user_id).order("created_at", desc=True).limit(1000).execute()
        probs = [p["dropout_probability"] for p in (sample_res.data or [])]
        avg_risk = round(sum(probs) / len(probs) * 100) if probs else 0

        return {
            "total": total, "dropouts": dropouts, "graduates": total - dropouts,
            "critical": critical, "high": high, "medium": medium, "low": low,
            "avg_risk": avg_risk,
        }
    except Exception as e:
        logger.error(f"Summary error for {user_id}: {e}")
        raise HTTPException(500, "Failed to load dashboard summary. Please try again.")

@app.get("/students/search")
async def search_students(q: str = Query(..., min_length=1), limit: int = 20,
                           user=Depends(get_current_user)):
    if not supabase:
        raise HTTPException(503, "Database not connected. Please check your connection.")
    user_id = user.get("user_id", "anonymous")
    try:
        name_res = supabase.table("predictions").select(
            "student_id,student_name,prediction,dropout_probability,risk_level,created_at,intervention_score"
        ).eq("user_id", user_id).ilike("student_name", f"%{q}%").order("created_at", desc=True).limit(limit).execute()

        id_res = supabase.table("predictions").select(
            "student_id,student_name,prediction,dropout_probability,risk_level,created_at,intervention_score"
        ).eq("user_id", user_id).ilike("student_id", f"%{q}%").order("created_at", desc=True).limit(limit).execute()

        seen = set()
        results = []
        for p in (name_res.data or []) + (id_res.data or []):
            key = p.get("student_id") or p.get("student_name") or str(p)
            if key not in seen:
                seen.add(key)
                results.append(p)

        by_student: dict = {}
        for p in results:
            sid = p.get("student_id") or p.get("student_name", "unknown")
            if sid not in by_student:
                by_student[sid] = p

        return {"results": list(by_student.values())[:limit], "total": len(by_student)}
    except Exception as e:
        logger.error(f"Student search error for {user_id}: {e}")
        raise HTTPException(500, "Search failed. Please try again.")

@app.get("/students/{student_id}")
async def get_student_detail(student_id: str, user=Depends(get_current_user)):
    if not supabase:
        raise HTTPException(503, "Database not connected. Please check your connection.")
    user_id = user.get("user_id", "anonymous")
    try:
        pred_res = supabase.table("predictions").select("*").eq(
            "user_id", user_id
        ).eq("student_id", student_id).order("created_at", desc=True).execute()

        predictions = pred_res.data or []
        if not predictions:
            pred_res2 = supabase.table("predictions").select("*").eq(
                "user_id", user_id
            ).ilike("student_name", f"%{student_id}%").order("created_at", desc=True).execute()
            predictions = pred_res2.data or []

        if not predictions:
            raise HTTPException(404, f"Student '{student_id}' not found in your records. Make sure you have made a prediction for this student.")

        latest = predictions[0]
        timeline_res = supabase.table("risk_timeline").select("*").eq(
            "student_id", student_id
        ).order("semester").execute()

        pred_ids = [str(p["id"]) for p in predictions]
        labels = []
        if pred_ids:
            try:
                label_res = supabase.table("active_learning_labels").select("*").in_(
                    "prediction_id", pred_ids[:10]
                ).execute()
                labels = label_res.data or []
            except: pass

        risk_level = latest.get("risk_level", "Unknown")
        cohort_res = supabase.table("predictions").select(
            "dropout_probability"
        ).eq("user_id", user_id).eq("risk_level", risk_level).limit(500).execute()
        cohort_probs = [p["dropout_probability"] for p in (cohort_res.data or [])]
        cohort_avg = round(sum(cohort_probs) / len(cohort_probs), 4) if cohort_probs else 0

        risk_trend = [
            {"date": p["created_at"][:10], "probability": round(p["dropout_probability"] * 100, 1)}
            for p in reversed(predictions)
        ]

        return {
            "student_id": student_id,
            "student_name": latest.get("student_name"),
            "latest_prediction": latest.get("prediction"),
            "latest_risk_level": risk_level,
            "latest_dropout_probability": latest.get("dropout_probability"),
            "intervention_score": latest.get("intervention_score"),
            "prediction_count": len(predictions),
            "predictions": predictions,
            "risk_timeline": timeline_res.data or [],
            "risk_trend": risk_trend,
            "labels": labels,
            "cohort_avg_probability": cohort_avg,
            "recommendation": get_recommendation(risk_level),
        }
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Student detail error for {user_id}/{student_id}: {e}")
        raise HTTPException(500, "Could not load student details. Please try again.")

@app.get("/model/comparison")
async def model_comparison(user=Depends(get_current_user)):
    import pandas as pd
    csv_path="models/comparison_table.csv"
    if not os.path.exists(csv_path):
        raise HTTPException(404,"Comparison table not found. Run train_model.py first.")
    df=pd.read_csv(csv_path)
    return {"models":df.drop(columns=["Best_Params"],errors="ignore").to_dict(orient="records")}

@app.get("/model/roc-curve")
async def get_roc_curve(user=Depends(get_current_user)):
    data=_load_json("models/roc_curve.json")
    if not data: raise HTTPException(404,"ROC curve data not found. Run train_model.py first.")
    return {"roc_curves":data}

@app.get("/model/shap-global")
async def get_shap_global(user=Depends(get_current_user)):
    data=_load_json("models/shap_global.json")
    if not data: raise HTTPException(404,"SHAP global data not found. Run train_model.py first.")
    return {"features":data,"champion_model":champion_name}

@app.get("/model/shap-interactions")
async def get_shap_interactions(user=Depends(get_current_user)):
    data=_load_json("models/shap_interactions.json")
    if not data: raise HTTPException(404,"SHAP interaction data not found. Run train_model.py first.")
    return {"interactions":data,"champion_model":champion_name}

@app.get("/model/calibration")
async def get_calibration(user=Depends(get_current_user)):
    data=_load_json("models/calibration_curve.json")
    if not data: raise HTTPException(404,"Calibration data not found.")
    return {"calibration_curves":data}

@app.get("/model/confusion-matrix")
async def get_confusion_matrix(user=Depends(get_current_user)):
    data=_load_json("models/confusion_matrix.json")
    if not data: raise HTTPException(404,"Confusion matrix not found.")
    total=data["TP"]+data["TN"]+data["FP"]+data["FN"]
    data["precision"]=round(data["TP"]/(data["TP"]+data["FP"]+1e-9),4)
    data["recall"]=round(data["TP"]/(data["TP"]+data["FN"]+1e-9),4)
    data["accuracy"]=round((data["TP"]+data["TN"])/total,4)
    data["f1"]=round(2*data["precision"]*data["recall"]/(data["precision"]+data["recall"]+1e-9),4)
    data["specificity"]=round(data["TN"]/(data["TN"]+data["FP"]+1e-9),4)
    data["npv"]=round(data["TN"]/(data["TN"]+data["FN"]+1e-9),4)
    return data

@app.get("/model/precision-recall")
async def get_precision_recall(user=Depends(get_current_user)):
    data=_load_json("models/pr_curve.json")
    if not data: raise HTTPException(404,"PR curve data not found.")
    return {"pr_curves":data}

@app.get("/model/feature-labels")
async def get_feature_labels(user=Depends(get_current_user)):
    return {"label_maps":LABEL_MAPS,"friendly_names":FRIENDLY_NAMES,"feature_order":FEATURE_ORDER}

@app.get("/model/smote-note")
async def get_smote_note(user=Depends(get_current_user)):
    return {
        "title":"SMOTE Data Leakage - Handled",
        "detail":"SMOTE applied strictly INSIDE each CV fold during hyperparameter search.",
        "impact":"Without this fix, CV AUC can be inflated by 1-5% depending on class imbalance."
    }

@app.get("/model/survival")
async def get_survival_curves(user=Depends(get_current_user)):
    data=_load_json("models/survival_curves.json")
    if data is None: raise HTTPException(404,"Survival data not found. Run train_model.py first.")
    return {"survival_curves":data,"champion_model":champion_name}

@app.post("/predict", response_model=PredictionResponse)
async def predict(student: StudentInput, user=Depends(get_current_user)):
    user_id = user.get("user_id", "anonymous")
    features=extract_feature_vector(student); raw=student.dict()
    features_scaled=scaler.transform(features) if scaler else features
    proba=model.predict_proba(features_scaled)[0] if model else mock_predict(features)[0]
    dropout_prob=float(proba[1]) if len(proba)>1 else float(proba[0])
    graduate_prob=1.0-dropout_prob
    prediction="Dropout" if dropout_prob>=decision_threshold else "Graduate"
    risk_level=("Critical" if dropout_prob>=0.75 else "High" if dropout_prob>=0.55
                else "Medium" if dropout_prob>=0.35 else "Low")
    risk_factors,protective_factors=compute_shap_factors(features_scaled,raw)
    intervention_score=compute_intervention_score(dropout_prob,risk_factors)
    timestamp=datetime.utcnow().isoformat()
    prediction_id=None
    if supabase:
        try:
            row={"user_id":user_id,"student_id":student.student_id,"student_name":student.student_name,
                 "prediction":prediction,"dropout_probability":round(dropout_prob,4),
                 "risk_level":risk_level,"input_features":raw,"notes":student.notes,
                 "created_at":timestamp,"intervention_score":intervention_score}
            result=supabase.table("predictions").insert(row).execute()
            prediction_id=result.data[0]["id"] if result.data else None
            if student.student_id:
                supabase.table("risk_timeline").insert({
                    "student_id": student.student_id,
                    "semester": 1,
                    "dropout_probability": round(dropout_prob, 4),
                    "risk_level": risk_level,
                    "prediction_id": str(prediction_id) if prediction_id else None,
                }).execute()
        except Exception as e: logger.error(f"Supabase log failed for {user_id}: {e}")
    return PredictionResponse(
        prediction=prediction,dropout_probability=round(dropout_prob,4),
        graduate_probability=round(graduate_prob,4),risk_level=risk_level,
        decision_threshold=decision_threshold,model_used=champion_name,
        risk_factors=risk_factors,protective_factors=protective_factors,
        recommendation=get_recommendation(risk_level),
        intervention_score=intervention_score,
        prediction_id=str(prediction_id) if prediction_id else None,timestamp=timestamp,
    )

@app.post("/predict/pdf/instant")
async def download_instant_pdf(student: StudentInput, user=Depends(get_current_user)):
    features=extract_feature_vector(student); raw=student.dict()
    features_scaled=scaler.transform(features) if scaler else features
    proba=model.predict_proba(features_scaled)[0] if model else mock_predict(features)[0]
    dropout_prob=float(proba[1]) if len(proba)>1 else float(proba[0])
    prediction="Dropout" if dropout_prob>=decision_threshold else "Graduate"
    risk_level=("Critical" if dropout_prob>=0.75 else "High" if dropout_prob>=0.55
                else "Medium" if dropout_prob>=0.35 else "Low")
    risk_factors,protective_factors=compute_shap_factors(features_scaled,raw)
    timestamp=datetime.utcnow().isoformat()
    pdf_bytes,mime=_generate_pdf_report(
        student_name=student.student_name,student_id=student.student_id,
        prediction=prediction,dropout_prob=dropout_prob,risk_level=risk_level,
        risk_factors=risk_factors,protective_factors=protective_factors,
        recommendation=get_recommendation(risk_level),timestamp=timestamp,model_used=champion_name,
    )
    safe_name=(student.student_name or "student").replace(" ","_")
    ext=".pdf" if "pdf" in mime else ".txt"
    return Response(content=pdf_bytes,media_type=mime,
        headers={"Content-Disposition":f"attachment; filename=report_{safe_name}{ext}"})

@app.get("/predict/pdf/{prediction_id}")
async def download_pdf_by_id(prediction_id: str, user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected.")
    try:
        result=supabase.table("predictions").select("*").eq("id",prediction_id).execute()
        if not result.data: raise HTTPException(404,f"Prediction {prediction_id} not found.")
        p=result.data[0]
        features=np.array([[p["input_features"].get(f,0) for f in FEATURE_ORDER]])
        features_scaled=scaler.transform(features) if scaler else features
        risk_factors,protective_factors=compute_shap_factors(features_scaled,p["input_features"])
        pdf_bytes,mime=_generate_pdf_report(
            student_name=p.get("student_name"),student_id=p.get("student_id"),
            prediction=p["prediction"],dropout_prob=p["dropout_probability"],
            risk_level=p["risk_level"],risk_factors=risk_factors,protective_factors=protective_factors,
            recommendation=get_recommendation(p["risk_level"]),
            timestamp=p.get("created_at",""),model_used=champion_name,
        )
        safe_name=(p.get("student_name") or "student").replace(" ","_")
        ext=".pdf" if "pdf" in mime else ".txt"
        return Response(content=pdf_bytes,media_type=mime,
                        headers={"Content-Disposition":f"attachment; filename=report_{safe_name}{ext}"})
    except HTTPException: raise
    except Exception as e: raise HTTPException(500,f"Report generation failed: {e}")

@app.post("/predict/batch")
async def predict_batch(batch: BatchStudentInput, user=Depends(get_current_user)):
    if not batch.students: return {"results":[],"total":0}
    user_id = user.get("user_id", "anonymous")
    logger.info(f"Batch: {len(batch.students)} students | SHAP={batch.include_shap} | user={user_id}")
    start=datetime.utcnow()
    all_features=np.array([[s.dict()[f] for f in FEATURE_ORDER] for s in batch.students])
    if model and scaler:
        scaled=scaler.transform(all_features); probs=model.predict_proba(scaled)
    else:
        probs=np.array([mock_predict(all_features[i:i+1])[0] for i in range(len(all_features))])
    results=[]; db_rows=[]
    for i,s in enumerate(batch.students):
        dp=float(probs[i][1]) if probs.shape[1]>1 else float(probs[i][0])
        pred="Dropout" if dp>=decision_threshold else "Graduate"
        rl=("Critical" if dp>=0.75 else "High" if dp>=0.55 else "Medium" if dp>=0.35 else "Low")
        shap_data={}
        if batch.include_shap:
            rf,pf=compute_shap_factors(scaled[i:i+1] if model and scaler else all_features[i:i+1],s.dict())
            shap_data={"risk_factors":[f.dict() for f in rf],"protective_factors":[f.dict() for f in pf]}
        intervention_score=compute_intervention_score(dp,
            [type('F',(),{'severity':f.get('severity','low')})() for f in shap_data.get("risk_factors",[])])
        results.append({
            "student_id":s.student_id,"student_name":s.student_name,
            "prediction":pred,"dropout_probability":round(dp,4),"risk_level":rl,
            "intervention_score":intervention_score,**shap_data
        })
        db_rows.append({"user_id":user_id,"student_id":s.student_id,"student_name":s.student_name,
                         "prediction":pred,"dropout_probability":round(dp,4),"risk_level":rl,
                         "input_features":s.dict(),"created_at":start.isoformat(),
                         "intervention_score":intervention_score})
    if supabase and db_rows:
        try:
            for i in range(0,len(db_rows),500):
                supabase.table("predictions").insert(db_rows[i:i+500]).execute()
        except Exception as e: logger.error(f"Supabase batch failed for {user_id}: {e}")
    results.sort(key=lambda x:x["intervention_score"],reverse=True)
    dur=(datetime.utcnow()-start).total_seconds()
    risk_summary={rl:sum(1 for r in results if r["risk_level"]==rl) for rl in ["Critical","High","Medium","Low"]}
    return {"results":results,"total":len(results),"duration_seconds":dur,
            "model_used":champion_name,"decision_threshold":decision_threshold,
            "risk_summary":risk_summary}

@app.get("/predictions/history")
async def get_history(limit: int=100, offset: int=0, user=Depends(get_current_user)):
    if not supabase: return {"predictions":[],"message":"Database not connected. Please check your configuration."}
    user_id = user.get("user_id", "anonymous")
    try:
        result=supabase.table("predictions").select("*").eq("user_id", user_id).order(
            "created_at",desc=True).range(offset, offset+limit-1).execute()
        return {"predictions":result.data,"limit":limit,"offset":offset}
    except Exception as e:
        logger.error(f"History error for {user_id}: {e}")
        raise HTTPException(500, "Could not load prediction history. Please try again.")

@app.get("/analytics/intervention-priority")
async def get_intervention_priority(limit: int=20, user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected. Please check your configuration.")
    user_id = user.get("user_id", "anonymous")
    try:
        result=supabase.table("predictions").select("*").eq("user_id", user_id).eq("prediction","Dropout") \
            .order("dropout_probability",desc=True).limit(limit).execute()
        ranked=[{"student_name":p.get("student_name"),"student_id":p.get("student_id"),
                 "risk_level":p["risk_level"],"dropout_probability":p["dropout_probability"],
                 "intervention_score":p.get("intervention_score",round(p["dropout_probability"]*70,1)),
                 "created_at":p["created_at"]} for p in result.data]
        return {"priority_list":ranked,"total":len(ranked)}
    except Exception as e:
        logger.error(f"Intervention priority error for {user_id}: {e}")
        raise HTTPException(500, "Could not load intervention priority list. Please try again.")

@app.get("/analytics/cohort")
async def get_cohort_analysis(user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected. Please check your configuration.")
    user_id = user.get("user_id", "anonymous")
    try:
        order=["Critical","High","Medium","Low"]
        output=[]
        total_res = supabase.table("predictions").select("id", count="exact").eq("user_id", user_id).execute()
        total = total_res.count or 0
        for rl in order:
            count_res = supabase.table("predictions").select("id,dropout_probability", count="exact").eq("user_id", user_id).eq("risk_level", rl).execute()
            count = count_res.count or 0
            probs = [p["dropout_probability"] for p in (count_res.data or [])]
            avg = round(sum(probs)/len(probs),4) if probs else 0
            output.append({
                "risk_level":rl,"count":count,
                "avg_probability":avg,
                "percentage":round(count/total*100,1) if total else 0
            })
        return {"cohorts":output,"total_students":total}
    except Exception as e:
        logger.error(f"Cohort analysis error for {user_id}: {e}")
        raise HTTPException(500, "Could not load cohort analysis. Please try again.")

@app.get("/analytics/trends")
async def get_trends(days: int=30, user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected. Please check your configuration.")
    user_id = user.get("user_id", "anonymous")
    try:
        since=(datetime.utcnow()-timedelta(days=days)).isoformat()
        result=supabase.table("predictions").select("created_at,prediction,risk_level,dropout_probability") \
            .eq("user_id", user_id).gte("created_at",since).order("created_at").execute()
        by_date: Dict[str,Any]={}
        for p in result.data:
            date=p["created_at"][:10]
            if date not in by_date:
                by_date[date]={"date":date,"total":0,"dropouts":0,"graduates":0,
                               "critical":0,"high":0,"medium":0,"low":0,"prob_sum":0.0}
            d=by_date[date]; d["total"]+=1; d["prob_sum"]+=p["dropout_probability"]
            if p["prediction"]=="Dropout": d["dropouts"]+=1
            else: d["graduates"]+=1
            rl=p["risk_level"].lower()
            if rl in d: d[rl]+=1
        output=[]
        for d in by_date.values():
            d["avg_prob"]=round(d.pop("prob_sum")/d["total"],4) if d["total"]>0 else 0
            output.append(d)
        return {"trends":output,"days":days}
    except Exception as e:
        logger.error(f"Trends error for {user_id}: {e}")
        raise HTTPException(500, "Could not load trend data. Please try again.")

@app.get("/analytics/risk-timeline/{student_id}")
async def get_risk_timeline(student_id: str, user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected")
    try:
        result = supabase.table("risk_timeline").select("*").eq(
            "student_id", student_id
        ).order("semester").execute()
        return {"student_id": student_id, "timeline": result.data or []}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/analytics/risk-timeline")
async def add_risk_timeline(entry: RiskTimelineEntry, user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected")
    try:
        row = {
            "student_id": entry.student_id,
            "semester": entry.semester,
            "dropout_probability": entry.dropout_probability,
            "risk_level": entry.risk_level,
            "prediction_id": entry.prediction_id,
        }
        result = supabase.table("risk_timeline").insert(row).execute()
        return {"ok": True, "data": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/analytics/fairness")
async def get_fairness_audit(user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected. Please check your configuration.")
    user_id = user.get("user_id", "anonymous")
    try:
        result = supabase.table("predictions").select(
            "prediction,dropout_probability,risk_level,input_features"
        ).eq("user_id", user_id).limit(2000).execute()

        data = result.data or []
        if len(data) < 10:
            return {"message": "Not enough data for fairness analysis", "metrics": []}

        genders = [p.get("input_features",{}).get("gender",1) for p in data]
        scholarships = [p.get("input_features",{}).get("scholarship_holder",0) for p in data]
        predictions = [1 if p["prediction"]=="Dropout" else 0 for p in data]
        probs = [p["dropout_probability"] for p in data]

        def demographic_parity(preds, groups):
            g0 = [p for p, g in zip(preds, groups) if g == 0]
            g1 = [p for p, g in zip(preds, groups) if g == 1]
            rate0 = sum(g0)/len(g0) if g0 else 0
            rate1 = sum(g1)/len(g1) if g1 else 0
            diff = abs(rate0 - rate1)
            return {"group_0_rate": round(rate0, 4), "group_1_rate": round(rate1, 4),
                    "difference": round(diff, 4), "fair": diff < 0.1}

        def avg_prob(probs, groups, g):
            vals = [p for p, gr in zip(probs, groups) if gr == g]
            return round(sum(vals)/len(vals), 4) if vals else 0

        gender_dp = demographic_parity(predictions, genders)
        scholarship_dp = demographic_parity(predictions, scholarships)

        metrics = [
            {
                "attribute": "Gender",
                "group_labels": {"0": "Female", "1": "Male"},
                "demographic_parity": gender_dp,
                "avg_dropout_prob": {
                    "Female": avg_prob(probs, genders, 0),
                    "Male": avg_prob(probs, genders, 1),
                },
                "sample_counts": {
                    "Female": genders.count(0),
                    "Male": genders.count(1),
                },
            },
            {
                "attribute": "Scholarship",
                "group_labels": {"0": "No scholarship", "1": "Has scholarship"},
                "demographic_parity": scholarship_dp,
                "avg_dropout_prob": {
                    "No scholarship": avg_prob(probs, scholarships, 0),
                    "Has scholarship": avg_prob(probs, scholarships, 1),
                },
                "sample_counts": {
                    "No scholarship": scholarships.count(0),
                    "Has scholarship": scholarships.count(1),
                },
            },
        ]
        return {"metrics": metrics, "total_analyzed": len(data),
                "overall_dropout_rate": round(sum(predictions)/len(predictions), 4)}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/counterfactual")
async def get_counterfactuals(req: CounterfactualRequest, user=Depends(get_current_user)):
    try:
        features = extract_feature_vector(req.student_data)
        features_scaled = scaler.transform(features) if scaler else features
        proba = model.predict_proba(features_scaled)[0] if model else mock_predict(features)[0]
        current_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])
        current_pred = "Dropout" if current_prob >= decision_threshold else "Graduate"

        actionable = [
            "tuition_fees_up_to_date", "debtor",
            "curricular_units_1st_sem_enrolled", "curricular_units_1st_sem_approved",
            "curricular_units_1st_sem_grade",
            "curricular_units_2nd_sem_enrolled", "curricular_units_2nd_sem_approved",
            "curricular_units_2nd_sem_grade",
            "scholarship_holder",
        ]

        counterfactuals = []
        raw = req.student_data.dict()

        if raw.get("tuition_fees_up_to_date") == 0 and req.desired_outcome == "Graduate":
            cf = raw.copy()
            cf["tuition_fees_up_to_date"] = 1
            cf_feat = np.array([[cf[f] for f in FEATURE_ORDER]])
            cf_scaled = scaler.transform(cf_feat) if scaler else cf_feat
            cf_prob = float(model.predict_proba(cf_scaled)[0][1]) if model else 0.3
            counterfactuals.append({
                "id": 1,
                "changes": [{"feature": "tuition_fees_up_to_date",
                             "friendly_name": "Tuition Fees Up To Date",
                             "from": "Not paid", "to": "Paid up"}],
                "new_dropout_probability": round(cf_prob, 4),
                "new_prediction": "Dropout" if cf_prob >= decision_threshold else "Graduate",
                "probability_change": round(current_prob - cf_prob, 4),
                "feasibility": "High",
                "action": "Ensure tuition fees are paid on time. Contact financial aid office.",
            })

        if raw.get("curricular_units_2nd_sem_approved", 0) < 4 and req.desired_outcome == "Graduate":
            cf = raw.copy()
            original = cf["curricular_units_2nd_sem_approved"]
            cf["curricular_units_2nd_sem_approved"] = min(original + 3, cf.get("curricular_units_2nd_sem_enrolled", 6))
            cf["curricular_units_2nd_sem_grade"] = max(cf.get("curricular_units_2nd_sem_grade", 10), 12.0)
            cf_feat = np.array([[cf[f] for f in FEATURE_ORDER]])
            cf_scaled = scaler.transform(cf_feat) if scaler else cf_feat
            cf_prob = float(model.predict_proba(cf_scaled)[0][1]) if model else 0.35
            counterfactuals.append({
                "id": 2,
                "changes": [
                    {"feature": "curricular_units_2nd_sem_approved",
                     "friendly_name": "Units Approved (Sem 2)",
                     "from": original, "to": cf["curricular_units_2nd_sem_approved"]},
                    {"feature": "curricular_units_2nd_sem_grade",
                     "friendly_name": "Grade Average (Sem 2)",
                     "from": round(raw.get("curricular_units_2nd_sem_grade", 10), 1),
                     "to": cf["curricular_units_2nd_sem_grade"]},
                ],
                "new_dropout_probability": round(cf_prob, 4),
                "new_prediction": "Dropout" if cf_prob >= decision_threshold else "Graduate",
                "probability_change": round(current_prob - cf_prob, 4),
                "feasibility": "Medium",
                "action": "Attend tutoring sessions and improve academic performance in semester 2.",
            })

        if raw.get("scholarship_holder") == 0 and req.desired_outcome == "Graduate":
            cf = raw.copy()
            cf["scholarship_holder"] = 1
            cf["tuition_fees_up_to_date"] = 1
            cf["debtor"] = 0
            cf_feat = np.array([[cf[f] for f in FEATURE_ORDER]])
            cf_scaled = scaler.transform(cf_feat) if scaler else cf_feat
            cf_prob = float(model.predict_proba(cf_scaled)[0][1]) if model else 0.28
            counterfactuals.append({
                "id": 3,
                "changes": [
                    {"feature": "scholarship_holder", "friendly_name": "Scholarship Holder",
                     "from": "No", "to": "Yes"},
                    {"feature": "debtor", "friendly_name": "Outstanding Debt", "from": "Yes", "to": "No"},
                ],
                "new_dropout_probability": round(cf_prob, 4),
                "new_prediction": "Dropout" if cf_prob >= decision_threshold else "Graduate",
                "probability_change": round(current_prob - cf_prob, 4),
                "feasibility": "Medium",
                "action": "Apply for scholarship to reduce financial burden. Check eligibility criteria.",
            })

        if not counterfactuals:
            counterfactuals.append({
                "id": 1,
                "changes": [],
                "new_dropout_probability": round(max(current_prob - 0.15, 0.05), 4),
                "new_prediction": "Graduate",
                "probability_change": 0.15,
                "feasibility": "High",
                "action": "Maintain current academic progress. Continue attending all classes and submitting coursework on time.",
            })

        return {
            "student_id": req.student_data.student_id,
            "student_name": req.student_data.student_name,
            "current_prediction": current_pred,
            "current_dropout_probability": round(current_prob, 4),
            "desired_outcome": req.desired_outcome,
            "counterfactuals": counterfactuals[:req.num_counterfactuals],
        }
    except Exception as e:
        raise HTTPException(500, f"Counterfactual generation failed: {e}")

@app.post("/alerts/send")
async def send_alert(req: AlertRequest, background_tasks: BackgroundTasks,
                     user=Depends(get_current_user)):
    async def _send():
        subject = f"[DropoutIQ] {req.risk_level} Risk Alert — {req.student_name or req.student_id}"
        body = (f"Student: {req.student_name or 'N/A'} (ID: {req.student_id})\n"
                f"Risk Level: {req.risk_level}\n"
                f"Dropout Probability: {round(req.dropout_probability*100,1)}%\n"
                f"Recommendation: {get_recommendation(req.risk_level)}\n\n"
                f"Generated by DropoutIQ v4")

        success = False
        if req.channel == "email" and SMTP_USER and req.recipient:
            try:
                import aiosmtplib
                from email.mime.text import MIMEText
                msg = MIMEText(body)
                msg["Subject"] = subject
                msg["From"] = SMTP_FROM or SMTP_USER
                msg["To"] = req.recipient
                await aiosmtplib.send(msg, hostname=SMTP_HOST, port=SMTP_PORT,
                                      username=SMTP_USER, password=SMTP_PASS, start_tls=True)
                success = True
                logger.info(f"Email alert sent to {req.recipient}")
            except Exception as e:
                logger.error(f"Email send failed: {e}")

        elif req.channel == "slack" and SLACK_WEBHOOK:
            try:
                async with httpx.AsyncClient() as client:
                    payload = {"text": f"*{subject}*\n{body}"}
                    resp = await client.post(SLACK_WEBHOOK, json=payload, timeout=5.0)
                success = resp.status_code == 200
                logger.info(f"Slack alert sent: status={resp.status_code}")
            except Exception as e:
                logger.error(f"Slack send failed: {e}")
        else:
            logger.warning(f"Alert skipped: channel={req.channel}, credentials configured={bool(SMTP_USER or SLACK_WEBHOOK)}")

        if supabase:
            try:
                supabase.table("alerts_log").insert({
                    "student_id": req.student_id,
                    "student_name": req.student_name,
                    "alert_type": req.channel,
                    "channel": req.recipient or "slack",
                    "payload": {"subject": subject, "body": body, "success": success},
                }).execute()
            except: pass

    background_tasks.add_task(_send)
    return {"ok": True, "message": f"Alert queued via {req.channel}",
            "configured": bool(SMTP_USER or SLACK_WEBHOOK)}

@app.get("/alerts/history")
async def get_alerts_history(limit: int=50, user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected")
    try:
        result = supabase.table("alerts_log").select("*").order("sent_at", desc=True).limit(limit).execute()
        return {"alerts": result.data or [], "total": len(result.data or [])}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/active-learning/uncertain")
async def get_uncertain_predictions(limit: int=20, user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected. Please check your configuration.")
    user_id = user.get("user_id", "anonymous")
    try:
        result = supabase.table("predictions").select(
            "id,student_id,student_name,dropout_probability,risk_level,prediction,created_at"
        ).eq("user_id", user_id).gte("dropout_probability", 0.35).lte("dropout_probability", 0.65).order(
            "created_at", desc=True
        ).limit(limit * 3).execute()

        predictions = result.data or []
        predictions.sort(key=lambda p: abs(p["dropout_probability"] - 0.5))

        labeled_ids = set()
        if predictions:
            pred_ids = [str(p["id"]) for p in predictions[:50]]
            try:
                label_res = supabase.table("active_learning_labels").select(
                    "prediction_id"
                ).in_("prediction_id", pred_ids).execute()
                labeled_ids = {r["prediction_id"] for r in (label_res.data or [])}
            except: pass

        unlabeled = [p for p in predictions if str(p["id"]) not in labeled_ids]
        return {
            "uncertain_predictions": unlabeled[:limit],
            "total": len(unlabeled),
            "uncertainty_threshold": {"min": 0.35, "max": 0.65},
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/active-learning/label")
async def submit_label(label: ActiveLearningLabel, user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected")
    user_id = user.get("user_id", "anonymous")
    try:
        existing = supabase.table("active_learning_labels").select("id").eq(
            "prediction_id", label.prediction_id
        ).execute()
        if existing.data:
            result = supabase.table("active_learning_labels").update({
                "true_label": label.true_label,
                "labeled_by": user_id,
                "notes": label.notes,
            }).eq("prediction_id", label.prediction_id).execute()
        else:
            result = supabase.table("active_learning_labels").insert({
                "prediction_id": label.prediction_id,
                "true_label": label.true_label,
                "labeled_by": user_id,
                "notes": label.notes,
            }).execute()
        return {"ok": True, "message": "Label saved", "labeled_by": user_id}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/active-learning/stats")
async def get_active_learning_stats(user=Depends(get_current_user)):
    if not supabase: raise HTTPException(503,"Database not connected")
    try:
        total_res = supabase.table("active_learning_labels").select("id", count="exact").execute()
        dropout_res = supabase.table("active_learning_labels").select("id", count="exact").eq(
            "true_label", "Dropout"
        ).execute()
        return {
            "total_labels": total_res.count or 0,
            "dropout_labels": dropout_res.count or 0,
            "graduate_labels": (total_res.count or 0) - (dropout_res.count or 0),
        }
    except Exception as e:
        raise HTTPException(500, str(e))
