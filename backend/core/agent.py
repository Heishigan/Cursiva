import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END

from .models import (
    AgentState, JobMetadata, StrategyResult, 
    CVData, ReviewResult, CoverLetterOutput, LessonResult
)
from database import SessionLocal
import models as db_models

# --- LLM INITIALIZATION ---
def get_llm(api_key: str): return ChatOpenAI(model="gpt-4o", temperature=0.2, api_key=api_key)
def get_llm_cl(api_key: str): return ChatOpenAI(model="gpt-4o", temperature=0.5, api_key=api_key)

def get_llm_json(api_key: str): return get_llm(api_key).with_structured_output(CVData)
def get_llm_review(api_key: str): return get_llm(api_key).with_structured_output(ReviewResult)
def get_llm_setup(api_key: str): return get_llm(api_key).with_structured_output(JobMetadata)
def get_llm_cl_out(api_key: str): return get_llm_cl(api_key).with_structured_output(CoverLetterOutput)

# --- LESSONS MECHANIC ---
def get_lessons(user_id: str, scope_filter=None):
    if not user_id: return []
    db = SessionLocal()
    try:
        query = db.query(db_models.UserLesson).filter(db_models.UserLesson.clerk_id == user_id)
        all_lessons = query.all()
        if not scope_filter:
            return [l.lesson for l in all_lessons]
        
        filtered = []
        for l in all_lessons:
            if any(s in l.scope for s in scope_filter):
                filtered.append(l.lesson)
        return filtered
    except Exception:
        return []
    finally:
        db.close()

def extract_lesson(api_key: str, user_id: str, user_feedback: str):
    if not user_id or not user_feedback: return
    existing_lessons = get_lessons(user_id)
    existing_text = "\n".join(existing_lessons) if existing_lessons else "None"
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", f"Extract a clear, concise rule for future CV/Cover Letter generation based on this user feedback. E.g. 'Never use em-dashes', 'Always highlight ComfyUI'.\n\nCRITICAL: Do NOT extract a rule if it is already covered by the EXISTING RULES below. If it is redundant, return an empty string for the lesson.\n\nEXISTING RULES:\n{{existing_text}}"),
        ("user", "{feedback}")
    ])
    chain = prompt | get_llm(api_key).with_structured_output(LessonResult)
    res = chain.invoke({"feedback": user_feedback, "existing_text": existing_text})
    
    if not res.lesson or not res.lesson.strip():
        return
        
    valid_scopes = [s for s in res.scope if s in ["CV", "Cover_Letter", "General"]]
    if not valid_scopes: valid_scopes = ["General"]
    
    db = SessionLocal()
    try:
        new_lesson = db_models.UserLesson(clerk_id=user_id, lesson=res.lesson, scope=valid_scopes)
        db.add(new_lesson)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

# --- NODES ---

def setup_node(state: AgentState):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Read the Job Description and the Generic CV provided below. Extract the company name, role name, job summary, and key requirements. Finally, evaluate the candidate's Eligibility (checking for hard mismatches in visa/location/languages). Output strictly the requested JSON. IMPORTANT: If you cannot determine the company name or role name with confidence from the text, return an empty string for that field — do NOT use placeholder values like 'Company' or 'Unknown'."),
        ("user", "Job Description:\n{job_description}\n\nGeneric CV:\n{generic_cv}")
    ])
    chain = prompt | get_llm_setup(state["api_key"])
    res = chain.invoke({"job_description": state["job_description"], "generic_cv": state["generic_cv_raw"]})
    
    company = ""
    role = ""
    if res:
        company = res.company_name.strip() if res.company_name and res.company_name.strip() else ""
        role = res.role_name.strip() if res.role_name and res.role_name.strip() else ""
    
    return {
        "company_name": company, 
        "role_name": role,
        "job_summary": res.job_summary if res else "",
        "key_requirements": res.key_requirements if res else [],
        "eligibility_passed": res.eligibility_passed if res else True,
        "eligibility_reason": res.eligibility_reason if res else ""
    }

