"""
Pit lane time loss (seconds) per circuit.
Values are approximate averages from recent seasons.
Falls back to DEFAULT_PIT_LOSS when a circuit is not in this dict.
"""

DEFAULT_PIT_LOSS = 25.0

# Keys are FastF1 circuit location names (session.event["Location"])
PIT_LANE_LOSS: dict[str, float] = {
    "Bahrain":      23.0,
    "Jeddah":       24.5,
    "Melbourne":    24.0,
    "Baku":         22.0,
    "Miami":        24.5,
    "Monaco":       28.0,
    "Barcelona":    24.0,
    "Silverstone":  23.5,
    "Monza":        23.0,
    "Singapore":    30.0,
    "Suzuka":       24.0,
    "Abu Dhabi":    24.0,
}

COMPOUNDS = {"SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"}
