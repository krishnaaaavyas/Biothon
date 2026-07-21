"""Synthetic-only tests for the LASI hypertension cohort audit."""
import json, re, sys
import numpy as np
import pandas as pd
import pytest
from training import build_lasi_hypertension_cohort as audit
from training import compare_lasi_hypertension_target_policies as target_policy
from training import validate_lasi_hypertension_cohort_outputs as validator
from training.lasi_hypertension_audit_utils import derive_family_history, derive_physical_activity, derive_smoking
from training.validate_lasi_hypertension_cohort_outputs import validate_outputs

ORDERED_APPROVED_PREDICTORS = audit.PRODUCTION_PREDICTOR_ORDER

def test_production_biomarker_registry_contains_all_target_columns():
    expected = {
        "bm006",
        "bm007",
        "bm010",
        "bm011",
        "bm014",
        "bm015",
        "bm017",
        "bm018",
    }

    assert expected.issubset(set(audit.BIOMARKER_COLUMNS))
    assert expected.issubset(set(audit.REQUIRED_TARGET_COLUMNS))


def test_missing_target_source_column_rejected_before_policy_execution():
    data = joined().drop(columns=["bm006"])

    with pytest.raises(
        ValueError,
        match=r"Missing required hypertension target-source columns: bm006",
    ):
        audit.build_outputs(data, diagnostics(), 10)

def joined(rows=20):
    d={c:[1]*rows for c in audit.INDIVIDUAL_COLUMNS[1:]+audit.BIOMARKER_COLUMNS[1:]}
    d.update({"dm005":[55]*rows,"dm003":[1]*rows,"ht002":[2]*rows,"ht002c":[np.nan]*rows,"indiaindividualweight":[1.0]*rows,"stateindividualweight":[1.0]*rows,
      "hhid":[f"H{i//2}" for i in range(rows)],"ssuid":[f"S{i//5}" for i in range(rows)],
      "bm006":[145]*rows,"bm007":[82]*rows,"bm010":[142]*rows,"bm011":[80]*rows,
      "bm014":[138]*rows,"bm015":[92]*rows,"bm017":[140]*rows,"bm018":[86]*rows,
      "bm067":[170.0]*rows,"bm071":[68.0]*rows,"fm303s1":[0]*rows,"fm303s2":[0]*rows,"fm303s3":[0]*rows,"fm303s4":[0]*rows,"fm303s5":[0]*rows,
      "hb211":[4]*rows,"hb213":[4]*rows,"hb001":[2]*rows,"hb003":[np.nan]*rows,"hb003_a":[np.nan]*rows})
    return pd.DataFrame(d)

def diagnostics(n=20): return {"individual_source_rows":n,"biomarker_source_rows":n,"matched_rows":n,"individual_only_rows":0,"biomarker_only_rows":0}

def test_policy_import_and_exact_sources():
    assert (
        audit.APPROVED_TARGET_POLICY
        == target_policy.APPROVED_TARGET_POLICY
        == "last_two_pairs_mean"
    )

    assert target_policy.APPROVED_TARGET_SOURCE_COLUMNS == (
        "bm010",
        "bm011",
        "bm014",
        "bm015",
    )

    assert audit.REQUIRED_TARGET_COLUMNS == (
        "bm006",
        "bm007",
        "bm010",
        "bm011",
        "bm014",
        "bm015",
        "bm017",
        "bm018",
    )

    assert set(audit.REQUIRED_TARGET_COLUMNS).issubset(
        set(audit.BIOMARKER_COLUMNS)
    )

def test_eligibility_rules_and_missing_medication():
    data=joined(4); data["dm005"]=[44,55,55,55]; data["ht002"]=[2,1,np.nan,2]
    out=audit.build_outputs(data,diagnostics(4),2)["lasi_hypertension_cohort_flow.json"]
    assert out["layers"]["approved_target_constructible_population"]=="SUPPRESSED_BELOW_2"

