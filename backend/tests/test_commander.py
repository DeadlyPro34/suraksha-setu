from langchain_core.runnables import RunnableLambda

from app.agents import commander


class FakeChatGroq:
    def __init__(self, **_kwargs):
        pass

    def with_structured_output(self, schema):
        return RunnableLambda(
            lambda _messages: schema(
                priority_score=7.5,
                summary="Check the reported flood area and coordinate available response teams.",
            )
        )


def test_langchain_groq_coordinator_returns_validated_response(monkeypatch):
    monkeypatch.setattr(commander.settings, "GROQ_API_KEY", "unit-test-key")
    monkeypatch.setattr(commander, "ChatGroq", FakeChatGroq)

    score, summary = commander._coordinate_with_groq({"flood_agent": {"severity": "high"}})

    assert score == 7.5
    assert summary == "Check the reported flood area and coordinate available response teams."
