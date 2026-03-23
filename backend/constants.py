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

# Fuel correction: F1 cars carry ~110kg of fuel, each kg adds ~0.03s per lap
FUEL_LOAD_KG = 110.0
FUEL_EFFECT_PER_LAP_KG = 0.03  # seconds slower per kg of fuel
FUEL_CONSUMPTION_KG_PER_LAP = 1.8  # approximate kg burned per lap

# Maps (year, round_number) -> circuit location name matching PIT_LANE_LOSS keys.
# Used by the live strategy endpoint to determine pit loss without loading a FastF1 session.
ROUND_TO_CIRCUIT: dict[tuple[int, int], str] = {
    # 2024
    (2024, 1): "Bahrain", (2024, 2): "Jeddah", (2024, 3): "Melbourne",
    (2024, 4): "Suzuka", (2024, 5): "Baku", (2024, 6): "Miami",
    (2024, 7): "Monaco", (2024, 8): "Barcelona", (2024, 9): "Montreal",
    (2024, 10): "Spielberg", (2024, 11): "Silverstone", (2024, 12): "Budapest",
    (2024, 13): "Spa", (2024, 14): "Zandvoort", (2024, 15): "Monza",
    (2024, 16): "Baku", (2024, 17): "Singapore", (2024, 18): "Austin",
    (2024, 19): "Mexico City", (2024, 20): "Sao Paulo", (2024, 21): "Las Vegas",
    (2024, 22): "Lusail", (2024, 23): "Abu Dhabi",
    # 2025
    (2025, 1): "Melbourne", (2025, 2): "Bahrain", (2025, 3): "Jeddah",
    (2025, 4): "Suzuka", (2025, 5): "Baku", (2025, 6): "Miami",
    (2025, 7): "Monaco", (2025, 8): "Barcelona", (2025, 9): "Montreal",
    (2025, 10): "Silverstone", (2025, 11): "Budapest", (2025, 12): "Spa",
    (2025, 13): "Zandvoort", (2025, 14): "Monza", (2025, 15): "Singapore",
    (2025, 16): "Austin", (2025, 17): "Mexico City", (2025, 18): "Sao Paulo",
    (2025, 19): "Las Vegas", (2025, 20): "Lusail", (2025, 21): "Abu Dhabi",
    # 2026 (provisional — update when calendar is confirmed)
    (2026, 1): "Melbourne", (2026, 2): "Bahrain", (2026, 3): "Jeddah",
    (2026, 4): "Suzuka", (2026, 5): "Miami", (2026, 6): "Monaco",
    (2026, 7): "Barcelona", (2026, 8): "Silverstone", (2026, 9): "Montreal",
    (2026, 10): "Spielberg", (2026, 11): "Budapest", (2026, 12): "Spa",
    (2026, 13): "Zandvoort", (2026, 14): "Monza", (2026, 15): "Baku",
    (2026, 16): "Singapore", (2026, 17): "Austin", (2026, 18): "Mexico City",
    (2026, 19): "Sao Paulo", (2026, 20): "Las Vegas", (2026, 21): "Lusail",
    (2026, 22): "Abu Dhabi",
}


def get_circuit_for_round(year: int, round_number: int) -> str | None:
    """Return the circuit location name for a given year/round, or None if unknown."""
    return ROUND_TO_CIRCUIT.get((year, round_number))
