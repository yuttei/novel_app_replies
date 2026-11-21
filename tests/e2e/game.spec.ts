import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function installPredictableAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const playingElements = new WeakSet<HTMLMediaElement>();
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get(this: HTMLMediaElement): boolean {
        return !playingElements.has(this);
      },
    });
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement): Promise<void> {
      playingElements.add(this);
      if (!this.loop) {
        window.setTimeout(() => this.dispatchEvent(new Event("ended")), 10);
      }
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement): void {
      playingElements.delete(this);
    };
  });
}

async function expectStageInsideViewport(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const stage = await page.locator(".game-stage").boundingBox();
  expect(stage).not.toBeNull();
  if (!viewport || !stage) {
    return;
  }
  expect(stage.x).toBeGreaterThanOrEqual(0);
  expect(stage.y).toBeGreaterThanOrEqual(0);
  expect(stage.x + stage.width).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(stage.y + stage.height).toBeLessThanOrEqual(viewport.height + 0.5);
}

test("タイトルと本編が3種類の画面内へ収まる", async ({ page }) => {
  await installPredictableAudio(page);
  for (const viewport of [
    { width: 667, height: 375 },
    { width: 844, height: 390 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expectStageInsideViewport(page);
    await page.goto("/game.html", { waitUntil: "domcontentloaded" });
    await expectStageInsideViewport(page);
  }
});

test("クレジットとタイトル復帰確認をキーボードで操作できる", async ({ page }) => {
  await installPredictableAudio(page);
  await page.goto("/");
  await page.getByRole("button", { name: "音源クレジット" }).click();
  await expect(page.getByRole("dialog", { name: "音源クレジット" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "音源クレジット" })).not.toBeVisible();

  await page.goto("/game.html");
  const titleButton = page.getByRole("button", { name: "タイトルへ" });
  await expect(titleButton).toBeEnabled();
  await titleButton.click();
  const returnDialog = page.getByRole("dialog", { name: "タイトルに戻りますか？" });
  await expect(returnDialog).toBeVisible();
  await expect(page.getByRole("button", { name: "キャンセル" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "タイトルに戻る" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(returnDialog).not.toBeVisible();
});

test("不正なシナリオは日本語のエラー画面へ移る", async ({ page }) => {
  const response = await page.request.get("/data/scenario.json");
  const scenario = await response.json() as {
    chapters: { entries: { selectEffects?: string[] }[] }[];
  };
  scenario.chapters[0].entries[0].selectEffects = ["start-corridor-bgm"];
  await page.route("**/data/scenario.json", (route) => route.fulfill({ json: scenario }));
  await page.goto("/game.html");
  await expect(page.getByRole("alert")).toContainText("selectEffectsは主人公台詞だけ");
});

test("タイトルからENDを経てタイトルへ戻れる", async ({ page }) => {
  await installPredictableAudio(page);
  await page.goto("/");
  await page.getByRole("button", { name: "tap to start" }).click();
  await expect(page).toHaveURL(/\/game(?:\.html)?$/);

  const advance = page.getByRole("button", { name: "物語を次へ進める" });
  const ending = page.getByRole("button", { name: "tap to end" });
  const deadline = Date.now() + 160_000;
  while (Date.now() < deadline) {
    if (await ending.isVisible() && await ending.isEnabled()) {
      break;
    }
    const protagonist = page.locator(".protagonist-line:enabled").first();
    if (await protagonist.isVisible()) {
      await protagonist.click();
    } else if (await advance.isVisible() && await advance.isEnabled()) {
      await advance.click();
    } else {
      await page.waitForTimeout(100);
    }
  }

  await expect(ending).toBeVisible();
  await expect(page.getByText("END", { exact: true })).toBeVisible();
  await ending.click();
  await expect(page).toHaveURL(/\/$/);
});
