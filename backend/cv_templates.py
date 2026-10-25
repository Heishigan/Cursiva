"""CV and cover letter designs the user can choose from (in Settings).

Every template renders the same CV data (core.models.FullCVData). The four
newer ones share templates/cv/_body.tex and only differ in how they style it.
All are single column with real text so applicant tracking systems can read them.

The cover letter uses the same design as the CV. Classic keeps the original
letter (cl_template.tex, XeLaTeX); the others reuse their CV file's styling
with templates/cv/_letter.tex as the body (rendered with document="letter").
"""
from typing import Literal

TemplateId = Literal["classic", "modern", "editorial", "technical", "signature"]

DEFAULT_TEMPLATE: TemplateId = "classic"

# Template id -> file under backend/templates/
CV_TEMPLATE_FILES: dict[str, str] = {
    "classic": "cv_template.tex",
    "modern": "cv/modern.tex",
    "editorial": "cv/editorial.tex",
    "technical": "cv/technical.tex",
    "signature": "cv/signature.tex",
}


def template_file(template_id: str | None) -> str:
    return CV_TEMPLATE_FILES.get(template_id or DEFAULT_TEMPLATE, CV_TEMPLATE_FILES[DEFAULT_TEMPLATE])


def resolve_template(*candidates: str | None) -> str:
    """The first known template id among the candidates (request, then the
    user's saved choice), else the default."""
    for c in candidates:
        if c in CV_TEMPLATE_FILES:
            return c
    return DEFAULT_TEMPLATE


def letter_template(template_id: str | None) -> tuple[str, str]:
    """(template file, LaTeX engine) for the cover letter in this design."""
    tid = resolve_template(template_id)
    if tid == "classic":
        return "cl_template.tex", "xelatex"
    return CV_TEMPLATE_FILES[tid], "pdflatex"