def strategist_node(state: AgentState):
    user_id = state.get("user_id", "")
    lessons = get_lessons(user_id, ["General"])
    lessons_prompt = f"\n\nPAST LESSONS (MUST OBEY):\n{json.dumps(lessons, indent=2)}" if lessons else ""
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", f"You are an expert tech recruiter. Read the Job Description and the Generic CV. First, assess the candidate's 'fit' for the role to save them time if it's a stretch. Then formulate a strategy mapping their experience to the role. Identify exact mandatory ATS keywords. Highlight the top projects to include.\n\nPay extremely close attention to the 'Who you are' or 'About you' sections of the Job Description. Do not just pattern-match on technical keywords; deeply analyze the specific type of problem solver they are looking for (e.g. benchmarking, assessing feasibility, autonomous work). Finally, generate 2-3 high-level strategic options (Agent Proposals) the candidate can choose to emphasize in their application to strongly position themselves for this specific role.\n\nCRITICAL RULE: Do NOT use markdown asterisks (**) for bolding text anywhere in your output. Use plain text only.{{lessons_prompt}}"),
        ("user", "Job Description:\n{job_description}\n\nGeneric CV:\n{generic_cv}")
    ])
    chain = prompt | get_llm(state["api_key"]).with_structured_output(StrategyResult)
    res = chain.invoke({"job_description": state["job_description"], "generic_cv": state["generic_cv_raw"], "lessons_prompt": lessons_prompt})
    
    return {
        "strategy_plan": f"**Fit Assessment:**\n{res.fit_assessment}\n\n**Strategy Plan:**\n{res.strategy_plan}", 
        "role_philosophy": res.role_philosophy,
        "sharpest_project_insight": res.sharpest_project_insight,
        "strategic_options": res.strategic_options, 
        "revision_count": state.get("revision_count", 0)
    }

def tailor_node(state: AgentState):
    rules = """
    STRICT RULES:
    1. DO NOT invent or hallucinate any skills, metrics, or technologies not present in the generic CV OR the Supplemental Candidate Context. You MUST incorporate any facts, projects, or tools explicitly mentioned in the Supplemental Context.
    2. NEVER use em dashes (---) in paragraph text.
    3. CV ORDERING: The final `sections` array MUST be strictly ordered as follows: "Work Experience", then "Education", then "Projects", then "Skills". Do NOT deviate from this order.
    4. For the 'projects' section ONLY: You MUST select exactly 5 projects (always including the Master's Thesis and BSc Final-Year Project). You MUST reorder the 5 selected projects so that the most relevant projects for this specific role appear at the top.
    5. For ALL OTHER sections: You MUST include every single item from the generic CV exactly as they appear (do not delete or add items). Only rewrite their bullet points to inject ATS keywords if naturally possible.
    6. ATS KEYWORD STRATEGY: You may only inject ATS keywords if they logically fit into the existing narrative of the item. Do NOT fundamentally change the story, scope, or technical achievements of any item. 
    7. The original item's authenticity must never be compromised. 
    8. NEVER change the 'Tools Used' or similar context line (e.g., "ReactJS, Firebase, Agile, Git" MUST remain identical). Only weave keywords into the bullet points.
    9. NO MARKDOWN FORMATTING: Do NOT use markdown bolding (e.g. **keyword**) or italics anywhere in your output. Output raw, plain text only.
    10. IGNORING COVER LETTER FEEDBACK: If the user's feedback specifically mentions the Cover Letter and does NOT mention the CV, ignore the feedback and keep the CV changes minimal or identical to previous iterations.

    BULLET VOICE (applies to bullets only, not Professional Summary):
    10. BAN empty intensifiers: "successfully," "effectively," "expertly," "robust," "seamlessly," "cutting-edge," "leveraged" (use "used" or "built with" instead), "various," "comprehensive." If a bullet works without the adjective, the adjective goes.
    11. VARY the opening verb across the bullets. Do not let three bullets in a row open with "Built" or "Developed." Rotate: Built, Designed, Reduced, Ran, Architected, Deployed, Automated, Shipped, Coordinated, Led, etc., chosen for what's actually true of that bullet, not at random.
    12. Metrics stay embedded in the sentence that earns them, never appended as a dangling clause. Not "Built a classifier, achieving 94% accuracy" as a generic tail; only keep the metric tail if the sentence has nowhere more natural to put it. Prefer working it into the clause: "Fine-tuned BERT for binary classification, achieving 94% accuracy" only if that's the most natural phrasing already in the generic CV; otherwise restructure minimally.
    13. No paragraph-style summarizing inside a bullet. Each bullet is one concrete action plus its concrete result. Cut any bullet that ends in a vague capstone clause like "...improving overall system performance" or "...enhancing the user experience" unless that exact outcome is named with specifics from the generic CV.

    PROFESSIONAL SUMMARY VOICE:
    14. Open with role/credential plus one concrete specialization, not a values statement. Avoid "passionate about," "dedicated to," "proven track record."
    15. Keep sentences short. 3-4 sentences total, no sentence over ~30 words.
    16. EVENT EXAGGERATION: NEVER pluralize single events or projects into "roles" or "experiences" (e.g., do not say "client-facing roles" if the generic CV only shows a single event). Stick exactly to the scale of the experience described.
    """
    
    user_strategy = state.get('user_strategy_answers', '')
    user_feedback = state.get('user_feedback', '')
    
    cv_context = state.get("generic_cv_raw", "")
    
    supplemental_prompt = ""
    if user_strategy or user_feedback:
        supplemental_prompt = "\n\n--- SUPPLEMENTAL CANDIDATE CONTEXT (From User's Custom Instructions & Feedback) ---\n"
        supplemental_prompt += "The following information is strictly factual candidate data provided by the user and MUST be treated as if it were part of the Generic CV. This is your highest priority.\n"
        supplemental_prompt += "CRITICAL INSTRUCTION: You MUST explicitly integrate the facts from this Supplemental Context directly into the CV content (e.g., within the Professional Summary, Project Context, or Bullets). Do NOT ignore this data.\n"
        if user_strategy:
            supplemental_prompt += f"\nUser Strategy Answers (MUST INTEGRATE):\n{user_strategy}\n"
        if user_feedback:
            supplemental_prompt += f"\nUser Feedback on Previous Draft (CRITICAL TO APPLY):\n{user_feedback}\n"
    
    user_id = state.get("user_id", "")
    lessons = get_lessons(user_id, ["CV", "General"])
    lessons_prompt = f"\n\nPAST LESSONS (MUST OBEY):\n{json.dumps(lessons, indent=2)}" if lessons else ""
    
    previous_cv = state.get("tailored_cv", {})
    previous_cv_prompt = f"\n\nPrevious Tailored CV (Apply feedback to THIS version):\n{json.dumps(previous_cv, indent=2)}" if previous_cv and user_feedback else ""
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", f"You are an expert CV writer. Your ONLY task is to rewrite the CV JSON (professional summary and all sections) to best match this role. Do NOT write any cover letter content. \n\n{{rules}}{{supplemental_prompt}}{{lessons_prompt}}"),
        ("user", "Job Description:\n{job_description}\n\nStrategist's Plan:\n{strategy_plan}\n\nGeneric CV JSON:\n{generic_cv}{previous_cv_prompt}")
    ])
    
    chain = prompt | get_llm_json(state["api_key"])
    res = chain.invoke({
        "job_description": state.get("job_description", ""),
        "strategy_plan": state.get("strategy_plan", ""),
        "generic_cv": cv_context,
        "previous_cv_prompt": previous_cv_prompt,
        "rules": rules,
        "supplemental_prompt": supplemental_prompt,
        "lessons_prompt": lessons_prompt
    })
    
    return {"tailored_cv": res.model_dump(), "revision_count": state.get("revision_count", 0) + 1}

