import { loadDuum } from "../src/node.js";
import { HdrHistogram, formatLatency } from "./hdr.js";

const j = await loadDuum();

console.log(j.judge("영롱").munhwaeo);
console.log(j.judge("이력").munhwaeo);
console.log(j.judge("이사").is_duum, j.judge("이사").layer);

const sentences = [
  "이력서를 제출하였다",
  "일본 열도의 화산",
  "치열한 경쟁이 벌어졌다",
  "양자 입양 절차",
];

for (const s of sentences) {
  const r = j.transformText(s);
  console.log(`${s}  ->  ${r.munhwaeo}${r.changed ? "" : "  (유지)"}`);
}

const hist = new HdrHistogram();
for (let i = 0; i < 250; i++) {
  for (const s of sentences) {
    const t0 = performance.now();
    j.transformText(s);
    hist.record(performance.now() - t0);
  }
}
console.log(`처리 속도: ${formatLatency(hist)}`);
