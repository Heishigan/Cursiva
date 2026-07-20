from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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
from core.agent import setup_node, strategist_node, tailor_app

from database import engine, get_db
from models import Base, UserProfile, JobApplication, UserLesson
from security import encrypt_key, decrypt_key
from auth import get_current_user_id

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cursiva API", description="Backend engine for the Cursiva Agentic Job Hunter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# BYOK has been removed

class IntakeRequest(BaseModel):
    job_description: str
    generic_cv_raw: str
    override_eligibility: bool = False

class TailorRequest(BaseModel):
    job_description: str
    generic_cv_raw: str
    company_name: str
    role_name: str
    strategy_plan: str
    user_strategy_answers: Optional[str] = ""
    user_feedback: Optional[str] = ""
    thread_id: str

from fastapi.responses import StreamingResponse

@app.post("/api/intake")
def run_intake(req: IntakeRequest, user_id: str = Depends(get_current_user_id)):
    async def event_generator():
        yield f"data: {json.dumps({'type': 'status', 'message': 'Setting up and extracting requirements...'})}\n\n"
        setup_result = setup_node({"job_description": req.job_description, "generic_cv_raw": req.generic_cv_raw, "api_key": os.environ.get("OPENAI_API_KEY"), "user_id": user_id})
        
        if not setup_result.get("eligibility_passed", True) and not req.override_eligibility:
            yield f"data: {json.dumps({'type': 'result', 'status': 'ineligible', 'reason': setup_result.get('eligibility_reason')})}\n\n"
            return
            
        yield f"data: {json.dumps({'type': 'status', 'message': 'Strategist analyzing fit and formulating plan...'})}\n\n"
        strategy_result = strategist_node({"job_description": req.job_description, "generic_cv_raw": req.generic_cv_raw, "api_key": os.environ.get("OPENAI_API_KEY"), "user_id": user_id})
        
        yield f"data: {json.dumps({'type': 'result', 'status': 'success', 'metadata': setup_result, 'strategy': strategy_result})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/tailor")
def run_tailor(req: TailorRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
    if not profile or profile.credits < 1:
        raise HTTPException(status_code=402, detail="Insufficient credits. Please top up your account.")
        
    # Deduct credit immediately upon pipeline start
    profile.credits -= 1
    db.commit()
        
    async def event_generator():
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
            "generate_cover_letter": True
        }
        
        config = {"configurable": {"thread_id": req.thread_id}}
        
        final_state = {}
        for event in tailor_app.stream(initial_state, config=config):
            for node_name, node_state in event.items():
                final_state.update(node_state)
                if node_name == "tailor":
                    rev_count = node_state.get("revision_count", 0)
                    tailored_cv = node_state.get("tailored_cv", {})
                    reasoning = tailored_cv.get("reasoning", "Modifying content to match the provided strategy...") if isinstance(tailored_cv, dict) else "Modifying content..."
                    yield f"data: {json.dumps({'type': 'status', 'message': f'Tailoring CV (Revision {rev_count}): {reasoning}'})}\n\n"
                elif node_name == "reviewer":
                    feedback = node_state.get("review_feedback", "")
                    if feedback and feedback != "PASS":
                        # Extract the first sentence or so of the feedback
                        short_feedback = feedback.split('.')[0] if '.' in feedback else feedback
                        yield f"data: {json.dumps({'type': 'status', 'message': f'Reviewer found issues: {short_feedback}'})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'status', 'message': 'Reviewer checked constraints: Passed!'})}\n\n"
                elif node_name == "cover_letter":
                    yield f"data: {json.dumps({'type': 'status', 'message': 'Generating Cover Letter based on the tailored CV and company context...'})}\n\n"
        
        yield f"data: {json.dumps({'type': 'result', 'status': 'success', 'tailored_cv': final_state.get('tailored_cv'), 'cover_letter_parts': final_state.get('cover_letter_parts', {}), 'revision_count': final_state.get('revision_count'), 'review_feedback': final_state.get('review_feedback')})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/parse_pdf")
