class HdrHistogram {
  constructor(sigDigits = 3) {
    this.sigDigits = sigDigits;
    this.counts = new Map();
    this.n = 0;
    this.max = 0;
  }

  record(ms) {
    if (!(ms >= 0)) return;
    this.n++;
    if (ms > this.max) this.max = ms;
    let key = 0;
    if (ms > 0) {
      const scale = 10 ** (Math.floor(Math.log10(ms)) - this.sigDigits + 1);
      key = Math.round(ms / scale) * scale;
    }
    this.counts.set(key, (this.counts.get(key) || 0) + 1);
  }

  percentile(p) {
    if (!this.n) return 0;
    if (p >= 100) return this.max;
    const target = Math.max(1, Math.ceil(this.n * p / 100));
    let acc = 0;
    for (const k of [...this.counts.keys()].sort((a, b) => a - b)) {
      acc += this.counts.get(k);
      if (acc >= target) return k;
    }
    return this.max;
  }
}

const PERCENTILES = [50, 75, 90, 95, 99, 99.9];

function formatLatency(hist) {
  if (!hist.n) return "";
  const fmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(3));
  const parts = PERCENTILES.map((p) => `p${p} ${fmt(hist.percentile(p))}`);
  parts.push(`p100(max) ${fmt(hist.max)}`);
  return `${parts.join(" · ")} ms · n=${hist.n}`;
}

export { HdrHistogram, formatLatency };
