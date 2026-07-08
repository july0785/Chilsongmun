import { loadDuum } from "../src/node.js";

const j = await loadDuum();
const cases = [
  ["영리한 학생", "령리한 학생"],
  ["그 학생은 매우 영리하다", "그 학생은 매우 령리하다"],
  ["치열한 경쟁", "치렬한 경쟁"],
  ["유사한 사례가 많다", "류사한 사례가 많다"],
  ["먹의 농담", "먹의 농담"],
  ["잉크의 농담을 조절하다", "잉크의 농담을 조절하다"],
  ["농담 반 진담 반", "롱담 반 진담 반"],
  ["친구와 농담하며 웃었다", "친구와 롱담하며 웃었다"],
  ["회사는 영리를 추구한다", "회사는 영리를 추구한다"],
  ["유망한 회사", "유망한 회사"],
  ["요란한 소리", "요란한 소리"],
  ["쓰레기를 연소하다", "쓰레기를 연소하다"],
  ["영리한테 물어봐", "영리한테 물어봐"],
  ["이력서를 제출하였다", "리력서를 제출하였다"],
  ["이 영토는 우리의 것이다", "이 령토는 우리의 것이다"],
];
let fail = 0;
for (const [input, expect] of cases) {
  const got = j.transformText(input).munhwaeo;
  const ok = got === expect;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${input} -> ${got}${ok ? "" : `  (기대: ${expect})`}`);
}
console.log(fail === 0 ? "\n전부 통과" : `\n실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