def reviewer_node(state: AgentState):
    rules = """
    You are a strict QA Reviewer. Check the newly tailored CV against the generic CV.
    Check for:
    1. Hallucinations: Did the tailor invent any technologies or metrics not in the generic CV?
    2. Em-dashes: Are there any em-dashes (---) in the text?
    3. Markdown: Are there any markdown asterisks (**) used for bolding? If so, FAIL.
    4. Banned Phrases (Rule 14): Check the Professional Summary. If it contains "passionate about", "dedicated to", or "proven track record", FAIL.
    5. Event Exaggeration: Did the tailor pluralize a single event into "roles" or "experiences" (e.g. claiming "client-facing roles" when the CV only shows a single pitch)? If so, FAIL.
    
    If it fails ANY of these, return passed=False and explain exactly what to fix. If it passes, return passed=True.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", rules),
        ("user", "Generic CV:\n{generic_cv}\n\nTailored CV:\n{tailored_cv}")
    ])
    chain = prompt | get_llm_review(state["api_key"])
    res = chain.invoke({
        "generic_cv": state["generic_cv_raw"],
        "tailored_cv": json.dumps(state["tailored_cv"])
    })
    return {"review_feedback": res.feedback if not res.passed else "PASS"}

def cover_letter_node(state: AgentState):
    if not state.get("generate_cover_letter"):
        return {"cover_letter_parts": {}}

    tailored = state.get("tailored_cv", {})
    cv_context = json.dumps(tailored, indent=2)
    professional_summary = tailored.get("professional_summary", "")

    user_id = state.get("user_id", "")
    lessons = get_lessons(user_id, ["Cover_Letter", "General"])
    lessons_text = "\n".join(f"- {l}" for l in lessons) if lessons else ""
    lessons_prompt = f"\n\nPAST LESSONS (MUST OBEY):\n{lessons_text}" if lessons_text else ""
    
    candidate_name = "[Candidate Name]"
    try:
        generic_raw = state.get("generic_cv_raw", "")
        if generic_raw:
            baseline_data = json.loads(generic_raw)
            candidate_name = baseline_data.get("personal_info", {}).get("name", "[Candidate Name]")
    except Exception:
        pass

    user_strategy = state.get("user_strategy_answers", "")
    strategy_prompt = ""
    if user_strategy:
        strategy_prompt = "\n\n--- SUPPLEMENTAL CANDIDATE CONTEXT (From User's Custom Instructions) ---\n"
        strategy_prompt += "The following information is strictly factual candidate data provided by the user and MUST be treated as if it were part of the Candidate's CV. This is your highest priority.\n"
        strategy_prompt += "CRITICAL INSTRUCTION: You MUST explicitly integrate the facts from this Supplemental Context into your letter. Do NOT invent a limitation or gap that contradicts these facts!\n"
        strategy_prompt += f"User Strategy Answers:\n{user_strategy}\n"
    
    user_feedback = state.get("user_feedback", "")
    feedback_prompt = f"\n\nUSER FEEDBACK FROM PREVIOUS DRAFT (CRITICAL: You MUST explicitly address and apply EVERY SINGLE point mentioned in the user feedback below. Do not ignore any part of the request.):\n{user_feedback}\n(If this feedback applies only to the CV, ignore it and write a standard cover letter.)" if user_feedback else ""

    role_philosophy = state.get("role_philosophy", "")
    sharpest_insight = state.get("sharpest_project_insight", "")

    prompt = ChatPromptTemplate.from_messages([
        ("system", f"""You are writing a cover letter for a job application. Write exactly 6 paragraphs.

