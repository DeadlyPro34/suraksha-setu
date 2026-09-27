"""Run the domain agents and use Groq to coordinate their response plan."""

import json
import logging
import math
import re
from typing import Any, Dict

from groq import Groq

from app.agents.flood_agent import FloodAgent
from app.agents.road_agent import RoadAgent
from app.agents.shelter_agent import ShelterAgent
from app.agents.resource_agent import ResourceAgent
from app.agents.misinformation_agent import MisinformationAgent
from app.core.config import settings


logger = logging.getLogger(__name__)
_MODEL = "openai/gpt-oss-20b"
_FALLBACK_SCORE = 5.0
_FALLBACK_SUMMARY = "Unable to generate AI summary — manual review required"
_AGENT_KEYS = (
    "flood_agent",
    "road_agent",
    "shelter_agent",
    "resource_agent",
    "misinformation_agent",
)

# Pre-instantiate agents (stateless, safe to reuse)
_agents = [
    FloodAgent(),
    RoadAgent(),
    ShelterAgent(),
    ResourceAgent(),
    MisinformationAgent(),
]


def _coordinate_with_groq(agent_outputs: Dict[str, Any]) -> tuple[float, str]:
    """Ask Groq to assess the mocked domain-agent findings safely."""
    if not settings.GROQ_API_KEY:
        logger.info("Commander Groq call unavailable (GROQ_API_KEY is not configured); using fallback")
        return _FALLBACK_SCORE, _FALLBACK_SUMMARY

    structured_findings = {
        key: agent_outputs.get(key, {"status": "no output"})
        for key in _AGENT_KEYS
    }
    prompt = "Agent findings (JSON):\n" + json.dumps(
        structured_findings, ensure_ascii=False, sort_keys=True, default=str
    )

    try:
        logger.info("Commander Groq request fired (model=%s)", _MODEL)
        client = Groq(api_key=settings.GROQ_API_KEY, timeout=10.0, max_retries=0)
        response = client.chat.completions.create(
            model=_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Act as a disaster response coordinator. Use only the supplied agent findings; "
                        "do not invent locations, teams, resources, or ETAs. Return a priority_score "
                        "from 0 to 10 and a concise, actionable summary. The summary must be "
                        "no more than 2 sentences and under 40 words. "
                        "Higher scores mean greater urgency."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "disaster_response_plan",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "priority_score": {"type": "number"},
                            "summary": {"type": "string"},
                        },
                        "required": ["priority_score", "summary"],
                        "additionalProperties": False,
                    },
                },
            },
            temperature=0.2,
            max_completion_tokens=800,
        )
        raw_content = response.choices[0].message.content or ""
        logger.info("Commander Groq raw response: %s", raw_content)
        result = json.loads(raw_content)
        score = float(result["priority_score"])
        summary = result["summary"]
        if not math.isfinite(score) or not 0 <= score <= 10:
            raise ValueError("priority_score must be a finite number from 0 to 10")
        if not isinstance(summary, str) or not summary.strip():
            raise ValueError("summary must be a non-empty string")
        # Keep the requested concise summary contract even if a response slips
        # past the structured-output constraints.
        sentence_count = len(
            [sentence for sentence in re.split(r"(?<=[.!?])\s+", summary.strip()) if sentence]
        )
        if sentence_count > 2:
            raise ValueError("summary must contain at most two sentences")
        if len(summary.split()) >= 40:
            raise ValueError("summary must contain fewer than 40 words")
        return score, summary.strip()
    except Exception as exc:
        # Avoid logging exception text that could contain request details or
        # credentials; the exception class still identifies the failure mode.
        logger.info("Commander Groq fallback triggered (%s)", type(exc).__name__)
        return _FALLBACK_SCORE, _FALLBACK_SUMMARY


def generate_response_plan(incident_id: str) -> Dict[str, Any]:
    """Run all five agents and return a coordinated response-plan dict."""
    raw_outputs: Dict[str, Any] = {}
    for agent in _agents:
        if isinstance(agent, RoadAgent):
            flood_output = raw_outputs.get("flood_agent", {})
            raw_outputs[agent.name] = agent.run(
                incident_id,
                flood_severity=flood_output.get("severity"),
            )
        elif isinstance(agent, ResourceAgent):
            raw_outputs[agent.name] = agent.run(
                incident_id,
                shelter_output=raw_outputs.get("shelter_agent", {}),
            )
        else:
            raw_outputs[agent.name] = agent.run(incident_id)

    priority, summary = _coordinate_with_groq(raw_outputs)

    return {
        "incident_id": incident_id,
        "priority_score": priority,
        "summary": summary,
        "raw_agent_outputs": raw_outputs,
    }
