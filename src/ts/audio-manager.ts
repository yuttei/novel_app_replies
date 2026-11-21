import { AudioGainController } from "./audio-gain-controller.ts";
import type { AudioGainEntry } from "./audio-gain-controller.ts";

/*
 * 本編で使うBGMとSEをまとめて管理します。
 * 新しい音源はscenario.jsonのassets.audioへ追加すると、ここで自動的に読み込みます。
 */

export type AudioKind = "bgm" | "se";

export interface AudioDefinition {
  kind?: AudioKind;
  path: string;
  loop?: boolean;
  volume?: number;
}

export type EasingFunction = (progress: number) => number;
export type FadeResult = "completed" | "cancelled" | "skipped";

export interface PlayOptions {
  restart?: boolean;
}

export interface FadeOptions {
  stopWhenFinished?: boolean;
  easing?: EasingFunction;
}

interface FadeJob {
  frameId: number | null;
  resolve: (result: FadeResult) => void;
}

// イージングが指定されていないフェードは、これまでどおり一定速度で音量を変えます。
const LINEAR_EASING: EasingFunction = (progress) => progress;

export class AudioManager {
  readonly audioById: Map<string, HTMLAudioElement>;
  readonly fadeJobById: Map<string, FadeJob>;
  readonly bgmGain: AudioGainController;

  constructor(audioDefinitions: Record<string, AudioDefinition>, audioBaseUrl: string) {
    this.audioById = new Map();
    this.fadeJobById = new Map();
    const bgmEntries: AudioGainEntry[] = [];

    Object.entries(audioDefinitions).forEach(([id, definition]) => {
      const audio = new Audio(`${audioBaseUrl}/${definition.path}`);
      audio.preload = "auto";
      audio.loop = definition.loop === true;
      audio.volume = definition.volume ?? 1;
      this.audioById.set(id, audio);
      if (definition.kind === "bgm") {
        bgmEntries.push({ id, audio, volume: definition.volume ?? 1 });
      }
    });
    this.bgmGain = new AudioGainController(bgmEntries);
  }

  get(id: string): HTMLAudioElement {
    const audio = this.audioById.get(id);
    if (!audio) {
      throw new Error(`音源「${id}」がscenario.jsonに登録されていません。`);
    }
    return audio;
  }

  play(id: string, { restart = true }: PlayOptions = {}): Promise<boolean> {
    const audio = this.get(id);
    // タップから呼ばれた場合、この時点でiPhoneの音声出力を再開します。
    void this.resume();
    if (restart) {
      audio.currentTime = 0;
    }
    const playResult = audio.play();
    return playResult === undefined
      ? Promise.resolve(true)
      : playResult.then(() => true).catch(() => false);
  }

  playUntilEnd(id: string, fallbackMs = 2500): Promise<void> {
    const audio = this.get(id);
    return new Promise((resolve) => {
      let isFinished = false;
      let fallbackTimer: number | null = null;
      const finish = (): void => {
        if (isFinished) {
          return;
        }
        isFinished = true;
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
        }
        // タイムアウトで先へ進んだ場合も古いリスナーを残さず、次回再生へ影響させません。
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("error", finish);
        resolve();
      };
      fallbackTimer = window.setTimeout(finish, fallbackMs);
      audio.currentTime = 0;
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      const playResult = audio.play();
      if (playResult !== undefined) {
        playResult.catch(finish);
      }
    });
  }

  cancelFade(id: string): boolean {
    const job = this.fadeJobById.get(id);
    if (!job) {
      return false;
    }

    if (job.frameId !== null) {
      window.cancelAnimationFrame(job.frameId);
    }
    this.fadeJobById.delete(id);
    // 中断したPromiseも必ず完了させ、呼び出し側が待ち続けないようにします。
    job.resolve("cancelled");
    return true;
  }

  getVolume(id: string): number {
    if (this.bgmGain.has(id)) {
      return this.bgmGain.getVolume(id) ?? this.get(id).volume;
    }
    return this.get(id).volume;
  }

  setVolume(id: string, volume: number): void {
    if (this.bgmGain.has(id)) {
      this.bgmGain.setVolume(id, volume);
      return;
    }
    this.get(id).volume = volume;
  }

  resume(): Promise<boolean> {
    return this.bgmGain.resume();
  }

  fadeTo(
    id: string,
    targetVolume: number,
    durationMs: number,
    { stopWhenFinished = false, easing = LINEAR_EASING }: FadeOptions = {},
  ): Promise<FadeResult> {
    const audio = this.get(id);
    this.cancelFade(id);
    if (audio.paused) {
      return Promise.resolve("skipped");
    }
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return Promise.reject(new Error("フェード時間は0以上の数で指定してください。"));
    }
    if (!Number.isFinite(targetVolume)) {
      return Promise.reject(new Error("フェード先の音量は数で指定してください。"));
    }
    if (durationMs === 0) {
      this.setVolume(id, targetVolume);
      if (stopWhenFinished) {
        audio.pause();
        audio.currentTime = 0;
      }
      return Promise.resolve("completed");
    }

    return new Promise((resolve) => {
      const startedAt = window.performance.now();
      const startedVolume = this.getVolume(id);
      const job: FadeJob = { frameId: null, resolve };
      const updateVolume = (currentTime: number): void => {
        const progress = Math.min((currentTime - startedAt) / durationMs, 1);
        // 終了判定には元の進み具合を使い、音量だけ指定された緩急へ変換します。
        const easedProgress = easing(progress);
        this.setVolume(
          id,
          startedVolume + (targetVolume - startedVolume) * easedProgress,
        );
        if (progress < 1) {
          job.frameId = window.requestAnimationFrame(updateVolume);
          return;
        }
        if (this.fadeJobById.get(id) === job) {
          this.fadeJobById.delete(id);
        }
        if (stopWhenFinished) {
          audio.pause();
          audio.currentTime = 0;
        }
        resolve("completed");
      };
      job.frameId = window.requestAnimationFrame(updateVolume);
      this.fadeJobById.set(id, job);
    });
  }

  stop(id: string): void {
    this.cancelFade(id);
    const audio = this.get(id);
    audio.pause();
    audio.currentTime = 0;
  }

  stopAll(exceptIds: readonly string[] = []): void {
    const exceptions = new Set(exceptIds);
    this.audioById.forEach((_audio, id) => {
      if (!exceptions.has(id)) {
        this.stop(id);
      }
    });
  }
}
