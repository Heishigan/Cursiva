"""One way to call a model: a prompt file, a user message of tagged data, a strict schema."""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import date
from functools import lru_cache
from pathlib import Path

from langchain_openai import ChatOpenAI


logger = logging.getLogger(__name__)

PROMPTS = Path(__file__).resolve().parent / "prompts"
TIMEOUT_S = float(os.environ.get("LLM_TIMEOUT_S", "90"))
MAX_RETRIES = int(os.environ.get("LLM_MAX_RETRIES", "2"))


def model_name(step: str = "") -> str:
    """The writer model, or for the fact-check steps PIPELINE_V2_CHECK_MODEL
    when set, so the checker doesn't have to be the model that wrote the text."""
    if step == "verify" and os.environ.get("PIPELINE_V2_CHECK_MODEL", "").strip():
        return os.environ["PIPELINE_V2_CHECK_MODEL"].strip()
    return os.environ.get("PIPELINE_V2_MODEL", "gpt-5.1").strip()


def _takes_temperature(model: str) -> bool:
    # Reasoning models (GPT-5 family, o-series) only accept the default temperature.
    m = model.lower()
    return not (m.startswith("gpt-5") or m.startswith("o1") or m.startswith("o3") or m.startswith("o4"))


JUDGE_STEPS = ("analysis", "verify")


def reasoning_effort(model: str, step: str = "") -> str | None:
    """GPT-5.1 doesn't reason unless asked. The judgement steps (reading the ad,
    fact-checking) use PIPELINE_V2_JUDGE_REASONING (default medium); the writing
    steps use PIPELINE_V2_REASONING (default low). Values: none, low, medium, high.
    Only reasoning models take it."""
    if _takes_temperature(model):
        return None
    if step in JUDGE_STEPS:
        effort = os.environ.get("PIPELINE_V2_JUDGE_REASONING", "medium")
    else:
        effort = os.environ.get("PIPELINE_V2_REASONING", "low")
    return effort.strip().lower() or None


def today() -> str:
    return date.today().isoformat()


@lru_cache(maxsize=None)
def prompt(name: str) -> str:
    return (PROMPTS / f"{name}.txt").read_text(encoding="utf-8").strip()


def tag(name: str, body: str) -> str:
    return f"<{name}>\n{(body or '').strip() or '(none)'}\n</{name}>"


def call(schema, prompt_name: str, user: str, api_key: str, temperature: float, config=None):
    """Call the model and return the parsed object.

    The raw reply is kept as well, so the logs always show why the model
    stopped and how many tokens it wrote."""
    model = model_name(prompt_name)
    system = prompt(prompt_name)
    effort = reasoning_effort(model, prompt_name)
    kwargs = {"temperature": temperature} if _takes_temperature(model) else {}
    if effort:
        kwargs["reasoning_effort"] = effort
    llm = ChatOpenAI(model=model, api_key=api_key, timeout=TIMEOUT_S if _takes_temperature(model) else max(TIMEOUT_S, 240.0),
                     max_retries=MAX_RETRIES, **kwargs)
    chain = llm.with_structured_output(schema, method="json_schema", strict=True, include_raw=True)
    t0 = time.monotonic()
    out = chain.invoke([("system", system), ("user", user)], config=config)
    seconds = round(time.monotonic() - t0, 2)

    raw = out.get("raw") if isinstance(out, dict) else None
    parsed = out.get("parsed") if isinstance(out, dict) else out
    error = out.get("parsing_error") if isinstance(out, dict) else None
    meta = getattr(raw, "response_metadata", {}) or {}
    usage = meta.get("token_usage") or {}
    refusal = (getattr(raw, "additional_kwargs", {}) or {}).get("refusal")
    facts = {
        "step": prompt_name, "model": meta.get("model_name") or model,
        "temperature": temperature if _takes_temperature(model) else "model default",
        "reasoning_effort": effort,
        "reasoning_tokens": (usage.get("completion_tokens_details") or {}).get("reasoning_tokens"),
        "finish_reason": meta.get("finish_reason"), "input_tokens": usage.get("prompt_tokens"),
        "output_tokens": usage.get("completion_tokens"), "seconds": seconds,
        "refused": bool(refusal), "parse_error": type(error).__name__ if error else None,
    }
    logger.info("v2_call %s", json.dumps(facts))

    if error is not None or parsed is None:
        raise RuntimeError(f"{prompt_name}: the model's reply could not be read "
                           f"(finish_reason={facts['finish_reason']}, refused={facts['refused']})")
    return parsed
