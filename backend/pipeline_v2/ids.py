"""Stable IDs for the Profile CV and the job ad, so every claim can name its source.

CV IDs are per section type, numbered in the user's own order:
    S          the Profile summary
    P1, P1.2   project 1, its 2nd bullet          (type "projects")
    W1, W1.1   work experience                     (type "work_experience")
    E1, E1.1   education                           (type "education")
    K1, K1.1   skills                              (type "skills")
    C1, C1.1   any other section                   (type "custom" or unknown)
    L          the candidate's location (from personal_info; no other contact data
               is ever sent to a model)

Job ad lines are A1, A2, ... (non-empty lines, in order).
User notes are N1, N2, ... (non-empty lines).
"""
from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field

PREFIX = {"projects": "P", "work_experience": "W", "education": "E", "skills": "K"}
EDITABLE_PREFIXES = {"P", "W", "E", "C"}  # bullets the CV step may rephrase; skills are locked


@dataclass
class Bullet:
    id: str
    text: str
    item_id: str
    section_index: int
    item_index: int
    bullet_index: int


@dataclass
class Item:
    id: str
    section_index: int
    item_index: int
    section_type: str
    title: str
    subtitle: str
    date: str
    context: str
    bullets: list[Bullet] = field(default_factory=list)


@dataclass
class LabelledCV:
    cv: dict
    items: dict[str, Item]
    bullets: dict[str, Bullet]
    summary: str
    location: str

    def text_of(self, source_id: str) -> str:
        """The words a source ID stands for ('' if unknown)."""
        if source_id == "S":
            return self.summary
        if source_id == "L":
            return self.location
        if source_id in self.bullets:
            b = self.bullets[source_id]
            it = self.items[b.item_id]
            # The bullet with its project's heading, so a claim about the project
            # ("my MSc thesis", "at Stockholm University") can be checked too.
            return "\n".join(x for x in (b.text, it.title, it.subtitle, it.date, it.context) if x)
        if source_id in self.items:
            it = self.items[source_id]
            return "\n".join([it.title, it.subtitle, it.date, it.context] + [b.text for b in it.bullets])
        return ""

    def project_ids(self) -> list[str]:
        return [i for i, it in self.items.items() if it.section_type == "projects"]


def label_cv(cv: dict) -> LabelledCV:
    cv = copy.deepcopy(cv or {})
    counters: dict[str, int] = {}
    items: dict[str, Item] = {}
    bullets: dict[str, Bullet] = {}
    for si, sec in enumerate(cv.get("sections", []) or []):
        stype = sec.get("type") or "custom"
        prefix = PREFIX.get(stype, "C")
        for ii, it in enumerate(sec.get("items", []) or []):
            counters[prefix] = counters.get(prefix, 0) + 1
            iid = f"{prefix}{counters[prefix]}"
            item = Item(iid, si, ii, stype, it.get("title", ""), it.get("subtitle", ""), it.get("date", ""),
                        it.get("context", ""))
            for bi, text in enumerate(it.get("bullets", []) or []):
                b = Bullet(f"{iid}.{bi + 1}", text, iid, si, ii, bi)
                item.bullets.append(b)
                bullets[b.id] = b
            items[iid] = item
    location = ((cv.get("personal_info") or {}).get("location") or "").strip()
    return LabelledCV(cv, items, bullets, cv.get("professional_summary", "") or "", location)


def render_cv(lcv: LabelledCV) -> str:
    """The CV as the models see it: IDs, no contact details."""
    lines = []
    if lcv.location:
        lines.append(f"[L] Location: {lcv.location}")
    if lcv.summary:
        lines.append(f"[S] Summary: {lcv.summary}")
    current = None
    for it in lcv.items.values():
        sec = (lcv.cv.get("sections") or [])[it.section_index]
        if current != it.section_index:
            current = it.section_index
            lines.append(f"\n## {sec.get('title', '')}")
        head = " | ".join(x for x in (it.title, it.subtitle, it.date) if x)
        lines.append(f"[{it.id}] {head}")
        if it.context:
            lines.append(f"    Tools/context: {it.context}")
        for b in it.bullets:
            lines.append(f"    [{b.id}] {b.text}")
    return "\n".join(lines).strip()


def label_lines(text: str, prefix: str) -> dict[str, str]:
    out: dict[str, str] = {}
    n = 0
    for line in (text or "").splitlines():
        if line.strip():
            n += 1
            out[f"{prefix}{n}"] = line.strip()
    return out


def render_lines(lines: dict[str, str]) -> str:
    return "\n".join(f"[{k}] {v}" for k, v in lines.items())


_ID_RE = re.compile(r"^(S|L|[PWEKC]\d+(?:\.\d+)?|A\d+|N\d+)$")


def is_id_shaped(s: str) -> bool:
    return bool(_ID_RE.match(s or ""))
