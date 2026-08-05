// P1 calibration harness (§11-lite): runs the exact sim code from index.html
// and measures the §12 P1 gate metrics over a 15-min unattended run.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const block = (name) => {
  const m = html.match(new RegExp(`/\\*${name}-BEGIN\\*/([\\s\\S]*?)/\\*${name}-END\\*/`));
  if (!m) throw new Error(`marker ${name} not found`);
  return m[1];
};
const { CONFIG, createSim, simStep } = new Function(
  block('CONFIG') + block('SIM') + '; return { CONFIG, createSim, simStep };'
)();

const S = CONFIG.sim;
const RUN_S = 960, WARM_S = 60;
const sim = createSim(CONFIG, Number(process.argv[2] || 12345));

// per-blob transit tracking
const track = sim.blobs.map(() => ({ dir: 0, t0: 0, topAt: -1, hoverT: 0 }));
const transitsUp = [], transitsDown = [], hovers = [], midTurns = [];
let samples = 0, hasRiser = 0, hasFaller = 0, hasBoth = 0, inFlightSum = 0;
let recycles = 0;

const origSpawnCheck = sim.blobs.map(b => b);
for (let step = 0; step < RUN_S / S.dt; step++) {
  const prevY = sim.blobs.map(b => b.y);
  const prevHist = sim.blobs.map(b => b.hist.length);
  simStep(sim, CONFIG);
  const t = step * S.dt;
  if (t < WARM_S) continue;

  sim.blobs.forEach((b, i) => {
    if (b.hist.length < prevHist[i]) { /* splice, not recycle */ }
    if (b.hist.length === 2 && prevHist[i] > 2) recycles++;
    const tr = track[i];
    // upward transit: cross 0.12 rising → reach 0.88
    if (tr.dir <= 0 && prevY[i] < 0.12 && b.y >= 0.12 && b.vy > 0) { tr.dir = 1; tr.t0 = t; }
    // arrival at 0.84: blob's top edge merges into the reservoir underside
    if (tr.dir === 1 && b.y >= 0.84) { transitsUp.push({ dt: t - tr.t0, r: b.r }); tr.dir = 2; }
    if (tr.dir === 1 && b.vy < -0.002) { midTurns.push(b.r); }
    if (tr.dir >= 1 && b.vy < -0.002) { // turned around → start downward watch
      tr.dir = -1; tr.t0 = t;
    }
    if (tr.dir === -1 && b.y <= 0.12) { transitsDown.push({ dt: t - tr.t0, r: b.r }); tr.dir = 0; }
    // hover: slow vertical speed while high in the column
    if (b.y > 0.6 && Math.abs(b.vy) < 0.005) tr.hoverT += S.dt;
    else if (tr.hoverT > 0) { hovers.push(tr.hoverT); tr.hoverT = 0; }
  });

  if (step % Math.round(1 / S.dt) === 0) { // 1 Hz traffic sampling
    samples++;
    const risers = sim.blobs.filter(b => b.y > 0.12 && b.y < 0.88 && b.vy > 0.003).length;
    const fallers = sim.blobs.filter(b => b.y > 0.12 && b.y < 0.88 && b.vy < -0.003).length;
    const inFlight = sim.blobs.filter(b => b.y > 0.12).length;
    if (risers) hasRiser++;
    if (fallers) hasFaller++;
    if (risers && fallers) hasBoth++;
    inFlightSum += inFlight;
  }
}

const stats = (arr) => {
  if (!arr.length) return 'none';
  const v = arr.slice().sort((a, b) => a - b);
  const q = (p) => v[Math.floor(p * (v.length - 1))].toFixed(1);
  return `n=${v.length} min=${q(0)} p25=${q(0.25)} med=${q(0.5)} p75=${q(0.75)} max=${q(1)}`;
};
const mid = (a) => a.filter(x => x.r >= 0.052 && x.r <= 0.078).map(x => x.dt);
const small = (a) => a.filter(x => x.r < 0.052).map(x => x.dt);
const big = (a) => a.filter(x => x.r > 0.078).map(x => x.dt);

console.log(`=== P1 gate metrics (${RUN_S - WARM_S}s observed, seed ${process.argv[2] || 12345}) ===`);
console.log(`up-transit  mid-size (s): ${stats(mid(transitsUp))}   [gate: 35-75]`);
console.log(`up-transit  small    (s): ${stats(small(transitsUp))}`);
console.log(`up-transit  big      (s): ${stats(big(transitsUp))}`);
console.log(`down-return          (s): ${stats(transitsDown.map(x => x.dt))}`);
console.log(`top hovers           (s): ${stats(hovers.filter(h => h > 1))}   [want: visible, >=3s common]`);
console.log(`traffic: riser ${Math.round(100 * hasRiser / samples)}% | faller ${Math.round(100 * hasFaller / samples)}% | both ${Math.round(100 * hasBoth / samples)}% | avg in-flight ${(inFlightSum / samples).toFixed(1)}`);
console.log(`mid-column turnarounds: ${midTurns.length} (mean r ${(midTurns.reduce((a, b) => a + b, 0) / (midTurns.length || 1)).toFixed(3)})`);
console.log(`recycles: ${recycles} (${(recycles / ((RUN_S - WARM_S) / 60)).toFixed(1)}/min)`);
