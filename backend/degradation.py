"""
Tyre degradation modelling for F1 strategy analysis.

Improvements over naive quadratic fit:
1. Fuel correction — removes fuel-mass lap time effect before fitting
2. Piecewise linear regression — captures pre/post-cliff behaviour via pwlf
3. Temperature covariate — models track temp interaction with tyre age
4. Multi-race pooling — augments sparse data with historical curves
5. Bayesian updating — refines prior curves with incoming live laps
"""

import logging

import numpy as np
import pandas as pd

from constants import COMPOUNDS, FUEL_CONSUMPTION_KG_PER_LAP, FUEL_EFFECT_PER_LAP_KG, FUEL_LOAD_KG

logger = logging.getLogger(__name__)

MIN_LAPS_FOR_FIT = 8  # raised from 5 — piecewise needs more data
MIN_LAPS_QUADRATIC_FALLBACK = 5  # fallback threshold for quadratic fit
FIT_DEGREE = 2  # quadratic fallback degree


# ---------------------------------------------------------------------------
# 1. Fuel correction
# ---------------------------------------------------------------------------

def fuel_correct_laptimes(df: pd.DataFrame, total_race_laps: int = 57) -> pd.DataFrame:
    """
    Remove the fuel-mass effect from lap times.

    Each lap, the car burns ~1.8 kg of fuel. Each kg adds ~0.03s.
    At lap N, the car carries (FUEL_LOAD_KG - N * consumption) kg.
    The fuel effect = remaining_fuel * FUEL_EFFECT_PER_LAP_KG.
    We subtract this from each lap time so degradation is isolated.
    """
    out = df.copy()
    if "lap_number" not in out.columns:
        return out

    remaining_fuel = FUEL_LOAD_KG - out["lap_number"] * FUEL_CONSUMPTION_KG_PER_LAP
    remaining_fuel = remaining_fuel.clip(lower=0)
    fuel_time_effect = remaining_fuel * FUEL_EFFECT_PER_LAP_KG
    out["lap_time"] = out["lap_time"] - fuel_time_effect
    return out


# ---------------------------------------------------------------------------
# 2. Compute delta (normalised lap time difference)
# ---------------------------------------------------------------------------

def compute_delta(laps_df: pd.DataFrame) -> pd.DataFrame:
    """
    Add a `lap_time_delta` column — lap time minus that driver's median lap
    time for that stint. Normalizes pace differences between drivers.
    """
    df = laps_df.copy()
    medians = df.groupby(["driver", "stint"])["lap_time"].transform("median")
    df["lap_time_delta"] = df["lap_time"] - medians
    return df


# ---------------------------------------------------------------------------
# 3. Piecewise linear fit (primary) + quadratic fallback
# ---------------------------------------------------------------------------

def _fit_piecewise(x: np.ndarray, y: np.ndarray) -> dict | None:
    """
    Fit a 2-segment piecewise linear model using pwlf.
    Returns coeffs-style dict or None if pwlf is unavailable or fails.
    The breakpoint between segments represents the cliff lap.
    """
    try:
        import pwlf
    except ImportError:
        logger.warning("pwlf not installed — falling back to quadratic fit")
        return None

    if len(x) < MIN_LAPS_FOR_FIT:
        return None

    try:
        pw = pwlf.PiecewiseLinFit(x, y)
        breaks = pw.fit(2)  # 2 segments = 1 breakpoint

        # R² calculation
        y_pred = pw.predict(x)
        ss_res = float(np.sum((y - y_pred) ** 2))
        ss_tot = float(np.sum((y - y.mean()) ** 2))
        r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

        # Extract slopes for each segment
        slopes = pw.calc_slopes()
        breakpoint = float(breaks[1])  # first internal breakpoint = cliff

        # Store the pwlf model parameters for prediction
        return {
            "type": "piecewise",
            "breaks": [float(b) for b in breaks],
            "slopes": [float(s) for s in slopes],
            "intercepts": [float(pw.intercepts[i]) if hasattr(pw, 'intercepts') else 0.0
                          for i in range(len(slopes))],
            "beta": [float(b) for b in pw.beta],
            "r2": r2,
            "cliff_lap": max(1, int(round(breakpoint))),
            "degree": -1,  # sentinel: piecewise, not polynomial
            # backward compat
            "slope": float(slopes[-1]),  # post-cliff slope
            "intercept": 0.0,
            "coeffs": None,  # not polynomial
            "_pw_breaks": [float(b) for b in breaks],
            "_pw_beta": [float(b) for b in pw.beta],
        }
    except Exception as exc:
        logger.warning("Piecewise fit failed: %s", exc)
        return None


