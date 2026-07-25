# Zone Map — Dev Mode Export

## Shared Chrome Frame

Used as the base for every Zone Map state frame below.

### Left Sidebar

| Property | Value | Token |
|----------|-------|-------|
| Collapsed width | 72px | — |
| Expanded width | 220px | — |
| Background | `#1E293B` | `color/theme/card-surface` |
| Full height | 100vh | — |
| Nav item padding | 12px 16px | `space/12` `space/16` |
| Nav item radius | 6px | `radius/md` |
| Nav item gap | 8px | `space/8` |
| Role badge bottom pin | 16px from bottom | `space/16` |

### Top Bar

| Property | Value | Token |
|----------|-------|-------|
| Height | 56px | — |
| Background | `#0F172A` | `color/theme/base-background` |
| Horizontal padding | 24px | `space/24` |
| Bottom border | 1px solid `#1E293B` | `color/theme/card-surface` |

### Top Bar — Center System-State Pill

| Property | Value | Token |
|----------|-------|-------|
| Background | `#1E293B` | `color/theme/card-surface` |
| Padding | 8px 16px | `space/8` `space/16` |
| Radius | 8px | `radius/lg` |
| Text | 16px/24px, Inter Medium | `body/label` |

### Top Bar — Right Connection Indicator

| Property | Value | Token |
|----------|-------|-------|
| Indicator dot radius | 6px | `radius/full` |
| Dot color (Live) | `#16A34A` | `color/status/safe` |
| Dot color (Reconnecting) | `#D97706` | `color/status/warning` |
| Dot color (Offline) | `#64748B` | `color/status/offline` |

### Main Viewport

| Property | Value | Token |
|----------|-------|-------|
| Left margin | 72px (or 220px when expanded) | — |
| Right margin | 0 (Priority Queue is separate rail) | — |
| Top offset | 56px (below top bar) | — |
| Padding | 32px | `space/32` |

---

## Frame 1: Zone Map — Idle/Loading

| Property | Value | Token |
|----------|-------|-------|
| Background | `#0F172A` | `color/theme/base-background` |

### Tile Grid (3-5 shimmer tiles)

| Property | Value | Token |
|----------|-------|-------|
| Grid columns | 3 (responsive, wraps to 2 on narrower viewports) | — |
| Inter-tile gap | 12px | `space/12` |
| Tile width | 280px | — |
| Tile height | 180px | — |
| Tile background | `#1E293B` | `color/theme/card-surface` |
| Tile radius | 8px | `radius/lg` |
| Shimmer region (status bar top) | height: 4px, full tile width, `#334155` | `color/skeleton` |
| Shimmer placeholder (zone name) | 100px × 16px, `#334155` | `color/skeleton` |
| Shimmer placeholder (4 sub-indicator dots) | 4 × 24px circles, 8px apart | `color/skeleton`, `space/8` |

### Reflow constraint

Shimmer tiles occupy exactly the same grid position and dimensions as the Success state tiles — no layout reflow on transition.

---

## Frame 2: Zone Map — Success

| Property | Value | Token |
|----------|-------|-------|
| Background | `#0F172A` | `color/theme/base-background` |

### Tile per Zone

| Property | Value | Token |
|----------|-------|-------|
| Tile width | 280px | — |
| Tile height | 180px | — |
| Tile radius | 8px | `radius/lg` |
| Tile internal padding | 16px | `space/16` |
| Tile background | `#1E293B` | `color/theme/card-surface` |
| Status color top stripe | height: 4px, full width | — |

### Status Color Stripes

| State | Stripe Color | Token |
|-------|-------------|-------|
| SAFE | `#16A34A` | `color/status/safe` |
| WARNING | `#D97706` | `color/status/warning` |
| CRITICAL | `#DC2626` | `color/status/critical` |

### Zone Name

| Property | Value | Token |
|----------|-------|-------|
| Text style | 16px/24px Inter Medium | `body/label` |
| Color | `#FFFFFF` | — |
| Margin top | 8px | `space/8` |

### Hazard Sub-Indicators (4 per tile)

| Property | Value | Token |
|----------|-------|-------|
| Layout | Row of 4 dots, 8px apart | `space/8` |
| Dot diameter | 10px | — |
| Dot radius | 9999px | `radius/full` |

