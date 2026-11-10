"""Pipeline v2: IDs, rules, the graph and both endpoints, with fake model calls (no network)."""
import json

import pytest

import pipeline_v2.llm as L
from pipeline_v2 import analysis as AN, generate as G, rules as R, service as SVC
from pipeline_v2.ids import label_cv, render_cv
from pipeline_v2.schemas import (Analysis, CvEdits, Letter, Repair, Verification)

CV = {
    "personal_info": {"name": "Alex Doe", "email": "alex@example.com", "phone": "+46 70 000 00 00",
                      "location": "Stockholm, Sweden", "linkedin": "", "github": "", "portfolio": ""},
    "professional_summary": "Backend developer who builds data services.",
    "sections": [
        {"title": "Projects", "type": "projects", "items": [
            {"title": f"Project {i}", "subtitle": "", "date": "2025", "url": "", "context": "Python, Docker",
             "bullets": [f"Built service {i} handling 40 requests per second", f"Wrote tests for service {i}"]}
            for i in range(1, 8)]},
        {"title": "Skills", "type": "skills", "items": [
            {"title": "Languages", "subtitle": "", "date": "", "url": "", "context": "", "bullets": ["English, Swedish (B2)"]}]},
        {"title": "Work Experience", "type": "work_experience", "items": [
            {"title": "Developer", "subtitle": "Acme AB", "date": "2023 - 2025", "url": "", "context": "Stockholm",
             "bullets": ["Maintained the billing API"]}]},
    ],
}
JD = "Backend Engineer at Example AB\nWe need Python and Docker\nCI/CD experience is required\nSkip the cover letter"


def analysis_obj(**over):
    base = dict(
        is_job_ad=True, company="Example AB", role="Backend Engineer", location="Stockholm", work_mode="hybrid",
        ad_language="en", required_languages=[], summary="A backend role.",
        requirements=[
            dict(ad_line="A2", text="Python and Docker", kind="must", category="skill", evidence=["P1"],
                 status="met", note=""),
            dict(ad_line="A3", text="CI/CD experience", kind="must", category="experience", evidence=[],
                 status="missing", note=""),
        ],
        application=dict(cover_letter="not_wanted", cover_letter_quote="Skip the cover letter", questions=[],
                         how_to_apply=""),
        angles=[dict(title="Lead with services", rationale="Fits the backend focus.", evidence=["P1"])],
    )
    base.update(over)
    return Analysis.model_validate(base)


class FakeLLM:
    """Answers by prompt name; records every user message."""

    def __init__(self, answers):
        self.answers = answers
        self.calls = []

    def __call__(self, schema, prompt_name, user, api_key, temperature, config=None):
        self.calls.append((prompt_name, user))
        a = self.answers[prompt_name]
        return a(user) if callable(a) else a


def verify_all(verdict="supported", overrides=None):
    overrides = overrides or {}

    def answer(user):
        keys = [line[1:].split("]")[0] for line in user.splitlines() if line.startswith("[") and "]" in line
                and not line.startswith("[A") and "claim" not in line]
        keys = [k for k in keys if not k.startswith(("  ",))]
        return Verification(verdicts=[{"key": k, "verdict": overrides.get(k, verdict),
                                       "problem": "" if overrides.get(k, verdict) == "supported" else "nope"}
                                      for k in keys])
    return answer


def edits(**over):
    base = dict(summary=[{"text": "Backend developer who builds data services in Python.", "sources": ["S", "P1"]}],
                project_order=["P3", "P1"],
                edits=[{"id": "P1.1", "new_text": "Built service 1 with Python and Docker, handling 40 requests per second",
                        "ad_lines": ["A2"]}])
    base.update(over)
    return CvEdits.model_validate(base)


def letter(**over):
    base = dict(greeting="Dear Hiring Team,",
                opening=[{"text": "I'm applying for the Backend Engineer role at Example AB.", "sources": ["A1"]},
                         {"text": "I built service 1, which handles 40 requests per second.", "sources": ["P1.1"]}],
                body=[{"sentences": [{"text": "You need Python and Docker, which I used across seven projects.", "sources": ["A2", "P1"]}]}],
                closing=[{"text": "That's the kind of work I want to keep doing.", "sources": []}])
    base.update(over)
    return Letter.model_validate(base)


