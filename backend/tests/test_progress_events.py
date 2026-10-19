import json

import core.agent as A
import progress
from tests.conftest import set_credits

GENERIC = {"professional_summary": "ML engineer.", "sections": [{"title": "Projects", "type": "projects", "items": [
    {"title": "P", "subtitle": "", "date": "", "url": "", "context": "", "bullets": ["Built X.", "Ran Y."]}]}]}
BODY = {"job_description": "jd", "generic_cv_raw": json.dumps(GENERIC), "company_name": "c", "role_name": "r",
        "strategy_plan": "s"}


def _events(text, kind):
    out = []
    for chunk in text.split("\n\n"):
        if chunk.startswith("data: "):
            d = json.loads(chunk[6:])
            if d["type"] == kind:
                out.append(d)
    return out


def test_cv_changes_counts_rewritten_bullets():
    tailored = {"professional_summary": "ML engineer.", "sections": [{"items": [{"bullets": ["Built X.", "Ran Y with RAG."]}]}]}
    c = progress.cv_changes(json.dumps(GENERIC), tailored)
    assert c == {"bullets_total": 2, "bullets_changed": 1, "summary_changed": False}
    assert progress.cv_summary(c) == "1 of 2 bullets tailored"


def test_fit_label_and_letter_facts():
    assert progress.fit_label("**Fit Assessment:**\nModerate Fit. The candidate...") == "Moderate fit"
    assert progress.fit_label("no label") == ""
    f = progress.letter_facts({"hook": "a b c", "match": "d e", "curiosity": "", "fit": "f"})
    assert f == {"paragraphs": 3, "words": 6}


class Graph:
    def __init__(self, events):
        self.events = events

    def stream(self, state, config=None, **kwargs):
        yield from self.events


TAILORED = {"reasoning": "secret reasoning", "professional_summary": "New summary.", "sections": GENERIC["sections"]}


def test_tailor_stream_stage_sequence_with_one_retry(client, app_module, monkeypatch):
    set_credits("user_A", 1)
    monkeypatch.setattr(app_module, "tailor_app", Graph([
        {"tailor": {"revision_count": 1, "tailored_cv": TAILORED}},
        {"reviewer": {"review_feedback": "- [unsupported_number] 45", "review_report": {"rule_issues": 1, "fact_issues": 0, "autofixed": []}}},
        {"tailor": {"revision_count": 2, "tailored_cv": TAILORED}},
        {"reviewer": {"review_feedback": "PASS", "tailored_cv": TAILORED, "review_report": {"autofixed": ["replaced em dashes"]}}},
        {"cover_letter": {"cover_letter_parts": {"hook": "one two", "match": "three", "curiosity": "four", "fit": "five"}}},
    ]))
    r = client.post("/api/tailor", json=BODY)
    stages = [(e["agent"], e["state"]) for e in _events(r.text, "stage")]
    assert stages == [("cv", "working"), ("cv", "done"), ("checker", "working"), ("checker", "retry"),
                      ("cv", "working"), ("cv", "done"), ("checker", "working"), ("checker", "done"),
                      ("letter", "working"), ("letter", "done")]
    drafts = _events(r.text, "draft")
    assert [d["doc"] for d in drafts] == ["cv", "cv", "cv", "letter"]
    assert all("reasoning" not in d["content"] for d in drafts)
    checker_done = [e for e in _events(r.text, "stage") if e["agent"] == "checker" and e["state"] == "done"][0]
    assert checker_done["summary"] == "Passed all checks · Replaced em dashes"
    assert _events(r.text, "result")[-1]["status"] == "success"


def test_tailor_stream_cap_reports_checker_failed(client, app_module, monkeypatch):
    set_credits("user_A", 1)
    events = []
    for i in range(1, A.MAX_REVISIONS + 1):
        events += [{"tailor": {"revision_count": i, "tailored_cv": TAILORED}},
                   {"reviewer": {"review_feedback": "bad", "review_report": {"rule_issues": 1}}}]
    monkeypatch.setattr(app_module, "tailor_app", Graph(events))
    r = client.post("/api/tailor", json=BODY)
    states = [(e["agent"], e["state"]) for e in _events(r.text, "stage")]
    assert states[-1] == ("checker", "failed")
    assert ("letter", "working") not in states


def test_intake_stages(client, app_module, monkeypatch):
    monkeypatch.setattr(app_module, "setup_node", lambda s: {"company_name": "Thule", "role_name": "AI Engineer",
                                                              "eligibility_passed": True, "key_requirements": ["a", "b", "c"]})
    monkeypatch.setattr(app_module, "strategist_node", lambda s: {"strategy_plan": "Strong Fit overall", "strategic_options": ["x", "y"]})
    r = client.post("/api/intake", json={"job_description": "jd", "generic_cv_raw": "{}"})
    st = _events(r.text, "stage")
    assert [(e["agent"], e["state"]) for e in st] == [("reader", "working"), ("reader", "done"), ("strategist", "working"), ("strategist", "done")]
    assert st[1]["summary"] == "3 key requirements found" and st[1]["facts"]["requirements"] == ["a", "b", "c"]
    assert st[3]["summary"] == "Strong fit · 2 angles proposed"


