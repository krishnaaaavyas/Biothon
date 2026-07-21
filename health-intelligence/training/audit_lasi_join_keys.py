from __future__ import annotations

import argparse
import json
import math
import numbers
from pathlib import Path
from typing import Any

import pandas as pd
import pyreadstat


CANDIDATE_KEYS = ("prim_key", "hhid", "ssuid")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Audit LASI join keys without printing or exporting identifier values."
        )
    )

    parser.add_argument("--individual", required=True, type=Path)
    parser.add_argument("--biomarker", required=True, type=Path)
    parser.add_argument("--dbs", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)

    return parser.parse_args()


def normalise_identifier(value: Any) -> str | None:
    """Convert an identifier to a comparable string without exposing it."""

    if pd.isna(value):
        return None

    if isinstance(value, numbers.Real) and not isinstance(value, bool):
        numeric_value = float(value)

        if not math.isfinite(numeric_value):
            return None

        if numeric_value.is_integer():
            return str(int(numeric_value))

        return format(numeric_value, ".15g")

    text = str(value).strip()

    if not text or text == ".":
        return None

    return text


def find_available_keys(file_path: Path) -> dict[str, str]:
    """Return candidate key names using case-insensitive matching."""

    if not file_path.exists():
        raise FileNotFoundError(f"LASI file not found: {file_path}")

    _, metadata = pyreadstat.read_dta(
        str(file_path),
        metadataonly=True,
    )

    available_columns = {
        column.lower(): column
        for column in metadata.column_names
    }

    return {
        candidate: available_columns[candidate]
        for candidate in CANDIDATE_KEYS
        if candidate in available_columns
    }


def read_key_values(file_path: Path, column: str) -> pd.Series:
    """Read one identifier column only."""

    dataframe, _ = pyreadstat.read_dta(
        str(file_path),
        usecols=[column],
        apply_value_formats=False,
    )

    return dataframe[column].map(normalise_identifier)


def audit_key(
    file_role: str,
    file_path: Path,
    key_name: str,
    actual_column: str,
) -> tuple[dict[str, Any], set[str]]:
    values = read_key_values(file_path, actual_column)

    nonmissing = values.dropna()
    unique_values = set(nonmissing.tolist())

    duplicate_rows = int(nonmissing.duplicated().sum())

    duplicated_values = nonmissing[
        nonmissing.duplicated(keep=False)
    ]

    result = {
        "file_role": file_role,
        "filename": file_path.name,
        "candidate_key": key_name,
        "actual_column": actual_column,
        "rows": int(len(values)),
        "missing_count": int(values.isna().sum()),
        "missing_rate": float(values.isna().mean()),
        "nonmissing_count": int(nonmissing.size),
        "unique_key_count": int(nonmissing.nunique()),
        "duplicate_row_count": duplicate_rows,
        "duplicate_key_value_count": int(duplicated_values.nunique()),
        "is_unique_among_nonmissing": duplicate_rows == 0,
    }

    return result, unique_values


def calculate_overlap(
    left_role: str,
    right_role: str,
    key_name: str,
    left_values: set[str],
    right_values: set[str],
) -> dict[str, Any]:
    overlap = left_values.intersection(right_values)

    return {
        "candidate_key": key_name,
        "left_file": left_role,
        "right_file": right_role,
        "left_unique_keys": len(left_values),
        "right_unique_keys": len(right_values),
        "overlap_count": len(overlap),
        "left_match_rate": (
            len(overlap) / len(left_values)
            if left_values
            else None
        ),
        "right_match_rate": (
            len(overlap) / len(right_values)
            if right_values
            else None
        ),
    }


def main() -> None:
    args = parse_args()

    files = {
        "individual": args.individual,
        "biomarker": args.biomarker,
        "dbs": args.dbs,
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)

    key_summary: list[dict[str, Any]] = []
    key_sets: dict[str, dict[str, set[str]]] = {}

    for role, file_path in files.items():
        print(f"Inspecting key metadata: {file_path.name}")

        available_keys = find_available_keys(file_path)

        for candidate_key in CANDIDATE_KEYS:
            if candidate_key not in available_keys:
                key_summary.append(
                    {
                        "file_role": role,
                        "filename": file_path.name,
                        "candidate_key": candidate_key,
                        "actual_column": None,
                        "present": False,
                    }
                )
                continue

            summary, values = audit_key(
                file_role=role,
                file_path=file_path,
                key_name=candidate_key,
                actual_column=available_keys[candidate_key],
            )

            summary["present"] = True
            key_summary.append(summary)

            key_sets.setdefault(candidate_key, {})[role] = values

    overlap_summary: list[dict[str, Any]] = []

    for candidate_key, role_values in key_sets.items():
        if "individual" in role_values and "biomarker" in role_values:
            overlap_summary.append(
                calculate_overlap(
                    "individual",
                    "biomarker",
                    candidate_key,
                    role_values["individual"],
                    role_values["biomarker"],
                )
            )

        if "individual" in role_values and "dbs" in role_values:
            overlap_summary.append(
                calculate_overlap(
                    "individual",
                    "dbs",
                    candidate_key,
                    role_values["individual"],
                    role_values["dbs"],
                )
            )

        if "biomarker" in role_values and "dbs" in role_values:
            overlap_summary.append(
                calculate_overlap(
                    "biomarker",
                    "dbs",
                    candidate_key,
                    role_values["biomarker"],
                    role_values["dbs"],
                )
            )

        if all(
            role in role_values
            for role in ("individual", "biomarker", "dbs")
        ):
            three_way_overlap = (
                role_values["individual"]
                & role_values["biomarker"]
                & role_values["dbs"]
            )

            overlap_summary.append(
                {
                    "candidate_key": candidate_key,
                    "left_file": "all_three",
                    "right_file": "all_three",
                    "left_unique_keys": None,
                    "right_unique_keys": None,
                    "overlap_count": len(three_way_overlap),
                    "left_match_rate": None,
                    "right_match_rate": None,
                }
            )

    key_summary_path = args.output_dir / "lasi_key_summary.csv"
    overlap_path = args.output_dir / "lasi_key_overlap.json"

    pd.DataFrame(key_summary).to_csv(
        key_summary_path,
        index=False,
    )

    overlap_path.write_text(
        json.dumps(
            {
                "files": {
                    role: file_path.name
                    for role, file_path in files.items()
                },
                "overlaps": overlap_summary,
                "contains_identifier_values": False,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print("\nKey summary:")
    printable_columns = [
        "file_role",
        "candidate_key",
        "present",
        "rows",
        "missing_count",
        "unique_key_count",
        "duplicate_key_value_count",
        "is_unique_among_nonmissing",
    ]

    summary_frame = pd.DataFrame(key_summary)

    print(
        summary_frame.reindex(columns=printable_columns)
        .to_string(index=False)
    )

    print(f"\nSaved aggregate summary:\n{key_summary_path}")
    print(f"\nSaved aggregate overlap report:\n{overlap_path}")
    print("\nNo identifier values were printed or exported.")


if __name__ == "__main__":
    main()