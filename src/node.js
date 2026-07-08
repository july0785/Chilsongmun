import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DuumJudge, DATA_FILES, judgeFromParts } from "./duum.js";

const DEFAULT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

async function loadDuum(dataDir = DEFAULT_DIR) {
  const parts = await Promise.all(
    DATA_FILES.map((f) => readFile(path.join(dataDir, f), "utf-8").then(JSON.parse)),
  );
  return judgeFromParts(parts);
}

export { DuumJudge, loadDuum };
export { _internal } from "./duum.js";
