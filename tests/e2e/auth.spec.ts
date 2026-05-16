import { expect, test, type Page } from "@playwright/test";

const apiBaseUrl = "http://localhost:8080";
const now = new Date("2026-05-16T12:00:00.000Z").toISOString();

function envelope<T>(data: T) {
  return {
    success: true,
    data,
  };
}

function authResult(email: string, name: string) {
  return envelope({
    user: {
      id: "auth-user-1",
      email,
      name,
      avatarUrl: "",
      createdAt: now,
      updatedAt: now,
    },
    tokens: {
      accessToken: "e2e-access-token",
      accessTokenExpiresAt: now,
      refreshToken: "e2e-refresh-token",
      refreshTokenExpiresAt: now,
    },
  });
}

async function seedPublicHome(page: Page) {
  await page.addInitScript(() => {
    // 认证 E2E 必须从完全未登录状态开始，否则 PublicOnlyRoute 会直接重定向到工作区。
    window.localStorage.clear();
    window.localStorage.setItem("my-notion-go.language", "en");
  });
}

async function mockWorkspaceAfterAuth(page: Page) {
  // 注册/登录成功后会立刻进入受保护工作区；这里 mock 文档树，避免测试依赖真实数据库种子数据。
  await page.route(`${apiBaseUrl}/api/v1/documents/tree`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope([
          {
            id: "doc-auth-1",
            parentId: null,
            title: "Auth E2E page",
            icon: "",
            coverImage: "",
            isArchived: false,
            isStarred: false,
            isPublished: false,
            isInKnowledgeBase: false,
            position: 1,
            path: "Auth E2E page",
            createdAt: now,
            updatedAt: now,
            children: [],
          },
        ]),
      ),
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await seedPublicHome(page);
  await mockWorkspaceAfterAuth(page);
});

test("homepage registration stores tokens and enters workspace", async ({ page }) => {
  let registerPayload: { email?: string; name?: string; password?: string } = {};
  await page.route(`${apiBaseUrl}/api/v1/auth/register`, async (route) => {
    // 捕获提交体比只看页面跳转更严格，可以防止表单字段名或 mode 分支接错接口。
    registerPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(authResult("new-user@example.com", "New User")),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Get My-Notion free" }).first().click();
  await expect(page.getByRole("dialog", { name: "Create your account" })).toBeVisible();

  await page.getByLabel("Name").fill("New User");
  await page.getByLabel("Email").fill("new-user@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Auth E2E page")).toBeVisible();
  expect(registerPayload).toEqual({
    email: "new-user@example.com",
    name: "New User",
    password: "password123",
  });
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("my-notion-go.access-token"))).toBe("e2e-access-token");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("my-notion-go.refresh-token"))).toBe("e2e-refresh-token");
});

test("homepage login stores tokens and enters workspace", async ({ page }) => {
  let loginPayload: { deviceName?: string; email?: string; password?: string } = {};
  await page.route(`${apiBaseUrl}/api/v1/auth/login`, async (route) => {
    // 登录接口额外携带 deviceName，用例保留这个断言以覆盖 refresh token 设备标识链路。
    loginPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(authResult("demo@example.com", "Demo User")),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("dialog", { name: "Sign in to My-Notion" })).toBeVisible();

  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Auth E2E page")).toBeVisible();
  expect(loginPayload.email).toBe("demo@example.com");
  expect(loginPayload.password).toBe("password123");
  expect(loginPayload.deviceName).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("my-notion-go.access-token"))).toBe("e2e-access-token");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("my-notion-go.refresh-token"))).toBe("e2e-refresh-token");
});
