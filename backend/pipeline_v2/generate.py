"""Steps 2-4: CV edits and the letter (in parallel), then checks, then at most
one repair of rejected letter sentences.

    START -> cv ----\
                     check -> (repair) -> finish
    START -> letter -/

Failures never end a run: a rejected CV edit is dropped (the user's own
bullet stays), a rejected summary sentence is dropped (the Profile summary is
used if none survive), and a letter sentence that still fails after the
repair is kept and flagged for the user on the Review screen.
"""
from __future__ import annotations

import json
import math
from typing import Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from . import llm, rules
from .analysis import Analysis, letter_language, analyse
from .ids import EDITABLE_PREFIXES, LabelledCV, label_cv, label_lines, render_cv, render_lines
from .schemas import CvEdits, Letter, Repair, Verification, letter_paragraphs

MAX_PROJECTS = 5
SIGN_OFF = {"en": "Best regards,", "sv": "Vänliga hälsningar,"}
DEFAULT_GREETING = {"en": "Dear Hiring Team,", "sv": "Hej,"}


class V2State(TypedDict, total=False):
    # inputs
    api_key: str
    job_description: str
    profile_cv: dict
    analysis: dict
    notes: str
    preferences: list
    feedback: str
    previous_cv: Optional[dict]
    previous_letter: Optional[dict]
    write_letter: bool
    # outputs
    cv_edits: dict
    letter: dict
    tailored_cv: dict
    cv_report: dict
    letter_report: dict
    pending_repairs: list
    cover_letter_parts: dict


# ---------------------------------------------------------------- shared context

class Ctx:
    def __init__(self, s: V2State):
        self.lcv: LabelledCV = label_cv(s["profile_cv"])
        self.ad_lines = label_lines(s["job_description"], "A")
        self.note_lines = label_lines(s.get("notes") or "", "N")
        self.a = Analysis.model_validate(s["analysis"])
        self.lang = letter_language(self.a)
        self.ad_text = s["job_description"]
        self.cv_all = render_cv(self.lcv)

    def source_text(self, sid: str) -> str:
        if sid in self.ad_lines:
            return self.ad_lines[sid]
        if sid in self.note_lines:
            return self.note_lines[sid]
        return self.lcv.text_of(sid)

    def requirements_block(self) -> str:
        out = []
        for r in self.a.requirements:
            ev = ", ".join(r.evidence) or "none"
            out.append(f"[{r.ad_line or '?'}] {r.kind} · {r.status} · {r.text} (evidence: {ev})")
        return "\n".join(out)

    def angle_block(self, notes: str) -> str:
        return notes or "No angle chosen; lead with the strongest match."


def _prefs(s: V2State) -> str:
    return "\n".join(f"- {p}" for p in (s.get("preferences") or []))


# ---------------------------------------------------------------- step 2: CV edits

def _previous_cv_block(lcv: LabelledCV, prev: Optional[dict]) -> str:
    """The earlier draft, as the IDs of the Profile CV, only where it differed."""
    if not prev:
        return ""
    lines = []
    if (prev.get("professional_summary") or "").strip() and prev["professional_summary"] != lcv.summary:
        lines.append(f"[summary] {prev['professional_summary']}")
    by_title = {(it.section_type, it.title): it for it in lcv.items.values()}
    for sec in prev.get("sections", []) or []:
        for pit in sec.get("items", []) or []:
            it = by_title.get((sec.get("type") or "custom", pit.get("title", "")))
            if not it:
                continue
            for b, text in zip(it.bullets, pit.get("bullets", []) or []):
                if text != b.text:
                    lines.append(f"[{b.id}] {text}")
    return "\n".join(lines)