DELIVERABLE OVERRIDE: Before generating the standard framework below, scan the Job Description for any explicit structural deliverable requests (e.g., "describe your most complex project", "answer these 3 questions", "explain your philosophy on X"). If the JD requests specific answers, you MUST fulfill those requirements within the body of the cover letter. Fulfilling the JD's explicit instructions takes absolute precedence over the standard 6-paragraph framework below.

FRAMEWORK:
1. Salutation: Match the language of the Job Description. If the JD is in Swedish, use a Swedish greeting (e.g. "Hej [Company]-team,"). If the JD is in English, use an English greeting (e.g. "Dear Hiring Team,"). If the user provided custom instructions for a specific greeting, YOU MUST USE THEIR EXACT GREETING.
2. Hook: Why THIS company's specific industry and business (as described in the Job Description) is compelling.
   Read the Job Description. The Hook is about THEIR world: their sector, their mission, their problem space.
   Do NOT write about the candidate's project topics or academic domains.
3. Match: Connect the role's philosophy ({role_philosophy}) to the candidate's sharpest project insight ({sharpest_insight}) directly. The match should feel conceptual, not just technical overlap. Include concrete metrics only if they exist in the Candidate's CV. DO NOT INVENT OR ROUND METRICS. If you use a metric, COPY IT EXACTLY AS WRITTEN in the Candidate's CV. Use them only in service of the conceptual point, not as a standalone credential dump.
4. Curiosity: One specific technical challenge in this role the candidate wants to explore. Frame as genuine curiosity, not a solution pitch. The curiosity should reveal something about the candidate's own working style or instincts, not just name a topic. CRITICAL: Do NOT name specific tools, technologies, or vendor platforms from the Job Description in this paragraph unless they are also explicitly listed in the candidate's CV data. Express curiosity conceptually, about a problem or design tension, not by citing a JD tool stack the candidate hasn't worked with.
5. Fit: Short close referencing this company's actual mission and work environment. State availability. Include exactly one honest limitation or gap, framed plainly. After stating the honest limitation, immediately reframe by naming the specific underlying skill that still transfers despite the gap. End with a natural, varied transition to the sign-off. Do NOT use any phrase starting with 'Let's...' or 'I look forward to...'. Simply state your interest in their specific problem space.
6. Sign-off and Name: Match the language of the Job Description. If Swedish, use "Vänliga hälsningar,\n\n{candidate_name}". If English, use "Best regards,\n\n{candidate_name}". If the user provided custom instructions for a specific sign-off, YOU MUST USE THEIR EXACT SIGN-OFF.

