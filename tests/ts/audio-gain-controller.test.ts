import assert from "node:assert/strict";
import test from "node:test";

import { AudioGainController } from "../../src/ts/audio-gain-controller.ts";

class FakeGainNode {
  gain: { value: number };
  connectedTo: unknown;

  constructor() {
    this.gain = { value: 1 };
    this.connectedTo = null;
  }

  connect(destination: unknown): unknown {
    this.connectedTo = destination;
    return destination;
  }
}

class FakeSourceNode {
  audio: unknown;
  connectedTo: unknown;

  constructor(audio: unknown) {
    this.audio = audio;
    this.connectedTo = null;
  }

  connect(destination: unknown): unknown {
    this.connectedTo = destination;
    return destination;
  }
}

class FakeAudioContext {
  destination: { kind: string };
  state: AudioContextState;

  constructor() {
    this.destination = { kind: "speaker" };
    this.state = "suspended";
  }

  createMediaElementSource(audio: unknown): FakeSourceNode {
    return new FakeSourceNode(audio);
  }

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  resume(): Promise<void> {
    this.state = "running";
    return Promise.resolve();
  }
}

function setFakeWindow(fakeWindow: Record<string, unknown>): void {
  Object.defineProperty(globalThis, "window", {
    value: fakeWindow,
    configurable: true,
    writable: true,
  });
}

test("Web Audio対応時はaudio.volumeではなくGainNodeでBGM音量を変える", async () => {
  setFakeWindow({ AudioContext: FakeAudioContext });
  const audio = { volume: 0.2 };
  const controller = new AudioGainController([
    { id: "bgm", audio, volume: 0.3 },
  ]);

  assert.equal(audio.volume, 1);
  assert.equal(controller.getVolume("bgm"), 0.3);
  assert.equal(controller.isRunning(), false);

  controller.setVolume("bgm", 0.15);
  assert.equal(controller.getVolume("bgm"), 0.15);
  assert.equal(controller.gainById.get("bgm")?.gain.value, 0.15);
  assert.equal(audio.volume, 1);

  assert.equal(await controller.resume(), true);
  assert.equal(controller.isRunning(), true);
});

test("Web Audio非対応時はaudio.volumeへ戻す", async () => {
  setFakeWindow({});
  const audio = { volume: 1 };
  const controller = new AudioGainController([
    { id: "bgm", audio, volume: 0.3 },
  ]);

  controller.setVolume("bgm", 0.2);
  assert.equal(audio.volume, 0.2);
  assert.equal(controller.getVolume("bgm"), 0.2);
  assert.equal(await controller.resume(), true);
});
