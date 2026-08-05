# PROJECT THERMO — friendly-blobs

Phenomenological lava lamp simulation for a desktop companion game.
Don't solve fluid equations: simulate the thermodynamic *causes* per blob,
let a raymarched SDF renderer manufacture the *appearance* of fluidity.

**Live build:** https://lumenaut-dev.github.io/friendly-blobs/

- `index.html` — the entire prototype (single-file WebGL2, no libraries, per TDD §2/§13)
- `docs/thermo_tdd.md` — the technical design document. Read it before touching anything.

## Status

| Phase | Gate | Status |
|---|---|---|
| **P0 — Renderer proof** | screenshot makes you say "oh" | **passed** (session 2/7) — reads as wax, not metaballs |
| **P1 — Thermal circulation** | 15 min unattended mixed traffic | **passed** (session 3) — harness-verified, see `tools/calibrate.js` |
| **P2 — Merge/drainage + volume ledger** | kiss-hesitate-fuse; no volume drift | **next up** |
| P3 — Pools + detachment + pendant | full self-priming cycle | not started |
| P4 — Interaction | heat-cursor feels caused, not commanded | not started |
| P5 — Polish & calibration | blind test ≤ 75% | not started |
| P6 — Godot port | budget table §8 on UHD 770 | not started |

P0 scope shipped: raymarched smooth-min SDF, Beer–Lambert absorption (#16),
under-light scatter from the bulb (#17), single-bend glass refraction +
Fresnel env reflection (#18), Blinn–Phong speculars (#19), liquid tint fog +
bulb glare (#20), dither (#22). Bloom (#21) and motes (#12) are P5.

P1 scope shipped: L1 thermal sim (§5) — per-blob temperature ODEs with zone
cooling + contact bulb heating, ρ(T) buoyancy about the density crossover,
√meltFrac-gated rise, anisotropic drag, wall constraints, pool-stick
detachment threshold (#5 lite), teleport-recycle hidden inside the pool,
fixed 1/60 sim step with render interpolation (§8). Necks/stretch come from
position history (#8 lite). Verified: mid-size transits ~35–40 s, hovers at
turnarounds, mixed traffic over 15 min unattended (`node tools/calibrate.js`).

Hard-won tuning invariant (P1): everywhere above the pool-stick zone the net
thermal drive must be negative (cooling wins). Any altitude where bulb heating
balances zone cooling near T≈crossover becomes a capture equilibrium that
permanently traps blobs in neutral-buoyancy limbo. Keep the bulb heat cutoff
(`bulbCutLo/Hi`) below `poolStickY` + `zoneMidLo`.

## Dev notes

- Open `index.html` directly, or visit the Pages URL. Every push to `main` or
  `claude/**` mirrors the tree to the `gh-pages` branch, which GitHub Pages
  serves — don't commit to `gh-pages` by hand, it gets force-overwritten.
- `?ts=N` URL param scales time (e.g. `?ts=10`) to preview slow behaviors fast.
  Real transit periods are 70–150 s by design — slowness is the point (TDD §5.3).
- All constants live in the `CONFIG` object at the top of `index.html`; never
  inline a magic number in the shader (TDD §13).
- Working agreement: one phase-item per session; behavior changes not in the
  §4 traceability matrix get a matrix row first; tune before restructuring.
