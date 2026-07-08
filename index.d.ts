export interface HanjaEntry {
  hanja: string | null;
  duum: boolean | null;
  ne: number;
  kw?: string[];
  north?: string;
  nk?: boolean;
}

export interface DuumData {
  word_hanja: Record<string, HanjaEntry[]>;
  boneum: {
    table: Record<string, { eums: string[]; is_duum: boolean }>;
    index: Record<string, string[]>;
  };
  stems: string[];
  gold: Record<string, { hanja: string; label: unknown; eum?: string }>;
  names: string[];
}

export type Context = Map<string, number> | Set<string> | string[] | null;

export declare class Verdict {
  word: string;
  is_duum: boolean;
  confidence: number;
  layer: string;
  evidence: Record<string, unknown>;
  munhwaeo: string;
  toDict(): {
    word: string; is_duum: boolean; munhwaeo: string;
    confidence: number; layer: string; evidence: Record<string, unknown>;
  };
}

export declare class AnalyzeResult {
  token: string;
  stem: string;
  south: string;
  verdict: Verdict;
  munhwaeo_token: string;
  readonly is_duum: boolean;
  toDict(): {
    token: string; stem: string; south: string; is_duum: boolean;
    munhwaeo_token: string; confidence: number; layer: string;
    evidence: Record<string, unknown>;
  };
}

export interface TransformResult {
  input: string;
  munhwaeo: string;
  changed: boolean;
  tokens: AnalyzeResult[];
}

export declare class DuumJudge {
  constructor(data: DuumData);
  judge(word: string, context?: Context): Verdict;
  judgeDecomp(word: string, context?: Context): Verdict;
  analyze(token: string, context?: Context): AnalyzeResult;
  transformText(text: string): TransformResult;
}

export declare function loadDuum(dataDir?: string): Promise<DuumJudge>;

export declare const _internal: Record<string, (...args: any[]) => any>;
