# Priority Queue — Dev Mode Export

## Shared Context

The Priority Queue is a right-hand rail, persistent across all main views.

### Rail Chrome

| Property | Value | Token |
|----------|-------|-------|
| Width | 320px | — |
| Background | `#0F172A` | `color/theme/base-background` |
| Left border | 1px solid `#1E293B` | `color/theme/card-surface` |
| Full height | 100vh | — |
| Header padding | 16px | `space/16` |
| Header text | "Priority Queue", 16px/24px Inter Medium | `body/label` |
| Header color | `#FFFFFF` | — |
| Body padding | 16px | `space/16` |
| Card gap | 12px | `space/12` |

---

## Frame 1: Priority Queue — Idle/Loading

| Property | Value | Token |
|----------|-------|-------|
| Rail background | `#0F172A` | `color/theme/base-background` |

### Shimmer Placeholder Cards (1-2)

| Property | Value | Token |
|----------|-------|-------|
| Card width | 288px | — |
| Card height | 120px | — |
| Card radius | 8px | `radius/lg` |
| Card background | `#1E293B` | `color/theme/card-surface` |
| Shimmer region (title area) | 120px × 16px, at top | `color/skeleton` |
| Shimmer region (score area) | 60px × 24px, middle | `color/skeleton` |
| Shimmer region (footer) | 80px × 14px, bottom | `color/skeleton` |

### Reflow constraint

Placeholder cards match the exact width and height of Populated cards — no layout shift on transition.

---

## Frame 2: Priority Queue — All-Nominal

| Property | Value | Token |
|----------|-------|-------|
| Rail background | `#0F172A` | `color/theme/base-background` |

### Single Centered Card

| Property | Value | Token |
|----------|-------|-------|
| Card width | 288px | — |
| Card height | 120px | — |
| Card radius | 8px | `radius/lg` |
| Card background | `#1E293B` | `color/theme/card-surface` |
| Card internal padding | 16px | `space/16` |
| Vertical centering | Flexbox, centered in rail body | — |

### Checkmark Icon

| Property | Value | Token |
|----------|-------|-------|
| Icon | Filled circle check | — |
| Icon color | `#16A34A` | `color/status/safe` |
| Icon size | 32×32px | — |
| Margin bottom | 8px | `space/8` |

### Text

| Property | Value | Token |
|----------|-------|-------|
| Text | "All zones nominal" | — |
| Text style | 16px/24px Inter Medium | `body/label` |
| Text color | `#FFFFFF` | — |
| Margin bottom | 4px | `space/4` |

### Muted Timestamp

| Property | Value | Token |
|----------|-------|-------|
| Text | "Last change: [timestamp]" | — |
| Text style | 12px/16px Inter Regular | `text/xs` |
| Text color | `#64748B` | `color/status/offline` |

---

## Frame 3: Priority Queue — Populated

| Property | Value | Token |
|----------|-------|-------|
| Rail background | `#0F172A` | `color/theme/base-background` |

### Ranked Card (each)

| Property | Value | Token |
|----------|-------|-------|
| Card width | 288px | — |
| Card height | auto (min 120px) | — |
| Card radius | 8px | `radius/lg` |
| Card background | `#1E293B` | `color/theme/card-surface` |
| Card internal padding | 16px | `space/16` |
| Card margin bottom | 12px | `space/12` |
| Left border accent | 4px solid (status color) | — |

### Status Left Border Colors

| State | Border Color | Token |
|-------|-------------|-------|
| CRITICAL | `#DC2626` | `color/status/critical` |
| WARNING | `#D97706` | `color/status/warning` |

### Card Content — Zone Name

| Property | Value | Token |
|----------|-------|-------|
| Text style | 14px/20px Inter Medium | `text/sm` |
| Color | `#FFFFFF` | — |

### Card Content — Risk Score

| Property | Value | Token |
|----------|-------|-------|
| Font | 24px/32px JetBrains Mono Medium | `telemetry/value` at `text/2xl` size |
| Color | `#FFFFFF` | — |

### Card Content — Occupancy Indicator