def cv_node(s: V2State, config=None) -> dict:
    c = Ctx(s)
    parts = [
        llm.tag("job_ad", render_lines(c.ad_lines)),
        llm.tag("requirements", c.requirements_block()),
        llm.tag("cv", c.cv_all),
        llm.tag("angle", c.angle_block(s.get("notes", ""))),
        llm.tag("notes", s.get("notes", "")),
        llm.tag("preferences", _prefs(s)),
        llm.tag("today", llm.today()),
    ]
    if s.get("feedback"):
        parts += [llm.tag("previous_draft", _previous_cv_block(c.lcv, s.get("previous_cv"))),
                  llm.tag("feedback", s["feedback"])]
    res = llm.call(CvEdits, "cv_edits", "\n\n".join(parts), s["api_key"], temperature=0.2, config=config)
    return {"cv_edits": json.loads(res.model_dump_json())}


# ---------------------------------------------------------------- step 3: letter

def _previous_letter_block(prev: Optional[dict]) -> str:
    if not prev:
        return ""
    keys = ("salutation", "hook", "match", "curiosity", "fit")
    return "\n\n".join(prev.get(k, "") for k in keys if prev.get(k))


MIN_WORDS, MAX_WORDS = 200, 300


def _letter_words(letter) -> int:
    data = json.loads(letter.model_dump_json()) if hasattr(letter, "model_dump_json") else letter
    return sum(len(x["text"].split()) for _, p in letter_paragraphs(data) for x in p)


def _letter_text(letter) -> str:
    data = json.loads(letter.model_dump_json())
    return "\n\n".join(" ".join(x["text"] for x in p) for _, p in letter_paragraphs(data))


def letter_node(s: V2State, config=None) -> dict:
    if not s.get("write_letter", True):
        return {"letter": {}}
    c = Ctx(s)
    parts = [
        llm.tag("job_ad", render_lines(c.ad_lines)),
        llm.tag("requirements", c.requirements_block()),
        llm.tag("cv", c.cv_all),
        llm.tag("angle", c.angle_block(s.get("notes", ""))),
        llm.tag("notes", render_lines(c.note_lines)),
        llm.tag("preferences", _prefs(s)),
        llm.tag("language", "Swedish" if c.lang == "sv" else "English"),
        llm.tag("today", llm.today()),
    ]
    redo = []
    if s.get("feedback"):
        redo = [llm.tag("previous_draft", _previous_letter_block(s.get("previous_letter"))),
                llm.tag("feedback", s["feedback"])]
    res = llm.call(Letter, "letter", "\n\n".join(parts + redo), s["api_key"], temperature=0.4, config=config)
    words = _letter_words(res)
    if not (MIN_WORDS <= words <= MAX_WORDS):
        # The prompt sets 200-300 words; a draft outside it gets one rewrite to length.
        # The new draft replaces the earlier one; the candidate's own feedback (on a redo) is kept.
        # Models count sentences far better than words, so the request names how many to cut.
        n_sent = sum(len(p) for _, p in letter_paragraphs(json.loads(res.model_dump_json()))) or 1
        if words > MAX_WORDS:
            cut = max(1, math.ceil((words - MAX_WORDS + 15) / (words / n_sent)))
            length = (f"This draft is {words} words in {n_sent} sentences. Rewrite it to between {MIN_WORDS} and "
                      f"{MAX_WORDS} words: remove at least {cut} of the least important sentences and keep each "
                      f"sentence under 30 words. Every sentence you keep keeps its sources.")
        else:
            length = (f"This draft is {words} words. Rewrite it to between {MIN_WORDS} and {MAX_WORDS} words, "
                      f"adding detail only from the cited sources. Every sentence keeps its sources.")
        feedback = f"{s['feedback']}\n\n{length}" if s.get("feedback") else length
        rewrite = [llm.tag("previous_draft", _letter_text(res)), llm.tag("feedback", feedback)]
        res = llm.call(Letter, "letter", "\n\n".join(parts + rewrite), s["api_key"], temperature=0.4, config=config)
    letter = json.loads(res.model_dump_json())
    trim_to_limit(letter)
    return {"letter": letter}


