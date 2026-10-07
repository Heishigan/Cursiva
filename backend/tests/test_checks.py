import json

import pytest

from core import checks

GENERIC = {
    "personal_info": {"name": "Ada"},
    "professional_summary": "ML engineer with 4 years of experience.",
    "sections": [
        {"title": "Work Experience", "type": "work_experience", "items": [
            {"title": "Engineer at Acme", "subtitle": "", "date": "2020 - 2023", "url": "", "context": "Python, AWS",
             "bullets": ["Cut inference latency by 40% with batching.", "Built a robust ETL pipeline."]},
            {"title": "Intern at Beta", "subtitle": "", "date": "2019", "url": "", "context": "", "bullets": ["Wrote tests."]}]},
        {"title": "Projects", "type": "projects", "items": [
            {"title": "Thesis", "subtitle": "", "date": "2024", "url": "", "context": "", "bullets": ["Trained five models."]}]},
    ],
}
RAW = json.dumps(GENERIC)


def tailored(**over):
    t = json.loads(RAW)
    t.pop("personal_info")
    t.update(over)
    return t


def test_clean_tailored_cv_has_no_issues():
    assert checks.find_issues(tailored(), RAW) == []


@pytest.mark.parametrize("text,expected", [
    ("Built X — fast", "Built X, fast"),
    ("Built X---fast", "Built X, fast"),
    ("Used **Python** daily", "Used Python daily"),
    ("2019 - 2021", "2019 - 2021"),
    ("2019–2021", "2019–2021"),  # en dash in ranges is left alone
])
def test_autofix(text, expected):
    fixed, _ = checks.autofix_cv({"professional_summary": text, "reasoning": "keep — me"})
    assert fixed["professional_summary"] == expected
    assert fixed["reasoning"] == "keep — me"


def test_banned_summary_phrase_flagged_only_when_introduced():
    t = tailored(professional_summary="Passionate about ML with 4 years of experience.")
    assert [i.code for i in checks.find_issues(t, RAW)] == ["banned_phrase"]
    # Present in the user's own source text -> allowed.
    assert checks.find_issues(t, RAW, supplemental="I am passionate about ML") == []


def test_bullet_intensifier_from_source_is_allowed():
    # "robust" is already in the generic CV bullets.
    assert checks.find_issues(tailored(), RAW) == []
    t = tailored()
    t["sections"][0]["items"][0]["bullets"][1] = "Seamlessly built an ETL pipeline."
    assert "seamlessly" in str(checks.find_issues(t, RAW)[0])


def test_invented_metric_flagged():
    t = tailored()
    t["sections"][0]["items"][0]["bullets"][0] = "Cut inference latency by 45% with batching."
    issues = checks.find_issues(t, RAW)
    assert issues and issues[0].code == "unsupported_number" and "45" in issues[0].message


def test_number_word_in_source_matches_digit():
    t = tailored()
    t["sections"][1]["items"][0]["bullets"][0] = "Trained 5 models."
    assert checks.find_issues(t, RAW) == []


def test_number_from_supplemental_allowed():
    t = tailored(professional_summary="ML engineer with 4 years of experience and 12 shipped models.")
    assert checks.find_issues(t, RAW) != []
    assert checks.find_issues(t, RAW, supplemental="I have shipped 12 models") == []


def test_dropped_work_item_flagged_but_projects_may_be_selected():
    t = tailored()
    t["sections"][0]["items"].pop(1)
    t["sections"][1]["items"] = []
    issues = checks.find_issues(t, RAW)
    assert [i.code for i in issues] == ["missing_items"] and "Intern at Beta" in issues[0].message


def test_quote_in_cv():
    t = tailored()
    assert checks.quote_in_cv("cut inference latency by 40%", t)
    assert not checks.quote_in_cv("Kubernetes expert", t)
    assert not checks.quote_in_cv("", t)
