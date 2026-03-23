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

from constants import (
    COMPOUNDS,
    FUEL_CONSUMPTION_KG_PER_LAP,
    FUEL_EFFECT_PER_LAP_KG,
    FUEL_LOAD_KG,
    MAX_FITTING_STINT,
    get_lap_offset,
)

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
# 2b. Track evolution correction
# ---------------------------------------------------------------------------

def apply_evolution_correction(
    df: pd.DataFrame,
    lap_col: str = "lap_number",
    delta_col: str = "lap_time_delta",
    k: float = 0.15,
) -> pd.DataFrame:
    """
    Subtract estimated track evolution gain from delta lap times.

    Evolution is modelled as an exponential decay: gain * exp(-k * lap_number).
    The gain magnitude is estimated from the standard deviation of pace across
    laps 1-10 in the session — a rough proxy for the evolution amplitude.
    Falls back to no correction if lap_col is absent.
    """
    if lap_col not in df.columns:
        return df
    early = df[df[lap_col] <= 10]
    if early.empty or delta_col not in df.columns:
        return df
    evolution_gain = early[delta_col].std()
    if np.isnan(evolution_gain) or evolution_gain == 0:
        return df
    df = df.copy()
    df[delta_col] = df[delta_col] - evolution_gain * np.exp(-k * df[lap_col])
    return df


# ---------------------------------------------------------------------------
# 2c. IQR-based outlier filtering
# ---------------------------------------------------------------------------

def filter_outlier_laps(
    df: pd.DataFrame, delta_col: str = "lap_time_delta", k: float = 1.5,
) -> pd.DataFrame:
    """
    Remove laps where delta is outside [Q1 - k*IQR, Q3 + k*IQR].
    Eliminates SC laps, VSC laps, and anomalous stints without
    needing explicit race control data.
    """
    if delta_col not in df.columns or df.empty:
        return df
    q1 = df[delta_col].quantile(0.25)
    q3 = df[delta_col].quantile(0.75)
    iqr = q3 - q1
    lower = q1 - k * iqr
    upper = q3 + k * iqr
    return df[(df[delta_col] >= lower) & (df[delta_col] <= upper)]


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
              weather_df: pd.DataFrame | None = None,
              circuit_name: str | None = None) -> dict:
    """
    Fit a degradation curve for one compound.

    Pre-fit pipeline (applied in order):
      a. Track-evolution lap offset — discard early unrepresentative laps
      b. Track evolution correction — subtract exponential rubber-in effect
      c. Stint length cap — ignore laps beyond realistic stint for compound

    Then tries piecewise linear (≥8 laps), falls back to quadratic (≥5).
    Optionally fits a temperature coefficient if weather data is available.

    Returns dict with: type, slope, intercept, r2, coeffs, degree, cliff_lap,
    temp_coefficient, and piecewise-specific fields when applicable.
    """
    if compound not in COMPOUNDS:
        raise ValueError(f"Unknown compound: {compound}")

    subset = laps_df[laps_df["compound"] == compound].copy()

    # --- Pre-fit filter (a): track evolution lap offset ---
    if circuit_name and "tyre_age" in subset.columns:
        offset = get_lap_offset(circuit_name)
        subset = subset[subset["tyre_age"] > offset]

    # --- Pre-fit filter (b): exponential evolution correction ---
    if circuit_name and "lap_time_delta" in subset.columns:
        subset = apply_evolution_correction(subset)

    # --- Pre-fit filter (c): cap stint length per compound ---
    if "tyre_age" in subset.columns:
        max_age = MAX_FITTING_STINT.get(compound, MAX_FITTING_STINT["default"])
        subset = subset[subset["tyre_age"] <= max_age]

    # --- Pre-fit filter (d): IQR outlier removal ---
    subset = filter_outlier_laps(subset)

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

    # Monotonicity check: post-cliff slope must not be shallower than pre-cliff
    if result is not None and result.get("type") == "piecewise":
        slopes = result.get("slopes", [])
        if len(slopes) >= 2 and slopes[1] < slopes[0]:
            pw_cliff_lap = result["cliff_lap"]
            logger.info(
                "Piecewise monotonicity violation for %s (slopes=%s) "
                "— refitting as single linear, cliff_confidence=low",
                compound, [f"{s:.4f}" for s in slopes],
            )
            result = _fit_quadratic(x, y, degree=1)
            result["type"] = "linear"
            result["cliff_lap"] = pw_cliff_lap
            result["cliff_confidence"] = "low"
        else:
            result["cliff_confidence"] = "high"

    if result is None:
        result = _fit_quadratic(x, y, degree)
        result["cliff_confidence"] = None

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
                      weather_df: pd.DataFrame | None = None,
                      circuit_name: str | None = None,
                      fit_per_driver: bool = True) -> dict[str, dict]:
    """
    Run fit_curve for every compound present in the DataFrame.

    When *fit_per_driver* is True (default) and a "driver" column exists,
    each compound entry becomes::

        {
            "_population": <curve dict>,   # all-driver fit
            "VER": <curve dict>,           # per-driver fits
            "HAM": <curve dict>,
            ...
        }

    Drivers with fewer than MIN_LAPS_FOR_FIT laps are omitted — callers
    should fall back to ``_population`` via :func:`resolve_driver_curves`.

    When *fit_per_driver* is False the return is the original flat
    ``{compound: curve_dict}`` format.
    """
    if "lap_time_delta" not in laps_df.columns:
        laps_df = compute_delta(laps_df)

    curves: dict[str, dict] = {}
    has_drivers = fit_per_driver and "driver" in laps_df.columns

    for compound in laps_df["compound"].unique():
        # Population-level fit (all drivers pooled)
        try:
            pop_curve = fit_curve(
                laps_df, compound, weather_df=weather_df, circuit_name=circuit_name,
            )
        except ValueError as exc:
            logger.warning("Skipping %s: %s", compound, exc)
            continue

        if not has_drivers:
            curves[compound] = pop_curve
            continue

        compound_entry: dict[str, dict] = {"_population": pop_curve}
        compound_laps = laps_df[laps_df["compound"] == compound]

        for driver in compound_laps["driver"].unique():
            driver_laps = laps_df[laps_df["driver"] == driver]
            try:
                d_curve = fit_curve(
                    driver_laps, compound,
                    weather_df=weather_df, circuit_name=circuit_name,
                )
                compound_entry[driver] = d_curve
            except ValueError:
                pass  # not enough laps — callers fall back to _population

        curves[compound] = compound_entry

    return curves


def resolve_driver_curves(
    curves: dict[str, dict], driver: str | None = None,
) -> dict[str, dict]:
    """
    Collapse per-driver curve structure into flat ``{compound: curve_dict}``.

    If *driver* is given and that driver has a curve for a compound, it is
    used; otherwise the ``_population`` curve is returned.  When the curves
    dict is already in the flat (non-per-driver) format this is a no-op.
    """
    resolved: dict[str, dict] = {}
    for compound, value in curves.items():
        if isinstance(value, dict) and "_population" in value:
            if driver and driver in value:
                resolved[compound] = value[driver]
            else:
                resolved[compound] = value["_population"]
        else:
            resolved[compound] = value
    return resolved


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
