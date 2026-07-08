"use strict";

const BASE = 44032;
const CHO = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const JUNG = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const JONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];
const CHO_IDX = new Map(CHO.map((c, i) => [c, i]));
const JUNG_IDX = new Map(JUNG.map((c, i) => [c, i]));
const JONG_IDX = new Map(JONG.map((c, i) => [c, i]));

const Y_I_JUNG = new Set([..."ㅑㅒㅕㅖㅛㅠㅣ"]);

function ishangulummgyol(ch) {
  const c = ch.codePointAt(0);
  return c >= 44032 && c <= 55203;
}

function decompose(ch) {
  if (!ishangulummgyol(ch)) return null;
  const code = ch.codePointAt(0) - BASE;
  return [CHO[Math.floor(code / 588)], JUNG[Math.floor((code % 588) / 28)], JONG[code % 28]];
}

function compose(cho, jung, jong = "") {
  return String.fromCodePoint(BASE + CHO_IDX.get(cho) * 588 + JUNG_IDX.get(jung) * 28 + JONG_IDX.get(jong));
}

function applyDuumSyllable(syll) {
  const d = decompose(syll);
  if (!d) return syll;
  const [cho, jung, jong] = d;
  if (cho === "ㄴ" && Y_I_JUNG.has(jung)) return compose("ㅇ", jung, jong);
  if (cho === "ㄹ") return compose(Y_I_JUNG.has(jung) ? "ㅇ" : "ㄴ", jung, jong);
  return syll;
}

function applyDuumWord(word) {
  if (!word) return word;
  return applyDuumSyllable(word[0]) + word.slice(1);
}

function isDuumCandidateSyllable(syll) {
  const d = decompose(syll);
  if (!d) return false;
  const [cho, jung] = d;
  return (cho === "ㅇ" && Y_I_JUNG.has(jung)) || (cho === "ㄴ" && !Y_I_JUNG.has(jung));
}

function isDuumCandidate(word) {
  return !!word && isDuumCandidateSyllable(word[0]);
}

function headIsLieulNieun(syll) {
  const d = decompose(syll);
  if (!d) return false;
  const [cho, jung] = d;
  return cho === "ㄹ" || (cho === "ㄴ" && Y_I_JUNG.has(jung));
}

function deapplySyllable(syll) {
  const d = decompose(syll);
  if (!d) return new Set();
  const [cho, jung, jong] = d;
  if (cho === "ㅇ" && Y_I_JUNG.has(jung)) {
    return new Set([compose("ㄹ", jung, jong), compose("ㄴ", jung, jong)]);
  }
  if (cho === "ㄴ" && !Y_I_JUNG.has(jung)) {
    return new Set([compose("ㄹ", jung, jong)]);
  }
  return new Set();
}

function deapplyWord(word) {
  const out = new Set();
  if (!word) return out;
  for (const h of deapplySyllable(word[0])) {
    out.add(h + word.slice(1));
  }
  return out;
}

function sylToBoneum(southSyl, eums) {
  for (const e of eums) {
    if (e !== southSyl && headIsLieulNieun(e) && applyDuumSyllable(e) === southSyl) return e;
  }
  return southSyl;
}

function toMunhwaeo(word, boneumHead) {
  if (!word || !boneumHead) return word;
  return boneumHead[0] + word.slice(1);
}

const _SUFFIXES = [
  "으로부터", "으로서", "으로써", "에서는", "에서도", "에서의", "에게서", "에게도",
  "에게는", "라고도", "으로의", "에서", "에게", "한테", "으로", "로부터", "로서",
  "로써", "처럼", "보다", "까지", "부터", "마다", "조차", "라는", "라고", "라며",
  "이라", "이다", "하였으며", "하였다", "하였고", "되였으며", "되였다", "하는데",
  "하므로", "하여야", "하여서", "시키는", "시킨", "시켜", "하는", "되는", "되여",
  "되게", "되고", "되며", "하고", "하며", "하면", "하여", "하지", "하게", "한다",
  "했다", "였다", "으며", "으면", "는다", "하다", "된", "될", "됨", "한", "할",
  "함", "은", "는", "이", "가", "을", "를", "의", "에", "로", "와", "과", "도",
  "만", "랑", "나", "야", "여", "께",
].sort((a, b) => b.length - a.length);