def state(**over):
    s = {"api_key": "x", "job_description": JD, "profile_cv": CV,
         "analysis": json.loads(analysis_obj().model_dump_json()), "notes": "", "preferences": [],
         "feedback": "", "previous_cv": None, "previous_letter": None, "write_letter": True}
    s.update(over)
    return s


@pytest.fixture(autouse=True)
def _any_length(monkeypatch):
    # The short test letters would otherwise trigger the length rewrite; its own tests set the limits.
    monkeypatch.setattr(G, "MIN_WORDS", 0)


# ---------------------------------------------------------------- IDs and rules

def test_ids_and_no_contact_details_in_prompt_text():
    lcv = label_cv(CV)
    assert "P7.2" in lcv.bullets and "K1.1" in lcv.bullets and "W1.1" in lcv.bullets
    text = render_cv(lcv)
    assert "[P1.1] Built service 1" in text and "[L] Location: Stockholm" in text
    assert "alex@example.com" not in text and "+46" not in text and "Alex Doe" not in text


def test_rules_catch_new_numbers_terms_and_copied_wording():
    src = "Built service 1 handling 40 requests per second\nProject 1\nPython, Docker"
    assert R.new_numbers("handling 45 requests", src) == ["45"]
    assert R.new_terms("Built it with Kubernetes and Docker", src) == ["kubernetes"]
    assert R.copied_from_ad("I have strong experience building scalable data platforms",
                            "you have strong experience building scalable data platforms", src)
    assert R.language("Jag har byggt en tjänst och det var roligt") == "sv"
    assert R.greeting_language("Hej Example-team,") == "sv"
    assert R.claims_experience("I have five years of experience", "en")
    assert R.mentions_availability("I can start immediately")
    assert R.fix_dashes("fast — and right") == "fast, and right"


def test_fit_label_is_computed_from_must_haves():
    assert AN.fit(analysis_obj())["label"] == "Stretch"  # 1 of 2 met
    lang_gap = analysis_obj(requirements=[dict(ad_line="A1", text="Fluent Swedish", kind="must", category="language",
                                               evidence=[], status="missing", note="")])
    assert AN.fit(lang_gap)["label"] == "Unlikely"
    all_met = analysis_obj(requirements=[dict(ad_line="A2", text="Python", kind="must", category="skill",
                                              evidence=["P1"], status="met", note="")])
    assert AN.fit(all_met)["label"] == "Strong"


def test_availability_and_willingness_dont_count_towards_the_fit():
    reqs = [dict(ad_line="A2", text="Python", kind="must", category="skill", evidence=["P1"], status="met", note=""),
            dict(ad_line="A3", text="Commit to six months, unpaid", kind="must", category="other", evidence=[],
                 status="missing", note="")]
    f = AN.fit(analysis_obj(requirements=reqs))
    assert f["label"] == "Strong" and f["total"] == 1
    only_other = analysis_obj(requirements=[reqs[1]])
    assert AN.fit(only_other)["total"] == 1  # nothing else to judge by: "other" still counts


def test_letter_language_and_letter_default():
    assert AN.letter_language(analysis_obj()) == "en"
    assert AN.letter_language(analysis_obj(ad_language="sv")) == "sv"
    assert AN.letter_language(analysis_obj(required_languages=[{"language": "Swedish", "level": "fluent"}])) == "sv"
    assert AN.letter_default(analysis_obj()) is False


def test_clean_drops_invented_ids():
    lcv = label_cv(CV)
    a = analysis_obj(requirements=[dict(ad_line="A99", text="X", kind="must", category="skill",
                                        evidence=["P42.9"], status="met", note="")])
    a = AN.clean(a, lcv, {"A1": "x"})
    assert a.requirements[0].evidence == [] and a.requirements[0].status == "missing"


def test_legacy_shapes_for_the_current_screens():
    md, st = AN.to_legacy(analysis_obj())
    assert md["company_name"] == "Example AB" and md["eligibility_passed"] is True
    assert st["fit_assessment"].startswith("Stretch fit.")
    assert st["strategic_options"] == ["Lead with services: Fits the backend focus."]
    assert st["analysis"]["letter_language"] == "en" and st["analysis"]["write_letter_default"] is False


# ---------------------------------------------------------------- the graph

def run(fake, monkeypatch, **over):
    monkeypatch.setattr(L, "call", fake)
    return G.app.invoke(state(**over))


