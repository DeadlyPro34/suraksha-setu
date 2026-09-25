"""
Road-status agent (REAL).

Ingests map data (simulated OSM query) and uses an LLM to assess
which roads are likely blocked based on standard flood vulnerability.
"""

import json
from typing import Any, Dict
from groq import Groq
from geoalchemy2.shape import to_shape

from app.agents.base import BaseAgent
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.report import Report

class RoadAgent(BaseAgent):
    name = "road_agent"

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
            
        # Simulated road data from a map API (e.g. OpenStreetMap / Google Maps)
        # In a real scenario, this would query Overpass API or similar for roads near (lat, lon)
        nearby_roads = [
            {"name": "Local Road A", "type": "primary", "elevation": "low"},
            {"name": "Highway B", "type": "highway", "elevation": "medium"},
            {"name": "Street C", "type": "secondary", "elevation": "very_low"},
            {"name": "Bridge D", "type": "flyover", "elevation": "high"}
        ]

        # Default fallback values
        status = "partial"
        blocked_segments = ["unknown"]
        
        if settings.GROQ_API_KEY:
            try:
                client = Groq(api_key=settings.GROQ_API_KEY)
                prompt = f"""
                You are a road traffic analysis agent during a flood emergency at coordinates (lat {lat}, lon {lon}).
                Based on the following nearby roads and their elevation profiles, estimate which roads are likely to be completely blocked by flooding.
                
                Nearby roads: {json.dumps(nearby_roads)}
                
                Return EXACTLY a JSON object in this format (no other text):
                {{"status": "clear|partial|blocked", "blocked_segments": ["road name 1", "road name 2"]}}
                """
                chat_completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama3-8b-8192", # Fast and capable
                    response_format={"type": "json_object"}
                )
                
                # Parse LLM output
                result_str = chat_completion.choices[0].message.content
                result = json.loads(result_str)
                status = result.get("status", status)
                blocked_segments = result.get("blocked_segments", blocked_segments)
            except Exception as e:
                print(f"Error calling LLM in RoadAgent: {e}")
                
        return {
            "status": status,
            "blocked_segments": blocked_segments,
            "raw_roads": nearby_roads
        }