const _NOISE_JOSA1 = ["의", "은", "는", "이", "가", "을", "를", "에", "와", "과", "도", "만"];

function deljepsaandjosa(word, maxIter = 3, minStem = 2) {
  let stem = word;
  for (let it = 0; it < maxIter; it++) {
    const suf = _SUFFIXES.find((s) => stem.length - s.length >= minStem && stem.endsWith(s));
    if (!suf) break;
    stem = stem.slice(0, stem.length - suf.length);
  }
  if (stem.length > minStem && stem.endsWith("들")) {
    stem = stem.slice(0, -1);
  }
  for (const j of _NOISE_JOSA1) {
    if (stem.length - 1 >= 2 && stem.endsWith(j)) {
      stem = stem.slice(0, -1);
      break;
    }
  }
  return stem;
}

const _HANGUL_RE = /[가-힣]+/;

function splitToken(token) {
  const m = _HANGUL_RE.exec(token);
  if (!m) return [token, "", ""];
  return [token.slice(0, m.index), m[0], token.slice(m.index + m[0].length)];
}

function splitStem(core) {
  const stem = deljepsaandjosa(core);
  return [stem, core.slice(stem.length)];
}

function tonamhan(stem) {
  return applyDuumWord(stem);
}

const NORTH_EXCEPTIONS = new Set(["나사", "나팔", "유월", "시월", "요기", "유리"]);

function isException(word) {
  return NORTH_EXCEPTIONS.has(word);
}

const SURNAME_TO_BONEUM = {
  이: "리",
  임: "림",
  유: "류",
  양: "량",
  노: "로",
  나: "라",
  여: "려",
  염: "렴",
  용: "룡",
  육: "륙",
  뇌: "뢰",
};

function restorefirstnamebonum(name) {
  if (name && Object.hasOwn(SURNAME_TO_BONEUM, name[0])) {
    return SURNAME_TO_BONEUM[name[0]] + name.slice(1);
  }
  return name;
}