def test_happy_path_applies_edits_and_pours_the_letter(monkeypatch):
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()})
    out = run(fake, monkeypatch)
    cv = out["tailored_cv"]
    projects = cv["sections"][0]["items"]
    assert [p["title"] for p in projects] == ["Project 3", "Project 1", "Project 2", "Project 4", "Project 5"]
    assert out["cv_report"]["projects_hidden"] == ["Project 6", "Project 7"]
    assert projects[1]["bullets"][0].startswith("Built service 1 with Python and Docker")
    assert cv["sections"][1] == CV["sections"][1]  # skills untouched
    assert "personal_info" not in cv
    parts = out["cover_letter_parts"]
    assert parts["salutation"] == "Dear Hiring Team,"
    assert parts["hook"].startswith("I'm applying") and parts["match"].startswith("You need")
    assert parts["curiosity"] == "" and parts["fit"].startswith("That's the kind")
    assert parts["sign_off"] == "Best regards,\n\nAlex Doe"
    assert [c[0] for c in fake.calls].count("verify") == 1 and len(fake.calls) == 3  # no repair needed


def test_bad_edits_are_dropped_and_the_original_bullet_stays(monkeypatch):
    bad = edits(edits=[
        {"id": "P1.1", "new_text": "Built service 1 handling 400 requests per second", "ad_lines": []},  # new number
        {"id": "P2.1", "new_text": "Built service 2 on Kubernetes handling 40 requests per second", "ad_lines": []},
        {"id": "K1.1", "new_text": "English, fluent Swedish", "ad_lines": []},  # skills locked
        {"id": "P9.9", "new_text": "Invented", "ad_lines": []},  # unknown
        {"id": "P3.2", "new_text": "Wrote thorough tests for service 3", "ad_lines": []},  # AI says overstated
    ])
    fake = FakeLLM({"cv_edits": bad, "letter": letter(), "verify": verify_all(overrides={"cv:P3.2": "overstated"})})
    out = run(fake, monkeypatch)
    bullets = {p["title"]: p["bullets"] for p in out["tailored_cv"]["sections"][0]["items"]}
    assert bullets["Project 1"][0] == "Built service 1 handling 40 requests per second"
    assert bullets["Project 3"][1] == "Wrote tests for service 3"
    assert out["tailored_cv"]["sections"][1] == CV["sections"][1]
    dropped = {d["id"] for d in out["cv_report"]["edits_dropped"]}
    assert dropped == {"P1.1", "P2.1", "K1.1", "P9.9", "P3.2"}


def test_missing_verdict_counts_as_unchecked(monkeypatch):
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(),
                    "verify": lambda user: Verification(verdicts=[])})
    fake.answers["letter_repair"] = Repair(replacements=[])
    out = run(fake, monkeypatch)
    assert out["cv_report"]["edits_applied"] == []
    assert out["tailored_cv"]["professional_summary"] == CV["professional_summary"]  # fell back to the Profile


def test_letter_sentence_is_repaired_once_and_rechecked(monkeypatch):
    lt = letter()
    lt.body[0].sentences[0].text = "I have deep Kubernetes experience."  # new term, rule failure
    fake = FakeLLM({"cv_edits": edits(), "letter": lt, "verify": verify_all(),
                    "letter_repair": Repair(replacements=[{"key": "p2s1", "text": "You need Python and Docker, which every one of my projects uses.",
                                                           "sources": ["A2", "P1"]}])})
    out = run(fake, monkeypatch)
    names = [c[0] for c in fake.calls]
    assert names.count("letter_repair") == 1 and names.count("verify") == 2
    assert "every one of my projects" in out["cover_letter_parts"]["match"]
    assert out["letter_report"]["flags"] == []


def test_unsourced_claims_and_invented_availability_are_caught():
    c = G.Ctx(state())
    assert G.check_letter_sentence(c, {"key": "p1s1", "text": "I have five years of backend experience.", "sources": []})
    assert G.check_letter_sentence(c, {"key": "p1s2", "text": "I can start immediately.", "sources": ["A1"]})
    assert G.check_letter_sentence(c, {"key": "p1s3", "text": "That's the work I want to do.", "sources": []}) is None


def test_wrong_language_greeting_is_replaced(monkeypatch):
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(greeting="Hej Example-team,"), "verify": verify_all()})
    out = run(fake, monkeypatch)
    assert out["cover_letter_parts"]["salutation"] == "Dear Hiring Team,"


