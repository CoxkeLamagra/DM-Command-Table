import { test, expect } from "@playwright/test";

test("update endpoints require administrator access and reject unapproved commands", async ({
  request,
}) => {
  expect((await request.get("/api/admin/updates")).status()).toBe(403);
  expect(
    (
      await request.post("/api/admin/updates", { data: { action: "start" } })
    ).status(),
  ).toBe(403);
  await request.post("/api/auth", {
    data: {
      action: "login",
      username: "browser-batch1",
      password: "browser-test-pass",
    },
  });
  expect((await request.get("/api/admin/updates")).status()).toBe(403);
  expect(
    (
      await request.post("/api/admin/updates", { data: { action: "start" } })
    ).status(),
  ).toBe(403);
  await request.post("/api/auth", {
    data: {
      action: "login",
      username: "browser-test",
      password: "browser-test-pass",
    },
  });
  const state = await request.get("/api/admin/updates");
  expect(state.status()).toBe(200);
  expect(await state.json()).toEqual({ available: false, job: null });
  expect(state.headers()["cache-control"]).toContain("no-store");
  expect(
    (
      await request.post("/api/admin/updates", {
        data: { action: "start", target: "; id" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/admin/updates", { data: { action: "start" } })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post("/api/admin/updates", {
        headers: { origin: "https://attacker.invalid" },
        data: { action: "start" },
      })
    ).status(),
  ).toBe(403);
});

test("administrator sees disabled update control without the Debian service", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Application updates" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update application", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("GUI updates require the Debian LXC update service.", {
      exact: false,
    }),
  ).toBeVisible();
});

test("update panel shows progress, reconnects and retains completion logs", async ({
  page,
}) => {
  let started = false,
    completed = false,
    disconnected = false;
  const job = {
    id: "job-1",
    status: "running",
    target: "origin/main",
    actor: "admin",
    startedAt: Date.now(),
    finishedAt: null,
    exitCode: null,
    steps: [{ id: "build", status: "running" }],
    log: "Building application\n",
  };
  await page.route("**/api/admin/updates", async (route) => {
    if (route.request().method() === "POST") started = true;
    else if (disconnected) {
      await route.abort();
      return;
    }
    await route.fulfill({
      json: {
        available: true,
        target: "origin/main",
        job: started
          ? completed
            ? {
                ...job,
                status: "succeeded",
                finishedAt: Date.now(),
                exitCode: 0,
                steps: [{ id: "build", status: "succeeded" }],
                log: "Completed <script>literal log text</script>",
              }
            : job
          : null,
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Application updates" });
  page.on("dialog", (dialog) => dialog.accept());
  await panel
    .getByRole("button", { name: "Update application", exact: true })
    .click();
  await expect(
    panel.getByText("Build application", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Update running…", exact: true }),
  ).toBeDisabled();
  disconnected = true;
  await expect(
    panel.getByText(/Retrying; the application may be restarting/),
  ).toBeVisible({ timeout: 10000 });
  disconnected = false;
  completed = true;
  await expect(
    panel.getByText("Update completed successfully.", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await panel.getByText("Update log (latest 64 KB)", { exact: true }).click();
  await expect(panel.locator("pre")).toHaveText(
    "Completed <script>literal log text</script>",
  );
  await expect(
    panel.getByRole("button", { name: "Reload application" }),
  ).toBeVisible();
});
