# Attributions & Licenses

## UI Components

**shadcn/ui** — All files in `src/components/ui/` were generated using the shadcn/ui CLI.
License: MIT — https://github.com/shadcn-ui/ui/blob/main/LICENSE.md
Source: https://github.com/shadcn-ui/ui

**Radix UI Primitives** — Underlying component primitives used by shadcn/ui.
License: MIT — https://github.com/radix-ui/primitives/blob/main/LICENSE
Source: https://github.com/radix-ui/primitives

## Charts

**Recharts** — React charting library used for all sensor data visualizations.
License: MIT — https://github.com/recharts/recharts/blob/master/LICENSE
Source: https://github.com/recharts/recharts

## Algorithms

**LTTB Downsampling** (`src/utils/downsample.ts`) — Largest-Triangle-Three-Buckets algorithm.
Original implementation by Sveinn Steinarsson.
License: MIT — https://github.com/sveinn-steinarsson/flot-downsample/blob/master/LICENSE
Source: https://github.com/sveinn-steinarsson/flot-downsample
Paper: https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf

**Pearson Correlation Coefficient** (`src/components/CorrelationPage.tsx`)
Formula from: https://en.wikipedia.org/wiki/Pearson_correlation_coefficient

**Population Standard Deviation** (`src/components/StatisticsCard.tsx`)
Formula from: NIST/SEMATECH e-Handbook of Statistical Methods
https://www.itl.nist.gov/div898/handbook/prc/section2/prc22.htm

## Number Formatting

**Intl.NumberFormat** (`src/utils/formatters.ts`) — ECMAScript Internationalization API.
Spec: ECMA-402 — https://tc39.es/ecma402/#numberformat-objects
Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat

## Backend

**Node.js Buffer API** (`lambda/supabase-writer/index.js`) — Binary payload decoding.
Docs: https://nodejs.org/api/buffer.html

**Supabase JavaScript Client** — Database client.
License: Apache 2.0 — https://github.com/supabase/supabase-js/blob/master/LICENSE
Source: https://github.com/supabase/supabase-js

## Icons

**Lucide React** — Icon library.
License: ISC — https://github.com/lucide-icons/lucide/blob/main/LICENSE
Source: https://github.com/lucide-icons/lucide

## Fonts

**Inter** — Google Fonts, loaded via CSS.
License: SIL Open Font License 1.1
Source: https://fonts.google.com/specimen/Inter

## Assets

**Unsplash** — Stock photos used in the UI.
License: https://unsplash.com/license
Source: https://unsplash.com

## AI Tools Disclosure

**GitHub Copilot** was used in this project for:
- Auto-generating code comments and JSDoc documentation strings
- Troubleshooting specific bugs (duplicate alert race condition, network alert Supabase persistence)

All architecture, data models, component logic, IoT pipeline design, and core application
functionality were designed and written by the project author. AI was not used to generate
application logic or system design.