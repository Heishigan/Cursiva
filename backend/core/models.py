from typing import TypedDict, List
from pydantic import BaseModel, Field

# --- PYDANTIC MODELS ---
class JobMetadata(BaseModel):
    company_name: str = Field(description="Name of the company hiring")
    role_name: str = Field(description="Title of the role")
    job_summary: str = Field(description="A concise 2-3 sentence summary of the job description.")
    key_requirements: List[str] = Field(description="A bulleted list of 3-5 key technical and soft requirements for the role.")
    eligibility_passed: bool = Field(description="True if the candidate meets absolute hard requirements (visa/location/language). False if there's a hard mismatch.")
    eligibility_reason: str = Field(description="If eligibility_passed is False, explain the exact hard requirement mismatch. If True, leave empty.")

class StrategyQuestion(BaseModel):
    question: str = Field(description="The question to ask the user.")
    options: List[str] = Field(description="2-4 multiple-choice options for the user.")

class StrategyResult(BaseModel):
    fit_assessment: str = Field(description="A clear assessment of how well the candidate fits the role (e.g., 'Strong Fit', 'Moderate Fit', 'Low Fit'), including a brief explanation.")
    strategy_plan: str = Field(description="High-level plan mapping the candidate's experience to the role.")
    role_philosophy: str = Field(description="One sentence capturing the underlying tension or value the JD implies based on 'Who you are'.")
    sharpest_project_insight: str = Field(description="The most honest or surprising finding from the top-matched project, not its headline metric.")
    targeted_questions: List[StrategyQuestion] = Field(description="1-2 targeted questions to ask the candidate to confirm preferences before drafting.")

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

class CVData(BaseModel):
    reasoning: str = Field(description="Explain your logic for selecting and tailoring items across all sections, and how you injected ATS keywords naturally.")
    professional_summary: str = Field(description="The tailored professional summary paragraph.")
    sections: List[Section] = Field(description="List of ALL tailored sections. Must include every section from the baseline CV.")

class ReviewResult(BaseModel):
    passed: bool = Field(description="True if the draft passes all rules, False otherwise.")
    feedback: str = Field(description="Feedback on what needs to be fixed if passed is False. Empty if passed is True.")

class CoverLetterOutput(BaseModel):
    paragraphs: List[str] = Field(description="The cover letter paragraphs, including salutation and sign-off.")

# --- STATE DEFINITION ---
class AgentState(TypedDict):
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
    strategy_questions: list
    user_strategy_answers: str
    tailored_cv: dict
    cover_letter_paragraphs: list
    review_feedback: str
    revision_count: int
    user_feedback: str
    custom_instructions: str
    generate_cover_letter: bool