const CONTEXT_HINTS = {
  熾烈: ["경쟁", "경쟁률", "전투", "전쟁", "논쟁", "선거", "접전", "공방", "싸움", "대결", "각축"],
  齒列: ["치아", "치과", "교정", "이빨", "구강", "잇몸", "교합", "배열", "해부"],
  錄音: ["방송", "소리", "음성", "테이프", "녹화", "스튜디오", "마이크", "라디오"],
  綠陰: ["나무", "그늘", "여름", "숲", "녹지", "수목", "방초"],
  映畵: ["영화관", "감독", "배우", "촬영", "스크린", "관람"],
  類似: ["비슷", "흡사", "닮음", "동일", "유사품"],
  演習: ["군사", "훈련", "합동", "기동", "실전"],
  努力: ["개인", "혼자", "스스로", "최선", "노력파"],
  異常: ["증상", "고장", "현상", "징후", "기후"],
  異性: ["교제", "연애", "이성친구", "만남"],
  移徙: ["날짜", "집", "이삿짐", "이사철", "전입"],
  移行: ["제도", "단계", "과정", "이행기"],
  入場: ["극장", "관람", "공연", "경기장", "입장권", "퇴장"],
  有利: ["조건", "위치", "고지", "국면", "형세"],
  遺産: ["문화", "상속", "문화유산", "세계유산", "유물"],
  留學: ["일본", "해외", "유학생", "어학", "교환"],
  儒學: ["경전", "유교", "공자", "성리학", "선비"],
  有意: ["통계", "통계적", "수준", "의미", "유의미", "차이"],
  幼稚: ["농담", "수준", "행동", "유치원생"],
  誘致: ["투자", "기업", "대회", "행사", "공장"],
  有形: ["문화재", "형태", "자산", "유형물", "실물"],
  遺失: ["유실물", "분실", "습득", "신고"],
  樣式: ["파일", "서식", "문서", "형식", "양식지"],
  養子: ["입양", "호적", "양부모", "수양", "양아들"],
  兩者: ["협상", "양측", "합의", "대화", "관계"],
  養分: ["식물", "영양", "흡수", "뿌리", "토양", "비료"],
  來歷: ["가문", "유래", "족보", "집안", "내력서"],
  耐力: ["구조물", "하중", "강도", "지지", "기둥", "내력벽"],
  來訪: ["손님", "방문", "찾아", "예방"],
  內房: ["안채", "사랑채", "규방", "안방"],
  餘命: ["환자", "수명", "말기", "시한", "선고"],
  女裝: ["배우", "분장", "변장", "남장"],
  旅裝: ["여행", "여행객", "행장", "배낭"],
  女神: ["종교", "신화", "숭배", "미의", "여신상"],
  與信: ["은행", "대출", "금융", "신용", "여신업무"],
  營養: ["식단", "건강", "섭취", "균형", "영양소", "결핍"],
  羚羊: ["초원", "동물", "사슴", "뿔", "포유류"],
  營利: ["회사", "기업", "이윤", "비영리", "법인"],
  // 弄談(예문 15)이 빈도로 濃淡 문맥까지 덮는 것을 차단
  濃淡: ["먹", "잉크", "색", "색깔", "빛깔", "물감", "색조", "명암", "농도", "용액", "수묵"],
  驛舍: ["서울역", "기차역", "철도", "플랫폼", "역무원"],
  疫學: ["감염병", "전염", "방역", "역학조사", "바이러스", "질병"],
  劣性: ["유전", "형질", "우성", "유전자", "열성인자"],
  聯想: ["고향", "떠올", "상상", "기억", "추억"],
  燃燒: ["반응", "산소", "화학", "연료", "점화"],
  年少: ["보호", "미성년", "연소자보호"],
  嚥下: ["장애", "삼킴", "연하곤란", "삼키"],
  年下: ["동생", "막내", "띠동갑", "살", "나이"],
  延命: ["치료", "생명", "말기", "연명의료"],
  禮節: ["예의", "범절", "공손", "인사"],
  例外: ["규칙", "경우", "제외", "예외없"],
  練習: ["피아노", "악기", "반복", "연습실", "맹연습"],
  勞力: ["농촌", "노동", "인력", "품", "일손"],
  理想: ["사회", "이상향", "이념", "꿈", "이상적"],
  理性: ["판단", "논리", "합리", "사고", "이성적"],
  理事: ["이사회", "취임", "임원", "이사장", "법인"],
  履行: ["계약", "의무", "약속", "채무", "이행"],
  立場: ["정치", "정치적", "견해", "태도", "처지", "입장표명"],
  流産: ["임신", "낙태", "태아", "유산위험"],
  留意: ["안전", "주의", "유념", "사항"],
  留置: ["피의자", "유치장", "구금", "경찰", "구치"],
  類型: ["분류", "종류", "패턴", "범주", "유형별"],
  流失: ["강둑", "쓸려", "침식", "홍수", "토사"],
  糧食: ["겨울", "식량", "비축", "곡식", "군량"],
  量子: ["컴퓨터", "물리", "입자", "양자역학", "얽힘"],
  兩分: ["재산", "둘", "분할", "이분", "양분법"],
  黎明: ["새벽", "동틀", "여명기", "박명"],
  歷史: ["교과서", "과거", "사건", "연표", "역사적"],
  力學: ["공식", "물리", "운동", "역학적"],
  逆說: ["모순", "패러독스", "논리", "역설적", "주장"],
  熱誠: ["팬", "열정", "정성", "열심", "열성적"],
  連名: ["서명", "명단", "공동", "청원", "연명부"],
  年上: ["나이", "살", "띠동갑", "연상녀"],
  料理: ["수업", "음식", "조리", "주방", "레시피", "요리사"],
  年代: ["측정", "지질", "탄소", "시대", "연도", "세기", "고대"],
  連帶: ["노동", "노동자", "투쟁", "책임", "보증", "운동", "단결"],
  聯隊: ["군대", "부대", "사단", "대대", "병력", "연대장"],
  陽曆: ["날짜", "달력", "음력", "설날", "양력설"],
  揚力: ["비행", "날개", "공기", "항공", "비행기"],
  亂流: ["비행기", "난기류", "항공", "교란", "소용돌이", "와류"],
  暖流: ["해류", "한류", "적도", "해수", "따뜻"],
  列島: ["일본", "섬", "군도", "다도해", "열도"],
  熱度: ["실험", "온도", "가열", "측정", "끓"],
  年長: ["예우", "어른", "손위", "경로", "웃어른", "연장자"],
  延長: ["수리", "기간", "계약", "연장전", "보수", "연기"],
};

