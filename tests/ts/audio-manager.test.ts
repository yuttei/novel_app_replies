import assert from "node:assert/strict";
import test from "node:test";

import { AudioManager } from "../../src/ts/audio-manager.ts";

type EventCallback = () => void;

class FakeAudio {
  src: string;
  currentTime: number;
  loop: boolean;
  paused: boolean;
  preload: string;
  volume: number;
  listeners: Map<string, Set<EventCallback>>;

  constructor(src: string) {
    this.src = src;
    this.currentTime = 0;
    this.loop = false;
    this.paused = true;
    this.preload = "";
    this.volume = 1;
    this.listeners = new Map();
  }

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  addEventListener(type: string, listener: EventCallback): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventCallback): void {
    this.listeners.get(type)?.delete(listener);
  }
}

interface FakeWindow {
  performance: { now: () => number };
  requestAnimationFrame: (callback: (time: number) => void) => number;
  cancelAnimationFrame: (frameId: number) => void;
  setTimeout?: (callback: () => void, ms?: number) => number;
  clearTimeout?: (timerId: number) => void;
}

function installAnimationFrameClock(): {
  fakeWindow: FakeWindow;
  runNextFrame: (time: number) => void;
} {
  let currentTime = 0;
  let nextFrameId = 1;
  const callbacks = new Map<number, (time: number) => void>();

  Object.defineProperty(globalThis, "Audio", {
    value: FakeAudio,
    configurable: true,
    writable: true,
  });

  const fakeWindow: FakeWindow = {
    performance: {
      now: () => currentTime,
    },
    requestAnimationFrame: (callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      callbacks.set(frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (frameId) => {
      callbacks.delete(frameId);
    },
  };

  Object.defineProperty(globalThis, "window", {
    value: fakeWindow,
    configurable: true,
    writable: true,
  });

  return {
    fakeWindow,
    runNextFrame(time: number): void {
      currentTime = time;
      const nextCallback = callbacks.entries().next().value;
      if (!nextCallback) {
        assert.fail("実行待ちのアニメーションフレームが必要です。");
      }
      const [frameId, callback] = nextCallback;
      callbacks.delete(frameId);
      callback(time);
    },
  };
}

test("fadeToは指定された緩急で音量を変え、最後に停止する", async () => {
  const clock = installAnimationFrameClock();
  const manager = new AudioManager(
    { bgm: { path: "bgm/test.mp3", loop: true } },
    "/static/audio",
  );
  const audio = manager.get("bgm");
  await manager.play("bgm", { restart: false });

  const smoothStep = (progress: number): number => progress * progress * (3 - 2 * progress);
  const fade = manager.fadeTo("bgm", 0, 1000, {
    stopWhenFinished: true,
    easing: smoothStep,
  });

  clock.runNextFrame(250);
  assert.equal(audio.volume, 0.84375);
  assert.equal(audio.paused, false);

  clock.runNextFrame(1000);
  await fade;
  assert.equal(audio.volume, 0);
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 0);
});

test("fadeToは緩急を省略すると一定速度で音量を変える", async () => {
  const clock = installAnimationFrameClock();
  const manager = new AudioManager(
    { bgm: { path: "bgm/test.mp3" } },
    "/static/audio",
  );
  const audio = manager.get("bgm");
  await manager.play("bgm", { restart: false });

  const fade = manager.fadeTo("bgm", 0, 1000);
  clock.runNextFrame(250);
  assert.equal(audio.volume, 0.75);
  clock.runNextFrame(1000);
  await fade;
});

test("新しいフェードは古いフェードをcancelledで完了させる", async () => {
  const clock = installAnimationFrameClock();
  const manager = new AudioManager(
    { bgm: { kind: "bgm", path: "bgm/test.mp3" } },
    "/static/audio",
  );
  await manager.play("bgm", { restart: false });

  const firstFade = manager.fadeTo("bgm", 0.4, 1000);
  clock.runNextFrame(250);
  const secondFade = manager.fadeTo("bgm", 0, 500);

  assert.equal(await firstFade, "cancelled");
  clock.runNextFrame(750);
  assert.equal(await secondFade, "completed");
});

test("停止とタイムアウトで古い非同期処理を残さない", async () => {
  const { fakeWindow } = installAnimationFrameClock();
  let timeoutCallback: (() => void) | undefined;
  fakeWindow.setTimeout = (callback) => {
    timeoutCallback = callback;
    return 1;
  };
  fakeWindow.clearTimeout = () => {};
  const manager = new AudioManager(
    { se: { kind: "se", path: "se/test.mp3" } },
    "/static/audio",
  );
  const audio = manager.get("se") as unknown as FakeAudio;

  const playback = manager.playUntilEnd("se", 100);
  assert.equal(audio.listeners.get("ended")?.size, 1);
  assert.equal(audio.listeners.get("error")?.size, 1);
  if (!timeoutCallback) {
    assert.fail("タイムアウトコールバックが登録されている必要があります。");
  }
  timeoutCallback();
  await playback;
  assert.equal(audio.listeners.get("ended")?.size, 0);
  assert.equal(audio.listeners.get("error")?.size, 0);
});
