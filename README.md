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
| **P2 — Merge/drainage + volume ledger** | kiss-hesitate-fuse; no volume drift | **passed** (session 4) — drift ~3e-16 over 31 min; fuse delays 2.6–4.7 s |
| **P3 — Pools + detachment + pendant** | full self-priming cycle | **passed** (session 5) — cold start primes in ~3 min sim; §6.2 de-scope valve taken |
| **P4 — Interaction** | heat-cursor feels caused, not commanded | **mechanics passed** (session 6) — "feel" verdict needs a human on a touchscreen |
| **P5 — Polish & calibration** | blind test ≤ 75% | **next up** |
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

P2 scope shipped: §5.4 contact state machine (FREE → CONTACT with film
pressure + drainage timer gated by |ΔT| and v_rel → MERGING slurp over
0.8 s), per-blob smin softness driven by merge readiness (dimple → slurp in
the renderer), coil-zone instant re-merge (#25), and the bottom-pool volume
ledger (#7): absorption deposits r³, spawns withdraw it, merges are
volume-exact — total wax is conserved to float epsilon. Depth layers don't
merge (#26). Pool visual scales with the ledger. Wobble is a stub (#9, P4).

P3 scope shipped: pools are real state machines (§5.5). Bottom pool: coil
heats pool T, a melt accumulator banks volume and releases blobs born hot
with a detachment impulse after a visible pre-release bulge (#5); size from
the lognormal distribution, capped by the ledger. Top pool: blobs loitering
near the dome deposit their volume incrementally (melts-in over ~1.2 s),
the pool cools toward ambient, and when cold + full it extrudes a pendant
that necks, pinches (#4), and falls (#6). The reservoir literally grows from
nothing on a cold start. True cold start (`?cold=1`): all wax pooled, first
detach ~60 s, full cycle primed ~3 min; pages pre-roll 180 s by default.
Cluster rendering intentionally uses the §6.2 de-scope valve (procedural
primitives + animated bulge/pendant spheres) — sub-particle clusters can
land in P5 polish if footage comparison demands them.

P4 scope shipped (§7): warm/cool touch as a gaussian heat source written into
L1 only (hold = warm at full strength, desktop hover = gentle warmth, ♨/❄
toggle or right-button for cool), capped heavily-smoothed drag nudge (heat is
the verb — no positional grabbing), tap-the-glass radial impulse with vessel
shudder (#24), and the real §6.1 damped shape oscillators (ζ=0.25, f=1.2 Hz)
replacing the wobble stub — excited by merges, detachments, pendants, and
taps. A warm touch over the pool softens it, banks melt, and hurries the
bulge: detachment in ~0.8 s when wax and a free slot exist (gate <4 s); a
saturated lamp correctly holds the bulge until a slot frees.

Shape realism pass (P4 session): moving blobs are volume-compensated eggs —
wide leading face, tapered trailing side, thinner as they elongate (#8) —
plus slow ambient shape breathing (#23). Pool transitions are pop-free: the
bulge hands off to the spawned blob at its exact position, both pools melt
blobs in/out incrementally, and tails collapse into the body as merges and
absorptions complete instead of vanishing in one frame.

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