const _HINT_SETS = {};
for (const [h, arr] of Object.entries(CONTEXT_HINTS)) {
  _HINT_SETS[h] = new Set(arr);
}

// 하다-활용 의미 고정 — 'X한/X하다'의 X가 혼합 동음이의일 때, 하다-용언을 실제로
// 형성하는 한자를 사람이 확정한 것. 명사 자리(하다 비활용)에는 적용하지 않는다.
// '두음 어근 항목 우대'로 일반화하면 안 된다: 유망하다(有望)·요란하다(搖亂)·
// 연소하다(燃燒)처럼 비두음 명사가 하다-용언을 만드는 혼합쌍이 다수다(전수 65건).
const HADA_SENSE = {
  "영리": "怜悧",  // 령리하다 — 명사 營利(비변환)와 분리
  "치열": "熾烈",  // 치렬하다 — 어중 렬 복원
  "유사": "類似",  // 류사하다
  "영묘": "靈妙",  // 령묘하다
};

const _CTX_WEIGHT = 8;
const _NK_BONUS = 2;

function ctxScore(entry, ctx) {
  if (!ctx || ctx.size === 0) return 0;
  const keys = new Set(entry.kw || []);
  const hint = _HINT_SETS[entry.hanja || ""];
  if (hint) {
    for (const k of hint) keys.add(k);
  }
  if (ctx instanceof Map) {
    let s = 0;
    for (const k of keys) s += ctx.get(k) || 0;
    return s;
  }
  let n = 0;
  for (const k of keys) {
    if (ctx.has(k)) n++;
  }
  return n;
}

