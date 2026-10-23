"""CV templates: every template renders the same CV data, and /api/compile_cv
picks the template the client asks for."""
import json
import os
import shutil
import subprocess

import jinja2
import pytest

import cv_templates

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES = os.path.join(os.path.dirname(HERE), "templates")
SAMPLE = json.load(open(os.path.join(HERE, "fixtures", "sample_cv.json"), encoding="utf-8"))


def _render(template_id: str) -> str:
    import main
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(TEMPLATES))
    return env.get_template(cv_templates.template_file(template_id)).render(**main._escape_data(SAMPLE))


@pytest.mark.parametrize("template_id", list(cv_templates.CV_TEMPLATE_FILES))
def test_every_template_renders_all_cv_content(template_id):
    tex = _render(template_id)
    assert "Gutierrez" in tex
    assert "Texas A\\&M University" in tex  # escaped user text
    for section in SAMPLE["sections"]:
        assert section["title"] in tex
        for item in section["items"]:
            assert item["title"] in tex
            for bullet in item["bullets"]:
                if section["type"] != "skills":
                    assert bullet.replace("&", "\\&").replace("%", "\\%") in tex
    assert "{%" not in tex and "personal_info" not in tex  # no unrendered Jinja left behind


def test_unknown_template_id_falls_back_to_classic():
    assert cv_templates.template_file(None) == "cv_template.tex"
    assert cv_templates.template_file("nope") == "cv_template.tex"


def test_compile_rejects_unknown_template(client):
    body = {**SAMPLE, "template": "comic-sans"}
    assert client.post("/api/compile_cv", json=body).status_code == 422


def test_compile_uses_requested_template(client, monkeypatch):
    import main
    seen = {}

    def fake_run(cmd, cwd=None, **kw):
        seen["tex"] = open(os.path.join(cwd, "cv.tex"), encoding="utf-8").read()
        open(os.path.join(cwd, "cv.pdf"), "wb").write(b"%PDF-1.4 fake")
        return subprocess.CompletedProcess(cmd, 0, b"", b"")

    monkeypatch.setattr(main.subprocess, "run", fake_run)
    r = client.post("/api/compile_cv", json={**SAMPLE, "template": "signature"})
    assert r.status_code == 200
    assert "lato" in seen["tex"] and "Signature" in seen["tex"]
    r = client.post("/api/compile_cv", json=SAMPLE)  # no template -> classic
    assert r.status_code == 200 and "lmodern" in seen["tex"]


def _have_fonts():
    if not shutil.which("pdflatex") or not shutil.which("pdftotext"):
        return False
    for sty in ("lato.sty", "sourcesanspro.sty", "ebgaramond.sty", "FiraSans.sty", "sourcecodepro.sty"):
        if not subprocess.run(["kpsewhich", sty], capture_output=True, text=True).stdout.strip():
            return False
    return True


@pytest.mark.skipif(not _have_fonts(), reason="needs pdflatex and the texlive-fonts-extra package (as in the Docker image)")
@pytest.mark.parametrize("template_id", list(cv_templates.CV_TEMPLATE_FILES))
def test_template_pdf_text_reads_in_order(template_id, tmp_path):
    """What an applicant tracking system sees: plain text, every section, in order."""
    (tmp_path / "cv.tex").write_text(_render(template_id), encoding="utf-8")
    for _ in range(2):
        subprocess.run(["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "cv.tex"],
                       cwd=tmp_path, check=True, capture_output=True, timeout=120)
    text = subprocess.run(["pdftotext", str(tmp_path / "cv.pdf"), "-"], capture_output=True, text=True).stdout
    flat = " ".join(text.split()).lower()
    positions = [flat.find(s["title"].lower()) for s in SAMPLE["sections"]]
    assert all(p >= 0 for p in positions) and positions == sorted(positions)
    assert "jake" in flat and "gutierrez" in flat
    assert "developed a rest api using fastapi and postgresql" in flat