def test_swedish_letter_gets_a_swedish_sign_off(monkeypatch):
    sv = letter(greeting="Hej,", opening=[{"text": "Jag söker tjänsten som backendutvecklare.", "sources": ["A1"]}], body=[], closing=[])
    fake = FakeLLM({"cv_edits": edits(), "letter": sv, "verify": verify_all()})
    out = run(fake, monkeypatch, analysis=json.loads(analysis_obj(ad_language="sv").model_dump_json()))
    assert out["cover_letter_parts"]["sign_off"] == "Vänliga hälsningar,\n\nAlex Doe"


def test_letter_switched_off_makes_no_letter_call(monkeypatch):
    fake = FakeLLM({"cv_edits": edits(), "verify": verify_all()})
    out = run(fake, monkeypatch, write_letter=False)
    assert "letter" not in [c[0] for c in fake.calls]
    assert out["cover_letter_parts"] == {}


def test_five_or_fewer_projects_are_all_kept(monkeypatch):
    small = json.loads(json.dumps(CV))
    small["sections"][0]["items"] = small["sections"][0]["items"][:3]
    fake = FakeLLM({"cv_edits": edits(project_order=["P2"]), "letter": letter(), "verify": verify_all()})
    out = run(fake, monkeypatch, profile_cv=small)
    assert [p["title"] for p in out["tailored_cv"]["sections"][0]["items"]] == ["Project 2", "Project 1", "Project 3"]


def test_prompts_carry_data_in_tags_and_redo_context(monkeypatch):
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()})
    prev = json.loads(json.dumps(CV))
    prev["sections"][0]["items"][0]["bullets"][0] = "EARLIER WORDING"
    run(fake, monkeypatch, feedback="shorter please", previous_cv=prev,
        previous_letter={"hook": "EARLIER LETTER"}, preferences=["Keep it short"])
    cv_user = next(u for n, u in fake.calls if n == "cv_edits")
    letter_user = next(u for n, u in fake.calls if n == "letter")
    assert "<job_ad>" in cv_user and "[P1.1] EARLIER WORDING" in cv_user and "shorter please" in cv_user
    assert "EARLIER LETTER" in letter_user and "Keep it short" in letter_user and "<language>\nEnglish" in letter_user
    assert "alex@example.com" not in cv_user + letter_user


def test_prompts_have_no_real_cv_content():
    text = " ".join(L.prompt(n) for n in ("analysis", "cv_edits", "letter", "letter_repair", "verify")).lower()
    for word in ("triagesim", "cursiva", "langgraph", "bert", "stockholm", "thesis", "hackathon"):
        assert word not in text


# ---------------------------------------------------------------- endpoints

@pytest.fixture()
def v2(monkeypatch):
    monkeypatch.setenv("PIPELINE_VERSION", "2")
    monkeypatch.setattr(SVC, "analyse", lambda *a, **k: analysis_obj())


def events(resp):
    return [json.loads(l[6:]) for l in resp.text.split("\n\n") if l.startswith("data: ")]


def test_intake_v2_returns_legacy_fields_and_analysis(client, v2):
    r = client.post("/api/intake", json={"job_description": JD, "generic_cv_raw": json.dumps(CV)})
    ev = events(r)
    result = ev[-1]
    assert result["status"] == "success"
    assert result["metadata"]["role_name"] == "Backend Engineer"
    assert result["strategy"]["analysis"]["fit"]["label"] == "Stretch"
    assert {e["agent"] for e in ev if e.get("type") == "stage"} == {"reader", "strategist"}


def test_intake_v2_blocks_a_hard_gap_when_strict(client, monkeypatch, v2):
    gap = analysis_obj(requirements=[dict(ad_line="A1", text="Must live in Oslo", kind="must", category="location",
                                          evidence=[], status="missing", note="")])
    monkeypatch.setattr(SVC, "analyse", lambda *a, **k: gap)
    ev = events(client.post("/api/intake", json={"job_description": JD, "generic_cv_raw": json.dumps(CV)}))
    assert ev[-1]["status"] == "ineligible" and "Oslo" in ev[-1]["reason"]
    ev = events(client.post("/api/intake", json={"job_description": JD, "generic_cv_raw": json.dumps(CV),
                                                 "override_eligibility": True}))
    assert ev[-1]["status"] == "success"


