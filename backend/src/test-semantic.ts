import * as fs from "fs";
import * as path from "path";

const BANNED_PATTERNS = [
  { name: "Disease Probability", regex: /disease\s+probability/i },
  { name: "Chance of Disease", regex: /chance\s+of\s+disease/i },
  { name: "AI Diagnosis", regex: /ai\s+diagnosis/i },
  { name: "Clinically Validated Model/Prediction", regex: /clinically\s+validated/i },
  { name: "Exact FINDRISC Implementation", regex: /exact\s+findrisc/i },
  { name: "Exact Framingham Implementation", regex: /exact\s+framingham/i },
  { name: "Guaranteed Risk Reduction", regex: /guaranteed\s+risk/i },
  { name: "Hospital-Ready", regex: /hospital[- ]ready/i },
  { name: "Production-Grade Clinical System", regex: /production[- ]grade/i },
  { name: "Statistical Confidence Without Validation", regex: /statistical\s+confidence/i },
];

const IGNORED_PATHS = [
  "node_modules",
  "dist",
  ".git",
  "docs",
  "e2e",
  "test-semantic.ts", // Ignore this test file itself
];

function walk(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (IGNORED_PATHS.some((p) => filePath.includes(p))) {
      continue;
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, callback);
    } else if (stat.isFile() && /\.(ts|tsx|html|css|js)$/.test(filePath)) {
      callback(filePath);
    }
  }
}

