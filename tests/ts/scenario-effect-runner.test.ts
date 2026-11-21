import assert from "node:assert/strict";
import test from "node:test";

import { ScenarioEffectRunner } from "../../src/ts/scenario-effect-runner.ts";
import type { EffectHandlersByPhase } from "../../src/ts/scenario-effect-runner.ts";
import { EFFECT_DEFINITIONS, EFFECT_PHASES } from "../../src/ts/scenario-effects.ts";
import type { EffectId, EffectPhase } from "../../src/ts/scenario-effects.ts";

function completeHandlers(
  overrides: Partial<EffectHandlersByPhase<Record<string, unknown>>> = {},
): EffectHandlersByPhase<Record<string, unknown>> {
  const handlers: EffectHandlersByPhase<Record<string, unknown>> = {
    [EFFECT_PHASES.ENTER]: {},
    [EFFECT_PHASES.SELECT]: {},
    [EFFECT_PHASES.COMPLETE]: {},
  };
  (Object.entries(EFFECT_DEFINITIONS) as [EffectId, (typeof EFFECT_DEFINITIONS)[EffectId]][]).forEach(
    ([effectId, definition]) => {
      definition.phases.forEach((phase) => {
        handlers[phase][effectId] = async () => {};
      });
    },
  );
  (Object.entries(overrides) as [EffectPhase, EffectHandlersByPhase<Record<string, unknown>>[EffectPhase]][]).forEach(
    ([phase, phaseHandlers]) => {
      Object.assign(handlers[phase], phaseHandlers);
    },
  );
  return handlers;
}

test("カタログ順に演出ハンドラーを実行する", async () => {
  const calls: string[] = [];
  const runner = new ScenarioEffectRunner(completeHandlers({
    [EFFECT_PHASES.SELECT]: {
      "hold-before-next-line": async () => {
        calls.push("hold");
      },
      "set-character-grin": async () => {
        calls.push("grin");
      },
    },
  }));
  await runner.run(EFFECT_PHASES.SELECT, ["hold-before-next-line", "set-character-grin"]);
  assert.deepEqual(calls, ["hold", "grin"]);
});

test("演出ハンドラーの追加漏れを起動時に検出する", () => {
  const handlers = completeHandlers();
  delete handlers[EFFECT_PHASES.ENTER]["water-transition"];
  assert.throws(() => new ScenarioEffectRunner(handlers), /実装されていません/);
});