def test_tailor_v2_success_keeps_the_credit_and_returns_the_review(client, monkeypatch, v2):
    from tests.conftest import get_credits, set_credits
    set_credits("user_A", 2)
    monkeypatch.setattr(L, "call", FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()}))
    body = {"job_description": JD, "generic_cv_raw": json.dumps(CV),
            "analysis": json.loads(analysis_obj().model_dump_json()), "generate_cover_letter": True}
    ev = events(client.post("/api/tailor", json=body))
    result = ev[-1]
    assert result["status"] == "success", result
    assert result["tailored_cv"]["sections"][0]["items"][0]["title"] == "Project 3"
    assert result["cover_letter_parts"]["sign_off"].endswith("Alex Doe")
    assert result["review"]["cv"]["edits_applied"] == ["P1.1"]
    assert get_credits("user_A") == 1
    assert {"cv", "checker", "letter"} <= {e["agent"] for e in ev if e.get("type") == "stage"}


def test_tailor_v2_error_refunds(client, monkeypatch, v2):
    from tests.conftest import get_credits, set_credits
    set_credits("user_A", 1)

    def boom(*a, **k):
        raise RuntimeError("model down")
    monkeypatch.setattr(L, "call", boom)
    body = {"job_description": JD, "generic_cv_raw": json.dumps(CV),
            "analysis": json.loads(analysis_obj().model_dump_json())}
    ev = events(client.post("/api/tailor", json=body))
    assert ev[-1]["status"] == "error" and get_credits("user_A") == 1


def test_v2_is_the_default_and_1_is_the_fallback(monkeypatch):
    monkeypatch.delenv("PIPELINE_VERSION", raising=False)
    assert SVC.enabled() is True
    monkeypatch.setenv("PIPELINE_VERSION", "1")
    assert SVC.enabled() is False


def test_report_lists_changes_and_dropped_with_before_and_after(monkeypatch):
    bad = edits(edits=[
        {"id": "P1.1", "new_text": "Built service 1 with Python and Docker, handling 40 requests per second", "ad_lines": ["A2"]},
        {"id": "P2.1", "new_text": "Built service 2 on Kubernetes handling 40 requests per second", "ad_lines": []},
    ])
    fake = FakeLLM({"cv_edits": bad, "letter": letter(), "verify": verify_all()})
    rep = run(fake, monkeypatch)["cv_report"]
    kinds = [(c["kind"], c["id"]) for c in rep["changes"]]
    assert kinds == [("summary", "S"), ("bullet", "P1.1")]
    assert rep["changes"][1]["before"] == "Built service 1 handling 40 requests per second"
    (d,) = rep["edits_dropped"]
    assert d["id"] == "P2.1" and d["before"].startswith("Built service 2 handling") and "Kubernetes" in d["proposed"]


def test_tailor_v2_shows_the_original_cv_first_then_the_changes(client, monkeypatch, v2):
    from tests.conftest import set_credits
    set_credits("user_A", 1)
    monkeypatch.setattr(L, "call", FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()}))
    body = {"job_description": JD, "generic_cv_raw": json.dumps(CV),
            "analysis": json.loads(analysis_obj().model_dump_json())}
    drafts = [e for e in events(client.post("/api/tailor", json=body)) if e.get("type") == "draft" and e["doc"] == "cv"]
    assert drafts[0]["content"]["professional_summary"] == CV["professional_summary"]
    assert "personal_info" not in drafts[0]["content"]
    assert [c["id"] for c in drafts[-1]["content"]["changes"]] == ["S", "P1.1"]


def test_verdict_keys_are_normalised_and_rejected_sentences_are_never_deleted(monkeypatch):
    def bracketed(user):
        keys = [l[1:].split("]")[0] for l in user.splitlines() if l.startswith("[") and "]" in l]
        return Verification(verdicts=[{"key": f"[{k}]", "verdict": "unsupported" if k == "p2s1" else "supported",
                                       "problem": "nope" if k == "p2s1" else ""} for k in keys])
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": bracketed,
                    "letter_repair": Repair(replacements=[{"key": "p2s1", "text": "", "sources": []}])})
    out = run(fake, monkeypatch)
    assert out["cv_report"]["edits_applied"] == ["P1.1"]  # "[cv:P1.1]" still matched
    parts = out["cover_letter_parts"]
    assert parts["hook"] and parts["match"].startswith("You need Python") and parts["fit"]  # nothing removed
    assert [f["key"] for f in out["letter_report"]["flags"]] == ["p2s1"]


