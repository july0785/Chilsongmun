import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "examples", "browser-demo-standalone.html");

const core = (await readFile(path.join(ROOT, "src", "duum.js"), "utf-8"))
  .replace(/^export /gm, "")
  .replace(/^\{ DuumJudge, DATA_FILES, judgeFromParts \};\s*$/m, "");

const hdr = (await readFile(path.join(ROOT, "examples", "hdr.js"), "utf-8"))
  .replace(/^export .*$/m, "");

const DATA_FILES = ["word_hanja.json", "hanja_boneum.json", "corpus_stems.json", "gold_dict.json", "names.json"];

const blocks = [];
for (const f of DATA_FILES) {
  const raw = await readFile(path.join(ROOT, "data", f));
  const b64 = gzipSync(raw, { level: 9 }).toString("base64");
  blocks.push(`<script type="application/gzip-b64" data-name="${f}">${b64}</script>`);
  console.log(`${f}: ${(raw.length / 1048576).toFixed(1)}MB -> ${(b64.length / 1048576).toFixed(1)}MB b64`);
}

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>duum SDK — 스탠드얼론 예제</title>
<style>
  body { font-family: system-ui, "Malgun Gothic", sans-serif; max-width: 640px;
         margin: 40px auto; padding: 0 16px; line-height: 1.6; }
  input { width: 100%; padding: 10px 12px; font-size: 1.1rem; box-sizing: border-box; }
  #out { margin-top: 16px; font-size: 1.4rem; min-height: 1.4em; }
  .m { color: #6b7280; font-size: .9rem; }
</style>
</head>
<body>
<h1>두음법칙 변환기 (스탠드얼론)</h1>
<p class="m" id="status">사전 압축 해제 중…</p>
<input id="in" placeholder="문장을 입력하세요" value="이력서를 제출하였다" disabled>
<div id="out"></div>
<p class="m" id="lat"></p>

${blocks.join("\n")}

<script type="module">
${core}
${hdr}

const $ = (id) => document.getElementById(id);

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function gunzipJson(b64) {
  const stream = new Blob([b64ToBytes(b64)]).stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json();
}

try {
  const parts = await Promise.all(DATA_FILES.map((f) => {
    const el = document.querySelector(\`script[data-name="\${f}"]\`);
    return gunzipJson(el.textContent.trim());
  }));
  const j = judgeFromParts(parts);
  $("status").textContent = "준비 완료";
  const inp = $("in"); inp.disabled = false;
  const hist = new HdrHistogram();
  let rounds = 0;
  const sample = (text) => {
    if (!rounds) {
      rounds = 1;
      for (;;) {
        const t0 = performance.now();
        for (let i = 0; i < rounds; i++) j.transformText(text);
        if (performance.now() - t0 >= 2 || rounds >= 4096) break;
        rounds *= 2;
      }
    }
    const t0 = performance.now();
    for (let i = 0; i < rounds; i++) j.transformText(text);
    hist.record((performance.now() - t0) / rounds);
  };
  const run = () => {
    $("out").textContent = j.transformText(inp.value.trim()).munhwaeo;
    sample(inp.value.trim());
    $("lat").textContent = formatLatency(hist) + (rounds > 1 ? \` (표본=연속 \${rounds}회 평균)\` : "");
  };
  inp.addEventListener("input", run);
  for (let i = 0; i < 30; i++) run();
} catch (e) {
  $("status").textContent = "로드 실패: " + e.message;
  console.error(e);
}
</script>
</body>
</html>
`;

await writeFile(OUT, html);
console.log(`-> ${OUT} (${(html.length / 1048576).toFixed(1)}MB)`);