def test_reviewer_reports_facts(monkeypatch):
    from tests.test_checks import RAW, tailored
    from tests.fakes import Recorder
    from core.models import ReviewResult
    rec = Recorder()
    monkeypatch.setattr(A, "get_llm_review", rec.factory(lambda pv: ReviewResult(passed=True)))
    cv = tailored(professional_summary="ML engineer — with 4 years of experience.")
    out = A.reviewer_node({"api_key": "x", "generic_cv_raw": RAW, "tailored_cv": cv})
    assert out["review_feedback"] == "PASS"
    assert out["review_report"] == {"autofixed": ["replaced em dashes"], "rule_issues": 0, "fact_issues": 0, "llm_checked": True}


def test_custom_stream_chunks_become_partial_drafts(client, app_module, monkeypatch):
    set_credits("user_A", 1)
    seen = {}

    class TupleGraph:
        def stream(self, state, config=None, stream_mode=None, **kwargs):
            seen["mode"], seen["configurable"] = stream_mode, (config or {}).get("configurable")
            yield ("custom", {"draft_partial": {"doc": "cv", "content": {"professional_summary": "New"}}})
            yield ("updates", {"tailor": {"revision_count": 1, "tailored_cv": TAILORED}})
            yield ("updates", {"reviewer": {"review_feedback": "PASS", "tailored_cv": TAILORED, "review_report": {}}})
            yield ("custom", {"draft_partial": {"doc": "letter", "content": {"hook": "Hej"}}})
            yield ("custom", {"something_else": 1})
            yield ("updates", {"cover_letter": {"cover_letter_parts": {"hook": "Hej då"}}})

    monkeypatch.setattr(app_module, "tailor_app", TupleGraph())
    r = client.post("/api/tailor", json=BODY)
    assert seen["mode"] == ["updates", "custom"] and seen["configurable"] == {"stream_drafts": True}
    drafts = _events(r.text, "draft")
    assert [(d["doc"], d.get("partial", False)) for d in drafts] == [
        ("cv", True), ("cv", False), ("cv", False), ("letter", True), ("letter", False)]
    assert _events(r.text, "result")[-1]["status"] == "success"


def _fake_prompt():
    from langchain_core.prompts import ChatPromptTemplate
    return ChatPromptTemplate.from_messages([("user", "{x}")])


def test_run_structured_streams_partials_and_validates(monkeypatch):
    from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
    from langchain_core.messages import AIMessage
    out = '{"reasoning": "why", "professional_summary": "Built a RAG pipeline for search", "sections": []}'
    monkeypatch.setattr(A, "get_llm_stream", lambda *a, **k: GenericFakeChatModel(messages=iter([AIMessage(content=out)])))
    monkeypatch.setattr(A, "DRAFT_EMIT_INTERVAL_S", 0)
    written = []
    monkeypatch.setattr(A, "get_stream_writer", lambda: written.append)
    res = A.run_structured(_fake_prompt(), {"x": "hi"}, A.CVData, "k", 0.2, None,
                           {"configurable": {"stream_drafts": True}}, doc="cv", strip_keys=("reasoning",))
    assert res.professional_summary == "Built a RAG pipeline for search"
    assert len(written) > 2
    assert all(w["draft_partial"]["doc"] == "cv" and "reasoning" not in w["draft_partial"]["content"] for w in written)
    summaries = [w["draft_partial"]["content"].get("professional_summary", "") for w in written]
    assert summaries[-1] == "Built a RAG pipeline for search" and any(0 < len(s) < len(summaries[-1]) for s in summaries)


def test_run_structured_falls_back_when_streaming_breaks(monkeypatch):
    from langchain_core.runnables import RunnableLambda

    def boom(*a, **k):
        raise RuntimeError("stream broke")
    monkeypatch.setattr(A, "get_llm_stream", boom)
    monkeypatch.setattr(A, "get_stream_writer", lambda: (lambda _: None))
    fallback = RunnableLambda(lambda _: A.CoverLetterOutput(salutation="Hej", hook="h", match="m", curiosity="c", fit="f", sign_off="s"))
    res = A.run_structured(_fake_prompt(), {"x": "hi"}, A.CoverLetterOutput, "k", 0.5, fallback,
                           {"configurable": {"stream_drafts": True}}, doc="letter")
    assert res.hook == "h"


def test_run_structured_without_flag_uses_normal_call(monkeypatch):
    from langchain_core.runnables import RunnableLambda
    monkeypatch.setattr(A, "get_llm_stream", lambda *a, **k: (_ for _ in ()).throw(AssertionError("should not stream")))
    fallback = RunnableLambda(lambda _: A.CoverLetterOutput(salutation="", hook="plain", match="", curiosity="", fit="", sign_off=""))
    assert A.run_structured(_fake_prompt(), {"x": "hi"}, A.CoverLetterOutput, "k", 0.5, fallback, None, doc="letter").hook == "plain"
