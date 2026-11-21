import type { DialogueView, ProtagonistView } from "./scenario-runtime.ts";

/*
 * 台詞ボックス、主人公ボタン、読み上げ用テキスト、タイプライター表示を担当します。
 * シナリオの進行判断は行わず、表示完了を呼び出し側へ通知します。
 */

export interface GameDialogViewOptions {
  dialogBox: HTMLElement;
  speakerName: HTMLElement;
  dialogText: HTMLElement;
  dialogAnnouncement: HTMLElement;
  nextMark: HTMLElement;
  protagonistDialog: HTMLElement;
  protagonistLines: HTMLElement;
  typewriterDelayMs: number;
  onTypingFinished: () => void;
  onProtagonistSelection: (event: MouseEvent) => void;
}

export class GameDialogView {
  private readonly dialogBox: HTMLElement;
  private readonly speakerName: HTMLElement;
  private readonly dialogText: HTMLElement;
  private readonly dialogAnnouncement: HTMLElement;
  private readonly nextMark: HTMLElement;
  private readonly protagonistDialog: HTMLElement;
  private readonly protagonistLines: HTMLElement;
  private readonly typewriterDelayMs: number;
  private readonly onTypingFinished: () => void;
  private readonly onProtagonistSelection: (event: MouseEvent) => void;
  private characters: string[];
  private characterIndex: number;
  private announcement: string;
  private timer: number | null;
  private typing: boolean;

  constructor({
    dialogBox,
    speakerName,
    dialogText,
    dialogAnnouncement,
    nextMark,
    protagonistDialog,
    protagonistLines,
    typewriterDelayMs,
    onTypingFinished,
    onProtagonistSelection,
  }: GameDialogViewOptions) {
    this.dialogBox = dialogBox;
    this.speakerName = speakerName;
    this.dialogText = dialogText;
    this.dialogAnnouncement = dialogAnnouncement;
    this.nextMark = nextMark;
    this.protagonistDialog = protagonistDialog;
    this.protagonistLines = protagonistLines;
    this.typewriterDelayMs = typewriterDelayMs;
    this.onTypingFinished = onTypingFinished;
    this.onProtagonistSelection = onProtagonistSelection;
    this.characters = [];
    this.characterIndex = 0;
    this.announcement = "";
    this.timer = null;
    this.typing = false;
  }

  clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  hideDialogs(): void {
    this.dialogBox.hidden = true;
    this.protagonistDialog.hidden = true;
  }

  getProtagonistButtons(): HTMLButtonElement[] {
    return [...this.protagonistLines.querySelectorAll<HTMLButtonElement>(".protagonist-line")];
  }

  renderProtagonist(view: ProtagonistView): void {
    this.clearTimer();
    this.typing = false;
    this.dialogBox.hidden = true;
    this.protagonistDialog.hidden = false;
    this.protagonistLines.replaceChildren();
    view.lines.forEach((line) => {
      const lineBox = document.createElement("button");
      lineBox.type = "button";
      lineBox.className = "protagonist-line";
      lineBox.classList.toggle("is-red", view.textTone === "red");
      lineBox.textContent = line;
      lineBox.addEventListener("click", this.onProtagonistSelection);
      this.protagonistLines.append(lineBox);
    });
    this.announcement = `主人公「${view.sourceText}」`;
    this.dialogAnnouncement.textContent = this.announcement;
  }

  renderDialogue(view: DialogueView): void {
    this.protagonistDialog.hidden = true;
    this.dialogBox.hidden = false;
    if (view.speaker === null) {
      this.speakerName.hidden = true;
      this.speakerName.textContent = "";
    } else {
      this.speakerName.textContent = view.speaker;
      this.speakerName.hidden = false;
      this.speakerName.classList.toggle("is-named", view.speaker === "クロコ");
    }
    this.startTypewriter(view);
  }

  startTypewriter(view: DialogueView): void {
    this.clearTimer();
    this.characters = [...view.text];
    this.characterIndex = 0;
    this.announcement = view.speaker ? `${view.speaker}「${view.text}」` : view.text;
    this.dialogText.textContent = "";
    this.dialogAnnouncement.textContent = "";
    this.nextMark.hidden = true;
    this.typing = true;
    this.scheduleNextCharacter();
  }

  scheduleNextCharacter(): void {
    this.timer = window.setTimeout(() => this.typeNextCharacter(), this.typewriterDelayMs);
  }

  typeNextCharacter(): void {
    if (!this.typing) {
      return;
    }
    if (this.characterIndex >= this.characters.length) {
      this.finishTyping();
      return;
    }
    this.dialogText.textContent += this.characters[this.characterIndex];
    this.characterIndex += 1;
    this.scheduleNextCharacter();
  }

  finishTyping(): void {
    if (!this.typing) {
      return;
    }
    this.clearTimer();
    this.typing = false;
    this.dialogAnnouncement.textContent = this.announcement;
    this.nextMark.hidden = false;
    this.onTypingFinished();
  }

  completeCurrentText(): boolean {
    if (!this.typing) {
      return false;
    }
    this.clearTimer();
    this.dialogText.textContent = this.characters.join("");
    this.characterIndex = this.characters.length;
    this.finishTyping();
    return true;
  }

  pauseTyping(): void {
    this.clearTimer();
  }

  resumeTyping(): void {
    if (this.typing && this.timer === null) {
      this.scheduleNextCharacter();
    }
  }
}
