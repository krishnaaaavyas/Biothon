"""LASI metadata-only column inspector.

Reports only filenames, matching column names, variable labels, and concept
groups. It never reads or prints participant row values.
"""

import argparse
import csv
import logging
import re
import sys
from pathlib import Path


log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

DEFAULT_FILES = [
    "3_LASI_W1_Individual_v4",
    "4_LASI_W1_Biomarker",
]

# Earlier exclusions: household/roster, DBS, spirometry, and pilot files.
_BLOCKED_SUBSTRINGS = [
    "1_lasi_w1_hh_roster",
    "2_lasi_w1_household_metrocities_28-03-22",
    "2_lasi_w1_household_v4",
    "lasi_wave1_dbs-dataset_v1_july2025_stata",
    "lasi_wave1_lft(spirometry)-dataset_v1_july2025_stata",
    "lasi-pilot_household",
    "lasi-pilot_individual",
]

# Relative labels are excluded globally, except explicit family-history
# questions, which remain a distinct category.
RELATIVE_EXCLUDE_PATTERNS = [
    r"\bfather\b",
    r"\bmother\b",
    r"\bchild\b",
    r"\bchildren\b",
    r"\bspouse\b",
    r"\bgrandchild\b",
    r"\bsibling\b",
    r"\bbrother\b",
    r"\bsister\b",
    r"\bparent\b",
    r"\bfamily\s+member\b",
    r"\bco[\s-]?resid",
]

FAMILY_HISTORY_PATTERNS = [r"\bfamily\s+history\b"]

KEYWORD_GROUPS: dict[str, list[str]] = {
    "target_candidate": [
        r"\bdiabet",
        r"\bhypertens",
        r"\btold.*doctor\b",
        r"\bdiagnosed\b",
    ],
    "anthropometry": [
        r"\bheight\b",
        r"\bweight\b",
        r"\bbmi\b",
        r"\bwaist\b",
    ],
    "blood_pressure": [
        r"\bsystolic\b",
        r"\bdiastolic\b",
        r"\bbp\b",
        r"\bblood\s+pressure\b",
    ],
}

# ID/key matching applies to column names only, never label text. Underscores
# are treated as token separators by the explicit lookaround boundaries.
ID_NAME_PATTERNS = [
    r"(?<![a-z0-9])id(?![a-z0-9])",
    r"(?<![a-z0-9])hhid(?![a-z0-9])",
    r"(?<![a-z0-9])prim_key(?![a-z0-9])",
    r"(?<![a-z0-9])psu(?![a-z0-9])",
    r"(?<![a-z0-9])ssuid(?![a-z0-9])",
    r"(?<![a-z0-9])stateid(?![a-z0-9])",
]

TABLE_PRINT_LIMIT = 40
REPORT_CATEGORIES = [
    "respondent_age",
    "respondent_sex",
    "target_candidate",
    "family_history",
    "anthropometry",
    "blood_pressure",
    "id_key",
]


def _matches_any_group(col_name: str, col_label: str) -> str | None:
    """Return the first explicit regex category, with no fallback category."""
    label = col_label.lower().replace("_", " ").strip()

    # Explicit family-history questions remain visible even if their labels
    # also mention a parent or another relative.
    if any(re.search(pattern, label) for pattern in FAMILY_HISTORY_PATTERNS):
        return "family_history"

    if any(re.search(pattern, label) for pattern in RELATIVE_EXCLUDE_PATTERNS):
        return None

    normalized_name = col_name.lower()
    if any(re.search(pattern, normalized_name) for pattern in ID_NAME_PATTERNS):
        return "id_key"

    # Respondent age/sex require label evidence and a short/direct respondent
    # formulation, avoiding long compound age- or sex-related questions.
    age_label = re.search(r"\bage\b", label)
    preferred_age = "respondent" in label or re.match(r"^age\b", label)
    if age_label and preferred_age:
        return "respondent_age"

    sex_label = re.search(r"\b(?:sex|gender)\b", label)
    preferred_sex = "respondent" in label or re.match(
        r"^(?:sex|gender)\b", label
    )
    if sex_label and preferred_sex:
        return "respondent_sex"

    haystack = f"{col_name} {label}".lower().replace("_", " ")
    for category, patterns in KEYWORD_GROUPS.items():
        if any(re.search(pattern, haystack) for pattern in patterns):
            return category
    return None