function tupleCmp(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

function maxBy(arr, keyFn) {
  let best = arr[0];
  let bk = keyFn(best);
  for (let i = 1; i < arr.length; i++) {
    const k = keyFn(arr[i]);
    if (tupleCmp(k, bk) > 0) {
      best = arr[i];
      bk = k;
    }
  }
  return best;
}

// 하다-활용 어절의 의미 고정. HADA_SENSE 미등재어면 null(일반 WSD로).
function resolveHada(word, entries) {
  const hz = Object.hasOwn(HADA_SENSE, word) ? HADA_SENSE[word] : undefined;
  if (hz === undefined) return null;
  const pick = entries.filter((e) => e.hanja === hz);
  if (pick.length === 0) return null;
  const e = maxBy(pick, (x) => [x.ne || 0]);
  return [e.duum, e, "하다용언(의미고정)"];
}

function resolve(entries, context) {
  const cands = entries.filter((e) => e.duum != null);
  if (cands.length === 0) return null;

  const ctx = context || null;
  const score = (e) => _CTX_WEIGHT * ctxScore(e, ctx) + (e.ne || 0);
  const sel = (e) => [ctxScore(e, ctx), score(e) + (e.nk ? _NK_BONUS : 0), e.nk ? 1 : 0];
  const duumCands = cands.filter((e) => e.duum);
  const nonduumCands = cands.filter((e) => !e.duum);

  if (duumCands.length === 0 || nonduumCands.length === 0) {
    const best = maxBy(cands, (e) => [...sel(e), e.duum ? 0 : 1]);
    let how;
    if (ctxScore(best, ctx) > 0) {
      how = "문맥";
    } else if (cands.length === 1 || new Set(cands.map((e) => e.duum)).size === 1) {
      how = "만장일치";
    } else {
      how = "대표(예문가중)";
    }
    return [best.duum, best, how];
  }

  const repD = maxBy(duumCands, sel);
  const repN = maxBy(nonduumCands, sel);
  const ctxD = ctxScore(repD, ctx);
  const ctxN = ctxScore(repN, ctx);
  if (ctxD > 0 && ctxD > ctxN) return [repD.duum, repD, "문맥"];
  if (ctxN > 0 && ctxN >= ctxD) return [repN.duum, repN, "문맥"];

  const maxNon = Math.max(...nonduumCands.map(score));
  const maxDuum = Math.max(...duumCands.map(score));
  if (maxNon * 2 >= maxDuum) return [repN.duum, repN, "보수적비변환"];
  return [repD.duum, repD, "대표(예문가중)"];
}

const _JOSA1 = new Set([..."의은는이가을를에와과도만"]);

function round4(x) {
  return Math.round(x * 1e4) / 1e4;
}

function ctxForms(stem) {
  const s2 = deljepsaandjosa(stem, 3, 1);
  return s2 === stem ? [stem] : [stem, s2];
}

function isCoordBoundary(tok) {
  if (tok.endsWith(",") || tok.endsWith("，") || tok.endsWith("、")) return true;
  if (tok === "및" || tok === "그리고") return true;
  return tok.length > 1 && (tok.endsWith("와") || tok.endsWith("과") || tok.endsWith("며") || tok.endsWith("및"));
}

class Verdict {
  constructor(word, isDuum, confidence, layer, evidence, munhwaeo = null) {
    this.word = word;
    this.is_duum = isDuum;
    this.confidence = confidence;
    this.layer = layer;
    this.evidence = evidence;
    this.munhwaeo = munhwaeo ?? word;
  }

  toDict() {
    return {
      word: this.word,
      is_duum: this.is_duum,
      munhwaeo: this.munhwaeo,
      confidence: round4(this.confidence),
      layer: this.layer,
      evidence: this.evidence,
    };
  }
}

class AnalyzeResult {
  constructor(token, stem, south, verdict, munhwaeoToken) {
    this.token = token;
    this.stem = stem;
    this.south = south;
    this.verdict = verdict;
    this.munhwaeo_token = munhwaeoToken;
  }

  get is_duum() {
    return this.verdict.is_duum;
  }

  toDict() {
    return {
      token: this.token,
      stem: this.stem,
      south: this.south,
      is_duum: this.verdict.is_duum,
      munhwaeo_token: this.munhwaeo_token,
      confidence: round4(this.verdict.confidence),
      layer: this.verdict.layer,
      evidence: this.verdict.evidence,
    };
  }
}

class DuumJudge {
  constructor(data) {
    this.word_hanja = data.word_hanja || {};
    this.btable = (data.boneum || {}).table || {};
    this.bindex = (data.boneum || {}).index || {};
    this.stems = new Set(data.stems || []);
    this.gold = data.gold || {};
    this.names = new Set(data.names || []);
  }

  _wh(word) {
    return Object.hasOwn(this.word_hanja, word) ? this.word_hanja[word] : undefined;
  }

  _duumBoneum(hanja) {
    if (!hanja) return null;
    const v = this.btable[hanja[0]];
    if (!v) return null;
    return v.eums.find(headIsLieulNieun) ?? null;
  }

  _munhwaeoFull(word, hanja) {
    if (!hanja || word.length !== hanja.length) {
      const bon = this._duumBoneum(hanja);
      return bon ? [toMunhwaeo(word, bon), true] : [word, false];
    }
    const out = [];
    let changed = false;
    for (let i = 0; i < word.length; i++) {
      const s = word[i];
      const v = this.btable[hanja[i]];
      const b = v ? sylToBoneum(s, v.eums) : s;
      out.push(b);
      if (b !== s) changed = true;
    }
    return [out.join(""), changed];
  }

  judge(word, context = null, hada = false) {
    word = (word || "").trim();
    if (!word) {
      return new Verdict(word, false, 1, "L0", { reason: "empty" });
    }
    if (isException(word)) {
      return new Verdict(word, false, 0.97, "EXC", {
        "사유": "관용음 예외(제25항) — 북한도 두음형",
      });
    }
    if (this.names.has(word)) {
      const mw = restorefirstnamebonum(word);
      return new Verdict(word, mw !== word, 0.9, "NAME", { "인명": true }, mw);
    }

    const entries = this._wh(word);
    if (entries && entries.length) {
      // 하다-활용은 형태론이 의미를 확정한다('영리한'은 營利일 수 없음) —
      // 공기어 문맥보다 먼저 본다. 미등재어는 일반 WSD로 떨어진다.
      const r = (hada ? resolveHada(word, entries) : null) ?? resolve(entries, context);
      if (r !== null) {
        let [duum, ch, how] = r;
        if (duum && word.length === 2 && _JOSA1.has(word[1]) && (ch.ne || 0) <= 1
            && how !== "문맥" && how !== "하다용언(의미고정)") {
          duum = false;
          how = "보수적비변환(조사오매칭)";
        }
        let mw = word;
        if (duum && ch.north) {
          mw = ch.north;
          duum = mw !== word;
        } else if (duum && ch.hanja) {
          [mw, duum] = this._munhwaeoFull(word, ch.hanja);
        } else if (duum) {
          duum = false;
        }
        const ev = { "한자": ch.hanja ?? null, WSD: how };
        if (ch.nk) {
          ev["실증"] = "우리말샘 북한어 표제어";
        }
        const cands = entries
          .filter((e) => e.hanja)
          .map((e) => ({ "한자": e.hanja, "두음": e.duum, "예문": e.ne || 0 }));
        if (new Set(cands.map((c) => c["한자"])).size > 1) {
          ev["후보"] = cands.slice().sort((a, b) => b["예문"] - a["예문"]).slice(0, 6);
          const nes = cands.map((c) => c["예문"]).sort((a, b) => b - a);
          if (nes[0] - nes[1] <= 1) {
            ev["한자신뢰"] = "낮음(예문 근소 — 한자 오인 가능)";
          }
        }
        let conf = 0.96;
        if (how.startsWith("보수적비변환")) {
          conf = 0.6;
          if (!("한자신뢰" in ev)) {
            ev["한자신뢰"] = "문맥 미지지 — 보수적 비변환(혼합 동음이의)";
          }
        }
        return new Verdict(word, duum, conf, "L2", ev, mw);
      }
    }

    if (word.includes("율")) {
      return new Verdict(word, true, 0.88, "L율", {
        "규칙": "남한 '율' → 문화어 '률'",
      }, word.replaceAll("율", "률"));
    }
    if (!isDuumCandidate(word)) {
      return new Verdict(word, false, 0.99, "L0", { reason: "어두가 두음 대상 음절 아님" });
    }

    for (const cand of deapplyWord(word)) {
      if (this.stems.has(cand)) {
        return new Verdict(word, true, 0.93, "L1", {
          "북한표기": cand,
          "출처": "북한 코퍼스",
        }, cand);
      }
    }

    const info = Object.hasOwn(this.gold, word) ? this.gold[word] : undefined;
    if (info !== undefined && info.label) {
      const bon = this._duumBoneum(info.hanja) || (info.eum || "").slice(0, 1);
      const mw = bon ? toMunhwaeo(word, bon) : word;
      return new Verdict(word, true, 0.9, "L2g", { "한자": info.hanja, "본음": bon }, mw);
    }

    return this._ruleFallback(word);
  }

  _ruleFallback(word) {
    const syl = word[0];
    const hanjas = this.bindex[syl] || [];
    const duums = hanjas.filter((h) => h in this.btable).map((h) => this.btable[h].is_duum);
    if (duums.length && duums.every(Boolean)) {
      let bon = null;
      for (const h of hanjas) {
        if (!(h in this.btable)) continue;
        bon = this.btable[h].eums.find(headIsLieulNieun) ?? null;
        if (bon) break;
      }
      const mw = bon ? toMunhwaeo(word, bon) : word;
      return new Verdict(word, !!bon, 0.6, "L3규칙", {
        "근거": `어두 '${syl}' 한자 모두 두음 대상`,
      }, mw);
    }
    return new Verdict(word, false, 0.6, "L3", { reason: "미등재 — 어두 음절 본음 혼재/비대상" });
  }

  judgeDecomp(word, context = null, hada = false) {
    const v = this.judge(word, context, hada);
    if (v.layer !== "L3" && v.layer !== "L3규칙" && v.layer !== "L율") {
      return v;
    }

    let ctxAug;
    if (context instanceof Map) {
      ctxAug = new Map(context);
      const vals = [...context.values()];
      ctxAug.set(word, vals.length ? Math.max(...vals) : 1);
    } else if (context instanceof Set) {
      ctxAug = new Set(context);
      ctxAug.add(word);
    } else {
      ctxAug = new Set([word]);
    }

    for (let i = word.length - 1; i > 1; i--) {
      const pv = this.judge(word.slice(0, i), ctxAug);
      if (!pv.is_duum || !["L2", "L2g", "L1", "NAME"].includes(pv.layer)) continue;
      const tail = word.slice(i);
      if (tail.length >= 2 && this._wh(tail) !== undefined) {
        const tv = this.judge(tail);
        if (tv.layer === "L2" && !tv.is_duum) continue;
      }
      const mw = pv.munhwaeo[0] + v.munhwaeo.slice(1);
      return new Verdict(word, true, round4(pv.confidence * 0.97), pv.layer + "+분해", {
        ...pv.evidence,
        "어두형태소": word.slice(0, i),
      }, mw);
    }
    return v;
  }

  analyze(token, context = null) {
    const [pre, core, post] = splitToken(token);
    if (!core) {
      const v = new Verdict(token, false, 1, "L0", { reason: "한글 없음" });
      return new AnalyzeResult(token, "", "", v, token);
    }
    const [stem, suffix] = splitStem(core);
    const south = tonamhan(stem);
    // 하다-활용 신호: 'X한/X하다/X했다…'에서 X는 용언 어간 자리다.
    // '한테'(체언 조사)만 제외 — 인명 '영리한테'류를 활용으로 오인하지 않게.
    const hada = suffix.length > 0 && "하한할함했".includes(suffix[0]) && suffix !== "한테";
    const v = this.judgeDecomp(south, context, hada);
    const mwStem = v.is_duum ? v.munhwaeo : stem;
    return new AnalyzeResult(token, stem, south, v, pre + mwStem + suffix + post);
  }

  transformText(text) {
    const tokens = text.split(/\s+/).filter((t) => t.length > 0);
    const stems = tokens.map((t) => splitStem(splitToken(t)[1])[0]);
    const bnd = tokens.map(isCoordBoundary);
    const results = [];
    const W = 3;
    for (let i = 0; i < tokens.length; i++) {
      const cw = new Map();
      for (let k = Math.max(0, i - W); k < Math.min(stems.length, i + W + 1); k++) {
        if (k === i || !stems[k] || stems[k] === stems[i]) continue;
        let w = (W + 1 - Math.abs(i - k)) / W;
        let ncross = 0;
        for (let m = Math.min(i, k); m < Math.max(i, k); m++) {
          if (bnd[m]) ncross++;
        }
        w *= Math.pow(0.4, ncross);
        for (const form of ctxForms(stems[k])) {
          if (w > (cw.get(form) || 0)) cw.set(form, w);
        }
      }
      results.push(this.analyze(tokens[i], cw));
    }
    const munhwaeo = results.map((r) => r.munhwaeo_token).join(" ");
    return {
      input: text,
      munhwaeo,
      changed: munhwaeo !== text,
      tokens: results,
    };
  }
}

const DATA_FILES = ["word_hanja.json", "hanja_boneum.json", "corpus_stems.json", "gold_dict.json", "names.json"];

function judgeFromParts([word_hanja, boneum, stems, gold, names]) {
  return new DuumJudge({ word_hanja, boneum, stems, gold, names });
}

export { DuumJudge, DATA_FILES, judgeFromParts };

export const _internal = {
  decompose,
  compose,
  applyDuumSyllable,
  applyDuumWord,
  isDuumCandidate,
  deapplyWord,
  sylToBoneum,
  deljepsaandjosa,
  splitToken,
  splitStem,
  tonamhan,
  resolve,
  resolveHada,
  ctxForms,
  isCoordBoundary,
};
