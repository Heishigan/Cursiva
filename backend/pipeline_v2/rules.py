"""Deterministic checks: plain Python, free, same answer every time.

They only check what can be matched: IDs, numbers, technical terms, wording
copied from the ad, language and a short list of stock phrases. Meaning is
left to the AI check (verify.py)."""
from __future__ import annotations

import re

# Prose dashes become commas. An en dash straight after a number is a range
# ("2024 – 2026", "Jul 2026 – Present") and is left alone.
EM_DASH_RE = re.compile(r"\s*(?:—|(?<![\d\s])–(?=\s)|(?<!\d)\s–(?=\s)|(?<!-)---(?!-))\s*")

# Words that are common in both languages and say nothing about the topic.
_SV = set("och att jag är det som en på för med av till den har inte ett vi ni er ert era min mitt mina "
          "du din ditt dina han hon de dem vår vårt våra kan ska vill har hade var blir från också".split())
_EN = set("and the to of is that for with on as it are this be have my i you your our was were will "
          "can from also an in at by not".split())
_EN.discard("i")  # "i" is an everyday Swedish preposition too, so it can't vote for English

SV_GREETINGS = ("hej", "hejsan", "bästa", "till ", "god dag")
EN_GREETINGS = ("dear", "hello", "hi ", "hi,", "to ", "good ")

# A short, generic list of stock phrases that read as filler in any letter.
STOCK_PHRASES = {
    "en": ["i am passionate about", "i'm passionate about", "i am excited to", "i'm excited to", "thrilled",
           "cutting-edge", "cutting edge", "leverage", "synergy", "fast-paced", "dynamic team",
           "eager to contribute", "perfect fit", "aligns perfectly"],
    "sv": ["brinner för", "passionerad", "perfekt match", "matchar perfekt", "dynamiskt team"],
}

# A sentence with no source may express interest or link ideas, but not claim
# experience. These patterns catch the common shapes of an experience claim.
_CLAIM_PATTERNS = {
    "en": re.compile(r"\b(i have|i've|i had|i built|i led|i developed|i designed|i managed|i worked|i ran|"
                     r"i created|i delivered|my experience|experience (with|in|of)|i am experienced|"
                     r"i'm experienced|years of)\b", re.I),
    "sv": re.compile(r"\b(jag har|jag hade|jag byggde|jag ledde|jag utvecklade|jag designade|jag arbetade|"
                     r"jag skapade|min erfarenhet|erfarenhet (av|inom)|års erfarenhet)\b", re.I),
}
# Availability and start dates may only come from the user's notes.
_AVAILABILITY = re.compile(r"\b(start immediately|available (to start|from|immediately|now)|can start|"
                           r"notice period|kan börja|tillgänglig (från|omgående|direkt)|tillträde|"
                           r"uppsägningstid)\b", re.I)

# Everyday abbreviations written with dots. They look like "Next.js" to the
# term check but name nothing, so they are never treated as technical terms.
_ABBREVIATIONS = {"e.g", "i.e", "etc", "vs", "approx", "t.ex", "bl.a", "d.v.s", "m.m", "m.fl", "o.s.v",
                  "fr.o.m", "t.o.m", "s.k", "p.g.a", "f.d", "ca", "dvs", "osv", "resp"}

_NUM_RE = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)?")
_WORD_RE = re.compile(r"[a-zåäöéü0-9]+")


def fix_dashes(text: str) -> str:
    return re.sub(r"\s+,", ",", EM_DASH_RE.sub(", ", text or "")).strip()


def numbers(text: str) -> set[str]:
    return {n.replace(",", ".") for n in _NUM_RE.findall(text or "")}


def terms(text: str) -> set[str]:
    """Technical-looking terms: words with an inner capital, all caps, digits or
    symbols (LangGraph, AWS, C#, Next.js, GPT-4), plus capitalised words that
    don't start a sentence (Django, Kubernetes)."""
    out = set()
    for sent in re.split(r"(?<=[.!?:;])\s+|\n", text or ""):
        tokens = re.findall(r"[A-Za-zÅÄÖåäöÉé0-9][\w.+#/-]*[\w+#]|[A-Za-z0-9]", sent)
        for i, tok in enumerate(tokens):
            # A hyphenated word ("Python-based", "AI-driven") is judged part by part.
            for t in tok.strip(".-/").split("-"):
                t = t.strip(".-/")
                if len(t) < 2 or t.lower() in _ABBREVIATIONS:
                    continue
                inner_cap = any(c.isupper() for c in t[1:])
                special = any(c in t for c in "#+.") or any(c.isdigit() for c in t)
                mid_cap = i > 0 and t[0].isupper()
                if inner_cap or special or mid_cap:
                    out.add(t.lower())
    return out


def new_numbers(text: str, source: str) -> list[str]:
    return sorted(numbers(text) - numbers(source))


def new_terms(text: str, source: str) -> list[str]:
    low = (source or "").lower()
    return sorted(t for t in terms(text) if t not in low)


def words(text: str) -> list[str]:
    return _WORD_RE.findall((text or "").lower())


def ngrams(text: str, n: int) -> set[tuple]:
    w = words(text)
    return {tuple(w[i:i + n]) for i in range(len(w) - n + 1)}


def copied_from_ad(text: str, ad: str, source: str, n: int = 5) -> list[str]:
    grams = (ngrams(text, n) & ngrams(ad, n)) - ngrams(source, n)
    return sorted(" ".join(g) for g in grams)


def language(text: str) -> str:
    w = words(text)
    sv = sum(x in _SV for x in w)
    en = sum(x in _EN for x in w)
    if sv == en == 0:
        return "?"
    return "sv" if sv > en else "en"


def greeting_language(greeting: str) -> str:
    g = (greeting or "").strip().lower()
    if g.startswith(SV_GREETINGS):
        return "sv"
    if g.startswith(EN_GREETINGS):
        return "en"
    return "?"


def stock_phrases(text: str, lang: str) -> list[str]:
    low = (text or "").lower()
    return [p for p in STOCK_PHRASES.get(lang, []) if p in low]


def claims_experience(text: str, lang: str) -> bool:
    return bool(_CLAIM_PATTERNS.get(lang, _CLAIM_PATTERNS["en"]).search(text or ""))


def mentions_availability(text: str) -> bool:
    return bool(_AVAILABILITY.search(text or ""))
