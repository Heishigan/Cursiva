"""Token and cost accounting for a generation run."""
import os

# USD per 1M tokens (input, output). These are list prices as of mid-2025;
# override with LLM_PRICES="model:in:out,model:in:out" if they change.
_DEFAULT_PRICES = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
}


def _prices() -> dict:
    prices = dict(_DEFAULT_PRICES)
    for entry in filter(None, (os.environ.get("LLM_PRICES") or "").split(",")):
        try:
            model, inp, out = entry.split(":")
            prices[model.strip()] = (float(inp), float(out))
        except ValueError:
            continue
    return prices


def _price_for(model: str, prices: dict):
    # Versioned names like "gpt-4o-2024-08-06" use the longest matching base model.
    for base in sorted(prices, key=len, reverse=True):
        if model == base or model.startswith(base + "-"):
            return prices[base]
    return None


def usage_to_metrics(usage_metadata: dict) -> dict:
    """{model: {input_tokens, output_tokens}} -> {prompt_tokens, completion_tokens, cost_usd}."""
    prices = _prices()
    pt = ct = 0
    cost = 0.0
    unknown = False
    for model, u in (usage_metadata or {}).items():
        i, o = int(u.get("input_tokens") or 0), int(u.get("output_tokens") or 0)
        pt += i
        ct += o
        p = _price_for(model, prices)
        if p is None:
            unknown = True
        else:
            cost += i / 1e6 * p[0] + o / 1e6 * p[1]
    return {"prompt_tokens": pt, "completion_tokens": ct, "cost_usd": None if unknown else round(cost, 6)}
