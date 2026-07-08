import { DuumJudge, DATA_FILES, judgeFromParts } from "./duum.js";

async function loadDuum(dataDir) {
  let base;
  if (dataDir == null) {
    base = new URL("../data/", import.meta.url);
  } else {
    const withSlash = dataDir.endsWith("/") ? dataDir : dataDir + "/";
    const ref = typeof location !== "undefined" ? location.href : import.meta.url;
    base = new URL(withSlash, ref);
  }
  const parts = await Promise.all(DATA_FILES.map((f) =>
    fetch(new URL(f, base)).then((r) => {
      if (!r.ok) throw new Error(`두음 사전 로드 실패 ${f}: HTTP ${r.status}`);
      return r.json();
    })));
  return judgeFromParts(parts);
}

export { DuumJudge, loadDuum };
export { _internal } from "./duum.js";