def test_an_edit_that_drops_a_number_is_rejected():
    c = G.Ctx(state())
    assert "drops a number" in G.check_edit(c, {"id": "P1.1", "new_text": "Built service 1 with Python and Docker"})


def test_letter_parts_follow_the_named_parts(monkeypatch):
    two_bodies = letter(body=[{"sentences": [{"text": "You need Python and Docker, which I used across seven projects.", "sources": ["A2", "P1"]}]},
                              {"sentences": [{"text": "I also wrote tests for every service.", "sources": ["P1.2"]}]}])
    fake = FakeLLM({"cv_edits": edits(), "letter": two_bodies, "verify": verify_all()})
    parts = run(fake, monkeypatch)["cover_letter_parts"]
    assert parts["hook"].startswith("I'm applying") and parts["match"].startswith("You need")
    assert parts["curiosity"] == "I also wrote tests for every service." and parts["fit"].startswith("That's the kind")


def test_the_letter_format_requires_all_three_parts():
    from openai.lib._pydantic import to_strict_json_schema
    schema = to_strict_json_schema(Letter)
    assert set(schema["required"]) == {"greeting", "opening", "body", "closing"}


def test_a_repaired_opening_sentence_stays_in_the_opening(monkeypatch):
    lt = letter()
    lt.opening[0].text = "I'm thrilled to apply for the Backend Engineer role at Example AB."  # stock phrase
    fake = FakeLLM({"cv_edits": edits(), "letter": lt, "verify": verify_all(),
                    "letter_repair": Repair(replacements=[{"key": "p1s1", "text": "I'm applying for the Backend Engineer role at Example AB.",
                                                           "sources": ["A1"]}])})
    parts = run(fake, monkeypatch)["cover_letter_parts"]
    assert parts["hook"].startswith("I'm applying for the Backend Engineer role")
    assert parts["match"].startswith("You need Python") and parts["curiosity"] == ""


def test_hyphenated_words_are_judged_part_by_part():
    src = "Built a Python service with AI tooling"
    assert R.new_terms("A Python-based tool, AI-driven and fast.", src) == []
    assert R.new_terms("A Kubernetes-based tool.", src) == ["kubernetes"]


def test_a_letter_outside_the_word_limit_gets_one_rewrite(monkeypatch):
    monkeypatch.setattr(G, "MIN_WORDS", 200)
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()})
    run(fake, monkeypatch)
    letters = [u for n, u in fake.calls if n == "letter"]
    assert len(letters) == 2  # one rewrite, never more
    assert letters[1].count("<previous_draft>") == 1 and "between 200 and 300 words" in letters[1]
    assert "adding detail only from the cited sources" in letters[1]  # too short: asked to add, not cut


def test_a_long_letter_rewrite_names_how_many_sentences_to_cut(monkeypatch):
    monkeypatch.setattr(G, "MAX_WORDS", 30)
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()})
    run(fake, monkeypatch)
    rewrite = [u for n, u in fake.calls if n == "letter"][1]
    assert "in 4 sentences" in rewrite and "remove at least" in rewrite


def test_code_guarantees_the_word_limit_and_keeps_opening_and_closing():
    body = [{"sentences": [{"text": "one two three", "sources": []}, {"text": "four five six", "sources": []}]},
            {"sentences": [{"text": "seven eight nine", "sources": []}]}]
    lt = {"greeting": "Hi,", "opening": [{"text": "a b", "sources": []}], "body": body,
          "closing": [{"text": "c d", "sources": []}]}
    removed = G.trim_to_limit(lt, limit=8)
    assert removed == ["seven eight nine", "four five six"]
    assert G._letter_words(lt) == 7 and lt["opening"] and lt["closing"] and len(lt["body"]) == 1


def test_the_final_letter_is_cut_to_the_limit_after_a_repair(monkeypatch):
    monkeypatch.setattr(G, "MAX_WORDS", 10)
    sents = [{"key": "p1s1", "part": "opening", "text": "a b c"}, {"key": "p2s1", "part": "body", "text": "d e f"},
             {"key": "p2s2", "part": "body", "text": "g h i"}, {"key": "p3s1", "part": "closing", "text": "j k l"}]
    kept = G._within_limit(sents)
    assert [x["key"] for x in kept] == ["p1s1", "p2s1", "p3s1"]


