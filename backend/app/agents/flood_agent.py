"""Analyze forecast precipitation for an incident location."""

import json
import logging
from typing import Any, Dict
from groq import Groq
from geoalchemy2.shape import to_shape

from app.agents.base import BaseAgent
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.report import Report
from app.services.ingestion.weather_service import get_precipitation_forecast


logger = logging.getLogger(__name__)

class FloodAgent(BaseAgent):
    name = "flood_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        # Lookup actual coordinates from DB using incident_id.
        lat, lon = 19.0760, 72.8777  # Mumbai fallback coordinates
        
        try:
            with SessionLocal() as db:
                report = db.query(Report).filter(Report.id == incident_id).first()
                if report and report.location:
                    shape = to_shape(report.location)
                    lat, lon = shape.y, shape.x
                else:
                    from app.models.incident import Incident
                    incident = db.query(Incident).filter(Incident.id == incident_id).first()
                    if incident and incident.location:
                        shape = to_shape(incident.location)
                        lat, lon = shape.y, shape.x
        except Exception as exc:
            logger.info("Could not load incident coordinates; using Mumbai defaults (%s)", type(exc).__name__)

        weather_data = get_precipitation_forecast(lat, lon)

        # Default fallback values
        severity = "high"
        flooded_pct = 65
        
        if settings.GROQ_API_KEY:
            try:
                client = Groq(api_key=settings.GROQ_API_KEY)
                prompt = f"""
                You are a flood severity analysis agent. Based on this Open-Meteo
                precipitation forecast for the incident location (lat {lat}, lon {lon}),
                estimate flood severity and flooded percentage. Do not claim flood extent
                is directly measured by precipitation. Forecast data: {json.dumps(weather_data)}
                
                Return EXACTLY a JSON object in this format (no other text):
                {{"severity": "low|medium|high|critical", "flooded_pct": <number 0-100>}}
                """
                chat_completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama-3.1-8b-instant",  # Existing flood-analysis model
                    response_format={"type": "json_object"}
                )
                
                # Parse LLM output
                result_str = chat_completion.choices[0].message.content
                result = json.loads(result_str)
                severity = result.get("severity", severity)
                flooded_pct = result.get("flooded_pct", flooded_pct)
            except Exception as exc:
                logger.info("Flood severity LLM unavailable; using default assessment (%s)", type(exc).__name__)
                
        return {
            "severity": severity,
            "flooded_pct": flooded_pct,
            "raw_weather": weather_data
        }
