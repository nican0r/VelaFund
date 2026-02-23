# Navia MVP - Design System Specification

**Purpose**: Define the visual identity, component patterns, and UI guidelines for the Navia cap table management platform.

**Design Philosophy**: Modern, clean, and professional. The interface should feel trustworthy and authoritative (financial product handling equity) while remaining approachable and easy to navigate.

**Theme**: Light mode only.

---

## Table of Contents

1. [Color System](#1-color-system)
2. [Typography](#2-typography)
3. [Spacing & Layout](#3-spacing--layout)
4. [Border Radius & Shadows](#4-border-radius--shadows)
5. [Page Layouts](#5-page-layouts)
6. [Component Patterns](#6-component-patterns)
7. [Icons](#7-icons)
8. [Data Visualization](#8-data-visualization)
9. [Responsive Breakpoints](#9-responsive-breakpoints)
10. [Animation & Transitions](#10-animation--transitions)
11. [Accessibility](#11-accessibility)
12. [shadcn/ui Theme Configuration](#12-shadcnui-theme-configuration)
13. [Tailwind Configuration](#13-tailwind-configuration)

---

## 1. Color System

### 1.1 Brand Colors

| Token                | Hex       | Name             | Usage                                      |
|----------------------|-----------|------------------|---------------------------------------------|
| `--brand-navy`       | `#0A2342` | Prussian Blue    | Sidebar background, headings, dark accents  |
| `--brand-blue`       | `#1B6B93` | Cornflower Ocean | Primary actions, links, active states       |
| `--brand-gray`       | `#E0E0E0` | Alabaster Grey   | Borders, dividers, disabled backgrounds     |
| `--brand-cream`      | `#F4E8C1` | Pearl Beige      | Warning backgrounds, highlights, badges     |
| `--brand-green`      | `#9DCE94` | Celadon          | Success states, positive indicators         |

### 1.2 Extended Palette

Each brand color has a scale for different UI contexts (hover, pressed, tinted backgrounds, etc.):

**Navy (Prussian Blue) Scale**
| Token        | Hex       | Usage                              |
|--------------|-----------|------------------------------------|
| `navy-950`   | `#061729` | Deepest — sidebar hover background |
| `navy-900`   | `#0A2342` | **Base** — sidebar background      |
| `navy-800`   | `#0E3259` | Sidebar active item background     |
| `navy-700`   | `#134170` | Dark text emphasis                 |
| `navy-600`   | `#1A5080` | Secondary headings                 |
| `navy-100`   | `#D6E4F0` | Light tinted backgrounds           |
| `navy-50`    | `#EBF2F8` | Subtle tinted backgrounds          |

**Blue (Cornflower Ocean) Scale**
| Token        | Hex       | Usage                              |
|--------------|-----------|------------------------------------|
| `blue-700`   | `#145578` | Button pressed state               |
| `blue-600`   | `#1B6B93` | **Base** — primary buttons, links  |
| `blue-500`   | `#2080AD` | Button hover state                 |
| `blue-400`   | `#4A9BC4` | Link hover                         |
| `blue-100`   | `#D4EAF3` | Info badge background              |
| `blue-50`    | `#EAF5FA` | Info alert background              |

**Green (Celadon) Scale**
| Token        | Hex       | Usage                              |
|--------------|-----------|------------------------------------|
| `green-700`  | `#6BAF5E` | Success text on white              |
| `green-600`  | `#9DCE94` | **Base** — success badges, icons   |
| `green-500`  | `#B0D9A8` | Success highlight                  |
| `green-100`  | `#E8F5E4` | Success alert background           |
| `green-50`   | `#F4FAF2` | Success row background             |

**Cream (Pearl Beige) Scale**
| Token        | Hex       | Usage                              |
|--------------|-----------|------------------------------------|
| `cream-700`  | `#C4A44E` | Warning text on white              |
| `cream-600`  | `#F4E8C1` | **Base** — warning badges          |
| `cream-100`  | `#FAF4E3` | Warning alert background           |
| `cream-50`   | `#FDFAF1` | Warning row highlight              |

### 1.3 Semantic Colors

| Role         | Token               | Hex / Reference   | Usage                                         |
|--------------|---------------------|-------------------|-----------------------------------------------|
| Primary      | `--primary`         | `#1B6B93`         | CTAs, primary buttons, active nav, links       |
| Primary Hover| `--primary-hover`   | `#2080AD`         | Button hover                                   |
| Primary Press| `--primary-pressed` | `#145578`         | Button active/pressed                          |
| Success      | `--success`         | `#9DCE94`         | Confirmations, completed states, positive %    |
| Success Text | `--success-text`    | `#3D7A34`         | Success text on white backgrounds              |
| Warning      | `--warning`         | `#F4E8C1`         | Pending states, caution, expiring items        |
| Warning Text | `--warning-text`    | `#8B6914`         | Warning text on white backgrounds              |
| Destructive  | `--destructive`     | `#DC2626`         | Error states, delete actions, negative %       |
| Destructive Text | `--destructive-text` | `#991B1B`    | Error text on white backgrounds                |
| Info         | `--info`            | `#1B6B93`         | Informational badges, tooltips                 |

### 1.4 Neutral Colors

| Token        | Hex       | Usage                                        |
|--------------|-----------|----------------------------------------------|
| `white`      | `#FFFFFF` | Card backgrounds, page background areas      |
| `gray-50`    | `#F9FAFB` | Page background, alternate table rows        |
| `gray-100`   | `#F3F4F6` | Input backgrounds, hover states              |
| `gray-200`   | `#E5E7EB` | Borders, dividers (close to brand-gray)      |
| `gray-300`   | `#D1D5DB` | Disabled borders                             |
| `gray-400`   | `#9CA3AF` | Placeholder text                             |
| `gray-500`   | `#6B7280` | Secondary text, captions                     |
| `gray-600`   | `#4B5563` | Body text                                    |
| `gray-700`   | `#374151` | Strong body text                             |
| `gray-800`   | `#1F2937` | Headings (alternative to navy)               |
| `gray-900`   | `#111827` | Maximum contrast text                        |

### 1.5 Color Usage Rules

1. **Primary actions** (main CTA buttons, active nav) always use `--primary` (Cornflower Ocean blue).
2. **Green is reserved** for success/positive states only: confirmations, positive percentage changes, completed badges, verified status.
3. **Pearl Beige** is used for warnings, pending states, and soft highlights (e.g., "expiring soon" badges).
4. **Destructive red** (`#DC2626`) is only used for errors, delete confirmations, and negative indicators. It is not part of the brand palette but is needed for UI states.
5. **Navy** is structural — sidebar, headings, and dark text. Not used for interactive elements (buttons).
6. **Background hierarchy**: Page = `gray-50`, Cards = `white`, Inputs = `gray-100` (or `white` with border).

---

## 2. Typography

### 2.1 Font Family

| Role      | Font                      | Fallback Stack                                    |
|-----------|---------------------------|---------------------------------------------------|
| Primary   | **Inter**                 | `system-ui, -apple-system, sans-serif`            |
| Monospace | **JetBrains Mono**        | `ui-monospace, 'Cascadia Code', monospace`        |

Load Inter via `next/font/google` for optimal performance (automatic font file hosting, zero layout shift).

### 2.2 Type Scale

Based on a 1.250 ratio (major third) for clean mathematical progression:

| Token     | Size    | Weight | Line Height | Letter Spacing | Usage                                |
|-----------|---------|--------|-------------|----------------|--------------------------------------|
| `h1`      | 30px    | 700    | 1.2         | -0.02em        | Page titles ("Dashboard", "Cap Table") |
| `h2`      | 24px    | 600    | 1.3         | -0.015em       | Section headings, card titles        |
| `h3`      | 20px    | 600    | 1.4         | -0.01em        | Subsection headings                  |
| `h4`      | 16px    | 600    | 1.5         | 0              | Widget titles, form group labels     |
| `body-lg` | 16px    | 400    | 1.6         | 0              | Primary body text                    |
| `body`    | 14px    | 400    | 1.5         | 0              | Default body text, table cells       |
| `body-sm` | 13px    | 400    | 1.5         | 0              | Secondary info, helper text          |
| `caption` | 12px    | 500    | 1.4         | 0.01em         | Labels, badges, timestamps           |
| `overline`| 11px    | 600    | 1.3         | 0.05em         | Section labels ("MENU", "GENERAL")   |
| `stat`    | 36px    | 700    | 1.1         | -0.02em        | Dashboard stat numbers               |

### 2.3 Text Colors

| Context             | Color                        |
|---------------------|------------------------------|
| Page headings       | `navy-900` (#0A2342)         |
| Section headings    | `gray-800` (#1F2937)         |
| Body text           | `gray-600` (#4B5563)         |
| Secondary text      | `gray-500` (#6B7280)         |
| Placeholder text    | `gray-400` (#9CA3AF)         |
| Links               | `blue-600` (#1B6B93)         |
| Links (hover)       | `blue-700` (#145578)         |
| Disabled text       | `gray-300` (#D1D5DB)         |
| Sidebar text        | `white` at 90% opacity       |
| Sidebar active text | `white` at 100%              |
| Sidebar muted text  | `white` at 60% opacity       |

---

## 3. Spacing & Layout

### 3.1 Spacing Scale

Based on a 4px base unit:

| Token  | Value | Usage                                        |
|--------|-------|----------------------------------------------|
| `0.5`  | 2px   | Hairline gaps                                |
| `1`    | 4px   | Tight inline spacing                         |
| `1.5`  | 6px   | Icon-to-text gap                             |
| `2`    | 8px   | Small element padding, compact gaps          |
| `3`    | 12px  | Input padding (vertical), small card gaps    |
| `4`    | 16px  | Default content padding, card internal gap   |
| `5`    | 20px  | Section spacing within cards                 |
| `6`    | 24px  | Card padding, gap between stat cards         |
| `8`    | 32px  | Gap between major content sections           |
| `10`   | 40px  | Page-level section margins                   |
| `12`   | 48px  | Large section separators                     |
| `16`   | 64px  | Page top padding                             |

### 3.2 Content Width

| Context            | Max Width   |
|--------------------|-------------|
| Dashboard content  | `1280px`    |
| Form pages         | `640px`     |
| Wide tables        | `100%` (full content area) |
| Modal (small)      | `400px`     |
| Modal (medium)     | `560px`     |
| Modal (large)      | `720px`     |

### 3.3 Grid

- Main content area uses a **12-column CSS grid** or flexbox as needed.
- Stat cards: 4 columns on desktop, 2 on tablet, 1 on mobile.
- Content cards: 2–3 columns on desktop, 1 on mobile.
- Gap between grid items: `24px` (6).

---

## 4. Border Radius & Shadows

### 4.1 Border Radius

| Token        | Value  | Usage                                   |
|--------------|--------|-----------------------------------------|
| `radius-sm`  | `6px`  | Small elements: badges, tags, tooltips  |
| `radius-md`  | `8px`  | Inputs, dropdowns, small cards          |
| `radius-lg`  | `12px` | Cards, modals, popovers                 |
| `radius-xl`  | `16px` | Stat cards, hero cards, large containers|
| `radius-full`| `9999px` | Avatars, pill badges, circular buttons|

### 4.2 Shadows

| Token         | Value                                              | Usage                          |
|---------------|-----------------------------------------------------|--------------------------------|
| `shadow-sm`   | `0 1px 2px rgba(10, 35, 66, 0.05)`                | Inputs, small elevated elements|
| `shadow-md`   | `0 4px 6px -1px rgba(10, 35, 66, 0.07), 0 2px 4px -2px rgba(10, 35, 66, 0.05)` | Cards, dropdowns |
| `shadow-lg`   | `0 10px 15px -3px rgba(10, 35, 66, 0.08), 0 4px 6px -4px rgba(10, 35, 66, 0.04)` | Modals, popovers |
| `shadow-xl`   | `0 20px 25px -5px rgba(10, 35, 66, 0.1), 0 8px 10px -6px rgba(10, 35, 66, 0.05)` | Floating panels |

Note: Shadow color uses navy-tinted rgba instead of pure black for a warmer, more cohesive feel.

### 4.3 Borders

| Context         | Style                                  |
|-----------------|----------------------------------------|
| Card border     | `1px solid gray-200` (#E5E7EB)         |
| Input border    | `1px solid gray-300` (#D1D5DB)         |
| Input focus     | `2px solid blue-600` (#1B6B93)         |
| Divider         | `1px solid gray-200` (#E5E7EB)         |
| Table row border| `1px solid gray-100` (#F3F4F6)         |
| Sidebar border  | None (sidebar is self-contained)       |

---

## 5. Page Layouts

### 5.1 Dashboard Shell

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌────────────────────────────────────────┐ │
│ │           │ │  Top Bar: Search, Notifications, User │ │
│ │  Sidebar  │ ├────────────────────────────────────────┤ │
│ │  240px    │ │                                        │ │
│ │  fixed    │ │  Content Area                          │ │
│ │           │ │  padding: 32px                         │ │
│ │  #0A2342  │ │  background: gray-50                   │ │
│ │           │ │  overflow-y: auto                      │ │
│ │           │ │  max-width: 1280px (centered)          │ │
│ │           │ │                                        │ │
│ └──────────┘ └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

| Element           | Specification                                          |
|-------------------|--------------------------------------------------------|
| Sidebar width     | `240px` fixed, collapsible to `64px` (icon-only mode)  |
| Sidebar bg        | `navy-900` (#0A2342), full height                      |
| Top bar height    | `64px`                                                 |
| Top bar bg        | `white` with `shadow-sm` bottom border                 |
| Content bg        | `gray-50` (#F9FAFB)                                    |
| Content padding   | `32px` on desktop, `16px` on mobile                    |

### 5.2 Sidebar Structure

```
┌──────────────────────┐
│  Logo (Navia)        │  ← 64px height, centered
│                      │
│  MENU (overline)     │  ← 11px, white/60%, uppercase
│  ■ Dashboard         │  ← Active: navy-800 bg, white text, left accent bar
│  □ Cap Table         │  ← Inactive: white/70% text
│  □ Shareholders      │
│  □ Transactions      │
│  □ Investments       │
│  □ Options           │
│  □ Documents         │
│                      │
│  ──── divider ────   │  ← white/10% border
│                      │
│  GENERAL (overline)  │
│  □ Settings          │
│  □ Help              │
│                      │
│  ──── divider ────   │
│  User: avatar + name │  ← Bottom, white text, gray-500 email
│  Logout              │
└──────────────────────┘
```

**Sidebar nav item states:**
| State    | Background        | Text           | Left Bar     |
|----------|-------------------|----------------|--------------|
| Default  | Transparent       | white/70%      | None         |
| Hover    | navy-950 / white 5% overlay | white/90% | None  |
| Active   | navy-800          | white 100%     | 3px blue-600 |
| Disabled | Transparent       | white/30%      | None         |

Nav items: `40px` height, `12px` horizontal padding, `8px` border-radius, `1.5` icon-to-text gap.

### 5.3 Top Bar Structure

```
┌────────────────────────────────────────────────────────────────┐
│  🔍 Search tasks...  [⌘ K]     │  📧  🔔(badge)  │  Avatar + Name │
└────────────────────────────────────────────────────────────────┘
```

| Element               | Specification                               |
|-----------------------|---------------------------------------------|
| Search bar            | `gray-100` bg, `radius-md`, placeholder gray-400, 360px max width |
| Notification bell     | Icon button, red badge for unread count     |
| User section          | Avatar (32px, circle) + name + dropdown     |
| Company switcher      | Dropdown showing current company name, navy text |

### 5.4 Auth Layout

```
┌─────────────────────────────────────────┐
│                                         │
│          ┌─────────────────┐            │
│          │  Logo           │            │
│          │                 │            │
│          │  Login Card     │            │
│          │  max-w: 420px   │            │
│          │  white bg       │            │
│          │  shadow-lg      │            │
│          │  radius-xl      │            │
│          │                 │            │
│          └─────────────────┘            │
│                                         │
│          Background: gray-50            │
└─────────────────────────────────────────┘
```

### 5.5 Page Header Pattern

Every page within the dashboard follows this header structure:

```
┌─────────────────────────────────────────────────────────┐
│  h1: Page Title                    [+ Action] [Export]  │
│  body-sm: Page description text                         │
├─────────────────────────────────────────────────────────┤
│  Tab bar (optional)  |  Filters (optional)              │
└─────────────────────────────────────────────────────────┘
```

- Page title: `h1`, color `navy-900`
- Description: `body-sm`, color `gray-500`
- Primary action button: `blue-600` filled
- Secondary action button: white with `gray-200` border

---

## 6. Component Patterns

### 6.1 Buttons

**Variants:**

| Variant     | Background    | Text         | Border           | Usage                    |
|-------------|---------------|--------------|------------------|--------------------------|
| Primary     | `blue-600`    | `white`      | None             | Main CTAs, submit forms  |
| Secondary   | `white`       | `gray-700`   | `1px gray-200`   | Secondary actions        |
| Ghost       | Transparent   | `blue-600`   | None             | Tertiary actions, links  |
| Destructive | `#DC2626`     | `white`      | None             | Delete, cancel           |
| Outline     | Transparent   | `blue-600`   | `1px blue-600`   | Alternative secondary    |

**Sizes:**

| Size   | Height | Padding (h) | Font Size | Radius     |
|--------|--------|-------------|-----------|------------|
| `sm`   | 32px   | 12px        | 13px      | `radius-md`|
| `md`   | 40px   | 16px        | 14px      | `radius-md`|
| `lg`   | 48px   | 24px        | 16px      | `radius-md`|

**States (Primary example):**
| State    | Background  | Shadow       |
|----------|-------------|--------------|
| Default  | `blue-600`  | `shadow-sm`  |
| Hover    | `blue-500`  | `shadow-md`  |
| Pressed  | `blue-700`  | None         |
| Disabled | `blue-600/50` | None       |
| Loading  | `blue-600` + spinner | None |

### 6.2 Cards

**Standard Card:**
- Background: `white`
- Border: `1px solid gray-200`
- Border radius: `radius-lg` (12px)
- Padding: `24px`
- Shadow: `shadow-sm` (optional, for elevated cards)
- Title: `h4` weight 600, `gray-800`

**Stat Card:**
```
┌────────────────────────┐
│  Label (caption)       │  ← gray-500, 12px
│  Value (stat)          │  ← navy-900, 36px, bold
│  ▲ +12.5% vs last mo  │  ← green-700 or destructive, 12px
└────────────────────────┘
```
- Border radius: `radius-xl` (16px)
- Padding: `24px`
- The "active/highlighted" stat card uses `blue-600` background with white text (like reference image's "Total Projects" card, but in blue instead of green)
- Other stat cards: white background, gray-200 border

**Stat Card Active Variant:**
- Background: `blue-600`
- Text color: `white`
- Change indicator: `white/80%`
- Border: none
- Shadow: `shadow-md`

### 6.3 Tables

```
┌─────────────────────────────────────────────────────┐
│  Shareholder Name  │ Share Class │ Shares │  %  │ ⋯ │  ← Header: gray-50 bg, gray-500 text, caption size
├─────────────────────────────────────────────────────┤
│  João Silva        │ ON         │ 10,000 │ 25% │ ⋯ │  ← Row: white bg, body size, gray-700
│  Maria Santos      │ ON         │  8,000 │ 20% │ ⋯ │  ← Alt row: gray-50 bg (optional)
│  Fund XYZ          │ PN-A       │ 12,000 │ 30% │ ⋯ │
└─────────────────────────────────────────────────────┘
  Showing 1-10 of 42                    < 1 2 3 4 5 >   ← Pagination
```

| Element          | Specification                                      |
|------------------|----------------------------------------------------|
| Header bg        | `gray-50`                                          |
| Header text      | `gray-500`, caption (12px), weight 500, uppercase  |
| Row height       | `52px`                                             |
| Row border       | `1px solid gray-100` bottom                        |
| Row hover        | `gray-50` background                               |
| Cell text        | `body` (14px), `gray-700`                          |
| Numeric cells    | Right-aligned, `tabular-nums` font feature         |
| Action column    | Icon buttons (ghost variant), right-aligned         |
| Table container  | `radius-lg`, `1px solid gray-200` border, overflow hidden |
| Empty state      | Centered illustration + "No data" text + CTA button|

### 6.4 Forms

**Input Fields:**
| State    | Background  | Border          | Shadow                    |
|----------|-------------|-----------------|---------------------------|
| Default  | `white`     | `1px gray-300`  | None                      |
| Hover    | `white`     | `1px gray-400`  | None                      |
| Focus    | `white`     | `2px blue-600`  | `0 0 0 3px blue-600/10%`  |
| Error    | `white`     | `2px #DC2626`   | `0 0 0 3px #DC2626/10%`   |
| Disabled | `gray-100`  | `1px gray-200`  | None                      |

- Input height: `40px`
- Input padding: `12px` horizontal, `8px` vertical
- Input radius: `radius-md` (8px)
- Label: `body-sm` (13px), weight 500, `gray-700`, `4px` margin-bottom
- Helper text: `caption` (12px), `gray-500`, `4px` margin-top
- Error text: `caption` (12px), `#DC2626`, `4px` margin-top

**Select / Dropdown:**
- Same sizing as inputs
- Dropdown menu: white bg, `shadow-lg`, `radius-md`
- Option hover: `gray-100` bg
- Option selected: `blue-50` bg, `blue-600` text

### 6.5 Badges / Status Indicators

| Status       | Background    | Text          | Border     |
|--------------|---------------|---------------|------------|
| Active       | `green-100`   | `green-700`   | None       |
| Pending      | `cream-100`   | `cream-700`   | None       |
| Error/Failed | `#FEE2E2`     | `#991B1B`     | None       |
| Info         | `blue-50`     | `blue-600`    | None       |
| Draft        | `gray-100`    | `gray-600`    | None       |
| Completed    | `green-100`   | `green-700`   | None       |
| Verified     | `green-100`   | `green-700`   | None       |
| Expired      | `gray-100`    | `gray-500`    | None       |

- Size: `caption` (12px), weight 500
- Padding: `2px 8px`
- Radius: `radius-full` (pill)

### 6.6 Modals / Dialogs

- Overlay: `navy-900` at 50% opacity
- Container: white bg, `radius-lg`, `shadow-xl`
- Header: `h3`, with optional close (X) button
- Body: `body` text, `24px` padding
- Footer: right-aligned buttons, `gray-100` bg strip, `16px` padding
- Max height: 85vh with scrollable body

### 6.7 Toast Notifications

- Position: top-right, `16px` from edges
- Container: white bg, `shadow-lg`, `radius-lg`
- Width: `360px`
- Left border accent: 3px in semantic color (green for success, red for error, cream for warning, blue for info)
- Auto-dismiss: 5 seconds (success/info), persistent (error)
- Icon: colored semantic icon on the left
- Close button: ghost X button

### 6.8 Empty States

- Centered in container
- Light illustration or icon (gray-300 tint, 64px)
- Title: `h3`, `gray-700`
- Description: `body`, `gray-500`, max-width 400px
- CTA button: Primary variant

### 6.9 Loading States

- **Skeleton screens**: `gray-200` pulsing rectangles matching content layout (preferred over spinners)
- **Spinner**: Circular, `blue-600` stroke, 20px default, 16px small
- **Progress bar**: `blue-600` fill on `gray-200` track, `radius-full`, 4px height
- **Button loading**: Replace label with spinner, maintain button width

### 6.10 Avatars

| Size   | Dimension | Font Size | Usage                    |
|--------|-----------|-----------|--------------------------|
| `xs`   | 24px      | 10px      | Inline mentions          |
| `sm`   | 32px      | 12px      | Table rows, compact UI   |
| `md`   | 40px      | 14px      | Cards, list items        |
| `lg`   | 48px      | 18px      | Profile sections         |
| `xl`   | 64px      | 24px      | Profile page header      |

- Shape: Circle (`radius-full`)
- Fallback: Initials on `blue-600` background, white text
- Border: `2px solid white` (when stacked/grouped)

---

## 7. Icons

### 7.1 Icon Library

Use **Lucide React** (already included with shadcn/ui).

### 7.2 Icon Sizes

| Context       | Size   |
|---------------|--------|
| Inline text   | 16px   |
| Nav items     | 20px   |
| Buttons       | 16px   |
| Stat cards    | 24px   |
| Empty states  | 48-64px|

### 7.3 Icon Colors

- Follow the text color of their context
- Interactive icons: `gray-500`, hover `gray-700`
- Sidebar icons: `white/70%`, active `white/100%`
- Semantic icons: Use semantic color (green for check, red for X, etc.)

---

## 8. Data Visualization

### 8.1 Chart Library

Use **Recharts** (per IMPLEMENTATION_PLAN.md).

### 8.2 Chart Color Palette

For multi-series charts, use colors in this order:

| Order | Color     | Hex       | Usage                   |
|-------|-----------|-----------|-------------------------|
| 1     | Ocean     | `#1B6B93` | Primary data series     |
| 2     | Navy      | `#0A2342` | Secondary data series   |
| 3     | Celadon   | `#9DCE94` | Third data series       |
| 4     | Cream     | `#D4B96A` | Fourth (darkened cream) |
| 5     | Teal      | `#2BBBB0` | Fifth (complementary)   |
| 6     | Coral     | `#E07A5F` | Sixth (complementary)   |
| 7     | Lavender  | `#7B8CDE` | Seventh                 |
| 8     | Peach     | `#F2A65A` | Eighth                  |

### 8.3 Chart Styling

| Element            | Specification                              |
|--------------------|--------------------------------------------|
| Chart background   | Transparent (inherits card bg)             |
| Grid lines         | `gray-200`, dashed, 1px                    |
| Axis labels        | `caption` (12px), `gray-500`               |
| Axis lines         | `gray-300`, 1px                            |
| Tooltip            | white bg, `shadow-lg`, `radius-md`, 14px   |
| Legend              | Bottom or right, `caption`, `gray-600`     |
| Pie chart labels   | Outside with leader lines                  |

### 8.4 Specific Chart Types

**Ownership Pie Chart (Cap Table):**
- Donut style (inner radius 60%)
- Center: Total shares or "100%" label
- Legend: Right side with color dot + name + percentage

**Dilution Bar Chart:**
- Horizontal bars
- Pre/post comparison using color opacity
- Labels on bars for percentage values

**Waterfall Chart:**
- Stacked bar, left to right
- Positive segments: `blue-600`
- Negative segments: `#DC2626`
- Net total: `navy-900`

---

## 9. Responsive Breakpoints

| Breakpoint | Width    | Sidebar Behavior    | Grid Columns |
|------------|----------|---------------------|--------------|
| `sm`       | 640px    | Hidden (hamburger)  | 1            |
| `md`       | 768px    | Collapsed (64px icons only) | 2   |
| `lg`       | 1024px   | Expanded (240px)    | 3            |
| `xl`       | 1280px   | Expanded (240px)    | 4            |
| `2xl`      | 1536px   | Expanded (240px)    | 4            |

- Mobile-first approach using Tailwind's responsive prefixes
- Sidebar has a hamburger toggle on `sm` and `md`
- Stat cards stack from 4 cols (xl) -> 2 cols (md) -> 1 col (sm)
- Tables become horizontally scrollable on mobile

---

## 10. Animation & Transitions

### 10.1 Transition Defaults

| Property         | Duration  | Easing                    |
|------------------|-----------|---------------------------|
| Color changes    | `150ms`   | `ease-in-out`             |
| Background       | `150ms`   | `ease-in-out`             |
| Border           | `150ms`   | `ease-in-out`             |
| Shadow           | `200ms`   | `ease-in-out`             |
| Transform        | `200ms`   | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Opacity          | `200ms`   | `ease-in-out`             |

### 10.2 Component Animations

| Component        | Animation                                          |
|------------------|----------------------------------------------------|
| Modal open       | Fade in overlay (200ms) + slide up content (250ms) |
| Modal close      | Reverse of open                                    |
| Toast enter      | Slide in from right (300ms)                        |
| Toast exit       | Fade out + slide right (200ms)                     |
| Dropdown open    | Scale Y from 95% to 100% + fade (150ms)           |
| Sidebar collapse | Width transition (200ms)                           |
| Skeleton pulse   | Opacity 0.5 -> 1.0 -> 0.5, 1.5s infinite          |
| Page transitions | None (instant, handled by Next.js App Router)      |

### 10.3 Rules

- Prefer opacity and transform animations (GPU-accelerated).
- No animations on data-heavy tables or lists.
- Respect `prefers-reduced-motion` media query — disable all non-essential animations.

---

## 11. Accessibility

### 11.1 Color Contrast

All text/background combinations must meet **WCAG 2.1 AA** minimum:
- Normal text: 4.5:1 contrast ratio
- Large text (18px+ or 14px bold): 3:1 contrast ratio
- UI components and graphical objects: 3:1 contrast ratio

Verified combinations:
| Foreground      | Background | Ratio  | Pass |
|-----------------|------------|--------|------|
| navy-900 on white  | #0A2342 / #FFF | 15.2:1 | AA |
| gray-600 on white  | #4B5563 / #FFF | 7.1:1  | AA |
| gray-500 on white  | #6B7280 / #FFF | 5.0:1  | AA |
| white on blue-600  | #FFF / #1B6B93 | 4.6:1  | AA |
| white on navy-900  | #FFF / #0A2342 | 15.2:1 | AA |
| green-700 on green-50 | #3D7A34 / #F4FAF2 | 5.4:1 | AA |
| cream-700 on cream-50 | #8B6914 / #FDFAF1 | 5.1:1 | AA |

### 11.2 Focus States

- All interactive elements must have visible focus indicators.
- Focus ring: `2px solid blue-600` with `2px` offset.
- Use `focus-visible` (not `focus`) to avoid showing focus rings on click.

### 11.3 General Requirements

- All images and icons must have `alt` text or `aria-label`.
- Form inputs must have associated `<label>` elements.
- Use semantic HTML (`<nav>`, `<main>`, `<aside>`, `<header>`, `<table>`).
- Keyboard navigation must work for all interactive components.
- Minimum tap target size: `44x44px` on mobile, `32x32px` on desktop.
- Do not use color alone to convey information — always pair with text or icons.

---

## 12. shadcn/ui Theme Configuration

Apply these CSS variables in `globals.css` to map the Navia palette to shadcn/ui's theming system:

```css
@layer base {
  :root {
    /* Base */
    --background: 210 20% 98%;          /* gray-50: #F9FAFB */
    --foreground: 215 50% 15%;          /* navy-900: #0A2342 */

    /* Cards & Popovers */
    --card: 0 0% 100%;                  /* white */
    --card-foreground: 215 50% 15%;     /* navy-900 */
    --popover: 0 0% 100%;
    --popover-foreground: 215 50% 15%;

    /* Primary (Cornflower Ocean Blue) */
    --primary: 198 69% 34%;             /* #1B6B93 */
    --primary-foreground: 0 0% 100%;    /* white */

    /* Secondary */
    --secondary: 210 20% 96%;           /* gray-100 */
    --secondary-foreground: 215 50% 15%;

    /* Muted */
    --muted: 210 20% 96%;              /* gray-100 */
    --muted-foreground: 215 16% 47%;   /* gray-500 */

    /* Accent */
    --accent: 210 20% 96%;
    --accent-foreground: 215 50% 15%;

    /* Destructive */
    --destructive: 0 84% 60%;          /* #DC2626 */
    --destructive-foreground: 0 0% 100%;

    /* Borders & Inputs */
    --border: 220 13% 91%;             /* gray-200 */
    --input: 220 13% 91%;
    --ring: 198 69% 34%;               /* blue-600 focus ring */

    /* Border Radius */
    --radius: 0.5rem;                  /* 8px base */

    /* Sidebar (Dark Navy) */
    --sidebar-background: 215 65% 15%; /* #0A2342 */
    --sidebar-foreground: 0 0% 100%;   /* white */
    --sidebar-primary: 198 69% 34%;    /* #1B6B93 */
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 215 65% 20%;     /* navy-800 */
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 215 65% 20%;     /* subtle divider */
    --sidebar-ring: 198 69% 34%;

    /* Chart Colors */
    --chart-1: 198 69% 34%;            /* #1B6B93 */
    --chart-2: 215 65% 15%;            /* #0A2342 */
    --chart-3: 112 35% 70%;            /* #9DCE94 */
    --chart-4: 40 55% 62%;             /* Darkened cream */
    --chart-5: 177 40% 55%;            /* Teal complement */
  }
}
```

---

## 13. Tailwind Configuration

Extend `tailwind.config.ts` with the Navia design tokens:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  // ... (darkMode, content, etc.)
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EBF2F8",
          100: "#D6E4F0",
          600: "#1A5080",
          700: "#134170",
          800: "#0E3259",
          900: "#0A2342",
          950: "#061729",
        },
        ocean: {
          50: "#EAF5FA",
          100: "#D4EAF3",
          400: "#4A9BC4",
          500: "#2080AD",
          600: "#1B6B93",
          700: "#145578",
        },
        celadon: {
          50: "#F4FAF2",
          100: "#E8F5E4",
          500: "#B0D9A8",
          600: "#9DCE94",
          700: "#6BAF5E",
        },
        cream: {
          50: "#FDFAF1",
          100: "#FAF4E3",
          600: "#F4E8C1",
          700: "#C4A44E",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        stat: ["36px", { lineHeight: "1.1", fontWeight: "700" }],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(10, 35, 66, 0.05)",
        md: "0 4px 6px -1px rgba(10, 35, 66, 0.07), 0 2px 4px -2px rgba(10, 35, 66, 0.05)",
        lg: "0 10px 15px -3px rgba(10, 35, 66, 0.08), 0 4px 6px -4px rgba(10, 35, 66, 0.04)",
        xl: "0 20px 25px -5px rgba(10, 35, 66, 0.1), 0 8px 10px -6px rgba(10, 35, 66, 0.05)",
      },
      spacing: {
        sidebar: "240px",
        "sidebar-collapsed": "64px",
        topbar: "64px",
      },
    },
  },
};

export default config;
```

---

## Appendix: Page-Specific Guidance

### A.1 Dashboard

- 4 stat cards across the top (Total Shares, Shareholders, Share Classes, Last Transaction)
- Highlighted (active) stat card: blue-600 bg
- Ownership pie chart in a card (donut, Recharts)
- Recent transactions table (last 5, with "View All" link)
- Quick actions card (buttons for common tasks)

### A.2 Cap Table Page

- Full-width data table with share class columns
- Summary row at bottom (totals, 100%)
- Export button (PDF, Excel, CSV)
- Snapshot comparison toggle

### A.3 Shareholder Detail Page

- Profile header card with avatar, name, type badge
- KYC status badge
- Holdings table (share classes, quantities, percentages)
- Transaction history for this shareholder
- Documents tab

### A.4 Transaction Forms

- Step indicator for multi-step transactions (e.g., Transfer: Select -> Review -> Confirm)
- Summary card on the right showing live calculations
- Dilution preview (before/after ownership chart)

### A.5 Settings Page

- Vertical tab navigation on the left
- Sections: Company Info, Members, Share Classes, Notifications, Security
- Each section in its own card
