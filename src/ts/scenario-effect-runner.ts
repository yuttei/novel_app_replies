import {
  EFFECT_DEFINITIONS,
  EFFECT_PHASES,
  getEffectDefinition,
} from "./scenario-effects.ts";
import type { EffectId, EffectPhase } from "./scenario-effects.ts";

/*
 * 演出IDを実際の処理へ結び付けます。
 * 起動時にカタログとの対応を確認し、IDだけ追加して再生処理を忘れる事故を防ぎます。
 */

export type EffectHandler<TContext> = (context: TContext) => unknown | Promise<unknown>;

export type EffectHandlersByPhase<TContext> = Record<
  EffectPhase,
  Partial<Record<EffectId, EffectHandler<TContext>>>
>;

export class ScenarioEffectRunner<TContext = Record<string, unknown>> {
  private readonly handlersByPhase: EffectHandlersByPhase<TContext>;

  constructor(handlersByPhase: EffectHandlersByPhase<TContext>) {
    this.handlersByPhase = handlersByPhase;
    (Object.entries(EFFECT_DEFINITIONS) as [EffectId, (typeof EFFECT_DEFINITIONS)[EffectId]][]).forEach(
      ([effectId, definition]) => {
        definition.phases.forEach((phase) => {
          if (typeof handlersByPhase[phase]?.[effectId] !== "function") {
            throw new Error(`演出「${effectId}」の${phase}処理が実装されていません。`);
          }
        });
      },
    );
  }

  async run(
    phase: EffectPhase,
    effectIds: readonly string[] | undefined,
    context: TContext = {} as TContext,
  ): Promise<void> {
    if (!(Object.values(EFFECT_PHASES) as readonly string[]).includes(phase)) {
      throw new Error(`未知の演出タイミングです: ${String(phase)}`);
    }
    for (const effectId of effectIds ?? []) {
      const definition = getEffectDefinition(effectId);
      if (!definition?.phases.includes(phase)) {
        throw new Error(`演出「${effectId}」は${phase}では実行できません。`);
      }
      const handler = this.handlersByPhase[phase]?.[effectId as EffectId];
      if (!handler) {
        throw new Error(`演出「${effectId}」の${phase}処理が実装されていません。`);
      }
      await handler(context);
    }
  }
}
