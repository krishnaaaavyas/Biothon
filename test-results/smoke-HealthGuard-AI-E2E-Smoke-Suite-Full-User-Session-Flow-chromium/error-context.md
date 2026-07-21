# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> HealthGuard AI E2E Smoke Suite >> Full User Session Flow
- Location: e2e\smoke.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /tell us about your health/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /tell us about your health/i })

```

```yaml
- region "Notifications alt+T"
- complementary:
  - link "HealthGuard Home":
    - /url: /
  - text: HealthGuard
  - navigation:
    - link "healthAssessment":
      - /url: /assessment
    - link "actionPlan":
      - /url: /action-plan
    - link "progress":
      - /url: /progress
    - link "foodScanner":
      - /url: /scanner
    - link "Profile":
      - /url: /profile
  - navigation:
    - link "about":
      - /url: /about
    - link "support":
      - /url: /contact
  - text: v1.0
- banner:
  - button "Collapse sidebar"
  - button "Toggle theme"
  - button "Change language": English
  - button "STP Smoke Test Patient"
- main:
  - text: assessment
  - heading "tellUsAboutYourHealth" [level=1]
  - paragraph: chooseHowToBegin
  - heading "uploadBloodReportTitle" [level=3]
  - paragraph: fastestMethod
  - paragraph: uploadBloodReportDesc
  - list:
    - listitem: aiExtractsLabValues
    - listitem: fasterAnalysis
    - listitem: skipManualEntry
  - button "uploadReportBtn"
  - heading "healthAssessment" [level=3]
  - paragraph: lifestyleAndSymptoms
  - paragraph: answerLifestyleQuestionsDesc
  - list:
    - listitem: lifestyleQuestionsItem
    - listitem: familyHistoryItem
    - listitem: symptomsItem
  - button "startAssessmentBtn"
  - text: ⭐ recommendedBadge
  - heading "completeHealthAnalysisTitle" [level=3]
  - paragraph: fullDiagnosticMapping
  - paragraph: combineBloodReportDesc
  - list:
    - listitem: bloodReportPlusLifestyle
    - listitem: combinedAiAnalysis
    - listitem: richestHealthResults
  - button "startCompleteAnalysisBtn"
  - paragraph: ⚕ medicalDisclaimerTitle
  - paragraph: medicalDisclaimerDesc
