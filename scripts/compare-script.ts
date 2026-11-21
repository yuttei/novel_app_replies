import { readFile } from "node:fs/promises";
import type { Scenario } from "../src/ts/scenario-runtime.ts";

/*
 * static/data/scenario.json と docs/specs/script.md の台詞差分を、
 * 必要なときだけ確認するスクリプトです。
 */

const SCENARIO_PATH = "static/data/scenario.json";
const SCRIPT_PATH = "docs/specs/script.md";
const SPEAKER_PATTERN = /^\*\*(.+?)\*\*\s*(.*)$/;
const QUOTED_TEXT_PATTERN = /「([^」]*)」/g;
const INLINE_DIRECTION_PATTERN = /\([^)]*\)/g;

export async function readScriptDialogues(): Promise<string[]> {
  // 台本の実装済み範囲（## 冒頭 以降）から、話者と原文を表示順に取り出します。
  const scriptText = await readFile(SCRIPT_PATH, "utf8");
  const markerIndex = scriptText.indexOf("## 冒頭");
  if (markerIndex === -1) {
    throw new Error(`${SCRIPT_PATH} に「## 冒頭」が見つかりません。`);
  }
  const implementedText = scriptText.slice(markerIndex + "## 冒頭".length);
  const dialogues: string[] = [];

  for (const rawLine of implementedText.split(/\r?\n/)) {
    const match = SPEAKER_PATTERN.exec(rawLine.trim());
    if (!match) {
      continue;
    }
    const speaker = match[1];
    const remainder = match[2];
    for (const quoteMatch of remainder.matchAll(QUOTED_TEXT_PATTERN)) {
      const displayText = quoteMatch[1].replace(INLINE_DIRECTION_PATTERN, "");
      const displaySpeaker = speaker === "地の文" ? "地の文" : speaker;
      dialogues.push(`${displaySpeaker}: ${displayText}`);
    }
  }
  return dialogues;
}

export async function readScenarioDialogues(): Promise<string[]> {
  // ブラウザで使用する正本から、話者と原文を表示順に取り出します。
  const scenario = JSON.parse(await readFile(SCENARIO_PATH, "utf8")) as Scenario;
  const dialogues: string[] = [];

  for (const chapter of scenario.chapters) {
    for (const entry of chapter.entries) {
      const speaker =
        entry.kind === "protagonist"
          ? "主人公"
          : (entry.speaker ?? "地の文");
      dialogues.push(`${speaker}: ${entry.sourceText}`);
    }
  }
  return dialogues;
}

function buildLineDiff(scriptLines: readonly string[], scenarioLines: readonly string[]): string[] {
  const diffLines: string[] = [];
  const maxLength = Math.max(scriptLines.length, scenarioLines.length);

  for (let index = 0; index < maxLength; index += 1) {
    const left = scriptLines[index];
    const right = scenarioLines[index];
    if (left === right) {
      continue;
    }
    if (left !== undefined) {
      diffLines.push(`- [${index + 1}] ${left}`);
    }
    if (right !== undefined) {
      diffLines.push(`+ [${index + 1}] ${right}`);
    }
  }
  return diffLines;
}

async function main(): Promise<void> {
  const isCheckMode = process.argv.includes("--check");
  const scriptDialogues = await readScriptDialogues();
  const scenarioDialogues = await readScenarioDialogues();
  const diffLines = buildLineDiff(scriptDialogues, scenarioDialogues);

  if (diffLines.length === 0) {
    console.log("docs/specs/script.mdとscenario.jsonの台詞に差分はありません。");
    return;
  }

  console.log(`--- ${SCRIPT_PATH}`);
  console.log(`+++ ${SCENARIO_PATH}`);
  console.log(diffLines.join("\n"));
  console.log("\nブラウザで使う正本はstatic/data/scenario.jsonです。");
  if (isCheckMode) {
    process.exitCode = 1;
  }
}

await main();
