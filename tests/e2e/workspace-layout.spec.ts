import { expect, test, type Page } from "@playwright/test";

const apiBaseUrl = "http://localhost:8080";

const now = new Date("2026-05-16T12:00:00.000Z").toISOString();

function envelope<T>(data: T) {
  return {
    success: true,
    data,
  };
}

async function mockWorkspaceApi(page: Page) {
  // 工作区布局测试只关心前端交互，所有 API 都用稳定 mock，避免真实账号和数据库状态影响宽度断言。
  await page.route(`${apiBaseUrl}/api/v1/me`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          id: "user-1",
          email: "tester@example.com",
          name: "Tester",
          avatarUrl: "",
          createdAt: now,
          updatedAt: now,
        }),
      ),
    }),
  );

  await page.route(`${apiBaseUrl}/api/v1/documents/tree`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope([
          {
            id: "doc-1",
            parentId: null,
            title: "E2E page",
            icon: "",
            coverImage: "",
            isArchived: false,
            isStarred: false,
            isPublished: false,
            isInKnowledgeBase: false,
            position: 1,
            path: "E2E page",
            createdAt: now,
            updatedAt: now,
            children: [],
          },
        ]),
      ),
    }),
  );

  await page.route(`${apiBaseUrl}/api/v1/ai/conversations`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope([])),
    }),
  );

  await page.route(`${apiBaseUrl}/api/v1/ai/conversations/*/messages`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope([])),
    }),
  );
}

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(() => {
    // 直接写入 token 可以绕过登录流程，让布局用例聚焦受保护页面本身。
    window.localStorage.setItem("my-notion-go.access-token", "access-token");
    window.localStorage.setItem("my-notion-go.refresh-token", "refresh-token");
    window.localStorage.setItem("my-notion-go.language", "en");
    window.localStorage.removeItem("my-notion-go.sidebar.width");
    window.localStorage.removeItem("my-notion-go.ai-chat.width");
    window.localStorage.removeItem("my-notion-go.ai-chat.model");
  });
}

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockWorkspaceApi(page);
});

test("sidebar and AI panel widths are resizable within thresholds", async ({ page }) => {
  await page.goto("/app");

  const sidebar = page.getByLabel("Resize sidebar").locator("xpath=..");
  await expect(page.getByText("E2E page")).toBeVisible();

  const sidebarHandle = page.getByLabel("Resize sidebar");
  const sidebarBox = await sidebarHandle.boundingBox();
  if (!sidebarBox) {
    throw new Error("sidebar resize handle is not visible");
  }
  await page.mouse.move(sidebarBox.x + 1, sidebarBox.y + sidebarBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(380, sidebarBox.y + sidebarBox.height / 2);
  await page.mouse.up();
  // 这里验证的是产品阈值生效后的实际 DOM 宽度，而不是 Hook 的内部 state。
  await expect.poll(async () => Math.round((await sidebar.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(370);

  await page.getByRole("button", { name: "AI Assistant" }).click();
  const panel = page.getByLabel("AI assistant panel");
  await expect(panel.getByText("How can I help you today?")).toBeVisible();

  const panelHandle = page.getByLabel("Resize AI panel");
  const panelHandleBox = await panelHandle.boundingBox();
  if (!panelHandleBox) {
    throw new Error("AI panel resize handle is not visible");
  }
  await page.mouse.move(panelHandleBox.x + 1, panelHandleBox.y + panelHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(100, panelHandleBox.y + panelHandleBox.height / 2);
  await page.mouse.up();

  // 右侧面板向左拖到很宽时应被夹到最大 520px，防止覆盖太多编辑区域。
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBeLessThanOrEqual(520);
  await expect.poll(() => page.evaluate(() => Number(window.localStorage.getItem("my-notion-go.ai-chat.width")))).toBe(520);
});

test("AI panel switches model and sends selected model to stream endpoint", async ({ page }) => {
  let requestedModel = "";
  // Hook 在 done 后会 invalidate messages；补这个 mock 可以覆盖“流式临时消息被服务端历史消息替换”的真实路径。
  await page.route(`${apiBaseUrl}/api/v1/ai/conversations/conv-1/messages`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope([
          {
            id: "msg-user",
            conversationId: "conv-1",
            role: "user",
            content: "hello",
            metadata: {},
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "msg-ai",
            conversationId: "conv-1",
            role: "assistant",
            content: "Model switch works.",
            metadata: {},
            createdAt: now,
            updatedAt: now,
          },
        ]),
      ),
    }),
  );
  await page.route(`${apiBaseUrl}/api/v1/ai/chat/stream`, async (route) => {
    const body = route.request().postDataJSON() as { model?: string };
    requestedModel = body.model ?? "";
    // 用原生 text/event-stream mock 后端 SSE，确保前端 parser、临时 assistant 消息和最终消息替换都被覆盖。
    await route.fulfill({
      contentType: "text/event-stream",
      body: [
        `event: conversation\ndata: ${JSON.stringify({ id: "conv-1", title: "New AI chat", createdAt: now, updatedAt: now })}\n\n`,
        `event: user_message\ndata: ${JSON.stringify({ id: "msg-user", conversationId: "conv-1", role: "user", content: "hello", metadata: {}, createdAt: now, updatedAt: now })}\n\n`,
        `event: message\ndata: ${JSON.stringify({ delta: "Model switch " })}\n\n`,
        `event: message\ndata: ${JSON.stringify({ delta: "works." })}\n\n`,
        `event: assistant_message\ndata: ${JSON.stringify({ id: "msg-ai", conversationId: "conv-1", role: "assistant", content: "Model switch works.", metadata: {}, createdAt: now, updatedAt: now })}\n\n`,
        `event: done\ndata: ${JSON.stringify({ conversationId: "conv-1" })}\n\n`,
      ].join(""),
    });
  });

  await page.goto("/app");
  await page.getByRole("button", { name: "AI Assistant" }).click();
  await page.getByRole("button", { name: /DeepSeek V4 Pro/ }).click();
  await page.getByRole("menuitem", { name: /Kimi K2.6/ }).click();
  await page.getByLabel("AI message input").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Model switch works.")).toBeVisible();
  expect(requestedModel).toBe("kimi-k2.6");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("my-notion-go.ai-chat.model"))).toBe("kimi-k2.6");
});
