import assert from "node:assert/strict";
import test from "node:test";

import {
  GAME_STATES,
  GameStateController,
} from "../../src/ts/game-state-controller.ts";

test("台詞表示と演出を明示した状態名で遷移する", () => {
  const state = new GameStateController();
  assert.equal(state.getState(), GAME_STATES.LOADING);
  state.transition(GAME_STATES.OPENING);
  state.transition(GAME_STATES.TYPING);
  state.transition(GAME_STATES.AWAITING_ADVANCE);
  state.transition(GAME_STATES.RUNNING_EFFECT);
  state.transition(GAME_STATES.AWAITING_PROTAGONIST);
  assert.equal(state.getState(), GAME_STATES.AWAITING_PROTAGONIST);
});

test("確認画面を閉じると直前の状態へ戻る", () => {
  const state = new GameStateController();
  state.transition(GAME_STATES.TYPING);
  assert.equal(state.openReturnDialog(), true);
  assert.equal(state.getState(), GAME_STATES.RETURN_DIALOG);
  assert.equal(state.closeReturnDialog(), true);
  assert.equal(state.getState(), GAME_STATES.TYPING);
});

test("演出中は確認画面を開かず、タイトル復帰後は状態を戻さない", () => {
  const state = new GameStateController();
  state.transition(GAME_STATES.RUNNING_EFFECT);
  assert.equal(state.openReturnDialog(), false);
  state.transition(GAME_STATES.RETURNING);
  assert.equal(state.transition(GAME_STATES.TYPING), false);
  assert.equal(state.getState(), GAME_STATES.RETURNING);
});