def trim_to_limit(letter: dict, limit: int | None = None) -> list[str]:
    """The word limit is a rule, so it is guaranteed here: while the letter is
    over it, remove the last body sentence. The opening and closing are never
    touched, and the first body paragraph keeps at least one sentence."""
    limit = MAX_WORDS if limit is None else limit
    removed = []
    body = letter.get("body") or []
    while _letter_words(letter) > limit:
        idx = next((i for i in range(len(body) - 1, -1, -1)
                    if len(body[i].get("sentences") or []) > (1 if i == 0 else 0)), None)
        if idx is None:
            break
        removed.append(body[idx]["sentences"].pop()["text"])
        if not body[idx]["sentences"]:
            body.pop(idx)
    return removed


# ---------------------------------------------------------------- step 4: checks

def _sentences(letter: dict) -> list[dict]:
    out = []
    for pi, (part, sents) in enumerate(letter_paragraphs(letter), 1):
        for si, sent in enumerate(sents, 1):
            out.append({"key": f"p{pi}s{si}", "part": part, "text": rules.fix_dashes(sent.get("text", "")),
                        "sources": list(sent.get("sources", []) or [])})
    return out


def check_edit(c: Ctx, e: dict) -> Optional[str]:
    """Rule problems with one CV edit, or None."""
    bid = e.get("id", "")
    b = c.lcv.bullets.get(bid)
    if not b:
        return "unknown bullet ID"
    if bid[0] not in EDITABLE_PREFIXES:
        return "this section can't be edited"
    new = rules.fix_dashes(e.get("new_text", ""))
    if not new.strip():
        return "empty text"
    source = c.lcv.text_of(bid)
    if (n := rules.new_numbers(new, source)):
        return f"numbers not in the original bullet: {', '.join(n)}"
    if (lost := sorted(rules.numbers(b.text) - rules.numbers(new))):
        return f"drops a number from the original bullet: {', '.join(lost)}"
    if (t := rules.new_terms(new, source + "\n" + c.ad_text)):
        return f"terms not in the original bullet or the ad: {', '.join(t)}"
    if (cp := rules.copied_from_ad(new, c.ad_text, source)):
        return f"wording copied from the ad: \"{cp[0]}\""
    return None


def check_summary_sentence(c: Ctx, sent: dict) -> Optional[str]:
    srcs = sent.get("sources") or []
    if not srcs or not all(c.lcv.text_of(x) for x in srcs):
        return "missing or unknown sources"
    cited = "\n".join(c.lcv.text_of(x) for x in srcs)
    text = rules.fix_dashes(sent.get("text", ""))
    if (n := rules.new_numbers(text, cited)):
        return f"numbers not in its sources: {', '.join(n)}"
    if (t := rules.new_terms(text, c.cv_all)):
        return f"terms not in the CV: {', '.join(t)}"
    if (cp := rules.copied_from_ad(text, c.ad_text, c.cv_all)):
        return f"wording copied from the ad: \"{cp[0]}\""
    return None


def check_letter_sentence(c: Ctx, sent: dict) -> Optional[str]:
    text, srcs = sent["text"], sent["sources"]
    if any(not c.source_text(x) for x in srcs):
        return "unknown source ID"
    cited = "\n".join(c.source_text(x) for x in srcs)
    everything = c.cv_all + "\n" + c.ad_text + "\n" + "\n".join(c.note_lines.values())
    if (sp := rules.stock_phrases(text, c.lang)):
        return f"stock phrase: \"{sp[0]}\""
    if (t := rules.new_terms(text, everything)):
        return f"terms in neither the CV nor the ad: {', '.join(t)}"
    if rules.mentions_availability(text) and not any(x.startswith("N") for x in srcs):
        return "availability not given in the candidate's notes"
    if not srcs:
        if rules.numbers(text):
            return "a number with no source"
        if rules.claims_experience(text, c.lang):
            return "an experience claim with no source"
        return None
    if (n := rules.new_numbers(text, cited)):
        return f"numbers not in its sources: {', '.join(n)}"
    return None


def _item(key: str, claim: str, sources: dict[str, str]) -> str:
    src = "\n".join(f"  [{k}] {v}" for k, v in sources.items()) or "  (no sources: acceptable only if the claim states no fact)"
    return f"[{key}]\nclaim: {claim}\nsources:\n{src}"