async def parse_pdf(
    file: UploadFile = File(...), 
    user_id: str = Depends(get_current_user_id), 
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Must be a PDF file")
    
    content = await file.read()
    try:
        doc = fitz.open(stream=content, filetype="pdf")
        text = "".join(page.get_text() for page in doc)
        
        setup_llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=os.environ.get("OPENAI_API_KEY"))
        structured_llm = setup_llm.with_structured_output(FullCVData)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Extract the candidate's information from the unstructured text and map it precisely to the provided schema. For the 'type' field in sections, map them correctly to 'skills', 'education', 'projects', 'work_experience' or 'custom' depending on content. Do not hallucinate. Leave fields empty if not present in the text."),
            ("user",   "CV Text:\n{text}")
        ])
        
        res = (prompt | structured_llm).invoke({"text": text})
        parsed_data = res.model_dump()
        
        profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
        if not profile:
            profile = UserProfile(clerk_id=user_id)
            db.add(profile)
        profile.cv_data_json = json.dumps(parsed_data)
        db.commit()
        
        return {"status": "success", "parsed_data": parsed_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/api/compile_cv")
def compile_cv(req: FullCVData, user_id: str = Depends(get_current_user_id)):
    data = req.model_dump()
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
            subprocess.run(['pdflatex', '-interaction=nonstopmode', 'cv.tex'], cwd=temp_dir, check=True, capture_output=True)
            subprocess.run(['pdflatex', '-interaction=nonstopmode', 'cv.tex'], cwd=temp_dir, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            # Fallback to returning the error
            raise HTTPException(status_code=500, detail=f"LaTeX compilation failed: {e.stdout.decode('utf-8', errors='ignore')}")
            
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
    user_feedback: str

@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest, user_id: str = Depends(get_current_user_id)):
    extract_lesson(os.environ.get("OPENAI_API_KEY"), user_id, req.user_feedback)
    return {"status": "success"}

class CompileCLRequest(BaseModel):
    personal_info: dict
    company_name: str
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
            subprocess.run(['xelatex', '-interaction=nonstopmode', 'cl.tex'], cwd=temp_dir, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"LaTeX compilation failed: {e.stdout.decode('utf-8', errors='ignore')}")
            
        pdf_path = os.path.join(temp_dir, 'cl.pdf')
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=500, detail="PDF was not generated.")
            
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()

    import base64
    b64_pdf = base64.b64encode(pdf_bytes).decode('utf-8')
    return JSONResponse(content={"status": "success", "pdf_base64": b64_pdf})

@app.get("/api/status")
def check_status(x_api_key: Optional[str] = Header(None)):
    api_key = x_api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"openai_status": "disconnected"}
        
    try:
        # Just check if we can list models to verify the key
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        client.models.list()
        return {"openai_status": "connected"}
    except Exception:
        return {"openai_status": "invalid"}

@app.get("/")
def read_root():
    return {"message": "Welcome to the Cursiva API"}

class ProfileUpdate(BaseModel):
    cv_data_json: Optional[str] = None
    openai_api_key: Optional[str] = None

@app.get("/api/user/profile")
def get_user_profile(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
    if not profile:
        return {"status": "success", "data": {"has_baseline": False, "has_api_key": False, "cv_data": None}}
    
    cv_data = json.loads(profile.cv_data_json) if profile.cv_data_json else None
    has_api_key = bool(profile.encrypted_api_key)
    return {"status": "success", "data": {"has_baseline": bool(cv_data), "has_api_key": has_api_key, "cv_data": cv_data, "credits": profile.credits}}



@app.post("/api/user/profile")
def update_user_profile(req: ProfileUpdate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
    if not profile:
        profile = UserProfile(clerk_id=user_id)
        db.add(profile)
    
    if req.cv_data_json is not None:
        if req.cv_data_json.strip() == "":
             profile.cv_data_json = None
        else:
             profile.cv_data_json = req.cv_data_json
             
    if req.openai_api_key is not None:
        if req.openai_api_key.strip() == "":
            profile.encrypted_api_key = None
        else:
            profile.encrypted_api_key = encrypt_key(req.openai_api_key)
            
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
    app = db.query(JobApplication).filter(JobApplication.id == app_id, JobApplication.clerk_id == user_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    db.delete(app)
    db.commit()
    return {"status": "success"}

# --- STRIPE INTEGRATION ---

@app.post("/api/create-checkout-session")
async def create_checkout_session(user_id: str = Depends(get_current_user_id)):
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    stripe_price_id = os.environ.get("STRIPE_PRICE_ID")
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': stripe_price_id,
                'quantity': 1,
            }],
            mode='payment',
            success_url=os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000") + '/dashboard/settings?success=true',
            cancel_url=os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000") + '/dashboard/settings?canceled=true',
            client_reference_id=user_id,
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/api/webhook")
async def stripe_webhook(request: Request):
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        if endpoint_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        else:
            # Fallback for local testing without webhook secret
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = getattr(session, 'client_reference_id', None)
        if user_id:
            # We need a new db session here since it's a webhook
            db = next(get_db())
            try:
                profile = db.query(UserProfile).filter(UserProfile.clerk_id == user_id).first()
                if profile:
                    profile.credits += 15
                else:
                    profile = UserProfile(clerk_id=user_id, credits=16)
                    db.add(profile)
                db.commit()
            finally:
                db.close()

    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
