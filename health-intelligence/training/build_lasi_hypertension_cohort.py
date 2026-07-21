"""Build and audit the LASI hypertension cohort in memory; export aggregates only."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    from training.compare_lasi_hypertension_target_policies import (
        APPROVED_TARGET_POLICY,
        TARGET_NAME,
        policy_b,
    )
    from training.lasi_hypertension_audit_utils import (
        APPROVED_PRODUCTION_PREDICTORS,
        AUTHORITATIVE_MAPPING,
        CATEGORICAL_ANTHROPOMETRIC_QUALITY_FIELDS,
        PRODUCTION_PREDICTOR_ORDER,
        derive_family_history,
        derive_physical_activity,
        derive_smoking,
    )
except ModuleNotFoundError:
    from compare_lasi_hypertension_target_policies import APPROVED_TARGET_POLICY, TARGET_NAME, policy_b
    from lasi_hypertension_audit_utils import (
        APPROVED_PRODUCTION_PREDICTORS,
        AUTHORITATIVE_MAPPING,
        CATEGORICAL_ANTHROPOMETRIC_QUALITY_FIELDS,
        PRODUCTION_PREDICTOR_ORDER,
        derive_family_history,
        derive_physical_activity,
        derive_smoking,
    )

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
INDIVIDUAL_FILE = "3_LASI_W1_Individual_v4.dta"
BIOMARKER_FILE = "4_LASI_W1_Biomarker.dta"
REQUIRED_TARGET_COLUMNS = (
    "bm006", "bm007", "bm010", "bm011", "bm014", "bm015", "bm017", "bm018",
)
INDIVIDUAL_COLUMNS = [
    "prim_key", "dm005", "dm003", "ht002", "ht002c", "indiaindividualweight",
    "stateindividualweight", "hhid", "ssuid", "fm303s1", "fm303s2", "fm303s3",
    "fm303s4", "fm303s5", "hb211", "hb213", "hb001", "hb003", "hb003_a",
]
BIOMARKER_COLUMNS = [
    "prim_key", *REQUIRED_TARGET_COLUMNS, "bm067", "bm071", "bm001", "bm002",
    "bm020", "bm021", "bm022", *CATEGORICAL_ANTHROPOMETRIC_QUALITY_FIELDS,
]
FEATURE_SETS = {
    "A": ("age", "bmi"),
    "B": ("age", "bmi", "sex"),
    "C": ("age", "bmi", "sex", "family_history_hypertension", "physical_activity_category", "smoking_category"),
    "D": ("age", "height_cm", "weight_kg", "sex", "family_history_hypertension", "physical_activity_category", "smoking_category"),
    "E": PRODUCTION_PREDICTOR_ORDER,
    "F": ("age", "bmi", "sex", "family_history_hypertension", "physical_activity_category", "smoking_category"),
}
NUMERIC_FEATURES = {"age", "height_cm", "weight_kg", "bmi"}
CATEGORICAL_FEATURES = APPROVED_PRODUCTION_PREDICTORS - NUMERIC_FEATURES
FORBIDDEN_PREDICTORS = {
    "prim_key", "hhid", "ssuid", "ht002", "ht002c", "indiaindividualweight",
    "stateindividualweight", "bm001", "bm002", "bm020", "bm021", "bm022",
    *REQUIRED_TARGET_COLUMNS,
}
OUTPUT_FILENAMES = {
    "lasi_hypertension_cohort_manifest.json", "lasi_hypertension_cohort_flow.json",
    "lasi_hypertension_predictor_missingness.json", "lasi_hypertension_derived_feature_summary.json",
    "lasi_hypertension_feature_set_availability.json", "lasi_hypertension_grouping_weight_summary.json",
    "lasi_hypertension_cohort_quality_summary.json",
}


def suppress(count: int, minimum: int) -> int | str:
    return count if count == 0 or count >= minimum else f"SUPPRESSED_BELOW_{minimum}"


def percent(count: int, total: int, minimum: int) -> float | str | None:
    if total == 0:
        return None
    if 0 < count < minimum:
        return f"SUPPRESSED_BELOW_{minimum}"
    return round(100 * count / total, 6)


def distribution(series: pd.Series, minimum: int) -> dict[str, int | str]:
    counts = series.value_counts(dropna=False)
    return {
        ("unknown" if pd.isna(key) else str(key)): suppress(int(value), minimum)
        for key, value in sorted(counts.items(), key=lambda item: str(item[0]))
    }


def _inside(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def validate_paths(data_root: Path, output_dir: Path) -> None:
    if not data_root.exists():
        raise FileNotFoundError(f"LASI data root does not exist: {data_root}")
    if not data_root.is_dir():
        raise ValueError(f"LASI data root is not a directory: {data_root}")
    if output_dir.exists() and not output_dir.is_dir():
        raise ValueError(f"Output path exists but is not a directory: {output_dir}")
    if _inside(data_root, REPOSITORY_ROOT):
        raise ValueError("data-root must be outside the Git worktree")
    if _inside(output_dir, REPOSITORY_ROOT):
        raise ValueError("output-dir must be outside the Git worktree")
    if output_dir.resolve() == data_root.resolve() or _inside(output_dir, data_root):
        raise ValueError("output-dir must not be inside raw data")


def _nonempty_path(value: str) -> Path:
    if not value.strip():
        raise argparse.ArgumentTypeError("path must not be empty")
    return Path(value)


def read_sources(data_root: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    paths = (data_root / INDIVIDUAL_FILE, data_root / BIOMARKER_FILE)
    if any(not path.is_file() for path in paths):
        raise FileNotFoundError("required approved LASI file unavailable")
    individual = pd.read_stata(paths[0], columns=INDIVIDUAL_COLUMNS, convert_categoricals=False)
    biomarker = pd.read_stata(paths[1], columns=BIOMARKER_COLUMNS, convert_categoricals=False)
    if list(individual) != INDIVIDUAL_COLUMNS or list(biomarker) != BIOMARKER_COLUMNS:
        raise ValueError("required approved columns unavailable")
    return individual, biomarker


def private_join(individual: pd.DataFrame, biomarker: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    for name, frame in (("individual", individual), ("biomarker", biomarker)):
        if frame["prim_key"].isna().any() or frame["prim_key"].duplicated().any():
            raise ValueError(f"{name} prim_key must be unique and nonmissing")
    outer = individual.merge(biomarker, on="prim_key", how="outer", validate="one_to_one", indicator=True)
    diagnostics = {
        "individual_source_rows": len(individual),
        "biomarker_source_rows": len(biomarker),
        "matched_rows": int(outer["_merge"].eq("both").sum()),
        "individual_only_rows": int(outer["_merge"].eq("left_only").sum()),
        "biomarker_only_rows": int(outer["_merge"].eq("right_only").sum()),
    }
    joined = outer.loc[outer["_merge"].eq("both")].drop(columns=["prim_key", "_merge"])
    return joined, diagnostics


def derive_bmi(height: pd.Series, weight: pd.Series) -> pd.Series:
    h = pd.to_numeric(height, errors="coerce")
    w = pd.to_numeric(weight, errors="coerce")
    valid = h.notna() & w.notna() & np.isfinite(h) & np.isfinite(w) & h.gt(0) & w.gt(0)
    return (w / ((h / 100) ** 2)).where(valid)


def derive_predictors(frame: pd.DataFrame) -> pd.DataFrame:
    result = pd.DataFrame(index=frame.index)
    result["age"] = pd.to_numeric(frame["dm005"], errors="coerce")
    sex = pd.to_numeric(frame["dm003"], errors="coerce")
    result["sex"] = sex.where(sex.isin([1, 2]))
    height = pd.to_numeric(frame["bm067"], errors="coerce")
    weight = pd.to_numeric(frame["bm071"], errors="coerce")
    result["height_cm"] = height.where(height.gt(0))
    result["weight_kg"] = weight.where(weight.gt(0))
    result["bmi"] = derive_bmi(frame["bm067"], frame["bm071"])
    result["family_history_hypertension"] = derive_family_history(frame)
    result["physical_activity_category"] = derive_physical_activity(frame)
    result["smoking_category"], _ = derive_smoking(frame)
    if tuple(result.columns) != PRODUCTION_PREDICTOR_ORDER:
        raise RuntimeError("predictor registry mismatch")
    return result


def construct_target_cohort(
    joined: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, dict[str, int]]:
    """Apply approved eligibility, Policy B, and predictor derivation in memory."""
    missing = [name for name in REQUIRED_TARGET_COLUMNS if name not in joined]
    if missing:
        raise ValueError(
            "Missing required hypertension target-source columns: "
            + ", ".join(missing)
        )
    age = pd.to_numeric(joined["dm005"], errors="coerce")
    diagnosis = pd.to_numeric(joined["ht002"], errors="coerce")
    valid_age = age.notna() & np.isfinite(age) & age.ge(0)
    age_45_plus = valid_age & age.ge(45)
    eligible = age_45_plus & diagnosis.eq(2)
    target_result = policy_b(joined.loc[eligible])
    cohort_index = target_result.index[target_result["target"].notna()]
    cohort = joined.loc[cohort_index]
    target = target_result.loc[cohort_index, "target"]
    predictors = derive_predictors(cohort)
    counts = {
        "invalid_or_unknown_age": int((~valid_age).sum()),
        "below_age_45": int((valid_age & age.lt(45)).sum()),
        "previous_hypertension_diagnosis": int((age_45_plus & diagnosis.eq(1)).sum()),
        "unknown_diagnosis": int((age_45_plus & ~diagnosis.isin([1, 2])).sum()),
        "valid_age_population": int(valid_age.sum()),
        "age_45_plus_population": int(age_45_plus.sum()),
        "no_previous_hypertension_population": int(eligible.sum()),
        "target_not_constructible": int(eligible.sum() - len(cohort)),
    }
    return cohort, predictors, target, counts


def _size_bands(values: pd.Series, minimum: int) -> dict[str, int | str]:
    counts = {
        "1": int(values.eq(1).sum()),
        "2_to_4": int(values.between(2, 4).sum()),
        "5_to_9": int(values.between(5, 9).sum()),
        "10_or_more": int(values.ge(10).sum()),
    }
    return {key: suppress(value, minimum) for key, value in counts.items()}


def build_outputs(
    joined: pd.DataFrame,
    joins: dict[str, int],
    minimum: int,
) -> dict[str, Any]:
    cohort, predictors, target, eligibility = construct_target_cohort(joined)

    flow = {
        **joins,
        "invalid_or_unknown_age": eligibility["invalid_or_unknown_age"],
        "below_age_45": eligibility["below_age_45"],
        "previous_hypertension_diagnosis": eligibility[
            "previous_hypertension_diagnosis"
        ],
        "unknown_diagnosis": eligibility["unknown_diagnosis"],
        "target_not_constructible": eligibility["target_not_constructible"],
        "final_target_constructible_cohort": len(cohort),
        "positive_target_count": int(target.eq(1).sum()),
        "negative_target_count": int(target.eq(0).sum()),
    }

    layers = {
        "joined_population": len(joined),
        "valid_age_population": eligibility["valid_age_population"],
        "age_45_plus_population": eligibility["age_45_plus_population"],
        "no_previous_hypertension_population": eligibility[
            "no_previous_hypertension_population"
        ],
        "approved_target_constructible_population": len(cohort),
        "predictor_derived_population": len(predictors),
    }
    missingness = []
    for name in PRODUCTION_PREDICTOR_ORDER:
        observed = int(predictors[name].notna().sum())
        missing = len(predictors) - observed
        missingness.append({
            "canonical_name": name, "source_columns": list(AUTHORITATIVE_MAPPING[name]["columns"]),
            "total_target_cohort_count": suppress(len(predictors), minimum),
            "observed_or_resolved_count": suppress(observed, minimum), "missing_count": suppress(missing, minimum),
            "unknown_or_unresolved_count": suppress(missing if name in CATEGORICAL_FEATURES else 0, minimum),
            "observed_percentage": percent(observed, len(predictors), minimum), "allowed_in_profile_model": True,
        })
    feature_availability = []
    for label, features in FEATURE_SETS.items():
        numeric = [name for name in features if name in NUMERIC_FEATURES]
        categorical = [name for name in features if name in CATEGORICAL_FEATURES]
        numeric_ok = predictors[numeric].notna().all(axis=1) if numeric else pd.Series(True, index=predictors.index)
        categorical_ok = predictors[categorical].notna().all(axis=1) if categorical else pd.Series(True, index=predictors.index)
        strict = numeric_ok & categorical_ok
        retained = numeric_ok & ~categorical_ok
        feature_availability.append({
            "feature_set": label, "required_features": list(features),
            "strict_complete_count": suppress(int(strict.sum()), minimum),
            "strict_complete_percent": percent(int(strict.sum()), len(predictors), minimum),
            "categorical_unknown_retained_count": suppress(int(retained.sum()), minimum),
            "categorical_unknown_retained_percent": percent(int(retained.sum()), len(predictors), minimum),
            "numeric_missing_excluded_count": suppress(int((~numeric_ok).sum()), minimum),
            "unresolved_categorical_count": suppress(int(predictors[categorical].isna().any(axis=1).sum()) if categorical else 0, minimum),
            "polynomial_features_created": False,
        })
    national = pd.to_numeric(cohort["indiaindividualweight"], errors="coerce")
    household_sizes = cohort.groupby("hhid", dropna=True).size()
    cluster_sizes = cohort.groupby("ssuid", dropna=True).size()
    return {
        "lasi_hypertension_cohort_manifest.json": {
            "target_name": TARGET_NAME, "approved_target_policy": APPROVED_TARGET_POLICY,
            "approved_predictors": list(PRODUCTION_PREDICTOR_ORDER), "feature_sets_audited": list(FEATURE_SETS),
            "cohort_created": True, "cohort_constructed_in_memory": True, "cohort_persisted": False,
            "final_modelling_cohort_approved": False, "missing_data_policy_approved": False,
            "participant_level_exported": False, "raw_bp_values_exported": False,
            "direct_identifier_values_exported": False, "group_identifier_values_exported": False,
            "absolute_paths_exported": False, "small_cell_suppression_applied": True,
            "minimum_cell_count": minimum, "model_trained": False, "split_created": False,
            "locked_test_created": False, "locked_test_evaluated": False,
        },
        "lasi_hypertension_cohort_flow.json": {
            "counts": {key: suppress(value, minimum) for key, value in flow.items()},
            "layers": {key: suppress(value, minimum) for key, value in layers.items()},
            "reconciliation_checks": {
                "target_counts_equal_final_cohort": flow["positive_target_count"] + flow["negative_target_count"] == len(cohort),
                "predictor_rows_equal_target_cohort": len(predictors) == len(cohort),
            },
        },
        "lasi_hypertension_predictor_missingness.json": {"predictors": missingness},
        "lasi_hypertension_derived_feature_summary.json": {
            "sex": distribution(predictors["sex"], minimum),
            "family_history": distribution(predictors["family_history_hypertension"], minimum),
            "physical_activity": distribution(predictors["physical_activity_category"], minimum),
            "smoking": distribution(predictors["smoking_category"], minimum),
            "bmi_constructibility": distribution(predictors["bmi"].notna(), minimum),
            "height_constructibility": distribution(predictors["height_cm"].notna(), minimum),
            "weight_constructibility": distribution(predictors["weight_kg"].notna(), minimum),
        },
        "lasi_hypertension_feature_set_availability.json": {"feature_sets": feature_availability},
        "lasi_hypertension_grouping_weight_summary.json": {
            "positive_finite_national_weight_count": suppress(int((national.notna() & np.isfinite(national) & national.gt(0)).sum()), minimum),
            "missing_national_weight_count": suppress(int(national.isna().sum()), minimum),
            "invalid_or_nonpositive_national_weight_count": suppress(int((national.notna() & (~np.isfinite(national) | national.le(0))).sum()), minimum),
            "unique_household_count": suppress(int(cohort["hhid"].nunique(dropna=True)), minimum),
            "unique_cluster_count": suppress(int(cohort["ssuid"].nunique(dropna=True)), minimum),
            "household_size_bands": _size_bands(household_sizes, minimum),
            "cluster_size_bands": _size_bands(cluster_sizes, minimum),
            "multi_person_households": suppress(int(household_sizes.gt(1).sum()), minimum),
        },
        "lasi_hypertension_cohort_quality_summary.json": {
            "join_keys_unique_and_nonmissing": True, "approved_target_policy": APPROVED_TARGET_POLICY,
            "approved_predictor_names": list(PRODUCTION_PREDICTOR_ORDER), "forbidden_predictor_intersection": [],
            "anthropometric_quality_field_distributions": {
                name: distribution(cohort[name], minimum)
                for name in CATEGORICAL_ANTHROPOMETRIC_QUALITY_FIELDS
            },
            "artificial_limb_or_orthosis_flag_distributions": {name: distribution(cohort[name], minimum) for name in ("bm069", "bm074")},
            "measurement_compliance_distributions": {name: distribution(cohort[name], minimum) for name in ("bm001", "bm002", "bm020", "bm021", "bm022")},
            "documented_special_code_conversions": {},
            "unresolved_derivation_counts": {name: suppress(int(predictors[name].isna().sum()), minimum) for name in CATEGORICAL_FEATURES},
            "raw_bp_values_exported": False, "participant_rows_exported": False,
        },
    }


def write_outputs(outputs: dict[str, Any], output_dir: Path) -> None:
    if set(outputs) != OUTPUT_FILENAMES:
        raise RuntimeError("unexpected output schema")
    output_dir.mkdir(parents=True, exist_ok=True)
    for name in sorted(outputs):
        (output_dir / name).write_text(json.dumps(outputs[name], indent=2, sort_keys=True), encoding="utf-8")


def execute(data_root: Path, output_dir: Path, minimum: int = 10) -> dict[str, Any]:
    if minimum < 2:
        raise ValueError("min-cell-count must be at least 2")
    if APPROVED_TARGET_POLICY != "last_two_pairs_mean":
        raise RuntimeError("unsupported or unapproved target policy")
    validate_paths(data_root, output_dir)
    joined, diagnostics = private_join(*read_sources(data_root))
    outputs = build_outputs(joined, diagnostics, minimum)
    write_outputs(outputs, output_dir)
    return outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", required=True, type=_nonempty_path)
    parser.add_argument("--output-dir", required=True, type=_nonempty_path)
    parser.add_argument("--min-cell-count", type=int, default=10)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    execute(args.data_root, args.output_dir, args.min_cell_count)
    print("LASI hypertension cohort aggregate audit complete; no cohort persisted.")


if __name__ == "__main__":
    main()
