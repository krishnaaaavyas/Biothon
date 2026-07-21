from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pandas as pd
import pyreadstat


QUESTION_CODES = {
    "respondent_sex": ["DM003"],
    "respondent_age": ["DM005"],
    "self_reported_diabetes": ["HT003"],
    "diabetes_oral_medication": ["HT003C"],
    "diabetes_insulin": ["HT003D"],
    "systolic_1": ["BM006"],
    "diastolic_1": ["BM007"],
    "systolic_2": ["BM010"],
    "diastolic_2": ["BM011"],
    "systolic_3": ["BM014"],
    "diastolic_3": ["BM015"],
    "average_systolic": ["BM017"],
    "average_diastolic": ["BM018"],
    "height_cm": ["BM067"],
    "weight_kg": ["BM071"],
    "waist_cm": ["BM076"],
}

TEXT_CONCEPTS = {
    "respondent_id": [
        r"\bhousehold person id\b",
        r"\brespondent id\b",
        r"\bindividual id\b",
        r"\bperson id\b",
    ],
    "hba1c": [
        r"\bhba1c\b",
        r"\bhb a1c\b",
        r"\bglycated h[a]?emoglobin\b",
        r"\bglycosylated h[a]?emoglobin\b",
    ],
    "national_weight": [
        r"\bnational.*weight\b",
        r"\bweight.*national\b",
    ],
    "state_weight": [
        r"\bstate.*weight\b",
        r"\bweight.*state\b",
    ],
    "dbs_weight": [
        r"\bdbs.*weight\b",
        r"\bweight.*dbs\b",
    ],
    "survey_design": [
        r"\bpsu\b",
        r"\bcluster\b",
        r"\bstratum\b",
        r"\bstrata\b",
        r"\brural\b",
        r"\burban\b",
        r"\bstate\b",
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--output-path", required=True, type=Path)
    return parser.parse_args()


def normalise(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def main() -> None:
    args = parse_args()

    if not args.data_dir.exists():
        raise FileNotFoundError(f"Data directory not found: {args.data_dir}")

    rows: list[dict[str, object]] = []

    for file_path in sorted(args.data_dir.rglob("*.dta")):
        print(f"Reading metadata: {file_path.name}")

        _, metadata = pyreadstat.read_dta(
            str(file_path),
            metadataonly=True,
        )

        labels = metadata.column_names_to_labels or {}
        value_labels = metadata.variable_value_labels or {}

        for column in metadata.column_names:
            label = normalise(labels.get(column))
            combined = f"{column} {label}"
            combined_upper = combined.upper()
            combined_lower = combined.lower()

            matched_concepts: set[str] = set()

            for concept, codes in QUESTION_CODES.items():
                if any(
                    re.search(rf"(?<![A-Z0-9]){re.escape(code)}(?![A-Z0-9])", combined_upper)
                    for code in codes
                ):
                    matched_concepts.add(concept)

            for concept, patterns in TEXT_CONCEPTS.items():
                if any(re.search(pattern, combined_lower) for pattern in patterns):
                    matched_concepts.add(concept)

            for concept in sorted(matched_concepts):
                rows.append(
                    {
                        "concept": concept,
                        "filename": file_path.name,
                        "rows": metadata.number_rows,
                        "column": column,
                        "label": label,
                        "value_labels": json.dumps(
                            value_labels.get(column, {}),
                            ensure_ascii=False,
                            sort_keys=True,
                        ),
                    }
                )

    result = pd.DataFrame(rows)

    args.output_path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(args.output_path, index=False)

    print(f"\nMapping written to: {args.output_path}")

    if result.empty:
        print("No approved question-code matches were found.")
        return

    print("\nMatch counts:")
    print(
        result.groupby(["concept", "filename"])
        .size()
        .rename("matches")
        .to_string()
    )


if __name__ == "__main__":
    main()