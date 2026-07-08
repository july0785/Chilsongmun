# ai-readme.md — AI 개발 에이전트용 코드베이스 가이드

> 대상: 이 저장소를 수정·확장하는 AI 코딩 에이전트.
> 사람용 개요는 `README.md`. 이 문서는 정확한 식별자·스키마·불변식·금지사항만 다룬다.

## 0. 한 줄 정의

남한어 → 북한 문화어 두음법칙 변환기의 **순수 JS(ESM) SDK**. 의존성 0, Node ≥18 + 브라우저 겸용.
핵심 원리: 표면형만으로 판정 불가 → **단어→한자**(word_hanja) × **한자→본음**(hanja_boneum) 두 축의 결정론 룩업.

```js
import { loadDuum } from "duum";           // Node: src/node.js, 브라우저: src/browser.js (조건부 exports)
const j = await loadDuum();                // 5개 JSON 사전 로드 (~37MB, 최초 1회)
j.judge("영롱").munhwaeo;                  // '령롱'
j.transformText("이력서를 제출하였다").munhwaeo;  // '리력서를 제출하였다'
```

## 1. 파일 지도

| 경로 | 역할 | 수정 빈도 |
|---|---|---|
| `src/duum.js` | **엔진 전체** (684줄, fs/fetch 의존 없음, 순수 함수 + `DuumJudge`) | 거의 모든 로직 변경이 여기 |
| `src/node.js` | Node 진입점 — `fs`로 `data/` 읽어 `loadDuum()` 제공 | 거의 안 건드림 |
| `src/browser.js` | 브라우저 진입점 — `fetch`로 동일 사전 로드 | 거의 안 건드림 |
| `index.d.ts` | 공개 API 타입 선언 (수동 관리 — API 변경 시 함께 갱신) | API 변경 시 |
| `package.json` | 조건부 `exports`: `.`(런타임 자동), `./core`(엔진만), `./data/*` | API 변경 시 |
| `data/*.json` | 사전 5종 (§3). **상위 Python 프로젝트의 빌드 산출물 — 여기서 손으로 편집 금지** | 재빌드로만 |
| `examples/_verify.mjs` | **회귀 테스트** (15케이스, exit code로 판정) | 케이스 추가 |
| `examples/node-demo.mjs` | 데모 + HdrHistogram 레이턴시 측정 | — |
| `examples/build-standalone.mjs` | 사전을 gzip-b64로 인라인한 단일 HTML 생성 | — |

상위 디렉터리(`../duum/`)에 동일 로직의 **Python 원본**이 있다. 이 SDK는 그 포팅이며, 판정 로직을 바꿀 때는 Python 쪽(`../duum/judge.py`, `wsd.py`)과 의도적으로 동기화할지 여부를 먼저 판단할 것.

## 2. 함수 명명 규정 (팀 규정 — 위반 금지)

영문 의미역이 아니라 **한국어 로마자 표기**를 쓴다. 새 함수·필드에도 동일 적용.

| 개념 | 식별자 | 쓰지 말 것 |
|---|---|---|
| 두음 | `duum`, `is_duum`, `applyDuumWord` | `duen`, `initialSound` |
| 한글 음절 판정 | `ishangulummgyol` | `isHangulSyllable` |
| 남한 표기로 | `tonamhan` | `toSouth` |
| 접사·조사 제거 | `deljepsaandjosa` | `stripAffixes` |
| 성씨 본음 복원 | `restorefirstnamebonum` | `restoreSurnameForm` |

JSON 스키마 키도 `duum`/`is_duum`이다. `../output/`, `../outputv2/` 구버전 산출물만 구 철자(`duen`)를 유지하므로 참조하지 말 것.

## 3. 데이터 스키마 (data/)

로드 순서는 `DATA_FILES` 상수(duum.js:660) 고정: `word_hanja, hanja_boneum, corpus_stems, gold_dict, names`.

### word_hanja.json — 15.4만 키, 36MB (핵심)
```jsonc
"영리": [ { "hanja": "營利", "duum": false, "ne": 7, "kw": ["재산상의", "이익을", ...] }, ... ]
// hanja: 한자 표기 | duum: 이 한자 선택 시 변환 대상인가 | ne: 우리말샘 예문 수(빈도 대용)
// kw: 뜻풀이·예문 어휘 (WSD 공기어) | north/nk: 북한어 표제어 실증 병합분(§5 L2)
"이사장": [ { "hanja": "理事長", "duum": true, "ne": 0, "kw": [...], "north": "리사장", "nk": true } ]
```