def verify(items: list[str], api_key: str, config=None) -> dict[str, dict]:
    if not items:
        return {}
    user = "\n\n".join([llm.tag("items", "\n\n".join(items)), llm.tag("today", llm.today())])
    res = llm.call(Verification, "verify", user, api_key, temperature=0.0, config=config)
    # Keys come back as written by the model; "[p2s1]" or " p2s1" must still match "p2s1".
    return {v.key.strip().strip("[]").strip(): {"verdict": v.verdict, "problem": v.problem} for v in res.verdicts}


def apply_cv(c: Ctx, edits: dict, accepted_edits: dict[str, str], summary: str) -> tuple[dict, dict]:
    cv = json.loads(json.dumps(c.lcv.cv))
    cv.pop("personal_info", None)
    cv.pop("template", None)
    for bid, text in accepted_edits.items():
        b = c.lcv.bullets[bid]
        cv["sections"][b.section_index]["items"][b.item_index]["bullets"][b.bullet_index] = text
    cv["professional_summary"] = summary
    # Projects: the model's order, every valid project once, at most MAX_PROJECTS.
    pids = c.lcv.project_ids()
    order = []
    for pid in edits.get("project_order", []) or []:
        if pid in pids and pid not in order:
            order.append(pid)
    for pid in pids:  # anything the model left out goes last, in the user's order
        if pid not in order:
            order.append(pid)
    shown, hidden = order[:MAX_PROJECTS], order[MAX_PROJECTS:]
    if pids:
        si = c.lcv.items[pids[0]].section_index
        originals = {pid: cv["sections"][si]["items"][c.lcv.items[pid].item_index] for pid in pids}
        cv["sections"][si]["items"] = [originals[p] for p in shown]
    report = {"projects_hidden": [c.lcv.items[p].title for p in hidden]}
    return cv, report


def check_node(s: V2State, config=None) -> dict:
    c = Ctx(s)
    edits = s.get("cv_edits") or {}
    items, cv_rule_fail, sum_rule_fail, letter_rule_fail, rule_proposed = [], {}, {}, {}, {}

    # CV edits
    proposed = {}
    for e in edits.get("edits", []) or []:
        bid = e.get("id", "")
        new = rules.fix_dashes(e.get("new_text", ""))
        if bid in c.lcv.bullets and new == c.lcv.bullets[bid].text:
            continue
        problem = check_edit(c, e)
        if problem:
            cv_rule_fail[bid] = problem
            rule_proposed[bid] = new
            continue
        proposed[bid] = new
        it = c.lcv.items[c.lcv.bullets[bid].item_id]
        items.append(_item(f"cv:{bid}", new, {f"{bid} original": c.lcv.bullets[bid].text,
                                              f"{it.id} heading": " | ".join(
                                                  x for x in (it.title, it.subtitle, it.date, it.context) if x)}))
    # Summary sentences
    summary = []
    for i, sent in enumerate(edits.get("summary", []) or []):
        problem = check_summary_sentence(c, sent)
        text = rules.fix_dashes(sent.get("text", ""))
        if problem:
            sum_rule_fail[f"sum:{i}"] = problem
            continue
        summary.append((f"sum:{i}", text))
        items.append(_item(f"sum:{i}", text, {x: c.lcv.text_of(x) for x in sent.get("sources", [])}))
    # Letter sentences
    letter = s.get("letter") or {}
    sentences = _sentences(letter) if letter else []
    for sent in sentences:
        problem = check_letter_sentence(c, sent)
        if problem:
            letter_rule_fail[sent["key"]] = problem
            continue
        items.append(_item(sent["key"], sent["text"], {x: c.source_text(x) for x in sent["sources"]}))

    verdicts = verify(items, s["api_key"], config)

    def bad(key):
        # A claim the checker didn't return a verdict for counts as unchecked,
        # and unchecked claims don't reach the user.
        v = verdicts.get(key)
        return v is None or v["verdict"] != "supported"

    def why(key):
        return (verdicts.get(key) or {}).get("problem") or "not confirmed by the fact-check"

    accepted = {bid: t for bid, t in proposed.items() if not bad(f"cv:{bid}")}
    def original(bid):
        return c.lcv.bullets[bid].text if bid in c.lcv.bullets else ""

    dropped = [{"id": bid, "reason": p, "before": original(bid), "proposed": rule_proposed.get(bid, "")}
               for bid, p in cv_rule_fail.items()]
    dropped += [{"id": bid, "reason": why(f"cv:{bid}"), "before": original(bid), "proposed": proposed[bid]}
                for bid in proposed if bad(f"cv:{bid}")]
    order = {bid: i for i, bid in enumerate(c.lcv.bullets)}
    dropped.sort(key=lambda d: order.get(d["id"], 10**6))
    kept_summary = [t for k, t in summary if not bad(k)]
    summary_dropped = len(sum_rule_fail) + sum(1 for k, _ in summary if bad(k))
    summary_text = " ".join(kept_summary) if kept_summary else c.lcv.summary
    cv, cv_report = apply_cv(c, edits, accepted, summary_text)
    changes = []
    if summary_text != c.lcv.summary:
        changes.append({"kind": "summary", "id": "S", "before": c.lcv.summary, "after": summary_text})
    changes += [{"kind": "bullet", "id": bid, "before": original(bid), "after": accepted[bid]}
                for bid in sorted(accepted, key=lambda b: order[b])]
    cv_report.update({"edits_applied": sorted(accepted), "edits_dropped": dropped, "changes": changes,
                      "summary_sentences_dropped": summary_dropped,
                      "summary_from_profile": not kept_summary})

    repairs = [{"key": k, "problem": p} for k, p in letter_rule_fail.items()]
    repairs += [{"key": x["key"], "problem": why(x["key"])} for x in sentences
                if x["key"] not in letter_rule_fail and bad(x["key"])]
    letter_report = {"sentences": sentences, "flags": [], "language": c.lang}

    return {"tailored_cv": cv, "cv_report": cv_report, "letter_report": letter_report, "pending_repairs": repairs}


