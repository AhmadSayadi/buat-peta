---
name: "Peta Lokasi Editorial Cartography"
description: "Modern, crisp editorial cartography design system for Peta Lokasi, pairing warm terracotta accents with alabaster studio surfaces and geometric-humanist typography."
---

## Overview

Peta Lokasi is a free Indonesian cartographic studio for generating print-ready location maps (Desa/Kelurahan, Kecamatan, Kabupaten/Kota). The interface balances **editorial minimalism** with **precision studio utility**: generous alabaster workspaces let the live map canvas command attention, while a disciplined terracotta-orange accent guides primary actions, active selections, and map focal points.

## Colors

Crisp alabaster and warm stone neutrals form an understated studio backdrop so multi-colored basemaps and highlighted administrative boundaries read with full clarity. Terracotta-orange (`primary`) marks active controls, selected regions, and the primary export action, while deep slate-blue (`tertiary`) supports secondary cartographic metadata.

```yaml
colors:
  accent: "#D95D24"
  success: "#15803D"
  warning: "#B45309"
  light:
    primary: "#B84309"
    on-primary: "#FFFFFF"
    primary-container: "#FFF0E8"
    on-primary-container: "#5A1C00"
    secondary: "#57534E"
    on-secondary: "#FFFFFF"
    secondary-container: "#ECEAE4"
    on-secondary-container: "#292524"
    tertiary: "#00628F"
    on-tertiary: "#FFFFFF"
    tertiary-container: "#E6F2FF"
    on-tertiary-container: "#00344F"
    error: "#BA1A1A"
    on-error: "#FFFFFF"
    error-container: "#FFDAD6"
    on-error-container: "#93000A"
    background: "#F7F6F2"
    on-background: "#18181B"
    surface: "#F7F6F2"
    surface-dim: "#EAE8E1"
    surface-bright: "#FFFFFF"
    surface-container-lowest: "#FFFFFF"
    surface-container-low: "#F1EFE9"
    surface-container: "#EAE7DF"
    surface-container-high: "#E2DFD5"
    surface-container-highest: "#D8D4C9"
    on-surface: "#18181B"
    surface-variant: "#E7E5DE"
    on-surface-variant: "#52525B"
    outline: "#71717A"
    outline-variant: "#E4E2DA"
    inverse-surface: "#27272A"
    inverse-on-surface: "#FAFAFA"
    inverse-primary: "#FFB599"
    shadow: "#000000"
    scrim: "#000000"
  dark:
    primary: "#FFB599"
    on-primary: "#5A1C00"
    primary-container: "#8B3000"
    on-primary-container: "#FFDBCE"
    secondary: "#D6D3D1"
    on-secondary: "#292524"
    secondary-container: "#44403C"
    on-secondary-container: "#F5F5F4"
    tertiary: "#8DCDFF"
    on-tertiary: "#00344F"
    tertiary-container: "#004B70"
    on-tertiary-container: "#CAE6FF"
    error: "#FFB4AB"
    on-error: "#690005"
    error-container: "#93000A"
    on-error-container: "#FFDAD6"
    background: "#141416"
    on-background: "#F4F4F5"
    surface: "#141416"
    surface-dim: "#0F0F11"
    surface-bright: "#27272A"
    surface-container-lowest: "#0C0C0E"
    surface-container-low: "#1C1C1F"
    surface-container: "#222226"
    surface-container-high: "#2C2C31"
    surface-container-highest: "#36363C"
    on-surface: "#F4F4F5"
    surface-variant: "#2E2E34"
    on-surface-variant: "#A1A1AA"
    outline: "#71717A"
    outline-variant: "#2E2E34"
    inverse-surface: "#F4F4F5"
    inverse-on-surface: "#18181B"
    inverse-primary: "#B84309"
    shadow: "#000000"
    scrim: "#000000"
```

## Typography

**Red Hat Display** anchors titles and section headings with clean geometric authority. **Commissioner** handles all UI controls, labels, and explanatory copy with high legibility at compact sizes. **Spline Sans Mono** renders coordinates, scale ratios, and technical map metadata with `tabular-nums`.

