"""Used only to label the nearest known city zone in agent output for readability.

Severity itself is computed from IMD's official rainfall classification (see
flood_agent.py), which is uniform nationwide — these zones do not carry
individual thresholds because no city-specific hydrological/drainage-capacity
data is available.
"""

FLOOD_PRONE_ZONES = [
    {"name": "Ahmedabad", "lat": 23.0225, "lon": 72.5714},
    {"name": "Vadodara", "lat": 22.3072, "lon": 73.1812},
    {"name": "Surat", "lat": 21.1702, "lon": 72.8311},
    {"name": "Rajkot", "lat": 22.3039, "lon": 70.8022},
    {"name": "Bhavnagar", "lat": 21.7645, "lon": 72.1519},
]