VOICE AND RHYTHM (this is what makes it sound human, follow it exactly):
- Use contractions throughout: "I'm," "don't," "that's," "isn't." A cover letter with zero contractions reads as AI-generated.
- Vary sentence length hard. Follow a long sentence with a short one. A fragment is fine if it lands. E.g. "Chasing that down taught me X. That's basically the job, as far as I can tell."
- NEVER use em dashes. When you need a connecting clause, use a comma or "and" instead. E.g. not "the model failed quietly—not loudly" but "the model failed quietly, not loudly."
- AVOID triadic lists ("X, Y, and Z" or "not A, not B, but C" repeated more than once per letter). This is the single biggest AI tell. One paragraph can have rhythm-of-three at most.
- Open the Hook paragraph with a direct, concrete observation about the company's core problem space. Vary this opener organically for every letter. DO NOT reuse generic openers or boilerplate phrases across different letters.
- Do NOT use colons (:) anywhere in the letter.
- Do not summarize what you just said at the end of a paragraph. Let paragraphs end on the most specific, concrete detail, not a wrap-up sentence.

BANNED PHRASES (reject and rewrite if any appear):
- "I am excited to," "I am passionate about," "I would be thrilled," "I am thrilled"
- "in today's fast-paced/rapidly evolving," "cutting-edge," "leverage," "synergy"
- "I believe that," "I am confident that"
- Any sentence starting with "Moreover," "Furthermore," "Additionally" as a paragraph opener
- Closing with "I look forward to the opportunity to discuss" verbatim, use a more specific, direct ask instead

RULES:
- Each paragraph 40-60 words. Total 180-220 words.
- EXPLICIT GROUNDING CONSTRAINT: Every substantive claim about the company/role MUST strictly cite or paraphrase a specific line from the provided Job Description text. Do not infer company focus from title keywords alone. Do not invent details about their products. Do NOT invent or fabricate the company's beliefs, values, or philosophies. Any claim about what the company values MUST be explicitly stated in the Job Description text. Base everything exclusively on the provided Job Description.
- NO HALLUCINATIONS: You are strictly forbidden from inventing metrics, percentages, tools, frameworks, or outcomes that are not explicitly written in the candidate's provided CV. If the JD mentions a tool the candidate has not used, you must either use the candidate's actual tool or omit the reference entirely. This rule applies to ALL four paragraphs including the Curiosity paragraph. Do NOT name any tool, technology, or platform that appears only in the Job Description and not in the candidate's CV data. 
- EXCEPTION TO NO HALLUCINATIONS: You may include outside tools, languages, or facts ONLY IF the user explicitly requested them in the USER'S CUSTOM INSTRUCTIONS below. In that case, prioritize the user's instructions over the CV.
- The Hook MUST be grounded in what the company described in the Job Description actually does.{lessons_prompt}{strategy_prompt}{feedback_prompt}"""),
        ("user", "Company: {company_name}\nRole: {role_name}\n\nJob Description:\n{job_description}\n\nCandidate Professional Summary:\n{professional_summary}\n\nCandidate's Full Tailored CV JSON:\n{cv_context}")
    ])

    chain = prompt | get_llm_cl_out(state["api_key"])
    res = chain.invoke({
        "company_name": state.get("company_name", ""),
        "role_name": state.get("role_name", ""),
        "job_description": state.get("job_description", ""),
        "professional_summary": professional_summary,
        "cv_context": cv_context,
        "role_philosophy": role_philosophy,
        "sharpest_insight": sharpest_insight,
        "candidate_name": candidate_name,
        "lessons_prompt": lessons_prompt,
        "strategy_prompt": strategy_prompt,
        "feedback_prompt": feedback_prompt
    })
    return {"cover_letter_parts": res.model_dump(), "user_feedback": ""}

def review_conditional(state: AgentState):
    if state["review_feedback"] == "PASS" or state["revision_count"] >= 3:
        return "pass"
    return "fail"

# --- APP EXPORT ---
# Exported for FastApi to run independently or test via LangGraph
builder = StateGraph(AgentState)
builder.add_node("tailor", tailor_node)
builder.add_node("reviewer", reviewer_node)
builder.add_node("cover_letter", cover_letter_node)
builder.set_entry_point("tailor")
builder.add_edge("tailor", "reviewer")
builder.add_conditional_edges("reviewer", review_conditional, {
    "pass": "cover_letter",
    "fail": "tailor"
})
builder.add_edge("cover_letter", END)

tailor_app = builder.compile()
