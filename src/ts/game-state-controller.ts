/*
 * 本編が現在どの操作を受け付ける状態かを一か所で管理します。
 * 複数の真偽値を個別に変更すると矛盾した組み合わせが生まれるため、状態名で遷移させます。
 */

export const GAME_STATES = Object.freeze({
  LOADING: "loading",
  OPENING: "opening",
  TYPING: "typing",
  AWAITING_ADVANCE: "awaiting-advance",
  AWAITING_PROTAGONIST: "awaiting-protagonist",
  RUNNING_EFFECT: "running-effect",
  SONG_CARD: "song-card",
  ENDING_TRANSITION: "ending-transition",
  ENDING_READY: "ending-ready",
  RETURN_DIALOG: "return-dialog",
  RETURNING: "returning",
  ERROR: "error",
} as const);

export type GameState = (typeof GAME_STATES)[keyof typeof GAME_STATES];

const ALL_STATES = new Set<GameState>(Object.values(GAME_STATES));
const RETURN_DIALOG_STATES = new Set<GameState>([
  GAME_STATES.OPENING,
  GAME_STATES.TYPING,
  GAME_STATES.AWAITING_ADVANCE,
  GAME_STATES.AWAITING_PROTAGONIST,
  GAME_STATES.SONG_CARD,
  GAME_STATES.ERROR,
]);

export class GameStateController {
  private state: GameState;
  private returnState: GameState | null;

  constructor() {
    this.state = GAME_STATES.LOADING;
    this.returnState = null;
  }

  getState(): GameState {
    return this.state;
  }

  is(...states: readonly GameState[]): boolean {
    return states.includes(this.state);
  }

  transition(nextState: GameState): boolean {
    if (!ALL_STATES.has(nextState)) {
      throw new Error(`未知のゲーム状態です: ${String(nextState)}`);
    }
    if (this.state === GAME_STATES.RETURNING && nextState !== GAME_STATES.ERROR) {
      return false;
    }
    this.state = nextState;
    return true;
  }

  canOpenReturnDialog(): boolean {
    return RETURN_DIALOG_STATES.has(this.state);
  }

  openReturnDialog(): boolean {
    if (!this.canOpenReturnDialog()) {
      return false;
    }
    this.returnState = this.state;
    this.state = GAME_STATES.RETURN_DIALOG;
    return true;
  }

  closeReturnDialog(): boolean {
    if (this.state !== GAME_STATES.RETURN_DIALOG || this.returnState === null) {
      return false;
    }
    this.state = this.returnState;
    this.returnState = null;
    return true;
  }

  fail(): void {
    this.returnState = null;
    this.state = GAME_STATES.ERROR;
  }
}
