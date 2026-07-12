import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .models import (
    AgentState, JobMetadata, StrategyResult, 
    CVData, ReviewResult, CoverLetterOutput
)

# --- LLM INITIALIZATION ---
def get_llm(): 
    return ChatOpenAI(model="gpt-4o", temperature=0.2)

def get_llm_cl(): 
    return ChatOpenAI(model="gpt-4o", temperature=0.5)

def get_llm_json(): return get_llm().with_structured_output(CVData)
def get_llm_review(): return get_llm().with_structured_output(ReviewResult)
def get_llm_setup(): return get_llm().with_structured_output(JobMetadata)
def get_llm_cl_out(): return get_llm_cl().with_structured_output(CoverLetterOutput)

# --- NODES ---

def setup_node(state: AgentState):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Read the Job Description and the Generic CV provided below. Extract the company name, role name, job summary, and key requirements. Finally, evaluate the candidate's Eligibility (checking for hard mismatches in visa/location/languages). Output strictly the requested JSON."),
        ("user", "Job Description:\n{job_description}\n\nGeneric CV:\n{generic_cv}")
    ])
    chain = prompt | get_llm_setup()
    res = chain.invoke({"job_description": state["job_description"], "generic_cv": state["generic_cv_raw"]})
    
    company = "Unknown_Company"
    role = "Unknown_Role"
    if res:
        company = res.company_name.strip() if res.company_name and res.company_name.strip() else "Unknown_Company"
        role = res.role_name.strip() if res.role_name and res.role_name.strip() else "Unknown_Role"
    
    return {
        "company_name": company, 
        "role_name": role,
        "job_summary": res.job_summary if res else "",
        "key_requirements": res.key_requirements if res else [],
        "eligibility_passed": res.eligibility_passed if res else True,
        "eligibility_reason": res.eligibility_reason if res else ""
    }

def strategist_node(state: AgentState):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert tech recruiter. Read the Job Description and the Generic CV. First, assess the candidate's 'fit' for the role to save them time if it's a stretch. Then formulate a strategy mapping their experience to the role. Identify exact mandatory ATS keywords. Highlight the top projects to include.\n\nPay extremely close attention to the 'Who you are' or 'About you' sections of the Job Description. Finally, generate 1-2 targeted questions with multiple-choice options to ask the candidate to confirm preferences before drafting.\n\nCRITICAL RULE: Do NOT use markdown asterisks (**) for bolding text anywhere in your output. Use plain text only."),
        ("user", "Job Description:\n{job_description}\n\nGeneric CV:\n{generic_cv}")
    ])
    chain = prompt | get_llm().with_structured_output(StrategyResult)
    res = chain.invoke({"job_description": state["job_description"], "generic_cv": state["generic_cv_raw"]})
    
    questions_dicts = [q.model_dump() for q in res.targeted_questions]
    return {
        "strategy_plan": f"**Fit Assessment:**\n{res.fit_assessment}\n\n**Strategy Plan:**\n{res.strategy_plan}", 
        "role_philosophy": res.role_philosophy,
        "sharpest_project_insight": res.sharpest_project_insight,
        "strategy_questions": questions_dicts, 
        "revision_count": state.get("revision_count", 0)
    }

def tailor_node(state: AgentState):
    rules = """
    STRICT RULES:
    1. DO NOT invent or hallucinate any skills, metrics, or technologies not present in the generic CV. This STRICTLY APPLIES to the Professional Summary as well.
    2. NEVER use em dashes (---) in paragraph text.
    3. For the 'projects' section ONLY: You MUST select exactly 5 projects. You MUST reorder the 5 selected projects so that the most relevant projects for this specific role appear at the top.
    4. For ALL OTHER sections: You MUST include every single item from the generic CV exactly as they appear (do not delete or add items). Only rewrite their bullet points to inject ATS keywords if naturally possible.
    5. ATS KEYWORD STRATEGY: You may only inject ATS keywords if they logically fit into the existing narrative of the item. Do NOT fundamentally change the story.
    6. NEVER change the 'Tools Used' or similar context line.
    7. NO MARKDOWN FORMATTING: Do NOT use markdown bolding (e.g. **keyword**) or italics anywhere in your output.
    
    BULLET VOICE (applies to bullets only, not Professional Summary):
    8. BAN empty intensifiers: "successfully," "effectively," "expertly," "robust," "seamlessly," "cutting-edge," "leveraged".
    9. VARY the opening verb across the bullets. Do not let three bullets in a row open with "Built" or "Developed."
    10. Metrics stay embedded in the sentence that earns them, never appended as a dangling clause.
    """
    
    user_strategy = state.get('user_strategy_answers', '')
    user_feedback = state.get('user_feedback', '')
    
    cv_context = state.get("generic_cv_raw", "")
    if user_strategy or user_feedback:
        cv_context += "\n\n--- SUPPLEMENTAL CANDIDATE CONTEXT ---\n"
        if user_strategy:
            cv_context += f"\nUser Strategy Answers:\n{user_strategy}\n"
        if user_feedback:
            cv_context += f"\nUser Feedback on Previous Draft:\n{user_feedback}\n"
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", f"You are an expert CV writer. Your ONLY task is to rewrite the CV JSON to best match this role. Do NOT write any cover letter content. \n\n{rules}"),
        ("user", "Job Description:\n{job_description}\n\nStrategist's Plan:\n{strategy_plan}\n\nGeneric CV JSON (Including Supplemental Data):\n{generic_cv}")
    ])
    
    chain = prompt | get_llm_json()
    res = chain.invoke({
        "job_description": state.get("job_description", ""),
        "strategy_plan": state.get("strategy_plan", ""),
        "generic_cv": cv_context
    })
    
    return {"tailored_cv": res.model_dump(), "revision_count": state.get("revision_count", 0) + 1}

def reviewer_node(state: AgentState):
    rules = """
    You are a strict QA Reviewer. Check the newly tailored CV against the generic CV.
    Check for:
    1. Hallucinations: Did the tailor invent any technologies or metrics not in the generic CV?
    2. Em-dashes: Are there any em-dashes (---) in the text?
    3. Markdown: Are there any markdown asterisks (**) used for bolding? If so, FAIL.
    
    If it fails ANY of these, return passed=False and explain exactly what to fix. If it passes, return passed=True.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", rules),
        ("user", "Generic CV:\n{generic_cv}\n\nTailored CV:\n{tailored_cv}")
    ])
    chain = prompt | get_llm_review()
    res = chain.invoke({
        "generic_cv": state["generic_cv_raw"],
        "tailored_cv": json.dumps(state["tailored_cv"])
    })
    return {"review_feedback": res.feedback if not res.passed else "PASS"}

def review_conditional(state: AgentState):
    if state["review_feedback"] == "PASS" or state["revision_count"] >= 3:
        return "pass"
    return "fail"

# --- BUILD GRAPH ---
memory = MemorySaver()
builder = StateGraph(AgentState)

builder.add_node("tailor", tailor_node)
builder.add_node("reviewer", reviewer_node)

builder.set_entry_point("tailor")
builder.add_edge("tailor", "reviewer")
builder.add_conditional_edges("reviewer", review_conditional, {
    "pass": END,
    "fail": "tailor"
})

# Compile the tailor/review loop. Intake/Strategy and CoverLetter are decoupled in the API routes.
tailor_app = builder.compile(checkpointer=memory)