### hanja_boneum.json — `{ table, index }`
```jsonc
"table": { "領": { "eums": ["령"], "is_duum": true } }   // 한자 → 본음 후보 (Unihan kHangul, 8,525자)
"index": { "영": ["令", "咏", ...] }                       // 남한 음절 → 그 음으로 읽히는 한자들 (L3 fallback용)
```

### 나머지
- `corpus_stems.json`: 북한 코퍼스 어간 1,794개 배열 (L1 직접 증거)
- `gold_dict.json`: `{ 단어: { label: bool, hanja, eum } }` 1,142키 (L2g 보조)
- `names.json`: 등재 인명 36개 배열 (NAME 층)

## 4. 공개 API (index.d.ts와 1:1)

```
loadDuum(dataDir?) → Promise<DuumJudge>
DuumJudge.judge(word, context?, hada?)      → Verdict        // 단일 어간 판정 (내부: hada 3번째 인자, d.ts 미노출)
DuumJudge.judgeDecomp(word, context?)       → Verdict        // L3/L율 결과면 복합어 어두 분해 재시도
DuumJudge.analyze(token, context?)          → AnalyzeResult  // 어절: 조사 분리 → judge → 재조립
DuumJudge.transformText(text)               → { input, munhwaeo, changed, tokens }
_internal                                   // 순수 함수 노출 — 단위 테스트·디버깅용, 안정성 비보장
```

`Verdict.layer` 값: `"EXC" | "NAME" | "L2" | "L율" | "L0" | "L1" | "L2g" | "L3규칙" | "L3" | "<층>+분해"`.
`Verdict.evidence`는 한국어 키(`"한자"`, `"WSD"`, `"후보"`, `"실증"`, `"한자신뢰"`)를 쓴다 — 그대로 유지할 것.

## 5. 판정 파이프라인 (judge, duum.js:469)

**early-exit 계층**. 위에서 확정되면 아래는 실행 안 됨. 순서 변경은 회귀를 부른다.

| 순서 | 층 | 코드 위치 | 내용 |
|---|---|---|---|
| 1 | EXC | `NORTH_EXCEPTIONS`(:144) | 관용음 예외 6개(나사·나팔·유월·시월·요기·유리) — 북한도 두음형, 비변환 |
| 2 | NAME | `names` + `SURNAME_TO_BONEUM`(:150) | 등재 인명만 성씨 복원(이순신→리순신) |
| 3 | **L2** | `resolve`(:329) / `resolveHada`(:320) | word_hanja 룩업 + WSD. 어중까지 `_munhwaeoFull`(:452)로 음절별 본음 복원 |
| 4 | L율 | :530 | 미등재 + '율' 포함 → 표면 규칙 `율→률` ('열'은 한자 갈려서 불가 — 규칙 확장 금지) |
| 5 | L0 | `isDuumCandidate`(:49) | 어두가 두음 후보 음절 아님 → 즉시 비변환 |
| 6 | L1 | `deapplyWord`(:73) + stems | 역적용형이 북한 코퍼스에 있으면 변환 |
| 7 | L2g | gold_dict | 코퍼스+위키 보조 사전 |
| 8 | L3 | `_ruleFallback`(:558) | 어두 음절의 한자 본음이 전부 두음 대상일 때만 규칙 변환 (conf 0.6) |

`judgeDecomp`(:577): L3/L율로 떨어진 단어를 뒤에서부터 잘라 어두 형태소를 재판정(`리력서` 류 복합어). 꼬리(tail)가 L2에서 명시적 비변환이면 분해를 포기한다(:599-601) — 과변환 가드.

### WSD (`resolve`, :329) — 동음이의 해소의 핵심 규칙

```
점수 = _CTX_WEIGHT(8) × ctxScore(공기어 일치) + ne(예문 수);  nk 실증은 +_NK_BONUS(2) 및 동점 우대
```

1. **문맥 우선**: 변환측·비변환측 대표를 각각 뽑아 문맥 점수가 있는 쪽이 이긴다. 빈도(ne)만으로는 절대 안 뒤집는다 — 고빈도 한자가 항상 이기는 실패 모드 차단.
2. **보수적 비변환**(:359-361): 혼합 동음이의에서 문맥이 없으면 `maxNon×2 ≥ maxDuum`일 때 비변환. `양자 입양`의 養子가 量子에 안 덮이는 이유. conf 0.6 + `"한자신뢰"` evidence.
3. **조사 오매칭 가드**(:491): 2음절어의 둘째 글자가 조사 글자(`_JOSA1`)이고 ne≤1이면 비변환 — '열이'(熱+이)가 裂耳로 오변환되던 문제의 방어선.
4. **하다-활용 의미 고정**(`HADA_SENSE`, :268): `analyze`가 접미사 첫 글자 `하한할함했`(단, `한테` 제외)로 hada 신호를 세우고, 등재어 4개만 한자를 사람이 고정. ⚠️ **'두음 어근 우대'로 일반화 금지** — 유망하다(有望)·요란하다(搖亂) 등 비두음 명사의 하다-용언 65건이 과변환된다(주석 :264-267에 명시).
5. **북한어 실증(nk)**: 어느 한자를 대표로 삼을지에만 관여하고 변환/비변환 결정 자체는 안 뒤집는다. 선택되면 `north` 필드 표기를 그대로 출력(관용음 일치).

