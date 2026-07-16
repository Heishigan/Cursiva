from typing import TypedDict, List, Optional
from pydantic import BaseModel, Field

# --- PYDANTIC MODELS ---
class PersonalInfo(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""

class JobMetadata(BaseModel):
    company_name: str = Field(description="Name of the company hiring")
    role_name: str = Field(description="Title of the role")
    job_summary: str = Field(description="A concise 2-3 sentence summary of the job description.")
    key_requirements: List[str] = Field(description="A bulleted list of 3-5 key technical and soft requirements for the role.")
    eligibility_passed: bool = Field(description="True if the candidate meets absolute hard requirements (visa/location/language). False if there's a hard mismatch.")
    eligibility_reason: str = Field(description="If eligibility_passed is False, explain the exact hard requirement mismatch. If True, leave empty.")

class StrategyResult(BaseModel):
    fit_assessment: str = Field(description="A clear assessment of how well the candidate fits the role (e.g., 'Strong Fit', 'Moderate Fit', 'Low Fit'), including a brief explanation so the candidate can save time if it's a massive stretch.")
    strategy_plan: str = Field(description="High-level plan mapping the candidate's experience to the role.")
    role_philosophy: str = Field(description="One sentence capturing the underlying tension or value the JD implies based on 'Who you are' (e.g. 'this role values a validated no over a shipped yes').")
    sharpest_project_insight: str = Field(description="The most honest or surprising finding from the top-matched project, not its headline metric.")
    strategic_options: List[str] = Field(description="2-3 high-level strategic approaches the candidate can choose to emphasize (e.g., 'Emphasize your background in production-ready ML engineering over research', 'Focus heavily on your leadership and multi-agent system architecture').")

class LessonResult(BaseModel):
    lesson: str = Field(description="A clear, generalized rule extracted from the feedback to apply to all future applications.")
    scope: List[str] = Field(description="Which document this rule applies to. Options: 'CV', 'Cover_Letter', 'General'.")

class SectionItem(BaseModel):
    title: str
    subtitle: str
    date: str
    url: str
    context: str
    bullets: List[str]

class Section(BaseModel):
    title: str
    type: str = Field(description="Must be 'skills', 'education', 'projects', 'work_experience', or 'custom'")
    items: List[SectionItem]

class FullCVData(BaseModel):
    personal_info: PersonalInfo
    professional_summary: str
    sections: List[Section]

class CVData(BaseModel):
    reasoning: str = Field(description="Explain your logic for selecting and tailoring items across all sections, and how you injected ATS keywords naturally.")
    professional_summary: str = Field(description="The tailored professional summary paragraph.")
    sections: List[Section] = Field(description="List of ALL tailored sections. Must include every section from the baseline CV.")

class ReviewResult(BaseModel):
    passed: bool = Field(description="True if the draft passes all rules, False otherwise.")
    feedback: str = Field(description="Feedback on what needs to be fixed if passed is False. Empty if passed is True.")

class CoverLetterOutput(BaseModel):
    salutation: str = Field(description="The greeting (e.g. 'Dear Hiring Manager,')")
    hook: str = Field(description="The opening paragraph that grabs attention.")
    match: str = Field(description="Paragraph mapping candidate experience to the role's needs.")
    curiosity: str = Field(description="Paragraph showing genuine interest in the company's work.")
    fit: str = Field(description="Paragraph showing cultural or strategic alignment.")
    sign_off: str = Field(description="The sign-off and name.")

# --- STATE DEFINITION ---
class AgentState(TypedDict):
    api_key: str
    user_id: str
    job_description: str
    generic_cv_raw: str
    company_name: str
    role_name: str
    job_summary: str
    key_requirements: list
    eligibility_passed: bool
    eligibility_reason: str
    strategy_plan: str
    role_philosophy: str
    sharpest_project_insight: str
    strategic_options: list
    user_strategy_answers: str
    tailored_cv: dict
    cover_letter_parts: dict
    review_feedback: str
    revision_count: int
    user_feedback: str
    custom_instructions: str
    generate_cover_letter: bool
