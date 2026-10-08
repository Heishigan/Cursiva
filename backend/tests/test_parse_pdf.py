import fitz

from core.models import FullCVData, PersonalInfo


def _pdf(text):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    return doc.tobytes()


class _FakeLLM:
    def __init__(self, *a, **k):
        pass

    def with_structured_output(self, schema):
        from langchain_core.runnables import RunnableLambda
        return RunnableLambda(lambda pv: FullCVData(personal_info=PersonalInfo(name="Ada"), professional_summary="s", sections=[]))


def test_parse_pdf_happy_path(client, app_module, monkeypatch):
    monkeypatch.setattr(app_module, "ChatOpenAI", _FakeLLM)
    r = client.post("/api/parse_pdf", files={"file": ("cv.PDF", _pdf("Ada Lovelace"), "application/pdf")})
    assert r.status_code == 200 and r.json()["parsed_data"]["personal_info"]["name"] == "Ada"


def test_parse_pdf_rejects_oversized_file(client, app_module):
    big = b"%PDF-1.4\n" + b"0" * (app_module.MAX_PDF_SIZE_BYTES + 10)
    r = client.post("/api/parse_pdf", files={"file": ("cv.pdf", big, "application/pdf")})
    assert r.status_code == 413


def test_parse_pdf_rejects_too_much_text(client, app_module, monkeypatch):
    monkeypatch.setattr(app_module, "MAX_CV_TEXT_CHARS", 5)
    monkeypatch.setattr(app_module, "ChatOpenAI", _FakeLLM)
    r = client.post("/api/parse_pdf", files={"file": ("cv.pdf", _pdf("much more than five chars"), "application/pdf")})
    assert r.status_code == 413
