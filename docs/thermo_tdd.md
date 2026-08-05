# PROJECT THERMO — Technical Design Document
## Phenomenological Lava Lamp Simulation for a Desktop Companion Game
**Version 1.0 — August 2026**
**Status: Pre-production. Phase 0 gate not yet passed.**

---

## 1. Purpose and Design Thesis

Build a real-time lava lamp that is visually indistinguishable from reference footage at desktop-companion scale, running at near-zero idle cost, with fully interactive and emergent blob behavior.

**Core thesis:** Do not solve fluid equations. Simulate the *causes* (thermodynamics, per-blob) and let the renderer manufacture the *appearance* of fluidity (volumetric raymarched SDF). Every observable phenomenon of a real lamp is either (a) emergent from the thermal-agent rules, or (b) explicitly approximated by a dedicated cheap mechanism. Section 4 is the exhaustive mapping; nothing ships on hope.

**Non-goals:** Physical accuracy in SI units. Spilling/pouring. Arbitrary vessel topology. Fullscreen photorealism under scrutiny. Multiplayer.

**Prime directive for implementation:** One feature per session. No feature begins until the previous phase's acceptance gate passes. Kill criteria are binding.

---

## 2. Architecture Overview

Three decoupled layers plus interaction. Layers communicate one-way, downward.

```
┌─────────────────────────────────────────────────┐
│ L1  THERMAL BLOB SIM (CPU, ~0.05 ms)            │
│     Blob agents: position, velocity, radius,    │
│     temperature, melt fraction, state machine   │
│     Pools, detachment, merge/drainage logic     │
├─────────────────────────────────────────────────┤
│ L2  SHAPE LAYER (CPU, ~0.05 ms)                 │
│     Per-blob ellipsoid stretch + wobble         │
│     oscillators; sub-particle clusters for      │
│     pools and pendant drops                     │
├─────────────────────────────────────────────────┤
│ L3  RENDERER (GPU, one fragment shader,         │
│     target ≤1.5 ms @ 360×640 on Intel UHD 770)  │
│     Raymarched smooth-min SDF, Beer–Lambert     │
│     absorption, under-light scatter, glass      │
│     refraction, bloom                           │
└─────────────────────────────────────────────────┘
INTERACTION: cursor = local heat/cool source + tap impulse
             (writes into L1 only; L2/L3 never know)
```

**Data flow per frame:** L1 integrates at fixed dt (see §8) → L2 derives shape params → uniforms/UBO uploaded (≤ 64 blobs × 2 vec4) → L3 draws one fullscreen (window-sized) quad.

**Prototype target:** single-file HTML + WebGL2 (matches the flora preview-tool workflow: validate algorithm in browser, port to Godot last). Godot port = one `ColorRect` + fragment shader + GDScript sim (§12).

---

## 3. The Real Device (reference model)

Understanding what we're faking, so mechanisms have named targets:

1. Two immiscible fluids: paraffin-based wax and a water/glycol solution, densities within ~1% of each other at operating temperature.
2. A bulb (heat + light) below a glass vessel; a metal coil sits at the base.
3. Heat melts and expands the wax; its density falls *below* the liquid's → buoyant rise. It cools with height; density rises *above* the liquid's → fall. The crossover being razor-thin is why motion is slow.
4. The coil breaks surface tension of returned blobs so they re-merge into the bottom pool.
5. Surfactants create a film between wax bodies → contact without instant coalescence.
6. Warm-up (30–60 min real time): dome softens, a stalagmite column rises first, then breaks into circulation.
7. Failure modes: overheating → all wax at top / clouding; underheating → one dead lump.

---

## 4. Phenomenon → Mechanism Traceability Matrix

**This is the contract.** Every visible behavior of a real lamp, its physical cause, our mechanism, where it lives, and whether it is Emergent (falls out of other rules) or Approximated (dedicated code). Fidelity: how close the illusion gets at companion scale.