def needs_repair(s: V2State) -> str:
    return "repair" if s.get("pending_repairs") else "finish"


def repair_node(s: V2State, config=None) -> dict:
    """One repair call for every rejected letter sentence, then a re-check of
    the replacements. Anything still failing is kept and flagged."""
    c = Ctx(s)
    report = dict(s["letter_report"])
    sentences = [dict(x) for x in report["sentences"]]
    by_key = {x["key"]: x for x in sentences}
    letter_text = "\n".join(f"[{x['key']}] {x['text']}" for x in sentences)
    problems = "\n".join(f"[{r['key']}] {r['problem']}" for r in s["pending_repairs"])
    user = "\n\n".join([
        llm.tag("letter", letter_text), llm.tag("problems", problems),
        llm.tag("job_ad", render_lines(c.ad_lines)), llm.tag("cv", c.cv_all),
        llm.tag("notes", render_lines(c.note_lines)),
        llm.tag("language", "Swedish" if c.lang == "sv" else "English"),
        llm.tag("preferences", _prefs(s)),
    ])
    res = llm.call(Repair, "letter_repair", user, s["api_key"], temperature=0.2, config=config)
    wanted = {r["key"] for r in s["pending_repairs"]}
    replaced, items, flags = {}, [], []
    for r in res.replacements:
        if r.key not in wanted or r.key not in by_key:
            continue
        new = {"key": r.key, "part": by_key[r.key].get("part", "body"), "text": rules.fix_dashes(r.text),
               "sources": list(r.sources)}
        if not new["text"].strip():
            continue  # never delete a sentence: the original is kept and flagged below
        problem = check_letter_sentence(c, new)
        if problem:
            flags.append({"key": r.key, "reason": problem})
        else:
            items.append(_item(r.key, new["text"], {x: c.source_text(x) for x in new["sources"]}))
        replaced[r.key] = new
    verdicts = verify(items, s["api_key"], config)
    checked = {i.split("]", 1)[0][1:] for i in items}
    for k in checked:
        v = verdicts.get(k)
        if v is None or v["verdict"] != "supported":
            flags.append({"key": k, "reason": (v or {}).get("problem") or "not confirmed by the fact-check"})
    for k in wanted - set(replaced):  # no usable replacement: keep the original, flagged
        flags.append({"key": k, "reason": next(r["problem"] for r in s["pending_repairs"] if r["key"] == k)})
    out = []
    for x in sentences:
        out.append(replaced.get(x["key"], x))
    report.update({"sentences": out, "flags": flags, "repaired": sorted(replaced)})
    return {"letter_report": report, "pending_repairs": []}


