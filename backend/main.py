from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import uvicorn
import uuid
import os
from dotenv import load_dotenv
load_dotenv()
from svix.webhooks import Webhook, WebhookVerificationError
import fitz
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy.orm import Session
import stripe
from fastapi import Request

from core.models import FullCVData
from core.agent import setup_node, strategist_node, tailor_app, extract_lesson

from database import engine, get_db, SessionLocal
from models import Base, UserProfile, JobApplication, UserLesson, SavedJob, StripeEvent
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool
from auth import get_current_user_id

Base.metadata.create_all(bind=engine)

# Auto-migration to ensure strict_eligibility column exists on production DB
try:
    with engine.begin() as conn:
        from sqlalchemy import text
        if engine.name == 'postgresql':
            conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS strict_eligibility BOOLEAN DEFAULT TRUE"))
        else:
            conn.execute(text("ALTER TABLE user_profiles ADD COLUMN strict_eligibility BOOLEAN DEFAULT 1"))
except Exception:
    pass

app = FastAPI(title="Cursiva API", description="Backend engine for the Cursiva Agentic Job Hunter")

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://cursiva.se,https://www.cursiva.se"
    ).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# BYOK has been removed

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"status": "ok", "service": "Cursiva Backend"}

@app.api_route("/api/health", methods=["GET", "HEAD"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "degraded", "database": str(e)}

class IntakeRequest(BaseModel):
    job_description: str = Field(..., max_length=50_000)
    generic_cv_raw: str = Field(..., max_length=100_000)
    override_eligibility: bool = False

class TailorRequest(BaseModel):
    job_description: str = Field(..., max_length=50_000)
    generic_cv_raw: str = Field(..., max_length=100_000)
    company_name: str
    role_name: str
    strategy_plan: str
    user_strategy_answers: Optional[str] = Field("", max_length=5_000)
    user_feedback: Optional[str] = Field("", max_length=5_000)
    thread_id: Optional[str] = None  # unused (no checkpointer); kept for client compatibility

from fastapi.responses import StreamingResponse

@app.post("/api/intake")
@limiter.limit("10/minute")
def run_intake(request: Request, req: IntakeRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
    strict_eligibility = profile.strict_eligibility if profile is not None else True

    # Plain (sync) generator on purpose: Starlette iterates it in a worker
    # thread. An async generator here would run the blocking LLM calls on the
    # event loop and stall every other request on the instance.
    def event_generator():
        yield f"data: {json.dumps({'type': 'status', 'message': 'Setting up and extracting requirements...'})}\n\n"
        setup_result = setup_node({"job_description": req.job_description, "generic_cv_raw": req.generic_cv_raw, "api_key": os.environ.get("OPENAI_API_KEY"), "user_id": user_id})
        
        company_name = setup_result.get("company_name", "").strip()
        role_name = setup_result.get("role_name", "").strip()
        
        if company_name and role_name and not req.override_eligibility:
            # The request-scoped session is already closed once the body
            # streams, so use a short-lived session of our own.
            with SessionLocal() as gen_db:
                duplicate = gen_db.query(JobApplication).filter(
                    JobApplication.clerk_id == user_id,
                    JobApplication.company_name == company_name,
                    JobApplication.role_name == role_name
                ).first()
            if duplicate:
                yield f"data: {json.dumps({'type': 'result', 'status': 'ineligible', 'reason': f'Duplicate detected! You have already started an application for {role_name} at {company_name}.'})}\n\n"
                return

        if not setup_result.get("eligibility_passed", True) and not req.override_eligibility and strict_eligibility:
            yield f"data: {json.dumps({'type': 'result', 'status': 'ineligible', 'reason': setup_result.get('eligibility_reason')})}\n\n"
            return
            
        yield f"data: {json.dumps({'type': 'status', 'message': 'Strategist analyzing fit and formulating plan...'})}\n\n"
        strategy_result = strategist_node({"job_description": req.job_description, "generic_cv_raw": req.generic_cv_raw, "api_key": os.environ.get("OPENAI_API_KEY"), "user_id": user_id})
        
        yield f"data: {json.dumps({'type': 'result', 'status': 'success', 'metadata': setup_result, 'strategy': strategy_result})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

from sqlalchemy import text
import credits

def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


FAILED_REVIEW_MESSAGE = (
    "We couldn't produce a CV that passed our quality checks for this job, so nothing was generated "
    "and your credit has been refunded. Try adjusting your answers or feedback and run it again."
)
ERROR_MESSAGE = "Something went wrong while generating your documents. Your credit has been refunded."


@app.post("/api/tailor")
@limiter.limit("10/minute")
def run_tailor(request: Request, req: TailorRequest, user_id: str = Depends(get_current_user_id)):
    credits.sweep_stale_runs()
    try:
        run_id = credits.charge_for_run(user_id)
    except credits.InsufficientCredits:
        raise HTTPException(status_code=402, detail="Insufficient credits. Please top up your account.")

    # Plain (sync) generator on purpose: Starlette iterates it in a worker
    # thread. An async generator here would run the blocking LLM calls on the
    # event loop and stall every other request on the instance.
    def event_generator():
        # Every exit path closes the run exactly once: success keeps the
        # credit, anything else refunds it (credits.refund_run is idempotent).
        outcome = None
        final_state: dict = {}
        failure_reasons: list = []

        def metrics() -> dict:
            return {
                "revision_count": final_state.get("revision_count"),
                "cap_hit": final_state.get("review_feedback") not in (None, "PASS"),
                "failure_reasons": failure_reasons,
            }

        try:
            initial_state = {
                "api_key": os.environ.get("OPENAI_API_KEY"),
                "user_id": user_id,
                "job_description": req.job_description,
                "generic_cv_raw": req.generic_cv_raw,
                "company_name": req.company_name,
                "role_name": req.role_name,
                "strategy_plan": req.strategy_plan,
                "user_strategy_answers": req.user_strategy_answers,
                "user_feedback": req.user_feedback,
                "revision_count": 0,
                "generate_cover_letter": True,
            }
            for event in tailor_app.stream(initial_state):
                for node_name, node_state in event.items():
                    final_state.update(node_state)
                    if node_name == "tailor":
                        rev_count = node_state.get("revision_count", 0)
                        tailored_cv = node_state.get("tailored_cv", {})
                        reasoning = tailored_cv.get("reasoning", "Modifying content to match the provided strategy...") if isinstance(tailored_cv, dict) else "Modifying content..."
                        yield _sse({'type': 'status', 'message': f'Tailoring CV (Revision {rev_count}): {reasoning}'})
                    elif node_name == "reviewer":
                        feedback = node_state.get("review_feedback", "")
                        if feedback and feedback != "PASS":
                            failure_reasons.append(feedback)
                            short_feedback = feedback.split('.')[0] if '.' in feedback else feedback
                            yield _sse({'type': 'status', 'message': f'Reviewer found issues: {short_feedback}'})
                        else:
                            yield _sse({'type': 'status', 'message': 'Reviewer checked constraints: Passed!'})
                    elif node_name == "cover_letter":
                        yield _sse({'type': 'status', 'message': 'Generating Cover Letter based on the tailored CV and company context...'})

            if final_state.get("review_feedback") != "PASS":
                credits.refund_run(run_id, "failed_review", metrics=metrics())
                outcome = "failed_review"
                yield _sse({'type': 'result', 'status': 'failed_review', 'refunded': True,
                            'message': FAILED_REVIEW_MESSAGE,
                            'issues': final_state.get('review_feedback') or '',
                            'revision_count': final_state.get('revision_count')})
                return

            if not final_state.get("tailored_cv"):
                raise RuntimeError("pipeline finished without a tailored CV")

            credits.mark_success(run_id, metrics())
            outcome = "success"
            yield _sse({'type': 'result', 'status': 'success', 'tailored_cv': final_state.get('tailored_cv'),
                        'cover_letter_parts': final_state.get('cover_letter_parts', {}),
                        'revision_count': final_state.get('revision_count'),
                        'review_feedback': final_state.get('review_feedback')})
        except GeneratorExit:
            # Client disconnected before an outcome was recorded.
            if outcome is None:
                credits.refund_run(run_id, "abandoned", "client disconnected", metrics=metrics())
                outcome = "abandoned"
            raise
        except Exception as e:
            logger.exception("Tailor run %s failed", run_id)
            if outcome is None:
                credits.refund_run(run_id, "error", f"{type(e).__name__}: {e}", metrics=metrics())
                outcome = "error"
                yield _sse({'type': 'result', 'status': 'error', 'refunded': True, 'message': ERROR_MESSAGE})
        finally:
            if outcome is None:
                credits.refund_run(run_id, "error", "stream closed without an outcome", metrics=metrics())

    return StreamingResponse(event_generator(), media_type="text/event-stream")

MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

@app.post("/api/parse_pdf")
@limiter.limit("5/minute")
async def parse_pdf(
    request: Request,
    file: UploadFile = File(...), 
    user_id: str = Depends(get_current_user_id), 
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Must be a PDF file")
    
    content = await file.read()
    if len(content) > MAX_PDF_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="PDF file exceeds 5 MB limit.")
    try:
        doc = fitz.open(stream=content, filetype="pdf")
        text = "".join(page.get_text() for page in doc)
        
        setup_llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=os.environ.get("OPENAI_API_KEY"))
        structured_llm = setup_llm.with_structured_output(FullCVData)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Extract the candidate's information from the unstructured text and map it precisely to the provided schema. For the 'type' field in sections, map them correctly to 'skills', 'education', 'projects', 'work_experience' or 'custom' depending on content. Do not hallucinate. Leave fields empty if not present in the text.\n\nCRITICAL ORDERING RULE: You MUST order the extracted sections in the `sections` array strictly as follows: 'Work Experience', then 'Education', then 'Projects', then 'Skills'. Do NOT deviate from this order."),
            ("user",   "CV Text:\n{text}")
        ])
        
        res = (prompt | structured_llm).invoke({"text": text})
        parsed_data = res.model_dump()
        
        return {"status": "success", "parsed_data": parsed_data}
    except Exception as e:
        logger.error("PDF parse error for user %s: %s", user_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process the uploaded file.")

import tempfile
import subprocess
import jinja2
from fastapi.responses import FileResponse, JSONResponse

# Escape LaTeX special characters
def escape_latex(s: str) -> str:
    if not isinstance(s, str):
        return str(s)
    
    # Simple escaping for LaTeX
    s = s.replace('\\', '\\textbackslash{}')
    s = s.replace('&', '\\&')
    s = s.replace('%', '\\%')
    s = s.replace('$', '\\$')
    s = s.replace('#', '\\#')
    s = s.replace('_', '\\_')
    s = s.replace('{', '\\{')
    s = s.replace('}', '\\}')
    s = s.replace('~', '\\textasciitilde{}')
    s = s.replace('^', '\\textasciicircum{}')
    return s

def _escape_data(obj):
    if isinstance(obj, str): return escape_latex(obj)
    if isinstance(obj, dict): return {k: _escape_data(v) for k, v in obj.items()}
    if isinstance(obj, list): return [_escape_data(v) for v in obj]
    return obj

import re
import logging

logger = logging.getLogger(__name__)

def sanitize_url(url: str) -> str:
    """Validate and sanitize URLs for safe injection into LaTeX href commands."""
    if not isinstance(url, str):
        return ""
    url = url.strip()
    # Only allow http:// and https:// protocols
    if not re.match(r'^https?://', url, re.IGNORECASE):
        return ""
    # Remove LaTeX control characters that could escape the href argument
    url = re.sub(r'[\\{}\[\]]', '', url)
    return url

@app.post("/api/compile_cv")
def compile_cv(req: FullCVData, user_id: str = Depends(get_current_user_id)):
    data = req.model_dump()
    
    # Ensure URLs have https:// prefix for valid LaTeX hyperlinks and sanitize
    if 'personal_info' in data and data['personal_info']:
        for key in ['github', 'linkedin', 'portfolio']:
            url = data['personal_info'].get(key, '')
            if url and not url.startswith('http'):
                url = 'https://' + url
            data['personal_info'][key] = sanitize_url(url)
            
    for section in data.get('sections', []):
        for item in section.get('items', []):
            if item.get('url'):
                item['url'] = sanitize_url(item['url'])

    # Apply escaping to prevent LaTeX compilation errors
    safe_data = _escape_data(data)
    
    template_dir = os.path.join(os.path.dirname(__file__), 'templates')
    try:
        jinja_env = jinja2.Environment(loader=jinja2.FileSystemLoader(template_dir))
        template = jinja_env.get_template('cv_template.tex')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template error: {str(e)}")

    tex_content = template.render(**safe_data)
    
    # Create a temporary directory to compile the PDF
    with tempfile.TemporaryDirectory() as temp_dir:
        tex_path = os.path.join(temp_dir, 'cv.tex')
        with open(tex_path, 'w', encoding='utf-8') as f:
            f.write(tex_content)
        
        # Run pdflatex twice for references
        try:
            subprocess.run(
                ['pdflatex', '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'cv.tex'],
                cwd=temp_dir, check=True, capture_output=True, timeout=60
            )
            subprocess.run(
                ['pdflatex', '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'cv.tex'],
                cwd=temp_dir, check=True, capture_output=True, timeout=60
            )
        except subprocess.TimeoutExpired:
            logger.error("LaTeX compilation timed out for user %s", user_id)
            raise HTTPException(status_code=500, detail="PDF compilation timed out.")
        except subprocess.CalledProcessError as e:
            logger.error("LaTeX failed for user %s: %s", user_id, e.stdout.decode('utf-8', errors='ignore'))
            raise HTTPException(status_code=500, detail="PDF compilation failed. Check your CV data for unsupported characters.")
            
        pdf_path = os.path.join(temp_dir, 'cv.pdf')
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=500, detail="PDF was not generated.")
            
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()

    # Return the raw PDF bytes
    import base64
    b64_pdf = base64.b64encode(pdf_bytes).decode('utf-8')
    return JSONResponse(content={"status": "success", "pdf_base64": b64_pdf})

class FeedbackRequest(BaseModel):
    user_feedback: str = Field(..., max_length=5_000)

@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest, user_id: str = Depends(get_current_user_id)):
    extract_lesson(os.environ.get("OPENAI_API_KEY"), user_id, req.user_feedback)
    return {"status": "success"}

class CompileCLRequest(BaseModel):
    personal_info: dict
    company_name: str
    company_location: str = "Sweden"
    cover_letter_paragraphs: list

@app.post("/api/compile_cl")
def compile_cl(req: CompileCLRequest, user_id: str = Depends(get_current_user_id)):
    template_dir = os.path.join(os.path.dirname(__file__), 'templates')
    try:
        jinja_env = jinja2.Environment(loader=jinja2.FileSystemLoader(template_dir))
        template = jinja_env.get_template('cl_template.tex')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template error: {str(e)}")

    safe_paragraphs = [_escape_data(p).replace('\r\n', '\n').replace('\n\n', ' \\\\ \\mbox{} \\\\ ').replace('\n', ' \\\\ ') for p in req.cover_letter_paragraphs]
    tex_content = template.render(
        personal_info=_escape_data(req.personal_info),
        company_name=_escape_data(req.company_name),
        company_location=_escape_data(req.company_location),
        cover_letter_paragraphs=safe_paragraphs
    )
    
    with tempfile.TemporaryDirectory() as temp_dir:
        tex_path = os.path.join(temp_dir, 'cl.tex')
        with open(tex_path, 'w', encoding='utf-8') as f:
            f.write(tex_content)
        
        import shutil
        shutil.copy2(os.path.join(template_dir, 'cover.cls'), temp_dir)
        dest_fonts = os.path.join(temp_dir, 'OpenFonts')
        if not os.path.exists(dest_fonts):
            shutil.copytree(os.path.join(template_dir, 'OpenFonts'), dest_fonts)

        try:
            subprocess.run(
                ['xelatex', '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'cl.tex'],
                cwd=temp_dir, check=True, capture_output=True, timeout=60
            )
        except subprocess.TimeoutExpired:
            logger.error("LaTeX compilation timed out for user %s (CL)", user_id)
            raise HTTPException(status_code=500, detail="PDF compilation timed out.")
        except subprocess.CalledProcessError as e:
            logger.error("LaTeX failed for user %s (CL): %s", user_id, e.stdout.decode('utf-8', errors='ignore'))
            raise HTTPException(status_code=500, detail="PDF compilation failed. Check your data for unsupported characters.")
            
        pdf_path = os.path.join(temp_dir, 'cl.pdf')
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=500, detail="PDF was not generated.")
            
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()

    import base64
    b64_pdf = base64.b64encode(pdf_bytes).decode('utf-8')
    return JSONResponse(content={"status": "success", "pdf_base64": b64_pdf})

@app.get("/")
def read_root():
    return {"message": "Welcome to the Cursiva API"}

class ProfileUpdate(BaseModel):
    cv_data_json: Optional[str] = None
    email: Optional[str] = None  # Used only on first profile creation to detect cycling
    strict_eligibility: Optional[bool] = None

@app.get("/api/user/profile")
def get_user_profile(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
    if not profile:
        return {"status": "success", "data": {"has_baseline": False, "cv_data": None}}
    
    cv_data = json.loads(profile.cv_data_json) if profile.cv_data_json else None
    return {"status": "success", "data": {"has_baseline": bool(cv_data), "cv_data": cv_data, "credits": profile.credits, "strict_eligibility": profile.strict_eligibility}}



@app.post("/api/user/profile")
def update_user_profile(req: ProfileUpdate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    from models import UsedTrialEmail
    import hashlib
    profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
    if not profile:
        # Check if this email has been used for a free trial before
        starting_credits = 1  # default trial credit
        if req.email:
            email_hash = hashlib.sha256(req.email.lower().strip().encode()).hexdigest()
            used = db.query(UsedTrialEmail).filter(UsedTrialEmail.email_hash == email_hash).first()
            if used:
                starting_credits = 0  # cycling detected — no free trial
            else:
                db.add(UsedTrialEmail(email_hash=email_hash))  # record it now
        profile = UserProfile(clerk_id=user_id, credits=starting_credits)
        db.add(profile)
    
    if req.cv_data_json is not None:
        if req.cv_data_json.strip() == "":
             profile.cv_data_json = None
             profile.cv_embedding_json = None
        else:
             profile.cv_data_json = req.cv_data_json
             try:
                 from langchain_openai import OpenAIEmbeddings
                 embedder = OpenAIEmbeddings(model="text-embedding-3-small", api_key=os.environ.get("OPENAI_API_KEY"))
                 embedding = embedder.embed_query(req.cv_data_json)
                 profile.cv_embedding_json = json.dumps(embedding)
             except Exception as e:
                 print(f"Failed to generate CV embedding: {e}")
                 profile.cv_embedding_json = None
    if req.strict_eligibility is not None:
        profile.strict_eligibility = req.strict_eligibility

    db.commit()
    return {"status": "success"}

class JobApplicationCreate(BaseModel):
    company_name: str
    role_name: str
    job_description: str
    cv_data_json: str
    cl_data_json: str

@app.post("/api/applications")
def create_application(req: JobApplicationCreate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    app_id = str(uuid.uuid4())
    new_app = JobApplication(
        id=app_id,
        clerk_id=user_id,
        company_name=req.company_name,
        role_name=req.role_name,
        job_description=req.job_description,
        cv_data_json=req.cv_data_json,
        cl_data_json=req.cl_data_json
    )
    db.add(new_app)
    db.commit()
    return {"status": "success", "id": app_id}

@app.get("/api/applications")
def get_applications(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    apps = db.query(JobApplication).filter(JobApplication.clerk_id == user_id).order_by(JobApplication.created_at.desc()).all()
    result = []
    for app in apps:
        result.append({
            "id": app.id,
            "company_name": app.company_name,
            "role_name": app.role_name,
            "status": app.status or "Applied",
            "created_at": app.created_at.isoformat()
        })
    return {"status": "success", "data": result}

class SaveJobRequest(BaseModel):
    job_description: str = Field(..., max_length=50_000)
    url: Optional[str] = Field(None, max_length=2048)

class JobExtract(BaseModel):
    company_name: str
    role_name: str

@app.post("/api/jobs/save")
@limiter.limit("20/minute")
def save_job(request: Request, req: SaveJobRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    
    # Extract company and role
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=os.environ.get("OPENAI_API_KEY"))
        structured_llm = llm.with_structured_output(JobExtract)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Extract the company name and role name from the provided job description. If not explicitly stated, infer them or output 'Unknown'."),
            ("user", "{text}")
        ])
        res = (prompt | structured_llm).invoke({"text": req.job_description})
        company_name = res.company_name
        role_name = res.role_name
    except Exception as e:
        company_name = "Unknown"
        role_name = "Unknown"

    job_id = str(uuid.uuid4())
    
    # Compute job description embedding
    embedding_json = None
    try:
        from langchain_openai import OpenAIEmbeddings
        import json
        embedder = OpenAIEmbeddings(model="text-embedding-3-small", api_key=os.environ.get("OPENAI_API_KEY"))
        embedding = embedder.embed_query(req.job_description)
        embedding_json = json.dumps(embedding)
    except Exception as e:
        print(f"Failed to generate job embedding: {e}")

    new_job = SavedJob(
        id=job_id,
        clerk_id=user_id,
        company_name=company_name,
        role_name=role_name,
        job_description=req.job_description,
        url=req.url,
        embedding_json=embedding_json
    )
    db.add(new_job)
    db.commit()
    return {"status": "success", "id": job_id}

import random

import numpy as np

@app.get("/api/jobs/matches")
def get_saved_jobs(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    jobs = db.query(SavedJob).filter(SavedJob.clerk_id == user_id).order_by(SavedJob.created_at.desc()).all()
    profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
    cv_emb = None
    if profile and profile.cv_embedding_json:
        try:
            cv_emb = np.array(json.loads(profile.cv_embedding_json))
        except:
            pass

    result = []
    
    for job in jobs:
        score = 0
        if cv_emb is not None and job.embedding_json:
            try:
                job_emb = np.array(json.loads(job.embedding_json))
                # Cosine similarity
                cosine_sim = np.dot(cv_emb, job_emb) / (np.linalg.norm(cv_emb) * np.linalg.norm(job_emb))
                # Convert from [-1, 1] to a realistic percentage [0, 100]
                # Empirically, text-embedding-3-small similarities usually hover around 0.3 - 0.6 for related texts
                # Let's map 0.25 -> 0% and 0.55 -> 100% roughly to spread out the scores
                clamped_sim = max(0.25, min(0.55, cosine_sim))
                score = int(((clamped_sim - 0.25) / 0.30) * 100)
            except Exception as e:
                print(f"Failed to compute similarity: {e}")
                score = 75 + (hash(job.id) % 20)
        else:
            # Fallback to pseudo-random if embeddings are missing
            score = 75 + (hash(job.id) % 20)

        result.append({
            "id": job.id,
            "company_name": job.company_name,
            "role_name": job.role_name,
            "job_description": job.job_description,
            "url": job.url,
            "match_score": score,
            "created_at": job.created_at.isoformat()
        })
    return {"status": "success", "data": result}

@app.delete("/api/jobs/saved/{job_id}")
def delete_saved_job(job_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    job = db.query(SavedJob).filter(SavedJob.id == job_id, SavedJob.clerk_id == user_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Saved job not found")
    
    db.delete(job)
    db.commit()
    return {"status": "success", "message": "Saved job deleted"}

class BatchDeleteRequest(BaseModel):
    ids: List[str]

@app.post("/api/jobs/saved/batch-delete")
def batch_delete_saved_jobs(req: BatchDeleteRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    jobs = db.query(SavedJob).filter(SavedJob.id.in_(req.ids), SavedJob.clerk_id == user_id).all()
    for job in jobs:
        db.delete(job)
    db.commit()
    return {"status": "success", "deleted_count": len(jobs)}

@app.get("/api/applications/{app_id}")
def get_application(app_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    app = db.query(JobApplication).filter(JobApplication.id == app_id, JobApplication.clerk_id == user_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {
        "status": "success", 
        "data": {
            "id": app.id,
            "company_name": app.company_name,
            "role_name": app.role_name,
            "job_description": app.job_description,
            "cv_data_json": app.cv_data_json,
            "cl_data_json": app.cl_data_json,
            "status": app.status or "Applied",
            "created_at": app.created_at.isoformat()
        }
    }

class JobApplicationUpdate(BaseModel):
    company_name: Optional[str] = None
    role_name: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[str] = None

import datetime

@app.put("/api/applications/{app_id}")
def update_application(app_id: str, req: JobApplicationUpdate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    app = db.query(JobApplication).filter(JobApplication.id == app_id, JobApplication.clerk_id == user_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if req.company_name is not None:
        app.company_name = req.company_name
    if req.role_name is not None:
        app.role_name = req.role_name
    if req.status is not None:
        app.status = req.status
    if req.created_at is not None:
        app.created_at = datetime.datetime.fromisoformat(req.created_at.replace('Z', '+00:00'))
        
    db.commit()
    return {"status": "success"}

@app.delete("/api/applications/{app_id}")
def delete_application(app_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    app_record = db.query(JobApplication).filter(JobApplication.id == app_id, JobApplication.clerk_id == user_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found")
    
    db.delete(app_record)
    db.commit()
    return {"status": "success", "message": "Application deleted"}

@app.post("/api/applications/batch-delete")
def batch_delete_applications(req: BatchDeleteRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    apps = db.query(JobApplication).filter(JobApplication.id.in_(req.ids), JobApplication.clerk_id == user_id).all()
    for app_record in apps:
        db.delete(app_record)
    db.commit()
    return {"status": "success", "deleted_count": len(apps)}

# --- STRIPE INTEGRATION ---

CREDITS_PER_PACK = int(os.environ.get("CREDITS_PER_PACK", "15"))


@app.post("/api/create-checkout-session")
def create_checkout_session(user_id: str = Depends(get_current_user_id)):
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    stripe_price_id = os.environ.get("STRIPE_PRICE_ID")
    app_url = os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': stripe_price_id,
                'quantity': 1,
            }],
            mode='payment',
            allow_promotion_codes=True,
            success_url=app_url + '/dashboard/settings?success=true',
            cancel_url=app_url + '/dashboard/settings?canceled=true',
            client_reference_id=user_id,
            # Read back by the webhook to decide what was bought.
            metadata={"product": "cursiva_credits", "price_id": stripe_price_id or "", "credits": str(CREDITS_PER_PACK)},
        )
        return {"url": session.url}
    except Exception:
        logger.exception("Stripe checkout session creation failed for user %s", user_id)
        raise HTTPException(status_code=502, detail="Could not start checkout. Please try again.")

@app.post("/api/clerk/webhook")
async def clerk_webhook(request: Request, db: Session = Depends(get_db)):
    secret = os.environ.get("CLERK_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="Missing Clerk webhook secret")
        
    payload = await request.body()
    headers = request.headers
    
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")
    
    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(status_code=400, detail="Missing svix headers")
        
    wh = Webhook(secret)
    try:
        event = wh.verify(payload, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature
        })
    except WebhookVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
        
    if event.get("type") == "user.deleted":
        user_id = event["data"].get("id")
        if user_id:
            db.query(UserProfile).filter(UserProfile.clerk_id == user_id).delete()
            db.query(UserLesson).filter(UserLesson.clerk_id == user_id).delete()
            db.query(JobApplication).filter(JobApplication.clerk_id == user_id).delete()
            db.commit()
            
    return {"status": "success"}

def _sget(obj, key, default=None):
    """Key access that works for dicts and StripeObjects of any version."""
    try:
        return obj[key]
    except (KeyError, TypeError, AttributeError):
        return default


def _credits_for_session(session) -> int:
    """How many credits a completed Checkout Session buys, or 0 if it isn't ours."""
    expected_price = os.environ.get("STRIPE_PRICE_ID")
    meta = dict(session.get("metadata") or {})
    if meta.get("product") == "cursiva_credits" and expected_price and meta.get("price_id") == expected_price:
        try:
            return max(0, int(meta.get("credits", CREDITS_PER_PACK)))
        except (TypeError, ValueError):
            return 0
    # Sessions created before metadata was added: verify the price with Stripe.
    if not expected_price:
        return 0
    items = stripe.checkout.Session.list_line_items(session["id"], limit=10)
    qty = 0
    for li in _sget(items, "data", []) or []:
        if _sget(_sget(li, "price", {}) or {}, "id") == expected_price:
            qty += _sget(li, "quantity", 0) or 0
    return CREDITS_PER_PACK * qty


_PAID_STATUSES = {"paid", "no_payment_required"}  # the latter: 100% promo codes


@app.post("/api/webhook")
async def stripe_webhook(request: Request):
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not endpoint_secret:
        raise HTTPException(status_code=500, detail="Stripe webhook secret is not configured.")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)  # verifies the signature
        # Work on plain dicts: StripeObject's dict API differs across stripe-python versions.
        event = json.loads(payload)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Blocking Stripe/DB work runs off the event loop.
    return await run_in_threadpool(_handle_stripe_event, event)


def _handle_stripe_event(event) -> dict:
    if event["type"] not in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        return {"status": "ignored"}
    session = event["data"]["object"]
    user_id = session.get("client_reference_id")
    if not user_id:
        logger.warning("Stripe event %s has no client_reference_id", event["id"])
        return {"status": "ignored"}
    if session.get("payment_status") not in _PAID_STATUSES:
        # Delayed payment methods: credits are granted on async_payment_succeeded.
        return {"status": "pending"}

    amount = _credits_for_session(session)
    if amount <= 0:
        logger.warning("Stripe event %s: session %s is not a Cursiva credit pack", event["id"], session.get("id"))
        return {"status": "ignored"}

    with SessionLocal() as db:
        try:
            # The event row and the credit grant commit together. Both columns
            # are unique, so a redelivered event, a concurrent delivery, or a
            # second event for the same checkout session (completed +
            # async_payment_succeeded) can't grant twice.
            db.add(StripeEvent(event_id=event["id"], checkout_session_id=session.get("id")))
            db.flush()
            res = db.execute(text("UPDATE user_profiles SET credits = credits + :n WHERE clerk_id = :uid"),
                             {"n": amount, "uid": user_id})
            if res.rowcount == 0:
                db.add(UserProfile(clerk_id=user_id, credits=amount))
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"status": "duplicate"}
    logger.info("Granted %s credits to %s for %s", amount, user_id, event["id"])
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
