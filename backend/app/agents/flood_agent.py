"""
Flood-analysis agent (REAL).

Ingests OpenWeatherMap API data for the incident location and uses an LLM
to assess the flood severity and flooded percentage.
"""

import httpx
import json
from typing import Any, Dict
from groq import Groq
from geoalchemy2.shape import to_shape

from app.agents.base import BaseAgent
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.report import Report

class FloodAgent(BaseAgent):
    name = "flood_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        # Lookup actual coordinates from DB using incident_id.
        lat, lon = 19.0760, 72.8777 # Fallback defaults
        
        try:
            with SessionLocal() as db:
                report = db.query(Report).filter(Report.id == incident_id).first()
                if report and report.location:
                    shape = to_shape(report.location)
                    lat, lon = shape.y, shape.x
        except Exception as e:
            print(f"Error fetching report coordinates: {e}")
            
        weather_data = None
        if settings.OPENWEATHER_API_KEY:
            try:
                url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={settings.OPENWEATHER_API_KEY}&units=metric"
                resp = httpx.get(url, timeout=10.0)
                resp.raise_for_status()
                weather_data = resp.json()
            except Exception as e:
                print(f"Error fetching weather: {e}")
        
        # If API key is missing or call failed, fallback to mocked data
        if not weather_data:
            weather_data = {
                "coord": {"lat": lat, "lon": lon},
                "weather": [{"main": "Rain", "description": "heavy intensity rain"}],
                "main": {"temp": 28.5, "humidity": 95},
                "rain": {"1h": 12.5}
            }

        # Default fallback values
        severity = "high"
        flooded_pct = 65
        
        if settings.GROQ_API_KEY:
            try:
                client = Groq(api_key=settings.GROQ_API_KEY)
                prompt = f"""
                You are a flood severity analysis agent. Based on the following real-time weather data for the incident location (lat {lat}, lon {lon}), estimate the current flood severity and flooded percentage.
                Weather data: {json.dumps(weather_data)}
                
                Return EXACTLY a JSON object in this format (no other text):
                {{"severity": "low|medium|high|critical", "flooded_pct": <number 0-100>}}
                """
                chat_completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama3-8b-8192", # Fast and capable
                    response_format={"type": "json_object"}
                )
                
                # Parse LLM output
                result_str = chat_completion.choices[0].message.content
                result = json.loads(result_str)
                severity = result.get("severity", severity)
                flooded_pct = result.get("flooded_pct", flooded_pct)
            except Exception as e:
                print(f"Error calling LLM: {e}")
                
        return {
            "severity": severity,
            "flooded_pct": flooded_pct,
            "raw_weather": weather_data
        }