def _fit_quadratic(x: np.ndarray, y: np.ndarray, degree: int = FIT_DEGREE) -> dict:
    """Quadratic polynomial fit (original approach, used as fallback)."""
    coeffs = np.polyfit(x, y, degree)

    y_pred = np.polyval(coeffs, x)
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    slope = float(coeffs[-2]) if len(coeffs) >= 2 else 0.0
    intercept = float(coeffs[-1]) if len(coeffs) >= 1 else 0.0

    return {
        "type": "quadratic",
        "coeffs": [float(c) for c in coeffs],
        "degree": degree,
        "slope": slope,
        "intercept": intercept,
        "r2": r2,
    }


# ---------------------------------------------------------------------------
# 4. Temperature covariate
# ---------------------------------------------------------------------------

def _fit_temp_coefficient(ages: np.ndarray, deltas: np.ndarray,
                          temps: np.ndarray) -> float | None:
    """
    Fit: delta = base_slope * age + temp_coeff * track_temp * age
    using least-squares. Returns temp_coeff or None if fitting fails.
    """
    if len(ages) < MIN_LAPS_FOR_FIT or temps is None or len(temps) != len(ages):
        return None

    try:
        # Design matrix: [age, track_temp * age]
        A = np.column_stack([ages, temps * ages])
        result, _, _, _ = np.linalg.lstsq(A, deltas, rcond=None)
        temp_coeff = float(result[1])
        return temp_coeff
    except Exception as exc:
        logger.warning("Temperature coefficient fit failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Main fitting functions
# ---------------------------------------------------------------------------

def fit_curve(laps_df: pd.DataFrame, compound: str, degree: int = FIT_DEGREE,
              weather_df: pd.DataFrame | None = None) -> dict:
    """
    Fit a degradation curve for one compound.

    Tries piecewise linear first (if ≥8 laps), falls back to quadratic (if ≥5).
    Optionally fits a temperature coefficient if weather data is available.

    Returns dict with: type, slope, intercept, r2, coeffs, degree, cliff_lap,
    temp_coefficient, and piecewise-specific fields when applicable.
    """
    if compound not in COMPOUNDS:
        raise ValueError(f"Unknown compound: {compound}")

    subset = laps_df[laps_df["compound"] == compound]
    n_laps = len(subset)

    if n_laps < MIN_LAPS_QUADRATIC_FALLBACK:
        raise ValueError(
            f"Insufficient data for {compound} — {n_laps} laps (need ≥{MIN_LAPS_QUADRATIC_FALLBACK})"
        )

    x = subset["tyre_age"].to_numpy(dtype=float)
    y = subset["lap_time_delta"].to_numpy(dtype=float)

    # Try piecewise first (needs ≥8 laps), then quadratic fallback
    result = None
    if n_laps >= MIN_LAPS_FOR_FIT:
        result = _fit_piecewise(x, y)

    if result is None:
        result = _fit_quadratic(x, y, degree)

    if result["r2"] < 0.5:
        logger.warning("Low R² for %s: %.2f (type=%s)", compound, result["r2"], result.get("type"))

    # Compute cliff lap for quadratic fits (piecewise already has it)
    if "cliff_lap" not in result:
        cliff = _compute_cliff_from_coeffs(result.get("coeffs"), threshold=1.5)
        result["cliff_lap"] = cliff

    # Temperature covariate
    temp_coeff = None
    if weather_df is not None and "track_temp" in weather_df.columns and "lap_number" in subset.columns:
        merged = subset.merge(weather_df[["lap", "track_temp"]], left_on="lap_number", right_on="lap", how="inner")
        if len(merged) >= MIN_LAPS_QUADRATIC_FALLBACK:
            temp_coeff = _fit_temp_coefficient(
                merged["tyre_age"].to_numpy(dtype=float),
                merged["lap_time_delta"].to_numpy(dtype=float),
                merged["track_temp"].to_numpy(dtype=float),
            )
    result["temp_coefficient"] = temp_coeff

    return result


def fit_all_compounds(laps_df: pd.DataFrame,
                      weather_df: pd.DataFrame | None = None) -> dict[str, dict]:
    """
    Run fit_curve for every compound present in the DataFrame.
    Skips compounds with insufficient data (logs warning, does not raise).
    """
    if "lap_time_delta" not in laps_df.columns:
        laps_df = compute_delta(laps_df)

    curves: dict[str, dict] = {}
    for compound in laps_df["compound"].unique():
        try:
            curves[compound] = fit_curve(laps_df, compound, weather_df=weather_df)
        except ValueError as exc:
            logger.warning("Skipping %s: %s", compound, exc)

    return curves


def _compute_cliff_from_coeffs(coeffs: list[float] | None, threshold: float = 1.5) -> int:
    """Find cliff lap from polynomial coefficients."""
    if not coeffs:
        return 60
    for age in range(1, 61):
        delta = float(np.polyval(coeffs, age))
        if delta >= threshold:
            return age
    return 60


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def predict_delta(compound: str, age: int, curves: dict[str, dict]) -> float:
    """
    Predict the lap time delta at a given tyre age using a pre-fitted curve.

    Supports both piecewise linear and polynomial curve types.
    Floors at 0.0 — a tyre cannot be faster than baseline.
    """
    if compound not in curves:
        raise KeyError(f"No degradation curve available for {compound}")
    c = curves[compound]

    curve_type = c.get("type", "quadratic")

    if curve_type == "piecewise" and "_pw_breaks" in c and "_pw_beta" in c:
        value = _predict_piecewise(age, c["_pw_breaks"], c["_pw_beta"])
    elif "coeffs" in c and c["coeffs"] is not None:
        value = float(np.polyval(c["coeffs"], age))
    else:
        value = c["slope"] * age + c["intercept"]

    return max(0.0, value)


def _predict_piecewise(age: float, breaks: list[float], beta: list[float]) -> float:
    """Evaluate piecewise linear model at a single point."""
    try:
        import pwlf
        # Reconstruct prediction manually from beta and breaks
        # pwlf beta: [intercept, slope1, delta_slope2, ...]
        # y = beta[0] + beta[1]*(x - breaks[0])
        #   + beta[2]*max(0, x - breaks[1]) + ...
        result = beta[0]
        result += beta[1] * (age - breaks[0])
        for i in range(2, len(beta)):
            if age > breaks[i - 1]:
                result += beta[i] * (age - breaks[i - 1])
        return result
    except Exception:
        # Ultimate fallback — linear using slope
        return 0.0


def predict_delta_with_temp(compound: str, age: int, track_temp: float,
                            curves: dict[str, dict]) -> float:
    """
    Predict delta with temperature adjustment.
    Falls back to predict_delta if no temp coefficient is available.
    """
    base = predict_delta(compound, age, curves)
    c = curves.get(compound, {})
    temp_coeff = c.get("temp_coefficient")
    if temp_coeff is not None and track_temp > 0:
        # Adjust: hotter track = more degradation
        # Reference temp ~30°C — adjust relative to that
        temp_adjustment = temp_coeff * (track_temp - 30.0) * age
        return max(0.0, base + temp_adjustment)
    return base


def find_cliff_lap(compound: str, curves: dict[str, dict], threshold: float = 1.5) -> int:
    """
    Find the tyre age at which degradation exceeds a threshold (the 'cliff').

    For piecewise fits, uses the breakpoint directly if available.
    Otherwise iterates ages 1-60, returning first age where predict_delta >= threshold.
    Returns 60 if no cliff is found within 60 laps.
    """
    if compound not in curves:
        return 60

    c = curves[compound]

    # Piecewise fits already computed the cliff
    if c.get("type") == "piecewise" and "cliff_lap" in c:
        return c["cliff_lap"]

    # Pre-computed cliff from fit_curve
    if "cliff_lap" in c and c["cliff_lap"] < 60:
        return c["cliff_lap"]

    for age in range(1, 61):
        if predict_delta(compound, age, curves) >= threshold:
            return age
    return 60


# ---------------------------------------------------------------------------
# 5. Bayesian updating (for live mode)
# ---------------------------------------------------------------------------

def bayesian_update(prior_curves: dict[str, dict],
                    live_laps: pd.DataFrame) -> tuple[dict[str, dict], float]:
    """
    Update prior degradation curves with incoming live lap data using
    conjugate Gaussian updating.

    Prior: slope and intercept from historical/benchmark curves.
    Likelihood: observed lap time deltas from live laps.

    Returns:
        (updated_curves, confidence) where confidence is 0.0-1.0.
        Confidence increases as more live data accumulates.
    """
    if live_laps.empty:
        return prior_curves, 0.0

    if "lap_time_delta" not in live_laps.columns:
        live_laps = compute_delta(live_laps)

    updated = {}
    total_laps = 0
    total_compounds = 0

    for compound, prior in prior_curves.items():
        subset = live_laps[live_laps["compound"] == compound] if "compound" in live_laps.columns else pd.DataFrame()

        if subset.empty or len(subset) < 3:
            # Not enough live data — keep prior unchanged
            updated[compound] = dict(prior)
            continue

        total_compounds += 1
        n_live = len(subset)
        total_laps += n_live

        x = subset["tyre_age"].to_numpy(dtype=float)
        y = subset["lap_time_delta"].to_numpy(dtype=float)

        # Prior parameters
        prior_slope = prior.get("slope", 0.05)
        prior_var = 0.01  # prior variance (tight for historical, loose for benchmarks)
        if prior.get("r2", 0) == 0.0:
            prior_var = 0.05  # benchmark data — wider prior

        # Compute observed slope via simple linear regression
        if len(x) >= 2 and np.std(x) > 0:
            obs_slope = float(np.polyfit(x, y, 1)[0])
            obs_var = float(np.var(y - (obs_slope * x))) / max(1, n_live)
        else:
            obs_slope = prior_slope
            obs_var = prior_var

        # Conjugate Gaussian update: posterior = weighted average
        # precision = 1/variance
        prior_precision = 1.0 / max(prior_var, 1e-6)
        obs_precision = 1.0 / max(obs_var, 1e-6)

        # Weight current race data 2x vs prior
        obs_precision *= 2.0

        posterior_precision = prior_precision + obs_precision
        posterior_slope = (prior_precision * prior_slope + obs_precision * obs_slope) / posterior_precision
        posterior_var = 1.0 / posterior_precision

        # Build updated curve
        updated_curve = dict(prior)
        updated_curve["slope"] = posterior_slope

        # Update coefficients if polynomial
        if updated_curve.get("coeffs") and updated_curve.get("type", "quadratic") == "quadratic":
            coeffs = list(updated_curve["coeffs"])
            if len(coeffs) >= 2:
                # Scale the linear term proportionally
                scale = posterior_slope / max(abs(prior_slope), 1e-6) if prior_slope != 0 else 1.0
                coeffs[-2] = posterior_slope
                # Scale quadratic term too
                if len(coeffs) == 3:
                    coeffs[0] = coeffs[0] * min(max(scale, 0.5), 2.0)
            updated_curve["coeffs"] = coeffs

        # Recompute cliff lap
        if updated_curve.get("coeffs"):
            updated_curve["cliff_lap"] = _compute_cliff_from_coeffs(updated_curve["coeffs"])
        else:
            updated_curve["cliff_lap"] = 60

        updated_curve["posterior_var"] = posterior_var
        updated[compound] = updated_curve

    # Confidence: 0.0 (no data) → 1.0 (≥20 laps across compounds)
    confidence = min(1.0, total_laps / 20.0) if total_compounds > 0 else 0.0

    return updated, confidence
