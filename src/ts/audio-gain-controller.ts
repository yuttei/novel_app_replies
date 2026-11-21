/*
 * BGMの音量を、PCとスマートフォンで同じように変更するための補助クラスです。
 * iPhoneでaudio.volumeが反映されない場合は、Web Audio APIのGainNodeを使います。
 */

export interface GainAudioTarget {
  volume: number;
}

export interface AudioGainEntry {
  id: string;
  audio: GainAudioTarget;
  volume: number;
}

interface WebkitAudioWindow extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export class AudioGainController {
  readonly audioById: Map<string, GainAudioTarget>;
  readonly gainById: Map<string, GainNode>;
  readonly sourceById: Map<string, MediaElementAudioSourceNode>;
  readonly volumeById: Map<string, number>;
  audioContext: AudioContext | null;

  constructor(entries: readonly AudioGainEntry[]) {
    this.audioById = new Map();
    this.gainById = new Map();
    this.sourceById = new Map();
    this.volumeById = new Map();
    this.audioContext = null;

    entries.forEach(({ id, audio, volume }) => {
      this.audioById.set(id, audio);
      this.volumeById.set(id, volume);
    });

    const audioWindow = window as WebkitAudioWindow;
    const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextClass || entries.length === 0) {
      entries.forEach(({ audio, volume }) => {
        audio.volume = volume;
      });
      return;
    }

    try {
      // 1ページにつき1つだけ作り、すべてのBGMを同じ出力先へ接続します。
      this.audioContext = new AudioContextClass();
    } catch {
      entries.forEach(({ audio, volume }) => {
        audio.volume = volume;
      });
      return;
    }

    entries.forEach(({ id, audio, volume }) => {
      if (!this.audioContext) {
        audio.volume = volume;
        return;
      }
      try {
        const source = this.audioContext.createMediaElementSource(audio as HTMLMediaElement);
        const gain = this.audioContext.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(this.audioContext.destination);
        // 実際の音量はGainNodeで管理するため、audio要素側は最大に固定します。
        audio.volume = 1;
        this.sourceById.set(id, source);
        this.gainById.set(id, gain);
      } catch {
        // Web Audioへの接続に失敗した音源だけ、従来の音量設定へ戻します。
        audio.volume = volume;
      }
    });
  }

  has(id: string): boolean {
    return this.audioById.has(id);
  }

  getVolume(id: string): number | undefined {
    return this.volumeById.get(id);
  }

  setVolume(id: string, volume: number): void {
    const safeVolume = Math.min(Math.max(volume, 0), 1);
    const audio = this.audioById.get(id);
    if (!audio) {
      throw new Error(`音量を管理するBGM「${id}」が登録されていません。`);
    }

    this.volumeById.set(id, safeVolume);
    const gain = this.gainById.get(id);
    if (gain) {
      gain.gain.value = safeVolume;
      return;
    }
    audio.volume = safeVolume;
  }

  resume(): Promise<boolean> {
    if (!this.audioContext || this.audioContext.state === "running") {
      return Promise.resolve(true);
    }
    return this.audioContext.resume()
      .then(() => this.audioContext?.state === "running")
      .catch(() => false);
  }

  isRunning(): boolean {
    return !this.audioContext || this.audioContext.state === "running";
  }
}
