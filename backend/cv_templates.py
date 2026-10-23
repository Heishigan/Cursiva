"""CV templates the user can choose from.

Every template renders the same CV data (core.models.FullCVData). The four
newer ones share templates/cv/_body.tex and only differ in how they style it.
All are single column with real text so applicant tracking systems can read them.
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
