import { test, expect } from "playwright/test";

test.describe("HealthGuard AI E2E Smoke Suite", () => {
  test("Full User Session Flow", async ({ page }) => {
    // 1. LANDING PAGE LOAD
    console.log("Step 1: Navigating to landing page...");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/HealthGuard/);
    
    const branding = page.locator("text=HealthGuard").first();
    await expect(branding).toBeVisible();

    // Navigate to Signup page
    console.log("Step 2: Navigating to signup page...");
    await page.goto("/signup");
    await expect(page).toHaveURL(/.*signup/);

    // 2. ONBOARDING REGISTRATION
    console.log("Step 3: Registering new user...");
    const testEmail = `smoke-user-${Date.now()}@example.com`;
    const testPassword = "SmokePassword123!";

    await page.fill("input#name", "Smoke Test Patient");
    await page.fill("input#email", testEmail);
    await page.fill("input#password", testPassword);
    await page.fill("input#confirmPassword", testPassword);

    await page.click('button[type="submit"]');

    // 3. ASSESSMENT CHOICE
    console.log("Step 4: Choosing the questionnaire assessment path...");
    await page.waitForURL("**/assessment**", { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /tell us about your health/i }),
    ).toBeVisible();

    const startAssessment = page.getByRole("button", {
      name: /^start assessment$/i,
    });
    await expect(startAssessment).toBeVisible();
    await startAssessment.click();

    // 4. QUESTIONNAIRE
    console.log("Step 5: Completing assessment questionnaire...");

    // Basic Profile (default demographic values are already populated)
    await expect(
      page.getByRole("button", { name: /stay healthy/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Health Info
    await expect(
      page.getByRole("button", { name: /^no medical conditions$/i }),
    ).toBeVisible();
    await page.getByPlaceholder(/mother.*type 2 diabetes/i).fill(
      "Mother has type 2 diabetes",
    );
    await page.getByPlaceholder(/occasional fatigue/i).fill(
      "Occasional thirst and dry mouth",
    );
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Lifestyle
    await expect(
      page.getByRole("button", { name: /^no equipment$/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Diet Preferences & Submission
    await expect(page.getByRole("checkbox", { name: /^paneer$/i })).toBeVisible();
    await expect(
      page.getByText(/educational health risk assessments/i),
    ).toBeVisible();

    console.log("Submitting assessment wizard...");
    const riskCalculation = page.waitForResponse((response) =>
      response.url().endsWith("/api/risk/calculate"),
    );
    await page.getByRole("button", { name: /^generate plan$/i }).click();
    await expect((await riskCalculation).ok()).toBeTruthy();

    // 5. VERIFY CURRENT POST-ASSESSMENT RESULTS
    console.log("Step 6: Verifying action plan renders...");
    await page.waitForURL("**/action-plan**", { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /^action plan$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^weekly meal planner$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^weekly workout plan$/i }),
    ).toBeVisible();
    await expect(page.getByText(/this week's top actions/i)).toBeVisible();

    // Verify lack of ML risk cards/claims
    const mlCard = page.getByText(/machine learning/i);
    await expect(mlCard).not.toBeVisible();

    // 6. LOGOUT FLOW & STORAGE CLEANUP
    console.log("Step 7: Logging out...");
    await page.getByRole("button", { name: /smoke test patient/i }).click();
    await page.getByText(/^log out$/i).click();

    // Wait for redirect to home or login page
    await page.waitForURL((url) =>
      url.pathname === "/" || url.pathname === "/login",
    );

    // Assert local storage keys are cleaned up
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const hgKeys = localStorageKeys.filter(key => key.startsWith("hg."));
    expect(hgKeys.length).toBe(0);
  });
});
