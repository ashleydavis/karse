# Resource utilization colours and legend

**Sequence:** 2 of 3 — [Resource utilization](README.md#resource-utilization-prototype--karse). Requires **1** complete.

## Overview

After [`1-1-plan-resource-utilization-dashboard.md`](1-1-plan-resource-utilization-dashboard.md) ships, replace the interim MUI theme colours on utilization bars, badges, and cards with the prototype's semantic green/amber/red/gray palette (`/home/ash/Downloads/k8s-dashboard`). The prototype uses Tailwind `green-400/500`, `amber-400/500`, `red-400/500`, and gray for informational states, with distinct background tints (`green-950`, `amber-950`, `red-950`) on badges and highlighted cards. Karse should centralize these tokens for light and dark mode and expose a **colour guide** as a popup anchored to the left sidebar (button on the sidebar edge), matching the prototype's "Color guide" block but not inline on every page.

Implement this plan only after the dashboard plan is complete and green.

## Issues

<!-- populated later by plan:check -->

## Steps

### Spec

1. Create `docs/spec/resource-utilization-colors/index.md` and `detail.md` documenting: the four semantic levels (healthy / investigate / action / informational), which UI surfaces use which level, light/dark hex or palette token mapping, and the sidebar legend popup behaviour.

### Palette tokens

2. Create `frontend/src/lib/utilization-colors.ts`:
   - Export `UtilizationLevel = "ok" | "warn" | "critical" | "info"`.
   - Export `UtilizationColors` type: `{ text: string; bar: string; badgeBg: string; badgeText: string; cardBg?: string; cardBorder?: string }`.
   - Export `utilizationColors(level: UtilizationLevel, mode: "light" | "dark"): UtilizationColors` with values derived from the prototype:
     - ok: green (`#22c55e` bar, `#4ade80` text, `#052e16`/`green-950` badge bg).
     - warn: amber (`#f59e0b`, `#fbbf24`, `#451a03`).
     - critical: red (`#ef4444`, `#f87171`, `#450a0a`).
     - info: gray (`#6b7280`, `#d1d5db`, neutral badge).
   - Export helpers consumed by existing classifiers in `frontend/src/lib/resource-utilization.ts`:
     - `barColorForPercent(percent, ruleset)` — returns level (port prototype `barColor()` thresholds per ruleset key: `clusterCard`, `nodeRow`, `podRow`, `workloadRow`).
     - `colorsForLevel(level, mode)` — thin wrapper over `utilizationColors`.
   - Dark mode: slightly lower luminance text, same hue family; verify contrast against `background.paper`.

3. Optionally extend MUI theme in `frontend/src/theme.ts` (if present) or the app's theme factory with `palette.utilization.{ok,warn,critical,info}` mirroring the above so non-utilization code can reuse tokens later. Keep utilization-specific logic in `utilization-colors.ts`.

### Wire colours into components

4. Update `frontend/src/components/resource-utilization/metric-card.tsx`: bar fill and value text colour from `colorsForLevel(level, theme.palette.mode)`.

5. Update `frontend/src/components/resource-utilization/resource-bar-cell.tsx`: bar and value text from level colours.

6. Update `frontend/src/components/resource-utilization/status-badge.tsx`: background/text from badge colours; map level → prototype labels (OK, Watch, Critical, Over-utilized, etc.).

7. Update `frontend/src/components/resource-utilization/health-signal-card.tsx`: value text and badge colours by level; apply `cardBg`/`cardBorder` when `highlighted` (node pressure card uses red tint like prototype `border-red-800`).

8. Update `frontend/src/components/resource-utilization/node-summary-strip.tsx`: each card uses level-specific tinted background/border (prototype over=red, healthy=green, under=amber).

9. Update `frontend/src/components/performance/usage-treemap.tsx` `leafColor()`: align utilisation colouring with the same ok/warn/critical thresholds (≥0.9 critical, ≥0.7 warn, else ok) using `utilizationColors` instead of hardcoded hex.

10. Add mode-specific table/workload **legends** below cluster workloads table and pods table (prototype `#legend-usage` / `#legend-requests` blocks): small swatches using `utilizationColors`, text from prototype legend strings, toggled by `ViewMode`.

### Sidebar colour guide popup

11. Create `frontend/src/components/resource-utilization/color-guide.tsx`:
    - Content mirrors prototype `index.html` "Color guide" section: four rows (Green — healthy, Amber — worth investigating, Red — action needed, Gray — informational) with short descriptions from the prototype.
    - Render inside MUI `Popover` or `Drawer` anchor="left" (popup slides from sidebar edge, not a full-page panel).

12. Create `frontend/src/components/resource-utilization/color-guide-button.tsx`:
    - Small vertical or edge-mounted icon button fixed to the **right edge of the sidebar** (or bottom of sidebar above collapse control) — a palette/legend icon (`faPalette` or `faList` from Font Awesome).
    - `aria-label="Colour guide"`; `data-test-id="color-guide-button"`.
    - Click opens/closes the popover; clicking outside closes it.

13. In `frontend/src/components/sidebar.tsx`:
    - Mount `ColorGuideButton` + `ColorGuide` in the sidebar `Box`, positioned `position: "absolute"` or flex layout so it sits on the sidebar's outer edge (visible in both collapsed and expanded states — tooltip when collapsed).
    - Do **not** add the inline colour guide block to cluster overview (prototype shows it once globally via sidebar, per user request).

### Replace interim colours

14. Grep for temporary theme.palette primary/info/success usage in `frontend/src/components/resource-utilization/` and `cluster-resource-indicator` (if any remnants); switch to utilization colour helpers.

15. Update `frontend/src/pages/cluster-home/components/cluster-resource-indicator.tsx` only if still present; otherwise skip.

### Documentation

16. Update `docs/user-guide.md` with a short "Reading the colours" section pointing to the sidebar legend.
17. Update `docs/testing-manual/resource-utilization/detail.md` with legend popup steps and screenshot requirements for both themes.

### E2E

18. Extend `e2e/src/e2e.test.ts`:
    - Open colour guide from sidebar; assert four entries visible; screenshot light + dark.
    - Assert a known fake-metrics row renders green bar at healthy percent and red at critical percent (use fixture tuned for threshold).
    - Assert workloads/pods legend switches when toggling Usage ↔ Requests.

## Unit Tests

- None required on frontend per project policy; backend unchanged.
- If `utilization-colors.ts` logic is duplicated for safety, optional backend-style pure tests are **not** used — rely on e2e.

## Smoke Tests

- No smoke script changes (no API changes).

## Verify

- Run `bun run compile`.
- Run `bun run tests:all`.
- Toggle light/dark mode: all utilization bars/badges remain readable (WCAG contrast spot-check).
- Sidebar colour guide opens/closes; content matches prototype descriptions.
- Cluster/node/pod views use consistent hues for the same level across cards, bars, and badges.

## Notes

- **Order dependency**: requires `1-plan-resource-utilization-dashboard.md` components (`metric-card`, `resource-bar-cell`, `status-badge`, etc.) to exist.
- **MUI Chips vs prototype pills**: use MUI `Chip`/`Box` with custom sx from tokens; pixel-perfect Tailwind match is not required.
- **Collapsed sidebar**: legend button shows icon-only with Tooltip; popover anchors to button.
- **Help content** for "what does amber mean?" lives in `3-plan-context-sensitive-help.md` later; the legend popup is the concise reference.