def test_a_redo_rewrite_keeps_the_candidates_feedback_once(monkeypatch):
    monkeypatch.setattr(G, "MIN_WORDS", 200)
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()})
    run(fake, monkeypatch, feedback="shorter please", previous_letter={"hook": "EARLIER LETTER"})
    rewrite = [u for n, u in fake.calls if n == "letter"][1]
    assert rewrite.count("<previous_draft>") == 1 and rewrite.count("<feedback>") == 1
    assert "shorter please" in rewrite and "EARLIER LETTER" not in rewrite


def test_every_writer_and_checker_gets_todays_date(monkeypatch):
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()})
    run(fake, monkeypatch)
    for name in ("cv_edits", "letter", "verify"):
        assert "<today>\n" + L.today() in next(u for n, u in fake.calls if n == name)


def test_reasoning_is_medium_for_judging_low_for_writing_and_off_for_others(monkeypatch):
    monkeypatch.delenv("PIPELINE_V2_REASONING", raising=False)
    monkeypatch.delenv("PIPELINE_V2_JUDGE_REASONING", raising=False)
    assert L.reasoning_effort("gpt-5.1", "letter") == "low"
    assert L.reasoning_effort("gpt-5.1", "cv_edits") == "low"
    assert L.reasoning_effort("gpt-5.1", "analysis") == "medium"
    assert L.reasoning_effort("gpt-5.1", "verify") == "medium"
    assert L.reasoning_effort("gpt-4o", "verify") is None
    monkeypatch.setenv("PIPELINE_V2_JUDGE_REASONING", "high")
    assert L.reasoning_effort("gpt-5.1", "verify") == "high"


def test_a_bullet_source_carries_its_project_heading():
    from pipeline_v2.ids import label_cv
    cv = json.loads(json.dumps(CV))
    cv["sections"][0]["items"][0]["subtitle"] = "MSc Thesis, Stockholm University"
    assert "MSc Thesis" in label_cv(cv).text_of("P1.1")


def test_a_letter_inside_the_word_limit_is_not_rewritten(monkeypatch):
    fake = FakeLLM({"cv_edits": edits(), "letter": letter(), "verify": verify_all()})
    run(fake, monkeypatch)
    assert [n for n, _ in fake.calls].count("letter") == 1


def test_the_repair_step_gets_the_saved_rules(monkeypatch):
    lt = letter()
    lt.body[0].sentences[0].text = "I have deep Kubernetes experience."
    fake = FakeLLM({"cv_edits": edits(), "letter": lt, "verify": verify_all(),
                    "letter_repair": Repair(replacements=[{"key": "p2s1", "text": "You need Python and Docker.",
                                                           "sources": ["A2", "P1"]}])})
    run(fake, monkeypatch, preferences=["Never start a sentence with I"])
    repair_user = next(u for n, u in fake.calls if n == "letter_repair")
    assert "<preferences>" in repair_user and "Never start a sentence with I" in repair_user


def test_gpt_5_1_is_the_default_model(monkeypatch):
    monkeypatch.delenv("PIPELINE_V2_MODEL", raising=False)
    assert L.model_name("letter") == "gpt-5.1"


def test_everyday_abbreviations_are_not_technical_terms():
    src = "Built a Python service"
    assert R.new_terms("Jag byggde t.ex. en tjänst, bl.a. i Python.", src) == []
    assert R.new_terms("I built services, e.g. in Python, i.e. backend work.", src) == []
    assert R.new_terms("I built it with Next.js.", src) == ["next.js"]  # real terms are still caught


def test_swedish_text_with_the_preposition_i_reads_as_swedish():
    assert R.language("Jag bor i Stockholm och arbetar i ett team med AI i produktion.") == "sv"
    assert R.language("I live in Stockholm and I work with AI in production.") == "en"


def test_a_number_range_keeps_its_dash_and_prose_dashes_become_commas():
    assert R.fix_dashes("Studied 2024 – 2026 in Stockholm") == "Studied 2024 – 2026 in Stockholm"
    assert R.fix_dashes("Jul 2026 – Present") == "Jul 2026 – Present"
    assert R.fix_dashes("I built it — alone") == "I built it, alone"
    assert R.fix_dashes("I built it – alone") == "I built it, alone"