def _inspect_file(filepath: Path) -> list[dict]:
    """Read Stata metadata only and return explicitly matched columns."""
    log.info("Inspecting metadata: %s", filepath.name)
    try:
        import pyreadstat
    except ImportError as exc:
        raise RuntimeError(
            "pyreadstat is required for metadata-only inspection; refusing "
            "to use a fallback that loads row values."
        ) from exc

    try:
        _, metadata = pyreadstat.read_dta(str(filepath), metadataonly=True)
    except TypeError as exc:
        raise RuntimeError(
            "Installed pyreadstat lacks metadataonly support; refusing to "
            "load row values."
        ) from exc

    columns = list(metadata.column_names if metadata else [])
    labels = {
        name: (label or "")
        for name, label in (
            metadata.column_names_to_labels.items() if metadata else []
        )
    }

    matches = []
    for column in columns:
        label = labels.get(column, "")
        category = _matches_any_group(column, label)
        if category is None:
            continue
        matches.append({
            "filename": filepath.name,
            "column_name": column,
            "column_label": label,
            "keyword_group": category,
        })
    log.info("Matched %d columns in %s", len(matches), filepath.name)
    return matches


def _print_table(category: str, rows: list[dict]) -> None:
    columns = ["filename", "column_name", "column_label", "keyword_group"]
    widths = {
        column: max(
            [len(column)] + [len(str(row.get(column, ""))) for row in rows]
        )
        for column in columns
    }
    separator = "  "
    rule = separator.join("-" * widths[column] for column in columns)
    print(f"LASI COLUMN MATCHES: {category} (metadata only; no row values)")
    print(rule)
    print(separator.join(column.ljust(widths[column]) for column in columns))
    print(rule)
    for row in rows:
        print(separator.join(
            str(row.get(column, "")).ljust(widths[column])
            for column in columns
        ))
    print(rule)


def _resolve_files(data_dir: Path, stems: list[str]) -> list[Path]:
    resolved = []
    for stem in stems:
        candidates = [
            data_dir / stem,
            data_dir / f"{stem}.dta",
            data_dir / f"{stem}.DTA",
        ]
        filepath = next((path for path in candidates if path.is_file()), None)
        if filepath is None:
            log.warning("File not found for stem %r — skipping.", stem)
            continue
        lower_name = filepath.name.lower()
        if any(blocked in lower_name for blocked in _BLOCKED_SUBSTRINGS):
            log.warning("Excluded file skipped: %s", filepath.name)
            continue
        # Only the individual and standard biomarker files are in scope.
        if "individual" not in lower_name and "biomarker" not in lower_name:
            log.warning("Out-of-scope file skipped: %s", filepath.name)
            continue
        resolved.append(filepath)
    return resolved


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect LASI column names and labels using metadata only."
    )
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--files", default=",".join(DEFAULT_FILES))
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.is_dir():
        log.error("--data-dir is not a directory: %s", data_dir)
        sys.exit(1)

    stems = [stem.strip() for stem in args.files.split(",") if stem.strip()]
    paths = _resolve_files(data_dir, stems)
    if not paths:
        log.error("No in-scope individual or biomarker files found.")
        sys.exit(1)

    matches = []
    for filepath in paths:
        matches.extend(_inspect_file(filepath))

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "filename", "column_name", "column_label", "keyword_group",
    ]

    # Report every category count before printing any column names or labels.
    categorized = {
        category: [
            row for row in matches if row["keyword_group"] == category
        ]
        for category in REPORT_CATEGORIES
    }
    for category in REPORT_CATEGORIES:
        print(f"{category}: {len(categorized[category])}")

    for category in REPORT_CATEGORIES:
        category_rows = categorized[category]
        if len(category_rows) >= TABLE_PRINT_LIMIT:
            log.warning(
                "%s has %d matches; its table and CSV are suppressed.",
                category,
                len(category_rows),
            )
            continue
        if not category_rows:
            continue

        _print_table(category, category_rows)
        csv_path = output_dir / f"lasi_column_matches_{category}.csv"
        with open(
            csv_path, "w", newline="", encoding="utf-8"
        ) as output_file:
            writer = csv.DictWriter(output_file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(category_rows)
        log.info(
            "Metadata-only CSV saved: %s (%d rows)",
            csv_path,
            len(category_rows),
        )


if __name__ == "__main__":
    main()
