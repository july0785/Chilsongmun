// 확장프로그램용 라이트 데이터팩 빌더 + 동작 동일성 전수 검증
//
// 사용법 (저장소 뿌리에서):
//   node tools/build-datapack.mjs
//   → dist/lite-data/ 에 축약 사전 5종 생성, 전수 대조 통과 시 exit 0
//   → 이후: tar --format=ustar -czf chilsongmun_data_vX.Y.Z.tgz -C dist/lite-data \
//           corpus_stems.json gold_dict.json hanja_boneum.json names.json word_hanja.json
//      sha256 을 구해 릴리스에 올리고, 확장 chilsongmun/offscreen-bridge.js 의
//      DATA_VERSION / DATA_SHA256 상수를 함께 갱신한다.
//
// 원리: judge()의 WSD(공기어 kw)는 후보 사이에서 "고를 것이 있을 때"만 결과를 바꾼다.
//   - 후보가 전부 비변환(duum=false) → 어떤 문맥에서도 비변환 → 최소 항목 1개로 축약
//   - 후보가 전부 변환이고 산출 표기도 전부 같음 → 무문맥 선택 규칙이 뽑을 대표 1개만 남김(kw 제거)
//   - 변환/비변환 혼합이거나 산출 표기가 갈림 → 원본 그대로 보존(kw 포함)
//   - HADA_SENSE 등재어는 무조건 전체 보존
// 축약 후 전 키(judge 무문맥·hada) 전수 대조 + 문맥 회귀 배터리로 동일성을 증명한다.
// SDK 저장소의 data/ 원본(전체판)은 유지한다 — 라이트판은 확장 배포용 산출물이다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DATA_FILES, judgeFromParts } from "../src/duum.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data");
const OUT_DIR = join(ROOT, "dist", "lite-data");
const HADA_WORDS = new Set(["영리", "치열", "유사", "영묘"]);   // src/duum.js HADA_SENSE와 동기 유지

const raw = {};
for (const f of DATA_FILES) raw[f] = readFileSync(join(DATA_DIR, f), "utf8");
const wh = JSON.parse(raw["word_hanja.json"]);
const rest = DATA_FILES.slice(1).map((f) => JSON.parse(raw[f]));
const judgeFull = judgeFromParts([wh, ...rest]);

function candOutput(word, e) {
  let duum = e.duum, mw = word;
  if (duum && e.north) { mw = e.north; duum = mw !== word; }
  else if (duum && e.hanja) { [mw, duum] = judgeFull._munhwaeoFull(word, e.hanja); }
  else if (duum) { duum = false; }
  return duum + "|" + mw;
}
function noCtxSel(e) { return [0, (e.ne || 0) + (e.nk ? 2 : 0), e.nk ? 1 : 0]; }
function tupleCmp(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; }
  return a.length - b.length;
}
function maxBy(arr, keyFn) {
  let best = arr[0], bk = keyFn(best);
  for (let i = 1; i < arr.length; i++) { const k = keyFn(arr[i]); if (tupleCmp(k, bk) > 0) { best = arr[i]; bk = k; } }
  return best;
}
function slim(e, dropKw) {
  const o = { hanja: e.hanja ?? null, duum: e.duum, ne: e.ne || 0 };
  if (!dropKw && e.kw) o.kw = e.kw;
  if (e.north) o.north = e.north;
  if (e.nk) o.nk = true;
  return o;
}

let nMixed = 0, nAllFalse = 0, nAllTrueOne = 0, nAllTrueVaried = 0, nKeep = 0;
const lite = {};
for (const [word, entries] of Object.entries(wh)) {
  const cands = entries.filter((e) => e && e.duum != null);
  if (HADA_WORDS.has(word) || cands.length === 0) { lite[word] = entries; nKeep++; continue; }
  const duumSet = new Set(cands.map((e) => !!e.duum));
  if (duumSet.size > 1) { lite[word] = entries.map((e) => slim(e, false)); nMixed++; continue; }
  if (!duumSet.has(true)) { lite[word] = [{ hanja: null, duum: false, ne: 0 }]; nAllFalse++; continue; }
  const outs = new Set(cands.map((e) => candOutput(word, e)));
  if (outs.size === 1) { lite[word] = [slim(maxBy(cands, noCtxSel), true)]; nAllTrueOne++; }
  else { lite[word] = entries.map((e) => slim(e, false)); nAllTrueVaried++; }
}
console.log(`혼합(보존): ${nMixed} | 전부비변환(축약): ${nAllFalse} | 전부변환·단일산출(대표1): ${nAllTrueOne} | 전부변환·산출갈림(보존): ${nAllTrueVaried} | 특수보존: ${nKeep}`);

mkdirSync(OUT_DIR, { recursive: true });
const liteJson = JSON.stringify(lite);
writeFileSync(join(OUT_DIR, "word_hanja.json"), liteJson);
for (const f of DATA_FILES) if (f !== "word_hanja.json") writeFileSync(join(OUT_DIR, f), raw[f]);
console.log(`word_hanja: ${(raw["word_hanja.json"].length / 1048576).toFixed(1)}M자 → ${(liteJson.length / 1048576).toFixed(1)}M자`);

// ─ 동일성 전수 검증 ─
const judgeLite = judgeFromParts([lite, ...rest]);
let diff = 0;
for (const word of Object.keys(wh)) {
  for (const hada of [false, true]) {
    const a = judgeFull.judge(word, null, hada), b = judgeLite.judge(word, null, hada);
    if (a.is_duum !== b.is_duum || a.munhwaeo !== b.munhwaeo) {
      if (diff < 8) console.log("차이:", word, hada ? "(hada)" : "", a.munhwaeo, "vs", b.munhwaeo);
      diff++;
    }
  }
}
console.log(`전수 대조(무문맥+hada, ${Object.keys(wh).length}키×2): 차이 ${diff}건`);

const battery = [
  "이력서를 제출하였다", "영롱한 빛깔", "확연하게 다르다", "유연하게 대처했다",
  "출산율이 떨어졌다", "양자 입양 절차", "치열한 경쟁이 벌어졌다", "치과에서 치열 교정을 받았다",
  "군인들이 대열을 맞췄다", "내력이 깊은 집안이다", "내력벽을 철거하면 위험하다",
  "기둥의 내력이 부족해 보강했다", "싱싱한 연어 회를 먹었다", "자연어 처리 기술",
  "영리한 아이다", "회사의 영리 목적", "요리 수업을 들었다", "노동자들의 연대 투쟁",
  "군 연대 병력이 이동했다", "은행 여신 업무", "그리스 신화의 여신", "양분을 흡수했다",
  "재산을 양분했다", "이영수 씨가 왔다", "다양성을 존중한다", "서양식 건물", "용서를 빌었다"
];
let diffT = 0;
for (const s of battery) {
  const a = judgeFull.transformText(s).munhwaeo, b = judgeLite.transformText(s).munhwaeo;
  if (a !== b) { console.log("문맥차이:", s, "|", a, "vs", b); diffT++; }
}
console.log(`문맥 배터리 ${battery.length}건: 차이 ${diffT}건`);
process.exit(diff + diffT ? 1 : 0);
