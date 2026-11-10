"""Output schemas for every model call. Sent to the API as strict JSON schemas,
so the shape is guaranteed by the API, not by prompt wording.

Strict mode needs every field required and no defaults."""
from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------- analysis

class Requirement(BaseModel):
    ad_line: str = Field(description="ID of the job ad line this requirement comes from, e.g. A12.")
    text: str = Field(description="The requirement, quoted or closely quoted from the ad.")
    kind: Literal["must", "nice"]
    category: Literal["skill", "experience", "education", "language", "location", "work_authorization", "other"]
    evidence: List[str] = Field(description="IDs of the CV entries that show this requirement. Empty if none.")
    status: Literal["met", "partial", "missing"]
    note: str = Field(description="One short sentence on why this status was chosen.")


class LanguageRequirement(BaseModel):
    language: str
    level: str = Field(description="The level the ad asks for, as written, or 'not stated'.")


class Application(BaseModel):
    cover_letter: Literal["wanted", "not_wanted", "not_stated"]
    cover_letter_quote: str = Field(description="The ad's exact words about a cover letter, or ''.")
    questions: List[str] = Field(description="Questions the ad asks applicants to answer, as written. Empty if none.")
    how_to_apply: str = Field(description="How the ad says to apply, as written, or ''.")


class Angle(BaseModel):
    title: str = Field(description="A short label for the angle, under 12 words, addressed to the candidate.")
    rationale: str = Field(description="One or two sentences to the candidate, using 'you', on why this angle suits this ad.")
    evidence: List[str] = Field(description="IDs of the CV entries this angle leads with.")


class Analysis(BaseModel):
    is_job_ad: bool
    company: str = Field(description="The hiring company, or '' if not stated.")
    role: str = Field(description="The job title, or '' if not stated.")
    location: str = Field(description="Where the job is based, as written, or ''.")
    work_mode: Literal["on_site", "hybrid", "remote", "not_stated"]
    ad_language: Literal["en", "sv", "other"]
    required_languages: List[LanguageRequirement]
    summary: str = Field(description="Two sentences describing the job.")
    requirements: List[Requirement]
    application: Application
    angles: List[Angle]


# ---------------------------------------------------------------- CV edits

class SourcedSentence(BaseModel):
    text: str
    sources: List[str] = Field(description="IDs of the entries this sentence rests on.")


class BulletEdit(BaseModel):
    id: str = Field(description="ID of the bullet being rephrased, e.g. P2.1.")
    new_text: str
    ad_lines: List[str] = Field(description="IDs of the ad lines this edit serves.")


class CvEdits(BaseModel):
    summary: List[SourcedSentence]
    project_order: List[str] = Field(description="IDs of the projects to show, most relevant first.")
    edits: List[BulletEdit]


# ---------------------------------------------------------------- letter

class Paragraph(BaseModel):
    sentences: List[SourcedSentence]


class Letter(BaseModel):
    """Three required parts, so a letter can't come back as just an opening."""
    greeting: str
    opening: List[SourcedSentence] = Field(description="2-3 sentences: the role, and the candidate's strongest evidence for it.")
    body: List[Paragraph] = Field(description="1-2 paragraphs of 3-5 sentences each, tying CV evidence to the ad's main requirements.")
    closing: List[SourcedSentence] = Field(description="2-3 sentences: one concrete reason for this company, from the ad, and a direct close.")


def letter_paragraphs(letter: dict) -> list[tuple[str, list]]:
    """The letter's paragraphs in reading order, each with its part name."""
    out = [("opening", letter.get("opening") or [])]
    out += [("body", p.get("sentences") or []) for p in letter.get("body") or []]
    out.append(("closing", letter.get("closing") or []))
    return [(part, sents) for part, sents in out if sents]


class Replacement(BaseModel):
    key: str = Field(description="The key of the sentence being replaced, e.g. p2s3.")
    text: str = Field(description="The new sentence, or '' to remove it.")
    sources: List[str]


class Repair(BaseModel):
    replacements: List[Replacement]


# ---------------------------------------------------------------- verification

class Verdict(BaseModel):
    key: str
    verdict: Literal["supported", "overstated", "unsupported"]
    problem: str = Field(description="If not supported, the exact problem in one sentence; otherwise ''.")


class Verification(BaseModel):
    verdicts: List[Verdict]