### 문맥 창 (`transformText`, :628)

어절 ±3창, 거리 가중 `(W+1-dist)/W` (1.0 / 0.67 / 0.33). 자기 표면형과 같은 이웃 제외(반복 표제어 오염 방지). `isCoordBoundary`(:376 — 쉼표·및·그리고·~와/과/며)를 건널 때마다 ×0.4 감쇠(등위 경계 누수 차단). context는 `Map<string, weight>`로 전달된다.

## 6. 음운 계층 (duum.js:1-92)

한자별 예외 사전이 아니라 **초·중·종성 분해 후 규칙 적용**이므로 어떤 음절에도 일반화된다.

- `applyDuumSyllable`: 본음→남한 (ㄹ→ㄴ/ㅇ, ㄴ+y계→ㅇ; 제10~12항)
- `deapplySyllable`: 남한→본음 후보 집합 (역방향은 1:多 — `여` → {려, 녀})
- `sylToBoneum`: 남한 음절 + 한자의 eums에서 두음 적용 시 그 음절이 되는 본음을 역산 (어중 복원의 핵심)

## 7. 검증 (변경 후 필수)

```bash
node examples/_verify.mjs    # 15케이스 회귀, 실패 시 exit 1 — 최소 게이트
node examples/node-demo.mjs  # 스모크 + 레이턴시 (p50 ~0.015ms/문장 수준)
```

테스트 프레임워크 없음. 판정 로직을 바꿨다면 `_verify.mjs`에 케이스를 **추가**하고 (기존 케이스 수정은 회귀 허용을 뜻하므로 근거 필요), 상위 Python 게이트(`python ../eval/evaluate.py` 94%, `python ../eval/eval_context.py` 오변환 0)도 로직 동기화 시 함께 확인한다.

## 8. 확장 레시피

| 하고 싶은 것 | 만지는 곳 |
|---|---|
| 동음이의 오판 1건 교정 | `CONTEXT_HINTS`(:171)에 해당 한자 키로 공기어 추가. 사전 재빌드 불필요 |
| 하다-용언 오판 교정 | `HADA_SENSE`(:268)에 개별 등재 (일반화 금지 — §5.4) |
| 관용음 예외 추가 | `NORTH_EXCEPTIONS`(:144) |
| 인명 추가 | `data/names.json` + 성씨는 `SURNAME_TO_BONEUM`(:150) |
| 단어·한자 데이터 갱신 | 여기서 편집하지 말 것 — 상위 `../duum/umalsam.py`, `nk_build.py` 재빌드 후 산출물 복사 |
| 새 판정 근거 층 | `judge()`에 삽입하되 §5 순서 원칙(강한 근거가 위) 준수, `layer` 문자열 새로 정의 |

## 9. 함정 목록 (실수하기 쉬운 순)

1. **`duum.js`에 I/O 넣지 말 것.** fs/fetch가 들어가면 런타임 겸용이 깨진다. I/O는 `node.js`/`browser.js`에만.
2. **evidence·WSD 라벨은 한국어 문자열이 API 계약이다.** `"보수적비변환"`, `"문맥"`, `"하다용언(의미고정)"` 등을 소비자가 분기 조건으로 쓸 수 있다.
3. **`resolve`의 selector는 튜플 비교**(`tupleCmp` + `maxBy`)다. 배열 요소 순서가 우선순위 그 자체 — 요소 추가 시 위치가 의미를 바꾼다.
4. **'열' 표면 규칙 금지**: '율'과 달리 列/烈(변환) vs 熱/說(유지)이 갈린다. L율을 '열'로 확장하면 오변환 폭발.
5. **`데이터는 빌드 산출물`**: data/의 JSON을 직접 고치면 다음 재빌드에서 소실된다.
6. **어절 분리는 공백 기준 + 접미사 테이블**(`_SUFFIXES`, :94)이지 형태소 분석기가 아니다. 조사 처리 버그는 대개 이 테이블과 `_JOSA1` 상호작용에서 나온다.
7. Windows 경로에 한글·공백이 있다(`바탕 화면`). 스크립트에서 경로는 항상 `import.meta.url` 기준 상대 계산(기존 코드 방식)을 따를 것.
