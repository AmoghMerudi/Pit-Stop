import logging

import numpy as np
import pandas as pd

from constants import COMPOUNDS

logger = logging.getLogger(__name__)

MIN_LAPS_FOR_FIT = 5


def compute_delta(laps_df: pd.DataFrame) -> pd.DataFrame:
    """
    Add a `lap_time_delta` column — lap time minus that driver's median lap
    time for that stint. Normalizes pace differences between drivers.
    """
    df = laps_df.copy()
    medians = df.groupby(["driver", "stint"])["lap_time"].transform("median")
    df["lap_time_delta"] = df["lap_time"] - medians
    return df


def fit_curve(laps_df: pd.DataFrame, compound: str) -> dict:
    """
    Fit a linear degradation curve for one compound.
    Returns { slope, intercept, r2 }.
    Raises ValueError if compound is unknown or has fewer than MIN_LAPS_FOR_FIT rows.
    """
    if compound not in COMPOUNDS:
        raise ValueError(f"Unknown compound: {compound}")

    subset = laps_df[laps_df["compound"] == compound]
    if len(subset) < MIN_LAPS_FOR_FIT:
        raise ValueError(
            f"Insufficient data for {compound} — fewer than {MIN_LAPS_FOR_FIT} laps available"
        )

    x = subset["tyre_age"].to_numpy(dtype=float)
    y = subset["lap_time_delta"].to_numpy(dtype=float)

    coeffs = np.polyfit(x, y, 1)
    slope, intercept = float(coeffs[0]), float(coeffs[1])

    y_pred = slope * x + intercept
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    if r2 < 0.5:
        logger.warning("Low R² for %s: %.2f", compound, r2)

    return {"slope": slope, "intercept": intercept, "r2": r2}


def fit_all_compounds(laps_df: pd.DataFrame) -> dict[str, dict]:
    """
    Run fit_curve for every compound present in the DataFrame.
    Skips compounds with insufficient data (logs warning, does not raise).
    """
    if "lap_time_delta" not in laps_df.columns:
        laps_df = compute_delta(laps_df)

    curves: dict[str, dict] = {}
    for compound in laps_df["compound"].unique():
        try:
            curves[compound] = fit_curve(laps_df, compound)
        except ValueError as exc:
            logger.warning("Skipping %s: %s", compound, exc)

    return curves


def predict_delta(compound: str, age: int, curves: dict[str, dict]) -> float:
    """
    Predict the lap time delta at a given tyre age using a pre-fitted curve.
    Raises KeyError if the compound has no curve.
    """
    if compound not in curves:
        raise KeyError(f"No degradation curve available for {compound}")
    c = curves[compound]
    return c["slope"] * age + c["intercept"]