```

# Test source

```ts
  1   | import { test, expect } from "playwright/test";
  2   | 
  3   | test.describe("HealthGuard AI E2E Smoke Suite", () => {
  4   |   test("Full User Session Flow", async ({ page }) => {
  5   |     // 1. LANDING PAGE LOAD
  6   |     console.log("Step 1: Navigating to landing page...");
  7   |     await page.goto("/", { waitUntil: "domcontentloaded" });
  8   |     await expect(page).toHaveTitle(/HealthGuard/);
  9   |     
  10  |     const branding = page.locator("text=HealthGuard").first();
  11  |     await expect(branding).toBeVisible();
  12  | 
  13  |     // Navigate to Signup page
  14  |     console.log("Step 2: Navigating to signup page...");
  15  |     await page.goto("/signup");
  16  |     await expect(page).toHaveURL(/.*signup/);
  17  | 
  18  |     // 2. ONBOARDING REGISTRATION
  19  |     console.log("Step 3: Registering new user...");
  20  |     const testEmail = `smoke-user-${Date.now()}@example.com`;
  21  |     const testPassword = "SmokePassword123!";
  22  | 
  23  |     await page.fill("input#name", "Smoke Test Patient");
  24  |     await page.fill("input#email", testEmail);
  25  |     await page.fill("input#password", testPassword);
  26  |     await page.fill("input#confirmPassword", testPassword);
  27  | 
  28  |     await page.click('button[type="submit"]');
  29  | 
  30  |     // 3. ASSESSMENT CHOICE
  31  |     console.log("Step 4: Choosing the questionnaire assessment path...");
  32  |     await page.waitForURL("**/assessment**", { timeout: 15000 });
  33  |     await expect(
  34  |       page.getByRole("heading", { name: /tell us about your health/i }),
> 35  |     ).toBeVisible();
      |       ^ Error: expect(locator).toBeVisible() failed
  36  | 
  37  |     const startAssessment = page.getByRole("button", {
  38  |       name: /^start assessment$/i,
  39  |     });
  40  |     await expect(startAssessment).toBeVisible();
  41  |     await startAssessment.click();
  42  | 
  43  |     // 4. QUESTIONNAIRE
  44  |     console.log("Step 5: Completing assessment questionnaire...");
  45  | 
  46  |     // Basic Profile (default demographic values are already populated)
  47  |     await expect(
  48  |       page.getByRole("button", { name: /stay healthy/i }),
  49  |     ).toBeVisible();
  50  |     await page.getByRole("button", { name: /^continue$/i }).click();
  51  | 
  52  |     // Health Info
  53  |     await expect(
  54  |       page.getByRole("button", { name: /^no medical conditions$/i }),
  55  |     ).toBeVisible();
  56  |     await page.getByPlaceholder(/mother.*type 2 diabetes/i).fill(
  57  |       "Mother has type 2 diabetes",
  58  |     );
  59  |     await page.getByPlaceholder(/occasional fatigue/i).fill(
  60  |       "Occasional thirst and dry mouth",
  61  |     );
  62  |     await page.getByRole("button", { name: /^continue$/i }).click();
  63  | 
  64  |     // Lifestyle
  65  |     await expect(
  66  |       page.getByRole("button", { name: /^no equipment$/i }),
  67  |     ).toBeVisible();
  68  |     await page.getByRole("button", { name: /^continue$/i }).click();
  69  | 
  70  |     // Diet Preferences & Submission
  71  |     await expect(page.getByRole("checkbox", { name: /^paneer$/i })).toBeVisible();
  72  |     await expect(
  73  |       page.getByText(/educational health risk assessments/i),
  74  |     ).toBeVisible();
  75  | 
  76  |     console.log("Submitting assessment wizard...");
  77  |     const riskCalculation = page.waitForResponse((response) =>
  78  |       response.url().endsWith("/api/risk/calculate"),
  79  |     );
  80  |     await page.getByRole("button", { name: /^generate plan$/i }).click();
  81  |     await expect((await riskCalculation).ok()).toBeTruthy();
  82  | 
  83  |     // 5. VERIFY CURRENT POST-ASSESSMENT RESULTS
  84  |     console.log("Step 6: Verifying action plan renders...");
  85  |     await page.waitForURL("**/action-plan**", { timeout: 15000 });
  86  |     await expect(
  87  |       page.getByRole("heading", { name: /^action plan$/i }),
  88  |     ).toBeVisible();
  89  |     await expect(
  90  |       page.getByRole("heading", { name: /^weekly meal planner$/i }),
  91  |     ).toBeVisible();
  92  |     await expect(
  93  |       page.getByRole("heading", { name: /^weekly workout plan$/i }),
  94  |     ).toBeVisible();
  95  |     await expect(page.getByText(/this week's top actions/i)).toBeVisible();
  96  | 
  97  |     // Verify lack of ML risk cards/claims
  98  |     const mlCard = page.getByText(/machine learning/i);
  99  |     await expect(mlCard).not.toBeVisible();
  100 | 
  101 |     // 6. LOGOUT FLOW & STORAGE CLEANUP
  102 |     console.log("Step 7: Logging out...");
  103 |     await page.getByRole("button", { name: /smoke test patient/i }).click();
  104 |     await page.getByText(/^log out$/i).click();
  105 | 
  106 |     // Wait for redirect to home or login page
  107 |     await page.waitForURL((url) =>
  108 |       url.pathname === "/" || url.pathname === "/login",
  109 |     );
  110 | 
  111 |     // Assert local storage keys are cleaned up
  112 |     const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
  113 |     const hgKeys = localStorageKeys.filter(key => key.startsWith("hg."));
  114 |     expect(hgKeys.length).toBe(0);
  115 |   });
  116 | });
  117 | 
```