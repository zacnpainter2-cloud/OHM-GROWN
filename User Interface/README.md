
# Hydroponics Dashboard

A real-time monitoring and control dashboard for a hydroponic greenhouse system. Built with React and TypeScript, it ingests sensor data from LoRaWAN devices via AWS IoT Core and displays live readings, alerts, dosing history, and historical trends.

The original UI layout is based on a Figma design: https://www.figma.com/design/8Gr9uJPIccG1KKQlW329bw/Website-Front-Page-Design

## Architecture

- **Frontend:** React 18 + TypeScript, built with Vite
- **Styling:** Tailwind CSS 4 with custom sea-inspired theme (Inter font via Google Fonts)
- **UI Components:** shadcn/ui (auto-generated via CLI), Radix UI primitives
- **Charts:** Recharts (LineChart, ScatterChart, ResponsiveContainer)
- **Database:** Supabase (PostgreSQL) — measurements, alerts, dosing history, control settings
- **IoT Pipeline:** AWS IoT Core → AWS Lambda → Supabase
- **Sensor Protocol:** 10-byte LoRaWAN binary payload (custom parsing)
- **State:** React Context API with custom providers

---

## Code Sources & References

### React Framework & Patterns

- **React 18** — Core framework. Context API pattern (`createContext`, `useContext`, `useState`, `useEffect`, `useCallback`, `useRef`, `useMemo`) used throughout all providers and pages.
  - Repo: https://github.com/facebook/react
  - Context API docs: https://react.dev/learn/passing-data-deeply-with-context
  - Hooks docs: https://react.dev/reference/react/hooks

- **TypeScript** — Static typing for all components, hooks, and services.
  - Docs: https://www.typescriptlang.org/docs/

### UI Component Library

All 46 files in `src/components/ui/` were generated using the **shadcn/ui CLI** (`npx shadcn@latest add`), which copies component source code from the shadcn/ui GitHub repo into the project. Each file is an exact copy of the corresponding component from the repo.

- **shadcn/ui** — https://github.com/shadcn-ui/ui | CLI docs: https://ui.shadcn.com/docs/cli
- **Radix UI Primitives** — Unstyled accessible components underlying all shadcn/ui components
  - Repo: https://github.com/radix-ui/primitives
  - Docs: https://www.radix-ui.com/primitives/docs/overview/introduction
  - Components used: Accordion, AlertDialog, AspectRatio, Avatar, Checkbox, Collapsible, ContextMenu, Dialog, DropdownMenu, HoverCard, Label, Menubar, NavigationMenu, Popover, Progress, RadioGroup, ScrollArea, Select, Separator, Slider, Switch, Tabs, Toast, Toggle, Tooltip
- **class-variance-authority (cva)** — CSS class variant utility used inside shadcn/ui components
  - Repo: https://github.com/joe-bell/cva
- **tailwind-merge** — Merges conflicting Tailwind CSS classes
  - Repo: https://github.com/dcastil/tailwind-merge
- **clsx** — Conditional className utility
  - Repo: https://github.com/lukeed/clsx

### Charts & Data Visualization

- **Recharts** — Composable React chart library. Used in all sensor pages (LineChart, ScatterChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, ZAxis).
  - Repo: https://github.com/recharts/recharts
  - Examples reference: https://recharts.org/en-US/examples/SimpleLineChart
- **ScatterChart for correlation** — Recharts ScatterChart pattern from official examples: https://recharts.org/en-US/examples/SimpleScatterChart
- **dom-to-image-more** — Exports DOM nodes to PNG/JPEG (used in ExportPage and CorrelationPage for chart image download)
  - Repo: https://github.com/1904labs/dom-to-image-more

### Database & Backend

- **Supabase JavaScript Client** — PostgreSQL database, used for upsert, select, insert, update, and real-time queries. Pattern: `createClient`, `.from().select()`, `.upsert()`, `.order()`, `.limit()`, `.range()`.
  - Repo: https://github.com/supabase/supabase-js
  - Upsert docs: https://supabase.com/docs/reference/javascript/upsert
  - Select docs: https://supabase.com/docs/reference/javascript/select
  - Insert docs: https://supabase.com/docs/reference/javascript/insert
  - Update docs: https://supabase.com/docs/reference/javascript/update
- **AWS API Gateway** — REST endpoint for fetching latest sensor reading via `fetch()`
  - Docs: https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html
- **AWS IoT Core (LoRaWAN)** — Ingests sensor payloads from LoRaWAN devices
  - Developer guide: https://docs.aws.amazon.com/iot/latest/developerguide/connect-iot-lorawan.html
- **AWS Lambda (Node.js)** — Serverless handler triggered by IoT rule, writes to Supabase
  - Handler docs: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
  - `exports.handler` pattern: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html#nodejs-handler-async

### Styling & Theming

- **Tailwind CSS 4** — Utility-first CSS framework. All component classes and the global theme use Tailwind.
  - Repo: https://github.com/tailwindlabs/tailwindcss
  - Docs: https://tailwindcss.com/docs
- **Inter Font** — Loaded via Google Fonts in `globals.css`
  - https://fonts.google.com/specimen/Inter
- **next-themes** — Dark/light mode toggle. Pattern: class-based dark mode on `document.documentElement`.
  - Repo: https://github.com/pacocoursey/next-themes
- **tw-animate-css** — Tailwind CSS animation utilities
  - Repo: https://github.com/magicuidesign/tw-animate-css

### Date & Time Utilities

- **date-fns** — Used in ExportPage and CorrelationPage for `format()` date formatting.
  - Repo: https://github.com/date-fns/date-fns
  - Format docs: https://date-fns.org/v3/docs/format

### Form & Input Handling

