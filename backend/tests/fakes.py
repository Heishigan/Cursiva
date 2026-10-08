"""Fake structured-output LLMs that record the rendered prompt."""
from langchain_core.runnables import RunnableLambda


class Recorder:
    def __init__(self):
        self.prompts = []

    def factory(self, make_result):
        def _get(_api_key):
            def _run(prompt_value):
                self.prompts.append(prompt_value.to_string())
                return make_result(prompt_value)
            return RunnableLambda(_run)
        return _get

    @property
    def last(self):
        return self.prompts[-1]
