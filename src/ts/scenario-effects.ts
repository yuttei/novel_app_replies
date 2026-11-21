/*
 * scenario.jsonで使える演出IDと、実行に必要な素材を一か所で管理します。
 * 検証処理と再生処理が別々の一覧を持つと追加漏れが起きるため、両方から参照します。
 */

export const EFFECT_PHASES = Object.freeze({
  ENTER: "enter",
  SELECT: "select",
  COMPLETE: "complete",
} as const);

export type EffectPhase = (typeof EFFECT_PHASES)[keyof typeof EFFECT_PHASES];

export interface EffectDefinition {
  readonly phases: readonly EffectPhase[];
  readonly audioIds: readonly string[];
}

export const EFFECT_DEFINITIONS = Object.freeze({
  "water-transition": Object.freeze({ phases: [EFFECT_PHASES.ENTER], audioIds: ["bubble"] }),
  "start-corridor-bgm": Object.freeze({
    phases: [EFFECT_PHASES.ENTER, EFFECT_PHASES.SELECT],
    audioIds: ["corridor"],
  }),
  "fade-out-corridor-bgm": Object.freeze({ phases: [EFFECT_PHASES.ENTER], audioIds: ["corridor"] }),
  "hesitation-zoom-shake": Object.freeze({ phases: [EFFECT_PHASES.ENTER], audioIds: ["footsteps"] }),
  "final-dialog-pause": Object.freeze({ phases: [EFFECT_PHASES.ENTER], audioIds: [] }),
  "final-camera-zoom": Object.freeze({ phases: [EFFECT_PHASES.ENTER], audioIds: [] }),
  "start-eternal-earth-bgm": Object.freeze({ phases: [EFFECT_PHASES.SELECT], audioIds: ["eternal-earth"] }),
  "start-star-remnants-bgm": Object.freeze({ phases: [EFFECT_PHASES.SELECT], audioIds: ["star-remnants"] }),
  "hold-before-next-line": Object.freeze({ phases: [EFFECT_PHASES.SELECT], audioIds: [] }),
  "set-character-surprise": Object.freeze({ phases: [EFFECT_PHASES.SELECT], audioIds: [] }),
  "set-character-grin": Object.freeze({ phases: [EFFECT_PHASES.SELECT], audioIds: [] }),
  "register-name": Object.freeze({ phases: [EFFECT_PHASES.COMPLETE], audioIds: [] }),
  "stop-corridor-bgm": Object.freeze({ phases: [EFFECT_PHASES.COMPLETE], audioIds: ["corridor"] }),
} as const satisfies Record<string, EffectDefinition>);

export type EffectId = keyof typeof EFFECT_DEFINITIONS;

// シナリオ上の演出とは別に、基本操作と冒頭処理が常に使用する音源です。
export const CORE_AUDIO_IDS = Object.freeze([
  "cancel",
  "decision",
  "footsteps",
  "metronome",
] as const);

export function getEffectDefinition(effectId: string): EffectDefinition | null {
  if (!Object.hasOwn(EFFECT_DEFINITIONS, effectId)) {
    return null;
  }
  return EFFECT_DEFINITIONS[effectId as EffectId];
}

interface EffectBearingEntry {
  readonly enterEffects?: readonly string[];
  readonly selectEffects?: readonly string[];
  readonly completeEffects?: readonly string[];
}

interface EffectBearingScenario {
  readonly chapters: readonly {
    readonly entries: readonly EffectBearingEntry[];
  }[];
}

export function getRequiredAudioIds(scenario: EffectBearingScenario): Set<string> {
  const requiredIds = new Set<string>(CORE_AUDIO_IDS);
  scenario.chapters.forEach((chapter) => {
    chapter.entries.forEach((entry) => {
      (["enterEffects", "selectEffects", "completeEffects"] as const).forEach((propertyName) => {
        (entry[propertyName] ?? []).forEach((effectId) => {
          getEffectDefinition(effectId)?.audioIds.forEach((audioId) => requiredIds.add(audioId));
        });
      });
    });
  });
  return requiredIds;
}