- **react-hook-form** — Form state management (used in ThresholdPage for settings inputs)
  - Repo: https://github.com/react-hook-form/react-hook-form
  - Docs: https://react-hook-form.com/get-started
- **react-day-picker** — Calendar date picker (used in ExportPage custom date range selector)
  - Repo: https://github.com/gpbl/react-day-picker

### Build Tooling

- **Vite 6** — Frontend build tool and dev server
  - Repo: https://github.com/vitejs/vite
  - Docs: https://vite.dev/guide
- **Vite React TypeScript template** — Project scaffold basis
  - Template: https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts
- **@vitejs/plugin-react** — React fast refresh and JSX transform for Vite
  - Repo: https://github.com/vitejs/vite-plugin-react
- **@tailwindcss/vite** — Tailwind CSS Vite plugin
  - Docs: https://tailwindcss.com/docs/installation/using-vite

### Icons & UI Utilities

- **Lucide React** — Icon library. Icons used: `TrendingUp`, `TrendingDown`, `Minus`, `Download`, `Loader2`, `Zap`, `CalendarIcon`, `Activity`, `GitCompare`, `AlertTriangle`, `Image` and others.
  - Repo: https://github.com/lucide-icons/lucide
  - Icon list: https://lucide.dev/icons/
- **Sonner** — Toast notification library (used in ExportPage via `toast()`)
  - Repo: https://github.com/emilkowalski/sonner
  - Docs: https://sonner.emilkowal.dev
- **cmdk** — Command menu component (used via shadcn/ui `command.tsx`)
  - Repo: https://github.com/pacocoursey/cmdk
- **embla-carousel-react** — Carousel component (used via shadcn/ui `carousel.tsx`)
  - Repo: https://github.com/davidjerleke/embla-carousel
- **input-otp** — OTP input component (used via shadcn/ui `input-otp.tsx`)
  - Repo: https://github.com/guilhermerodz/input-otp
- **vaul** — Drawer component (used via shadcn/ui `drawer.tsx`)
  - Repo: https://github.com/emilkowalski/vaul
- **react-resizable-panels** — Resizable layout panels (used via shadcn/ui `resizable.tsx`)
  - Repo: https://github.com/bvaughn/react-resizable-panels

### Data Processing Algorithms

- **LTTB (Largest-Triangle-Three-Buckets)** — Downsampling algorithm implemented in `src/utils/downsample.ts`. Selects the most visually representative data points from a time series while preserving shape.
  - Original repo: https://github.com/sveinn-steinarsson/flot-downsample
  - Academic paper (Sveinn Steinarsson, 2013): https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf

- **Pearson Correlation Coefficient** — Implemented in `src/components/CorrelationPage.tsx` to measure linear relationships between sensor parameters. Formula: r = Σ((xᵢ - x̄)(yᵢ - ȳ)) / sqrt(Σ(xᵢ - x̄)² · Σ(yᵢ - ȳ)²)
  - Wikipedia: https://en.wikipedia.org/wiki/Pearson_correlation_coefficient
  - Freedman, Pisani, Purves — *Statistics* (4th ed.), W. W. Norton, 2007

- **Population Standard Deviation** — Implemented in `src/components/StatisticsCard.tsx`. Formula: σ = sqrt(Σ(xᵢ - μ)² / N)
  - NIST/SEMATECH e-Handbook of Statistical Methods: https://www.itl.nist.gov/div898/handbook/prc/section2/prc22.htm

- **Number Formatting via Intl.NumberFormat** — Used in `src/utils/formatters.ts` for locale-aware decimal formatting.
  - MDN Web Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
  - ECMA-402 Specification: https://tc39.es/ecma402/#numberformat-objects

### Assets

- **Unsplash** — Stock images used in the UI
  - Site: https://unsplash.com
  - License: https://unsplash.com/license

---

## Custom Code

The following modules were written specifically for this project:

- **Context Providers** — `AlertContext`, `SensorDataContext`, `ThresholdContext`, `DosingContext`, `AuthContext`, `ThemeContext`, `UnitContext` — custom React Context patterns following https://react.dev/learn/passing-data-deeply-with-context
- **Page Components** — `Dashboard`, `HomePage`, `ECPage`, `PHPage`, `TemperaturePage`, `O2Page`, `WaterLevelPage`, `WaterFlowPage`, `TranspirationRatePage`, `ThresholdPage`, `AlertHistoryPage`, `DosingHistoryPage`, `CorrelationPage`, `ExportPage`, `UserManualPage`, `LoginPage`
- **Lambda Functions** — `lambda/supabase-writer/index.js` — IoT event handler that writes sensor data to Supabase, manages alert lifecycle, and detects dosing transitions
- **Hooks** — `useSensorData.ts` — polls AWS API Gateway every 10 seconds, paginates 180 days of history from Supabase
- **Utilities** — `formatters.ts` (decimal formatting per sensor type); `downsample.ts` (LTTB algorithm, cited above)
- **AWS Integration** — `aws-config.ts`, `aws-data-service.ts` — REST calls to API Gateway via native `fetch()`
- **LoRaWAN Payload Parser** — 10-byte binary protocol decoded using Node.js `Buffer` methods (`readUInt16BE`, `readInt16BE`, bitmask operations)
  - Node.js Buffer API: https://nodejs.org/api/buffer.html
  - buf.readUInt16BE: https://nodejs.org/api/buffer.html#bufreaduint16beoffset
  - buf.readInt16BE: https://nodejs.org/api/buffer.html#bufreadint16beoffset

---

## AI Usage Disclosure

**GitHub Copilot** was used for:
- Auto-generating code comments and JSDoc documentation
- Troubleshooting specific bugs (duplicate alert race conditions, network alert Supabase persistence)

All architecture decisions, data models, component structure, IoT pipeline design, and application logic were designed and written manually. AI was not used to generate core functionality.