```yaml
typography:
  display-md:
    fontFamily: "Red Hat Display"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 44px
    letterSpacing: -0.5px
  display-md-mobile:
    fontFamily: "Red Hat Display"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: -0.25px
  headline-lg:
    fontFamily: "Red Hat Display"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
    letterSpacing: -0.25px
  headline-md:
    fontFamily: "Red Hat Display"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 24px
    letterSpacing: -0.15px
  title-md:
    fontFamily: "Red Hat Display"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0px
  title-sm:
    fontFamily: "Commissioner"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: 0px
  body-md:
    fontFamily: "Commissioner"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  body-sm:
    fontFamily: "Commissioner"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0px
  label-lg:
    fontFamily: "Commissioner"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: 0.1px
  label-md:
    fontFamily: "Commissioner"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.15px
  label-sm:
    fontFamily: "Commissioner"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 14px
    letterSpacing: 0.2px
  mono-sm:
    fontFamily: "Spline Sans Mono"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0px
```

## Layout & Spacing

A **Fixed-Max-Width Studio Grid** (`max-w-[1440px]`) divides the desktop viewport into a dedicated 380px left inspector rail and a fluid right cartographic preview stage, collapsing to a single-column stack on mobile viewports. Spacing follows a strict 4px/8px grid.

```yaml
spacing:
  gutter-xs: 4px
  gutter-sm: 8px
  gutter-md: 16px
  gutter-lg: 24px
  gutter-xl: 32px
  section: 40px
  page-margin: 24px
```

## Elevation & Depth

Hierarchy relies on **tonal layering** and **hairline outlines** (`1px` `outline-variant`) rather than heavy drop shadows. The studio mat (`surface-container-low`) recedes behind crisp white control surfaces (`surface-container-lowest`), while the central map sheet uses a single diffused ambient shadow (`0 12px 32px -8px rgba(24,24,27,0.08)`) to float above the drafting stage.

## Shapes

Controlled, architectural radii keep the interface crisp: `8px` (`DEFAULT`) for buttons and inputs, `12px` (`md`) for map style thumbnails and inner cards, `16px` (`lg`) for the main inspector and preview panels, and `9999px` (`full`) for segmented tabs, basemap pills, and location chips.

```yaml
rounded:
  sm: 6px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
```

## Motion & Micro-interaction

Motion is crisp and tactile. Control state transitions (tab switches, toggle slides, button hovers) resolve within 120ms using `ease-out`. Nothing loops or bounces.

```yaml
motion:
  state-change:
    duration: 120ms
    delay: 0ms
    timingFunction: ease-out
  surface-enter:
    duration: 220ms
    delay: 0ms
    timingFunction: cubic-bezier(0.2, 0, 0, 1)
  surface-exit:
    duration: 150ms
    delay: 0ms
    timingFunction: cubic-bezier(0.3, 0, 1, 1)
```

## Voice & Content Strategy

Copy is written in clear, natural **Bahasa Indonesia** with sentence case for headings and labels. Instructions are concise and action-oriented (`Ketik nama desa/kelurahan...`, `Unduh PNG`, `Scroll untuk zoom, drag untuk geser`). Technical cartographic terms (`Proyeksi Web Mercator`, `Datum WGS 84`, `Batas administrasi`) remain precise and consistent.

## Components

Component implementations live as individual HTML sticker sheet files in
`components/`. Each file contains the canonical, styled HTML components with
`<!-- COMPONENT: name -->` comment markers. Read each file before use.

- **Button** → `@components/button.html` — `button-primary`, `button-icon`, `button-with-icon`
- **Chip** → `@components/chip.html` — `chip-action`, `chip-input`, `chip-with-icon`
- **Input Field** → `@components/input-field.html` — `input-field-text`, `input-field-icon`
- **Tabs** → `@components/tabs.html` — `tabs-horizontal`, `tabs-with-icon`
- **Toggle** → `@components/toggle.html` — `toggle-standard`, `toggle-label`, `toggle-description`