async function runSemanticTests() {
  console.log("==================================================");
  console.log("HEALTHGUARD AI AUTOMATED SEMANTIC REGRESSION TESTS");
  console.log("==================================================");

  let totalViolations = 0;
  const projectRoot = path.resolve(process.cwd(), ".."); // process.cwd() is backend/

  walk(path.join(projectRoot, "src"), checkFile);
  walk(path.join(projectRoot, "backend", "src"), checkFile);
  checkFile(path.join(projectRoot, "index.html"));

  function checkFile(filePath: string) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      BANNED_PATTERNS.forEach((pattern) => {
        if (pattern.regex.test(line)) {
          console.error(
            `❌ Violation: [${pattern.name}] found in ${path.relative(projectRoot, filePath)}:L${idx + 1}`
          );
          console.error(`   Line: "${line.trim()}"`);
          totalViolations++;
        }
      });
    });
  }

  console.log("==================================================");
  console.log("HEALTHGUARD AI AUTOMATED REPOSITORY-POLICY CHECKS");
  console.log("==================================================");

  const BANNED_REPO_PATTERNS = [
    { name: "Synthetic data generator reference", regex: /generate_synthetic_data\.py/i },
    { name: "Synthetic diabetes dataset reference", regex: /diabetes_data\.csv/i },
    { name: "Synthetic diabetes model reference", regex: /diabetes_model\.joblib/i },
    { name: "Hardcoded normal glucose fallback", regex: /fastingBloodSugar\s*\|\|\s*90/ },
    { name: "Legacy V1 model fallback inside V2 module code", regex: /1\.0\.0-legacy/ }
  ];

  walk(path.join(projectRoot, "src"), checkRepoFile);
  walk(path.join(projectRoot, "backend", "src"), checkRepoFile);
  checkRepoFile(path.join(projectRoot, "index.html"));

  function checkRepoFile(filePath: string) {
    if (!fs.existsSync(filePath)) return;
    
    // Ignore test files for repository policy checks to avoid false positives on tests asserting absence/removal
    const filename = path.basename(filePath);
    if (filename.startsWith("test-") || filename.includes("test")) {
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      BANNED_REPO_PATTERNS.forEach((pattern) => {
        if (pattern.regex.test(line)) {
          console.error(
            `❌ Repo-Policy Violation: [${pattern.name}] found in ${path.relative(projectRoot, filePath)}:L${idx + 1}`
          );
          console.error(`   Line: "${line.trim()}"`);
          totalViolations++;
        }
      });
    });
  }

  // ── Unconditionally prohibited files ──────────────────────────────────────
  // These must never exist in the repository under any circumstances.
  const prohibitedFiles = [
    "health-intelligence/health-intelligence/data/diabetes_data.csv",
    "health-intelligence/data/diabetes_data.csv",
    "health-intelligence/health-intelligence/models/diabetes_model.joblib",
    "health-intelligence/training/generate_synthetic_data.py",
  ];

  prohibitedFiles.forEach((file) => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      console.error(`❌ Repo-Policy Violation: Prohibited model file exists at ${file}`);
      totalViolations++;
    }
  });

  // ── Conditional governance check for the research model artifact ───────────
  // health-intelligence/models/diabetes_model.joblib is permitted ONLY when:
  //   1. health-intelligence/models/diabetes_model_metadata.json exists alongside it.
  //   2. metadata.lifecycle_status is "RESEARCH_ONLY" or "VALIDATION_CANDIDATE".
  //   3. metadata.dataset_source contains "ICMR" (case-insensitive).
  // If the model file is absent, no check is performed.
  // If any condition fails, this is a governance violation (catches an
  // undocumented or synthetic model silently re-appearing in the repo).
  const ACCEPTED_LIFECYCLE_STATES = new Set(["RESEARCH_ONLY", "VALIDATION_CANDIDATE"]);
  const researchModelPath   = path.join(projectRoot, "health-intelligence/models/diabetes_model.joblib");
  const researchMetaPath    = path.join(projectRoot, "health-intelligence/models/diabetes_model_metadata.json");

  if (fs.existsSync(researchModelPath)) {
    console.log(`ℹ️  Research model artifact found — running governance check...`);

    if (!fs.existsSync(researchMetaPath)) {
      console.error(
        `❌ Repo-Policy Violation: diabetes_model.joblib exists but ` +
        `diabetes_model_metadata.json is missing. ` +
        `Every model artifact must be accompanied by a metadata file.`
      );
      totalViolations++;
    } else {
      let metaParsed: Record<string, unknown> | null = null;
      try {
        metaParsed = JSON.parse(fs.readFileSync(researchMetaPath, "utf-8"));
      } catch (e) {
        console.error(
          `❌ Repo-Policy Violation: diabetes_model_metadata.json exists but ` +
          `could not be parsed as JSON: ${(e as Error).message}`
        );
        totalViolations++;
      }

      if (metaParsed !== null) {
        const lifecycle    = typeof metaParsed["lifecycle_status"] === "string"
          ? metaParsed["lifecycle_status"] as string
          : "";
        const datasetSource = typeof metaParsed["dataset_source"] === "string"
          ? metaParsed["dataset_source"] as string
          : "";

        if (!ACCEPTED_LIFECYCLE_STATES.has(lifecycle)) {
          console.error(
            `❌ Repo-Policy Violation: diabetes_model_metadata.json has ` +
            `lifecycle_status="${lifecycle}" which is not an accepted state ` +
            `(${[...ACCEPTED_LIFECYCLE_STATES].join(" | ")}). ` +
            `This may indicate an undocumented or synthetic model.`
          );
          totalViolations++;
        } else {
          console.log(`   ✓ lifecycle_status="${lifecycle}" — accepted.`);
        }

        if (!/icmr/i.test(datasetSource)) {
          console.error(
            `❌ Repo-Policy Violation: diabetes_model_metadata.json has ` +
            `dataset_source="${datasetSource}" which does not reference "ICMR". ` +
            `Only models trained on the approved ICMR-INDIAB dataset are permitted.`
          );
          totalViolations++;
        } else {
          console.log(`   ✓ dataset_source="${datasetSource}" — references ICMR.`);
        }
      }
    }
  }


  console.log("==================================================");
  if (totalViolations > 0) {
    console.error(`TESTS FAILED: Found ${totalViolations} guideline violations.`);
    process.exit(1);
  } else {
    console.log("✅ All semantic and repository policy checks passed!");
    process.exit(0);
  }
}

runSemanticTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