def test_exact_predictors_and_feature_sets():
    data = joined()
    predictors = audit.derive_predictors(data)

    assert tuple(predictors.columns) == (
        "age",
        "sex",
        "height_cm",
        "weight_kg",
        "bmi",
        "family_history_hypertension",
        "physical_activity_category",
        "smoking_category",
    )

    assert set(predictors.columns) == set(
        audit.APPROVED_PRODUCTION_PREDICTORS
    )

    assert audit.FEATURE_SETS["A"] == (
        "age",
        "bmi",
    )

    assert audit.FEATURE_SETS["B"] == (
        "age",
        "bmi",
        "sex",
    )

    assert audit.FEATURE_SETS["C"] == (
        "age",
        "bmi",
        "sex",
        "family_history_hypertension",
        "physical_activity_category",
        "smoking_category",)


def test_generated_predictor_registries_are_canonical_and_model_only():
    outputs = audit.build_outputs(joined(), diagnostics(), 10)
    manifest_names = outputs["lasi_hypertension_cohort_manifest.json"]["approved_predictors"]
    quality_names = outputs["lasi_hypertension_cohort_quality_summary.json"]["approved_predictor_names"]

    assert manifest_names == list(audit.PRODUCTION_PREDICTOR_ORDER)
    assert set(quality_names) == audit.APPROVED_PRODUCTION_PREDICTORS
    assert len(manifest_names) == len(set(manifest_names)) == 8
    assert len(quality_names) == len(set(quality_names)) == 8
    assert not ({"national_weight", "private_join_key", "systolic_1"} & set(manifest_names))


def test_only_approved_categorical_anthropometric_quality_fields_are_summarized():
    expected = {"bm066", "bm068", "bm069", "bm072", "bm074"}
    outputs = audit.build_outputs(joined(), diagnostics(), 10)
    quality = outputs["lasi_hypertension_cohort_quality_summary.json"]

    assert set(audit.CATEGORICAL_ANTHROPOMETRIC_QUALITY_FIELDS) == expected
    assert set(quality["anthropometric_quality_field_distributions"]) == expected
    assert "bm073" not in quality["anthropometric_quality_field_distributions"]
    assert "bm073" not in audit.BIOMARKER_COLUMNS


def test_categorical_quality_distributions_still_suppress_small_cells():
    data = joined()
    data["bm066"] = [1] * 19 + [2]
    outputs = audit.build_outputs(data, diagnostics(), 10)
    distribution = outputs["lasi_hypertension_cohort_quality_summary.json"][
        "anthropometric_quality_field_distributions"
    ]["bm066"]

    assert distribution["1"] == 19
    assert distribution["2"] == "SUPPRESSED_BELOW_10"
    assert set(outputs) == audit.OUTPUT_FILENAMES
    assert "bm073" not in json.dumps(outputs)

def test_bmi_derivations():
    r=audit.derive_bmi(pd.Series([200,0,np.nan,170]),pd.Series([80,80,80,-1])); assert r.iloc[0]==20 and r.iloc[1:].isna().all()

def test_family_history_excludes_grandchildren_and_preserves_unknown():
    f=pd.DataFrame({"fm303s1":[1,0,0],"fm303s2":[np.nan,0,np.nan],"fm303s3":[0,0,0],"fm303s4":[0,0,0],"fm303s5":[0,0,0],"fm303s6":[0,1,1]})
    r=derive_family_history(f); assert r.iloc[0]==1 and r.iloc[1]==0 and pd.isna(r.iloc[2])

def test_activity_precedence_and_smoking():
    a=derive_physical_activity(pd.DataFrame({"hb211":[1,3,4,np.nan],"hb213":[3,5,4,np.nan]})); assert a.iloc[:3].tolist()==["high","moderate","low"] and pd.isna(a.iloc[3])
    s,_=derive_smoking(pd.DataFrame({"hb001":[2,1,1,1],"hb003":[np.nan,1,3,2],"hb003_a":[np.nan,1,2,1]})); assert s.iloc[:3].tolist()==["never","current","former"] and pd.isna(s.iloc[3])