# ---------------------------------------------------------------- finish

def _within_limit(sentences: list[dict]) -> list[dict]:
    """A repair can lengthen a sentence, so the limit is applied once more on
    the final sentences: the last body sentence goes first; the opening, the
    closing and the first body sentence stay."""
    out = list(sentences)
    words = lambda: sum(len(x["text"].split()) for x in out)
    while words() > MAX_WORDS:
        body = [i for i, x in enumerate(out) if x.get("part", "body") == "body"]
        if len(body) <= 1:
            break
        out.pop(body[-1])
    return out


def letter_parts(s: V2State) -> dict:
    """Pour the letter into the fields the Review screen and the letter PDF
    use: opening -> hook, body paragraphs -> match (+ curiosity), closing -> fit."""
    letter = s.get("letter") or {}
    if not letter:
        return {}
    c = Ctx(s)
    report = s.get("letter_report") or {}
    # Group the checked sentences back into paragraphs, remembering each one's part.
    sentences = _within_limit(report.get("sentences", []))
    paras: dict[int, tuple[str, list[str]]] = {}
    for x in sentences:
        p = int(x["key"][1:].split("s")[0])
        paras.setdefault(p, (x.get("part", "body"), []))[1].append(x["text"])
    ordered = [paras[k] for k in sorted(paras)]
    opening = " ".join(" ".join(t) for part, t in ordered if part == "opening")
    body = [" ".join(t) for part, t in ordered if part == "body"]
    closing = " ".join(" ".join(t) for part, t in ordered if part == "closing")
    greeting = rules.fix_dashes(letter.get("greeting", "")).strip()
    if not greeting or rules.greeting_language(greeting) not in (c.lang, "?"):
        greeting = DEFAULT_GREETING[c.lang]
    name = ((s["profile_cv"].get("personal_info") or {}).get("name") or "").strip()
    sign_off = SIGN_OFF[c.lang] + (f"\n\n{name}" if name else "")
    return {
        "salutation": greeting,
        "hook": opening,
        "match": body[0] if body else "",
        "curiosity": " ".join(body[1:]),
        "fit": closing,
        "sign_off": sign_off,
        "company_location": c.a.location or "Sweden",
    }


def finish_node(s: V2State, config=None) -> dict:
    parts = letter_parts(s)
    report = dict(s.get("letter_report") or {})
    if parts:
        body = " ".join(parts[k] for k in ("hook", "match", "curiosity", "fit"))
        report["words"] = len(body.split())
        report["body_language"] = rules.language(body)
    return {"cover_letter_parts": parts, "letter_report": report}


def build_graph():
    g = StateGraph(V2State)
    g.add_node("cv", cv_node)
    g.add_node("letter", letter_node)
    g.add_node("check", check_node)
    g.add_node("repair", repair_node)
    g.add_node("finish", finish_node)
    g.add_edge(START, "cv")
    g.add_edge(START, "letter")
    g.add_edge(["cv", "letter"], "check")
    g.add_conditional_edges("check", needs_repair, {"repair": "repair", "finish": "finish"})
    g.add_edge("repair", "finish")
    g.add_edge("finish", END)
    return g.compile()


app = build_graph()


def ensure_analysis(state: dict, config=None) -> dict:
    """An older client may not send the analysis: run it here (one more call)."""
    if state.get("analysis"):
        return state["analysis"]
    a = analyse(state["job_description"], state["profile_cv"], state.get("notes", ""), state["api_key"], config)
    return json.loads(a.model_dump_json())
