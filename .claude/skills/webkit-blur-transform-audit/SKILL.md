---
name: webkit-blur-transform-audit
description: Use before shipping ANY new component that combines backdrop-filter/backdrop-blur with a CSS transform (Framer Motion animate/whileHover/drag, Lenis scroll, rotateX/Y/Z, scale, translate) on the same element, and whenever reviewing a PR that touches glass/blur surfaces. Covers the recurring WebKit paint-failure trap this codebase has hit 3+ times, and the exact grep-based audit procedure to run.
---

# WebKit backdrop-filter + transform Audit

Real WebKit (Safari/iOS) has a well-documented class of paint failure when
`backdrop-filter` and a CSS `transform` land on the SAME element, specifically
when that transform is CONTINUOUS or interactive (not a one-shot settle-and-
done entrance). This has shipped broken in this exact codebase at least
twice and been corrected a third time proactively:

1. **`PredictionModal`'s Vaul drawer** (§21/§34) — the sheet became completely
   invisible on a real phone because `Drawer.Content` (which Vaul transforms
   continuously for its open/slide drag physics) also carried
   `card-elevated`'s `backdrop-filter` AND `.glass-grain`'s `mix-blend-mode`.
   The separate, untransformed `Drawer.Overlay` rendered fine — the tell of
   this bug class is ALWAYS one element painting while an adjacent,
   untransformed one doesn't.
2. **`BottomNav`'s scroll drift** (§21/§34) — a `position: fixed` element
   under Lenis's JS-driven smooth-scroll visually drifted/lagged on real iOS
   Safari even though no code-level containing-block fact was wrong. Fixed by
   forcing the fixed element onto its own GPU compositing layer
   (`transform: translateZ(0)` + `will-change: transform`) — landed on the
   `<nav>` itself, deliberately NEVER the same element as `.glass`'s
   `backdrop-filter` (which lives on a child `<div>` one level down).
3. **Sprint 43's `BallTrailTransition`/`EntityBadge` specular reverts**
   (§58 addendum) — a planned prestige-badge sheen combining
   `backdrop-filter` + `transform: preserve-3d` on the same node was caught
   and redesigned BEFORE shipping, specifically by reading this history
   first.

## The safe precedent — what IS fine

A ONE-SHOT, settle-and-done entrance transform (mounts once, animates to a
final value, then stops — never re-triggered by drag, scroll, or continuous
pointer tracking) CAN safely combine with `backdrop-filter` on the same
element. `WorldCupBracket.tsx`'s `GroupCard`/`StadiumCard` do exactly this —
`rotateX`/`scale` entrance + `backdrop-blur-2xl`, proven safe in real
production use (confirmed and reused deliberately for §61's `WeeklyPodiumModal`
podium cards). The distinguishing fact is CONTINUOUS/INTERACTIVE vs.
ONE-SHOT, not "any transform at all."

## The audit procedure — run this before shipping, and in review

```bash
# 1. Find every backdrop-filter/backdrop-blur usage in files this change touches
grep -rn "backdrop-blur\|backdropFilter\|backdrop-filter" <changed files or dir>

# 2. For EACH hit, find the element it's actually on and ask:
#    a. Does this element (or a DIRECT ancestor up to the nearest positioned
#       container) ALSO carry a transform?
#    b. If yes — is that transform continuous/interactive (drag="y"/"x",
#       Framer whileHover/whileTap/drag, a Lenis-driven scroll offset,
#       useTactileTilt's per-frame pointer tracking) or a one-shot mount
#       entrance (initial -> animate, never re-triggered)?
#    c. Continuous/interactive + blur on the SAME element => real risk.
#       Separate the blur onto a sibling/ancestor that is NEVER transformed,
#       or move the transform to a wrapper and keep blur on an untransformed
#       inner element.
```

Grep for the specific Framer/CSS signatures that mean "continuous transform":
`drag=`, `whileHover=`, `whileTap=`, `animate={{` (when the animated keys
include `x`/`y`/`rotate`/`scale` and the component can re-render/re-trigger),
`useTactileTilt`, any Lenis-scroll-derived `style.transform`.

## This sandbox cannot verify real WebKit rendering

Headless Chromium (what every Playwright verification pass in this repo runs
against) does NOT reproduce this bug class — it's a genuine WebKit compositor
quirk, confirmed by direct attempt (§21/§34's own documented limitation). A
Playwright pass that finds "no backdrop-filter + transform on the same
element" via the grep/DOM-walk above is real, useful evidence; a Playwright
pass that tries to reproduce the VISUAL failure on a real device is not
something this sandbox can do. State that limitation plainly in any
verification report rather than implying headless-Chromium screenshots prove
more than they do.

## Quick self-check

1. Did I grep every new/changed file for `backdrop-blur`/`backdropFilter`?
2. For each hit, did I check whether the SAME element (or its direct
   transformed ancestor) also carries a transform?
3. If so, is that transform provably one-shot (mounts once, settles, never
   re-triggered) — or could it be continuous/interactive?
4. If continuous, did I move the blur to a separate, never-transformed
   element instead of accepting the risk?
