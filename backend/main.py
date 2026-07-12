from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn
import uuid

from core.agent import setup_node, strategist_node, tailor_app

app = FastAPI(title="Cursiva API", description="Backend engine for the Cursiva Agentic Job Hunter")

class IntakeRequest(BaseModel):
    job_description: str
    generic_cv_raw: str

class TailorRequest(BaseModel):
    job_description: str
    generic_cv_raw: str
    company_name: str
    role_name: str
    strategy_plan: str
    user_strategy_answers: Optional[str] = ""
    thread_id: str

@app.post("/api/intake")
def run_intake(req: IntakeRequest):
    # 1. Run Setup Node
    setup_result = setup_node({"job_description": req.job_description, "generic_cv_raw": req.generic_cv_raw})
    
    if not setup_result.get("eligibility_passed", True):
        return {"status": "ineligible", "reason": setup_result.get("eligibility_reason")}
        
    # 2. Run Strategist Node
    strategy_result = strategist_node({"job_description": req.job_description, "generic_cv_raw": req.generic_cv_raw})
    
    return {
        "status": "success",
        "metadata": setup_result,
        "strategy": strategy_result
    }

@app.post("/api/tailor")
def run_tailor(req: TailorRequest):
    initial_state = {
        "job_description": req.job_description,
        "generic_cv_raw": req.generic_cv_raw,
        "company_name": req.company_name,
        "role_name": req.role_name,
        "strategy_plan": req.strategy_plan,
        "user_strategy_answers": req.user_strategy_answers,
        "revision_count": 0
    }
    
    config = {"configurable": {"thread_id": req.thread_id}}
    
    # Run the tailor -> reviewer loop
    final_state = tailor_app.invoke(initial_state, config=config)
    
    return {
        "status": "success",
        "tailored_cv": final_state.get("tailored_cv"),
        "revision_count": final_state.get("revision_count"),
        "review_feedback": final_state.get("review_feedback")
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to the Cursiva API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