| Property | Value | Token |
|----------|-------|-------|
| Layout | Inline with risk score | — |
| Dot diameter | 8px | — |
| Dot radius | 9999px | `radius/full` |
| Dot color (occupied) | `#16A34A` | `color/status/safe` |
| Dot color (empty) | `#334155` | muted |
| Label | "Occupied" / "Empty" | — |
| Label style | 12px/16px Inter Regular | `text/xs` |
| Label color | `#94A3B8` | `color/acknowledged-border` |

### Card Content — Elapsed Time-Critical

| Property | Value | Token |
|----------|-------|-------|
| Font | 12px/16px JetBrains Mono Regular | `text/xs` using `font/telemetry` |
| Color | `#94A3B8` | `color/acknowledged-border` |
| Format | "2m 34s" or "1h 12m" | — |

### Card Content — Rank Reason

| Property | Value | Token |
|----------|-------|-------|
| Font | 12px/16px Inter Regular | `text/xs` |
| Color | `#64748B` | `color/status/offline` |
| Text | e.g. "CRITICAL, risk 95.0, occupied, in state for 120s" | — |

### Risk-Breakdown Expandable Row (hover state — shown expanded on one card)

| Property | Value | Token |
|----------|-------|-------|
| Layout | Inline row below rank reason | — |
| Padding top | 8px | `space/8` |
| Background | `rgba(15,23,42,0.5)` | `color/theme/base-background` at 50% |
| Radius | 6px | `radius/md` |
| Each contribution label | 12px/16px Inter Regular | `text/xs` |
| Contribution value | 12px/16px JetBrains Mono | `text/xs` using `font/telemetry` |

Breakdown columns:

| Column | Label | Value Format |
|--------|-------|-------------|
| Fire | "Fire" | e.g. "42.75" |
| Gas | "Gas" | e.g. "17.50" |
| Water | "Water" | e.g. "0.00" |
| Occupancy | "Occ ×" | e.g. "1.15" |
| Total | "Total" | e.g. "69.24" |

### Alert Entrance Animation (newest card)

| Property | Value | Token |
|----------|-------|-------|
| Initial scale | `scale(0.96)` | `motion/alert-entrance/scale` |
| Final scale | `scale(1.0)` | — |
| Duration | 220ms | `motion/alert-entrance` |
| Curve | `cubic-bezier(0.34, 1.56, 0.64, 1)` | — |
| Glow (2 pulses) | `0 0 0 4px rgba(220,38,38,0.35)` | `color/critical-glow` |
| Glow duration | 900ms | `motion/alert-entrance/glow` |
| Final border | 2px solid `#DC2626` | `color/status/critical` |

---

## Frame 4: Priority Queue — Acknowledged Card

Same as Populated frame, except:

| Property | Value | Token |
|----------|-------|-------|
| Card border | 2px solid `#94A3B8` | `color/acknowledged-border` |
| Left border accent | removed (replaced by full border) | — |
| Border desaturation transition | 300ms ease-in | `motion/acknowledged-transition` |

### Acknowledged By Label (replaces action button)

| Property | Value | Token |
|----------|-------|-------|
| Text | "Acknowledged by [Name]" | — |
| Text style | 12px/16px Inter Regular | `text/xs` |
| Text color | `#94A3B8` | `color/acknowledged-border` |
| Position | Bottom-right of card | — |
| Margin top | 8px | `space/8` |

### State

- Card remains in the Priority Queue until the zone recovers to SAFE
- No action button is shown on acknowledged cards

---

## Card Dimensions Summary

| Element | Width | Height | Gap |
|---------|-------|--------|-----|
| Priority Queue rail | 320px | 100vh | — |
| Card | 288px | min 120px (auto) | 12px between cards |
| Status left border accent | 4px | full card height | — |
| Checkmark icon (all-nominal) | 32px | 32px | 8px below |
| Occupancy dot | 8px | 8px | — |
| Risk score value | auto | 32px (line-height) | — |
| Contribution columns | auto (4 cols) | auto | 8px between cols |
| Acknowledged label | auto | 16px (line-height) | 8px from bottom |