| Hazard | Active Color | Inactive Color | Token |
|--------|-------------|----------------|-------|
| Fire (FLAME) | `#DC2626` | `#334155` | `color/status/critical` / muted |
| Gas | `#D97706` | `#334155` | `color/status/warning` / muted |
| Water | `#3B82F6` | `#334155` | — / muted |
| Occupancy | `#16A34A` | `#334155` | `color/status/safe` / muted |

### Risk Score (bottom-right of tile)

| Property | Value | Token |
|----------|-------|-------|
| Font | 14px/20px JetBrains Mono Medium | `telemetry/value` |
| Color | `#FFFFFF` | — |

### Hover state (interaction)

| Property | Value | Token |
|----------|-------|-------|
| Scale | `scale(1.015)` | `motion/hover` |
| Shadow elevation | +2px (to 8px) | — |
| Duration | 150ms ease-out | `motion/hover` |
| Cursor | pointer | — |

### Active/Press state

| Property | Value | Token |
|----------|-------|-------|
| Scale | `scale(0.97)` | `motion/active-press` |
| Duration | 100ms ease-out | `motion/active-press` |

---

## Frame 3: Zone Map — Degraded/Reconnecting

Same as Success frame (Frame 2), with these additions applied to **every tile simultaneously**:

| Property | Value | Token |
|----------|-------|-------|
| Overlay | Diagonal-hatched pattern (thin lines, 45°) | `color/stale-overlay` |
| Tag text | "stale — reconnecting" | — |
| Tag background | `rgba(100,116,139,0.85)` | `color/status/offline` at 85% |
| Tag text style | 12px/16px Inter Regular | `text/xs` |
| Tag radius | 6px | `radius/md` |
| Tag padding | 4px 8px | `space/4` `space/8` |
| Tag position | Centered over tile | — |
| Underlying tile colors | Last-known (frozen) values | — |

---

## Frame 4: Zone Map — Zone Offline (single tile)

Same as Success frame (Frame 2), except:

| Property | Value | Token |
|----------|-------|-------|
| Affected tile background | `#1E293B` | `color/theme/card-surface` |
| Offline tile top stripe | `#64748B` | `color/status/offline` |
| Offline label text | "OFFLINE" | — |
| Offline label font | 14px/20px Inter Medium | `body/label` |
| Offline label color | `#64748B` | `color/status/offline` |
| Offline icon | Disconnected-plug icon | — |
| Offline icon size | 24×24px | — |
| Offline icon color | `#64748B` | `color/status/offline` |
| Sibling tiles | Unaffected — show their live data normally | — |

---

## Frame 5: Zone Map — Error

Same as Success frame (Frame 2), except:

### Inline Alert Banner

| Property | Value | Token |
|----------|-------|-------|
| Position | Above the tile grid | — |
| Width | Full viewport content width | — |
| Background | `#1E293B` | `color/theme/card-surface` |
| Left border | 4px solid `#DC2626` | `color/status/critical` |
| Padding | 12px 16px | `space/12` `space/16` |
| Radius | 8px | `radius/lg` |
| Margin bottom | 16px | `space/16` |
| Icon | Triangle exclamation | — |
| Icon color | `#DC2626` | `color/status/critical` |
| Text | "Couldn't load zone data — Retry" | — |
| Text style | 14px/20px Inter Regular | `text/sm` |
| Text color | `#FFFFFF` | — |
| Retry link/button style | 14px/20px Inter Medium, underline | `text/sm` |
| Retry color | `#3B82F6` | `color/focus-ring` |
| Grid below banner | Last-successfully-loaded tile data (frozen) | — |

---

## Frame Dimensions Summary

| Element | Width | Height | Gap |
|---------|-------|--------|-----|
| Left sidebar (collapsed) | 72px | 100vh | — |
| Left sidebar (expanded) | 220px | 100vh | — |
| Top bar | calc(100vw - sidebar-width) | 56px | — |
| Zone tile | 280px | 180px | 12px inter-tile |
| Status stripe on tile | 280px | 4px | — |
| Hazard indicator dot | 10px | 10px | 8px between dots |