| # | Phenomenon | Real physics | Our mechanism | Layer | E/A | Fidelity | Phase |
|---|---|---|---|---|---|---|---|
| 1 | Slow rise/fall, hovering at turnarounds | Buoyancy = tiny density delta near crossover; Stokes drag | ρ(T) linear model; a = g·(ρ_liq−ρ_wax(T))/ρ_wax; anisotropic drag; float positions (no resolution floor) | L1 | A | High | P1 |
| 2 | Mixed up/down traffic, phase diversity | Cooling rate ∝ surface/volume; size variation | dT/dt ∝ 1/r; detachment size distribution; ±10% per-blob param noise | L1 | E | High | P1 |
| 3 | Blobs kiss, ride together, then suddenly fuse | Film drainage between droplets; T/ρ mismatch delays coalescence | Contact state machine: soft repulsion + drainage timer gated by |ΔT| and rel. velocity; per-blob smin softness driven by merge readiness | L1+L3 | A | High | P2 |
| 4 | Necking and pinch-off on merge/split | Plateau–Rayleigh instability, surface tension | Smooth-min between nearby density sources creates/thins necks automatically as separation changes | L3 | E | High | P0 |
| 5 | Bottom pool: flat mass, melts, bulges, releases risers | Melt front, buoyant detachment | Pool = sub-particle cluster pressed to base; melt accumulator; √(meltFraction) buoyancy ramp + one-shot detachment impulse; spawn radius from size distribution | L1+L2 | A | High | P3 |
| 6 | Top pool: dome-flattened mass drips pendant blobs | Cooling past crossover, pendant-drop necking | Mirror of #5 against dome; release when coldest cluster region exceeds pendant volume threshold; neck rendered by #4 | L1+L2 | A | High | P3 |
| 7 | Volume conservation; pools visibly drain/refill | Mass conservation | r_new = (Σrᵢ³)^⅓ on all merges/splits; pool volume ledger | L1 | A | Exact | P2 |
| 8 | Teardrop elongation while moving; jellyfish cap on risers | Viscous drag deforms droplet | Per-blob ellipsoid stretch along velocity: scale SDF space by s(|v|); cap asymmetry term for risers | L2 | A | Med-High | P5 |
| 9 | Wobble after merge/poke, ringing down | Droplet shape-oscillation modes (damped) | Critically-under-damped oscillator on stretch axes, excited by merge/impulse events | L2 | A | High | P4 |
| 10 | Hot wax deforms more; cold wax lumpy/rigid | Viscosity falls with T | Stretch gain and spring stiffness scaled by T; below melt threshold, blobs render with harder smin k and resist deformation | L2+L3 | A | Med | P5 |
| 11 | Lateral drift; blobs wander, never rise plumb | Entrained convection in surrounding liquid | Analytic toroidal convection field v_c(x,y): up over heat source, down at walls; weak advection coupling on blobs, strong on dust motes | L1 | A | Med-High | P5 |
| 12 | Glitter/particulate motion revealing currents | Suspended particles advected by convection | 100–200 mote billboards advected by v_c + Brownian jitter, rendered with depth-correct occlusion vs wax SDF | L3 | A | High | P5 |
| 13 | Blobs slide along glass, slight wall attraction/lubrication | Wetting, lubrication layer | Wall SDF constraint with tangential slip (kill normal velocity, damp tangential lightly); optional weak wall spring within 1 radius | L1 | A | Med | P1 |
| 14 | Warm-up sequence: softening dome, stalagmite column, first breakup | Melt front + initial surface-tension bridge | Scripted-by-physics: init all wax as bottom cluster at T_cold; melt model produces bulge; a temporary "bridge blob chain" spawns for first ascent, then normal circulation. Optional flourish. | L1 | A | Med | P5 |
| 15 | Overheat clouding / stall-at-top | Emulsification, thermal runaway | Global agitation/heat meter → raises liquid turbidity uniform + biases all blobs buoyant; recovers over minutes. Doubles as game risk mechanic | L1+L3 | A | Med | P5 |
| 16 | Wax glow: thin edges luminous, thick cores dense/saturated | Beer–Lambert absorption through thickness | Entry/exit march → thickness → per-channel transmittance exp(−σ·d); wax color = f(thickness) | L3 | A | High | P0 |
| 17 | Undersides bloom; light from below | Bulb radiance, forward scattering in wax | Per-hit short march toward bulb through density → attenuation; add forward-scatter lobe; emissive term scaled by blob T (hotter = brighter) | L3 | A | High | P0 |
| 18 | Glass refraction; blobs distort near walls; magnification | Two IOR interfaces (air/glass/liquid) on a cylinder | Analytic cylinder intersection + single combined refraction bend at entry (cheap, visually correct); Fresnel-weighted env reflection on glass | L3 | A | Med-High | P0 |
| 19 | Specular highlights on wax surface | Wax–liquid interface reflectance | SDF normal → Blinn-Phong from bulb + one fake key light, Fresnel-weighted | L3 | A | High | P0 |
| 20 | Liquid tint, faint haze, aged-lamp character | Dyed liquid, slight turbidity | Distance fog inside vessel with liquid tint; turbidity uniform (see #15) | L3 | A | High | P0 |
| 21 | Bloom/halation around bright wax and bulb | Camera/eye response | Bright-pass + separable blur at ¼ res, composite | L3 | A | High | P5 |
| 22 | No banding in slow gradients | — | Blue-noise dither on output | L3 | A | Exact | P0 |
| 23 | Nothing is ever static: pool breathes, dome shimmers | Micro-convection | Low-amplitude time-noise on pool cluster positions and smin k | L2 | A | High | P5 |
| 24 | Tap-the-glass wobble | Impulse through vessel | Radial impulse to nearby blobs + brief camera-space vessel shudder; excites #9 oscillators | L1 | A | High | P4 |
| 25 | Coil at base aiding re-merge | Coil breaks film of returned blobs | Bottom zone sets drainage timer → ~0 (instant merge eligibility) | L1 | A | Exact | P2 |
| 26 | Depth-ambiguous traffic: blobs pass in front of / behind each other without fusing; implied front/back circulation loop | Full 3D motion in a cylinder viewed from one side | 3 fixed depth layers (z planes within ±0.4R); smin only within a layer, near-hard min across layers (tiny k reads as film contact, previews #3); pools span all layers; perspective + liquid fog give free depth cues | L1+L3 | A | Med-High | P1 |

**Audit rule:** any time footage comparison reveals a behavior not in this table, add a row before writing code for it.

---

## 5. Layer 1 — Thermal Blob Simulation

### 5.1 Data structures

```
struct Blob {
  vec2  pos;            // lamp-local; x ∈ [-R_lamp, R_lamp], y ∈ [0, H_lamp]
                        // NOTE: sim is 2D in a cylinder; render fakes z by
                        // assigning each blob a stable z-jitter ∈ [-0.3R, 0.3R]
                        // (blobs in real lamps read as depth-ambiguous; full
                        // 3D sim is unnecessary — revisit only if P0 gate says so)
  vec2  vel;
  float radius;         // current, volume-derived
  float T;              // temperature, normalized [0,1]; 0=room, 1=coil max
  float meltFrac;       // [0,1]
  float zJitter;        // fixed at spawn
  float noiseSeed;      // ±10% param variation
  vec2  stretch;        // written by L2
  float sminK;          // per-blob softness, written by merge logic
  int   state;          // FREE | CONTACT | MERGING | POOL_BOTTOM | POOL_TOP
  int   contactPartner; // blob id or -1
  float drainTimer;
}

struct Pool {           // two instances: bottom, top
  float volume;         // ledger, drives cluster particle count/spread
  float T;              // bulk temperature
  float meltAccum;      // bottom only
  SubParticle cluster[M];  // M ≈ 6–14, owned by L2
}
```

Max free blobs: **48** (uniform budget 64 incl. pool sub-particles). This is far more than a real lamp shows (~8–15 in flight).

### 5.2 Update loop (fixed dt = 1/60 s sim time; see §8 for wall-clock decoupling)

```
1. thermal:      for each blob: dT/dt = (k_zone(y)·(T_amb(y) − T) + k_bulb·bulbGain(pos)) · (r_ref/r)
                 meltFrac ← smoothstep over T around T_melt
2. forces:       buoyancy  a_b = g_sim · (ρ_liq − ρ_wax(T)) / ρ_wax(T) · √(meltFrac)
                 drag      a_d = −(c_v·v_y, c_h·v_x) / r        // anisotropic, radius-scaled
                 convection a_c = k_conv · (v_c(pos) − vel)
                 walls:     project out of vessel SDF; kill normal vel; damp tangential ×0.98
                 interaction forces (§7)
3. integrate:    semi-implicit Euler (vel += a·dt; pos += vel·dt). No stability risk at these
                 accelerations; do NOT add substeps unless P1 gate fails.
4. contacts:     spatial check all pairs (n≤48 → brute force is fine, no grid needed);
                 run merge state machine (§5.4)
5. pools:        melt accumulator, detachment, pendant release (§5.5)
6. bookkeeping:  volume ledger, spawn/despawn, state transitions
```

### 5.3 The density model (the heart of slowness)

```
ρ_wax(T) = ρ_wax0 · (1 − β·T)          // β chosen so crossover at T_cross
Δρ(T)    = ρ_liq − ρ_wax(T)            // < 0 cold (sinks), > 0 hot (rises)
```

Terminal velocity v_t = a_b / (c_v/r). **Speed is a closed-form dial.** Calibrate: a mid-size blob should cross the lamp in **35–75 s** (measure from reference footage, §11). Near T_cross, a_b → 0 continuously → hovering and slow turnarounds are automatic. If everything else fails, `g_sim` is a single global speed knob.

### 5.4 Merge state machine (film drainage)

```
FREE ──(dist < r₁+r₂+ε)──► CONTACT:
    apply soft repulsion  F = k_film · overlap        (the "film pressure")
    drainTimer += dt  IF  |T₁−T₂| < ΔT_max  AND  |v_rel| < v_max
                      ELSE decay drainTimer ×0.95
    τ_required = τ_drain0 · (1 + k_ΔT·|T₁−T₂|)
    in bottom zone (coil): τ_required ≈ 0                     // phenomenon #25
    readiness m = clamp(drainTimer / τ_required)
    both blobs: sminK = mix(k_hard, k_soft, m)                // renderer shows
                                                              // dimple → slurp
CONTACT ──(m ≥ 1)──► MERGING:
    over t_merge ≈ 0.8 s: lerp positions toward volume-weighted center,
    then replace with one blob: r = (r₁³+r₂³)^⅓,  T = volume-weighted mean,
    excite L2 wobble oscillator.
CONTACT ──(separation)──► FREE (drainTimer decays)
```

Splitting (rarer in real lamps): a rising blob with meltFrac ≈ 1 and |stretch| above threshold has small probability/frame to fission into two volume-conserving children with a separation impulse. Keep probability low; real lamps split far less than screensavers think.

### 5.5 Pools and detachment

**Bottom pool.** All wax not in flight lives in the ledger. Heat input grows `meltAccum`. When `meltAccum ≥ V_detach` (sampled from lognormal around V_mean, ±40%): spawn blob at pool surface bulge point with `meltFrac=1`, `T=T_pool_bottom`, upward impulse `J_detach`; subtract volume. The L2 cluster visibly bulges before release (bulge target fed by meltAccum).

**Top pool.** Arriving hot blobs with sustained dome contact and m≥1 deposit volume into ledger. Pool T cools toward T_amb(top). When pool T < T_cross and volume > V_pendant: designate lowest cluster particle as pendant seed, extrude downward (L2), spawn falling blob (T = pool T), subtract volume. Smooth-min renders the thinning neck; pinch-off is visual-only and free (#4).

**Traffic guarantee:** because detachment sizes vary and dT/dt ∝ 1/r, small blobs turn around mid-column while large ones complete full transits → simultaneous risers and fallers with no choreography. If a degenerate state appears (all wax pooled), the melt accumulator restarts circulation within seconds — the system is self-priming, same as a real lamp warming up.

---

## 6. Layer 2 — Shape

### 6.1 Free blobs: analytic ellipsoid + wobble
```
stretchTarget = 1 + k_s(T) · min(|v|/v_ref, s_max)      // elongate along velocity
k_s(T) = k_s_cold + meltFrac·(k_s_hot − k_s_cold)       // phenomenon #10
wobble: 2nd-order damped oscillator per blob on (stretch⊥, stretch∥),
        ζ ≈ 0.25, f ≈ 1.2 Hz, excited by merges/impulses (#9, #24)
Renderer applies inverse-scaled space around blob center oriented to v̂.
Risers get cap asymmetry: top hemisphere scale ×(1 + k_cap·|v_y|) → jellyfish.
```

### 6.2 Pool clusters
Each pool = M sub-particles (bottom M=10–14, top M=6–10) with:
soft mutual springs (rest length ∝ ∛(V/M)), buoyancy pressure pressing the set against base/dome (flattening emerges), lateral spread until wall contact, low-amplitude time-noise (#23). Pendant/bulge events animate one particle away from the set; smin does the rest.

**De-scope valve:** if cluster tuning burns > 3 days, fallback = pools as 3 fixed overlapping stadium-SDF primitives with animated height + one animated bulge sphere. Ships 85% of the look.

---

## 7. Interaction

Writes forces/heat into L1 only. Cursor mapped through inverse vessel refraction to lamp space (approximation fine).

- **Warm touch (hover/hold, LMB):** gaussian heat source, radius ~1.5 blob radii: `k_bulb_local` added into thermal step. Softens/detaches cold wax, sustains risers. NO direct positional force — heat is the verb.
- **Cool touch (RMB):** negative source, same shape. Stalls and drops blobs.
- **Nudge (drag fast):** capped radial impulse, heavily smoothed. Small; the illusion dies if blobs feel grabbed.
- **Tap the glass (click on vessel, not wax):** #24.
- **Agitation meter:** ∫(interaction energy) → clouding + runaway (#15); decays over ~2 min. The "don't overdo it" risk loop.

Game-layer hooks (chemistries, vessels, heat sources, species) are **config rows only** — same CSV-driven pattern as the Deeplight flora database: a chemistry = {β, T_cross, σ_absorb(RGB), τ_drain0, k_s, emissive gain}; a vessel = {SDF params, glass IOR/tint}; a heat source = {bulbGain profile, flicker}. No game code in this document's scope; the sim/renderer must simply read all constants from config (§10) so the game layer is data.

---

## 8. Timing, Sleep, and the Companion Contract

- Sim fixed-step 60 Hz **sim-time**; wall-clock decoupled by `timeScale` (default 1.0; exposed — slow-motion mode is free and gorgeous).
- Render on monitor refresh while focused; **10 Hz sim / 24 fps render when unfocused; 0 fps when occluded/minimized** (visibility API / OS occlusion events). Positions interpolate for render frames between sim ticks.
- Budgets (reference machine Intel UHD 770, window 360×640): GPU ≤ 1.5 ms focused; CPU ≤ 2% of one core; RAM ≤ 150 MB; **zero** GPU work occluded.

---

## 9. Layer 3 — Renderer (single fragment shader)

### 9.1 Pipeline per pixel
```
1. Ray from camera (fixed slight-low angle, subtle idle sway ±0.5°).
2. Analytic outer-cylinder (glass) intersection; miss → background/base/cap shading.
3. Refract once at glass entry with combined air→glass→liquid bend (Fresnel →
   env reflection mix on glass; fake 2-band env).
4. Raymarch wax SDF inside vessel: sequential smin over ≤64 sources,
   per-source k = blob.sminK, ellipsoid space-warp per L2.
   Max 80 steps, early-exit ε scaled by distance. Bounding: skip march if ray
   misses union of blob bounding circle (cheap 2D prepass in shader).
5. HIT: normal via tetrahedron gradient →
   a. Thickness: march to exit (coarse, 16 steps) → d
   b. Transmittance exp(−σ_RGB·d); wax body color = tint(d)
   c. Under-light: 8-step march toward bulb point → attenuation A;
      radiance += bulbColor · A · (forwardScatter + k_e·blobT)     // #17
   d. Specular: Blinn-Phong ×2 lights, Fresnel-weighted             // #19
6. MISS: liquid: tint fog by in-vessel path length; add bulb glare gradient;
   composite mote billboards (depth vs SDF).                        // #12, #20
7. Turbidity uniform lifts fog + desaturates (#15).
8. Bulb/base/cap geometry: analytic SDF, emissive bulb with 0.5 Hz flicker noise.
9. Post: ¼-res bright-pass bloom, composite; blue-noise dither; subtle vignette.
```

### 9.2 Known cost levers (apply in order if over budget)
half-res main march + bilateral upsample → step count 80→56 → thickness march 16→8 → moth billboards off → bloom off. Do not reduce blob count; reduce pixels.

### 9.3 Per-pair smin honesty note
True per-*pair* k in sequential smin is not directly expressible; per-*blob* k (each contact pair writes readiness into both members) is the approximation. Contacts are spatially local, so error only manifests when one blob touches two partners at different readiness — rare, and reads as "wax being weird," which is in-brand. Documented so nobody "fixes" it into an O(n²) shader.

---

## 10. Tuning Constants (starting values — calibration will move all of these)

All constants live in one config object/CSV. Units: lamp-height = 1.0, sim-seconds.

| Constant | Start | Meaning / calibration note |
|---|---|---|
| g_sim | 0.15 | global speed master; sets transit time w/ drag |
| ρ_liq | 1.00 | reference |
| ρ_wax0 | 1.035 | cold wax 3.5% denser |
| β | 0.07 | → crossover at T_cross = 0.5 |
| c_v, c_h | 2.0, 3.2 | vertical/horizontal drag (crib: 1.6/2.5 scaled) |
| k_zone top/mid/bottom | 0.35 / 0.12 / 0.0 | cooling rates (crib: strong/mild/none) |
| k_bulb | 0.5 | base heating gain, gaussian σ = 0.18·H |
| T_melt | 0.28 | melt threshold (crib) |
| r_ref | 0.045·H | reference radius for 1/r thermal scaling |
| τ_drain0 | 2.5 s | film drainage base time |
| k_ΔT | 6.0 | drainage penalty per unit ΔT |
| ΔT_max, v_max | 0.15, 0.03 | merge gates |
| k_film | 4.0 | contact repulsion |
| k_hard / k_soft | 0.008 / 0.09 | smin k range (in lamp units) |
| t_merge | 0.8 s | slurp duration |
| V_mean detach | (0.05·H)³ | mean detachment volume, lognormal ±40% |
| J_detach | 0.04 | detachment impulse (crib: "decisive, not sluggish") |
| ζ, f wobble | 0.25, 1.2 Hz | merge/poke ring-down |
| k_s hot/cold | 0.35 / 0.06 | stretch gain |
| k_conv | 0.15 | blob↔convection coupling (motes: 1.0) |
| σ_RGB (classic red) | (0.4, 2.8, 3.2) | absorption; drives thin-edge glow color |
| k_e | 0.6 | temperature emissive gain |
| timeScale | 1.0 | exposed |

---

## 11. Calibration Protocol (Phase 5, but read now)

1. Acquire 3 reference clips of a real Mathmos/Lava-brand lamp: warm-up, steady circulation, tap response. Fixed camera, known lamp height for scale.
2. Measure from footage: transit times by blob size class, hover durations at turnarounds, kiss-to-fuse delays (expect 1–8 s), pendant drip cadence, wobble frequency/decay after tap.
3. Tune constants to match measured *distributions*, not single values, in this order: speed (g_sim, drag) → thermal (zones, k_bulb) → merge timing (τ) → shape (stretch, wobble) → optics (σ, k_e) — earlier stages change the inputs to later ones.
4. Blind test: 4 clips (2 real, 2 sim) at companion size shown to spouse + 2 external testers. **Target: ≤ 75% correct identification** (chance = 50%). This is the "convincing" bar, made falsifiable.

---

## 12. Build Phases, Gates, Kill Criteria

Single-file `index.html` through P4; split into `sim.js` / `config.js` / inline GLSL only when > ~900 lines. Godot port is P6, not before.

**P0 — Renderer proof (est. 4–7 sessions).** Hardcoded 6 blobs on scripted sine paths. Full §9 minus bloom/motes. *Gate:* a screenshot that makes you involuntarily say "oh." Blind-ish test: does spouse ask if it's a video? *Kill criterion:* if after 7 focused sessions it still reads as "nice metaballs" rather than "wax," stop — the thesis is wrong and no sim work will save it. (Expected outcome: pass; #16–#19 are well-trodden.)

**P1 — Thermal circulation (2–4 sessions).** L1 free blobs, no pools/merging (blobs teleport-recycle at extremes). *Gate:* 15 min unattended: continuous mixed traffic, mid-size transit within measured 35–75 s window, visible hovering at turnarounds, no blob jitter at slow speeds (the grid-solver failure being explicitly retired here).

**P2 — Merge/drainage + volume ledger (2–3 sessions).** *Gate:* kiss-hesitate-fuse visibly occurring; bottom-zone instant remerge; no volume drift over 30 min (log Σr³).

**P3 — Pools + detachment + pendant (3–5 sessions, hardest sim phase).** *Gate:* full self-priming cycle from cold start; pendant drops neck and pinch; pools visibly breathe/drain. *De-scope valve:* §6.2 fallback after 3 days of cluster fighting.

**P4 — Interaction (2 sessions).** *Gate:* heat-cursor detaches a cold blob within 4 s and it feels caused, not commanded; tap wobble rings down naturally.

**P5 — Polish & calibration (5–8 sessions).** Motes, convection, warm-up flourish, agitation/clouding, bloom, §11 protocol. *Gate:* blind test ≤ 75%.

**P6 — Godot port (2–3 sessions).** GDScript L1/L2 (trivially portable — it's ODEs), shader → Godot shading language (mechanical), transparent always-on-top borderless window, occlusion sleep. *Gate:* budget table §8 met on UHD 770.

**Total honest estimate: 20–32 sessions.** Game layer (chemistries/vessels/progression) is a separate document, gated on P5 passing — per the standing rule, the renderer is the product hypothesis; test it before building the store around it.

## 13. Claude Code Working Agreement

One phase-item per session; open each session by pasting the relevant §§ of this doc plus current config. No library additions (raw WebGL2, no three.js — the shader IS the app). Every constant through config, never inline. Any behavior change that isn't in the §4 matrix: add the row first. When something looks wrong, tune before restructuring — this architecture fails by mistuning, not by design, and restructuring is how Lucent-drift gets in through the side door.