def test_aggregate_deterministic_no_processing_split_or_ids():
    first=audit.build_outputs(joined(),diagnostics(),10); second=audit.build_outputs(joined(),diagnostics(),10)
    assert json.dumps(first,sort_keys=True)==json.dumps(second,sort_keys=True)
    text=json.dumps(first); assert "H0" not in text and "S0" not in text and "prim_key" not in text
    m=first["lasi_hypertension_cohort_manifest.json"]; assert m["model_trained"] is m["split_created"] is m["cohort_persisted"] is False
    assert all(not x["polynomial_features_created"] for x in first["lasi_hypertension_feature_set_availability.json"]["feature_sets"])

def test_suppression_and_invalid_weights():
    data=joined(3); data["indiaindividualweight"]=[1.0,0,-1]
    out=audit.build_outputs(data,diagnostics(3),2)["lasi_hypertension_grouping_weight_summary.json"]
    assert out["positive_finite_national_weight_count"]=="SUPPRESSED_BELOW_2" and out["invalid_or_nonpositive_national_weight_count"]==2

def test_private_join_rejects_duplicates_and_drops_key():
    left=pd.DataFrame({"prim_key":["A","B"],"x":[1,2]}); right=pd.DataFrame({"prim_key":["A","B"],"y":[1,2]})
    merged,_=audit.private_join(left,right); assert "prim_key" not in merged
    with pytest.raises(ValueError,match="unique"): audit.private_join(pd.concat([left,left.iloc[[0]]]),right)


def test_missing_data_root_reports_received_path(tmp_path, monkeypatch):
    monkeypatch.setattr(audit, "REPOSITORY_ROOT", tmp_path / "repo")
    missing = tmp_path / "missing-lasi-root"

    with pytest.raises(FileNotFoundError, match=re.escape(str(missing))):
        audit.validate_paths(missing, tmp_path / "output")


def test_data_root_file_and_output_file_are_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(audit, "REPOSITORY_ROOT", tmp_path / "repo")
    data_file = tmp_path / "not-a-directory.dta"
    data_file.write_text("synthetic fixture", encoding="utf-8")

    with pytest.raises(ValueError, match="LASI data root is not a directory"):
        audit.validate_paths(data_file, tmp_path / "output")

    data_root = tmp_path / "synthetic-data"
    data_root.mkdir()
    output_file = tmp_path / "not-an-output-directory.json"
    output_file.write_text("synthetic fixture", encoding="utf-8")
    with pytest.raises(ValueError, match="Output path exists but is not a directory"):
        audit.validate_paths(data_root, output_file)

def test_cli_integration_synthetic_dta(tmp_path,monkeypatch):
    repo=tmp_path/"repo"; root=tmp_path/"data"; output=tmp_path/"output"; repo.mkdir(); root.mkdir(); data=joined(); keys=[f"FAKE-{i}" for i in range(len(data))]
    individual=data[audit.INDIVIDUAL_COLUMNS[1:]].copy(); individual.insert(0,"prim_key",keys)
    required_bp=["bm006","bm007","bm010","bm011","bm014","bm015","bm017","bm018"]
    biomarker_columns=list(dict.fromkeys([*audit.BIOMARKER_COLUMNS[1:],*required_bp]))
    biomarker=data[biomarker_columns].copy(); biomarker.insert(0,"prim_key",keys)
    individual.to_stata(root/audit.INDIVIDUAL_FILE,write_index=False); biomarker.to_stata(root/audit.BIOMARKER_FILE,write_index=False)
    monkeypatch.setattr(audit,"BIOMARKER_COLUMNS",["prim_key",*biomarker_columns])
    monkeypatch.setattr(audit,"REPOSITORY_ROOT",repo); monkeypatch.setattr(sys,"argv",["build","--data-root",str(root),"--output-dir",str(output)])
    audit.main(); assert validate_outputs(output,10)["validated_output_count"]==7
    exported="".join(p.read_text() for p in output.iterdir()); assert not any(k in exported for k in keys)


