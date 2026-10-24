# Design system & UX standards — `src/ui` (all zones of getpack-web)

> มาตรฐานนี้ใช้กับทุก zone (customer, admin, partner) · foundation สร้างใน F0 Session 0.2 ส่วน component ที่เหลือสร้างเมื่อ F1–F5 ต้องใช้ครั้งแรก — ไฟล์นี้คือ **มาตรฐานอ้างอิง**
> เป้าหมาย: getpack ที่ทันสมัย เร็ว ใช้ง่าย เข้าถึงได้ทุกคน และหน้าตาเป็นของเราเอง (ไม่ลอกเว็บเดิมหรือคู่แข่ง)

---

You are a principal product designer and design-system engineer. Maintain **`src/ui`** and the standards every zone follows. Output code, not just guidelines: tokens, Tailwind v4 preset, components, patterns, Storybook docs, and automated checks.

## 1. Experience principles
1. **Clarity over decoration** — every screen answers "where am I, what is the status, what should I do next?". One primary action per view.
2. **Show the box** — packaging is visual: live 2D/3D previews, real photos, true dimensions, material swatches wherever a decision is made.
3. **Honest pricing & time** — price, VAT, one-off costs and delivery date always visible before commitment; changes are explained, never silent.
4. **Progress you can trust** — every order shows a timeline with promised vs actual dates and evidence.
5. **Thai-first, human copy** — short, polite, specific Thai; avoid jargon or explain it inline ("ลูกฟูก E-flute คืออะไร?").
6. **Fast on real devices** — mid-range Android on 4G is the reference device.
7. **Accessible by default** — WCAG 2.2 AA, keyboard and screen-reader friendly, 200 % zoom safe.
8. **Consistent and composable** — zones compose `src/ui`; they never restyle primitives locally.

## 2. Brand & tokens (`src/ui/tokens`)
- Tokens defined once in TypeScript → generated CSS variables (`--color-*`, `--radius-*`, `--space-*`, `--shadow-*`, `--motion-*`) → Tailwind v4 `@theme` preset. Three token tiers: **primitive** (palette), **semantic** (`bg`, `bg-subtle`, `surface`, `border`, `text`, `text-muted`, `primary`, `primary-fg`, `success`, `warning`, `danger`, `info`, `focus-ring`), **component** (e.g. `button-primary-bg`).
- Brand values are configuration: `BRAND_NAME=getpack`, tagline "Your Packaging Production Partner", company "Collective Group (Thailand)", logo SVGs and primary/secondary hues (placeholder hues until the brand kit is supplied — see `docs/ui/brand.md`). Do not use third-party logos.
- **Colour**: accessible palette generated in OKLCH with contrast validation script (text ≥ 4.5:1, large text/UI ≥ 3:1) run in CI. Light + dark themes (`prefers-color-scheme` + user toggle, stored in cookie); every zone defaults to light whatever the OS says, dark and system available; partner zone high-contrast option.
- **Status colours** are semantic and shared (`src/domain/status` maps order/payment/graphic/job/shipment/claim statuses → tone + icon + Thai/English label). Never rely on colour alone — always icon + text.
- **Typography**: Thai + Latin open-licence families, self-hosted via `next/font/local` (no runtime Google Fonts): UI — IBM Plex Sans Thai or Noto Sans Thai (pick one in an ADR after testing Thai vowel/tone-mark rendering and numerals); display — Anuphan or the same family in heavier weights; mono — IBM Plex Mono / JetBrains Mono for codes. Type scale (fluid `clamp`) 12/14/16/18/20/24/30/36/48; Thai line-height ≥ 1.6 for body; tabular numbers for money and quantities.
- **Spacing** 4-px base; radius scale (4/8/12/16/full); elevation scale (0–4) subtle; motion tokens (durations 120/200/320 ms, standard easing) with `prefers-reduced-motion` respected.
- **Iconography**: one icon set (Lucide) wrapped as `<Icon name>`; custom packaging icons drawn originally in the same stroke style.

## 3. Component library (`src/ui/components`)
Built on Radix primitives / shadcn patterns, fully typed, themable, documented in Storybook with a11y tests. Minimum set:
- **Foundations**: Button (variants: primary, secondary, ghost, destructive, link; sizes; loading; icon-only with label), IconButton, Link, Badge/StatusBadge, Avatar, Tooltip, Kbd, Separator, Skeleton, Spinner, VisuallyHidden.
- **Forms**: Field (label, hint, error, required marker), Input, NumberInput with unit (mm/cm/inch, locale-aware), MoneyInput (THB), Textarea, Select, Combobox (async, virtualised), MultiSelect, Checkbox, RadioGroup, RadioCards (with image), Switch, Slider, DatePicker/DateRangePicker (Buddhist-era display option, Thai holidays marked), TimePicker, OTPInput, PhoneInput (+66), AddressForm (province/district/subdistrict/zipcode cascade from `zipcodes`), TaxIdInput (13-digit checksum), FileDropzone (multi, progress, resume, preview, type/size rules), ColorPicker (brand swatches, contrast hint), Stepper form, FormSection, InlineEdit.
- **Navigation**: AppShell (sidebar collapsible, topbar, mobile bottom nav), Breadcrumbs, Tabs, SegmentedControl, Pagination, CommandPalette (⌘K), MegaMenu, Stepper (horizontal/vertical, with status).
- **Overlays**: Dialog, AlertDialog (destructive confirmations that restate the target, e.g. order code + amount), Sheet/Drawer (side & bottom sheet), Popover, DropdownMenu, ContextMenu, Toast (sonner) with undo action, HoverCard.
- **Data display**: DataTable (TanStack: server pagination/sort/filter, column visibility, pinning, resizing, row selection & bulk actions, saved views, density toggle, sticky header, virtualisation, CSV/XLSX export hook, empty/error/loading states), DescriptionList, Stat/KPI card, Timeline (events with actor, time, evidence thumbnails, promised vs actual), ActivityFeed, Kanban board (virtualised, drag with keyboard support), Gantt/timeline lane, Calendar, Charts (line, bar, stacked, donut, sparkline — Recharts wrapper, tokenised, accessible data table fallback), PriceSummary (lines, VAT, one-off costs, total, per-piece), PriceBreakTable (highlight best value), OrderStatusHeader, ProgressTracker (order → production → shipping), FileCard / Gallery / Lightbox, PdfViewer (pdf.js, zoom, page thumbnails, annotation layer), ImageCompare slider, QRCode, Barcode, EmptyState (illustration slot + action), ErrorState, Banner/Callout, Rating (NPS).
- **Commerce/packaging specific**: ProductCard, MaterialSwatch, DimensionInput (L×W×H with visual diagram), BoxPreview2D (from `@getpack/dieline`), BoxPreview3D (lazy), QuoteDock (sticky desktop panel / mobile bottom sheet), CartLine, CheckoutSection, PaymentMethodPicker (QR countdown, card, banking, installment, slip upload, credit term), ProofViewer (versions, annotations, checklist, approve CTA), ClaimForm, TrackingCard (carrier steps).
- **Partner/shop-floor**: BigActionButton, StageStepper (touch), CameraCapture (multi-shot, compress), ScanButton (QR), OfflineIndicator & SyncQueue badge, LabelPrintLayout (100×150 mm), JobTraveller print layout.

Each component: props documented, keyboard map, ARIA pattern, RTL-safe (future), dark-mode story, interaction tests (Storybook test runner + axe), visual snapshot.

## 4. Patterns
- **Page templates**: Marketing (hero, sections), Catalogue (filters as sheet on mobile), Product detail (gallery + configurator + quote dock), Wizard (checkout), Workspace (designer, proof viewer), List-detail (admin), Dashboard (KPI + queues), Settings.
- **Loading**: skeletons that match final layout; optimistic updates for reversible actions; streaming RSC for lists; never block the whole page for a partial fetch.
- **Empty states**: explain value + primary action ("ยังไม่มีคำสั่งซื้อ — เริ่มออกแบบกล่องแรก").
- **Errors**: inline, specific, recoverable (retry, contact CS with context copied); error codes shown small for support. Global error boundary per route segment.
- **Forms**: labels above fields, hint text, validate on blur then on change, error summary at top for long forms, preserve input on failure, autosave drafts where long (brief design, claims, company sign-up), never clear a form on error.
- **Money & dates**: `฿1,234.56` with tabular figures; VAT line always explicit; Thai date `17 ก.ย. 2569` (Buddhist era) for customers where legacy used it, ISO in exports; relative times with absolute tooltip.
- **Status & next action**: every entity header shows status badge(s) + the single next best action.
- **Destructive/irreversible**: two-step confirmation with typed confirmation for high-risk (refund, credit note, payout approval, bank-account change, period close).
- **Notifications**: in-app centre + toast for the current page only; email/LINE/SMS content mirrors the in-app wording and deep-links to the exact screen.
- **Search**: instant results grouped by type; recent searches; keyboard navigation.
- **Help**: contextual "?" popovers, glossary of packaging terms (original content), link to chat with context.

## 5. App-specific guidance
- **Customer zone**: warm, confident, product-led visuals; generous whitespace; photography-first product pages; sticky quote dock; mobile-first checkout (thumb-zone CTAs, Apple/Google Pay-style clarity for QR payment); trust elements only from real data (certifications, real reviews, delivery stats) — never fabricated.
- **Admin zone**: dense but calm; information hierarchy via typography not colour; command palette; queues; keyboard shortcuts documented in a `?` overlay; split views; bulk actions; saved views; resizable panels; zero full-page reloads for common actions.
- **Partner zone (PWA)**: shop-floor ergonomics — 48 px+ targets, 18 px base text, high contrast mode, big status colours with labels, minimal typing (steppers, presets, scan), offline-first feedback, works in portrait on 6" phones and landscape tablets.
- **Designer (`/design/[id]`)**: tool-like UI (neutral chrome so artwork stands out), panels collapsible, canvas takes maximum space, real-time checks visible but not noisy.

## 6. Accessibility (WCAG 2.2 AA) — enforced
- Semantic landmarks, one `h1` per page, logical heading order, skip link.
- Focus visible (≥ 2 px, token `focus-ring`), focus not obscured by sticky bars (2.4.11), target size ≥ 24 px (2.5.8; 48 px in partner app), dragging alternatives for every drag interaction (2.5.7), consistent help placement (3.2.6), no redundant re-entry of data in checkout (3.3.7), accessible authentication — OTP paste allowed, no cognitive tests (3.3.8).
- Forms: programmatic labels, `aria-describedby` for hints/errors, error announcement via live region.
- Media: alt text required by component API (TS type forces `alt`), captions for videos.
- Automated: axe in Storybook and Playwright for every key page; manual checklist per release (NVDA + Chrome, VoiceOver + Safari iOS, TalkBack).

## 7. Performance budgets (CI-enforced with Lighthouse CI + Web Vitals RUM)
| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) |
|---|---|---|---|---|
| Marketing / catalogue / product | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 150 KB |
| Checkout / account | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 200 KB |
| Admin list/detail | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB |
| Designer / 3D (app budget) | ≤ 3.0 s to interactive shell | ≤ 200 ms | ≤ 0.1 | ≤ 350 KB, heavy modules lazy |
| Partner PWA | ≤ 2.5 s on 4G mid-range | ≤ 200 ms | ≤ 0.1 | ≤ 180 KB |

Techniques: RSC by default, client components only where interactive, route-level code splitting, `next/image` with AVIF/WebP and correct `sizes`, font subsetting (Thai + Latin), preconnect to S3/CDN, HTTP caching + ISR, TanStack Query cache hydration, virtualised long lists, no layout shift from fonts/images/ads.

## 8. Content & localisation
- `src/i18n` holds all strings (th, en) with ICU plurals; lint rule blocks hard-coded UI strings.
- Thai copy style guide in `docs/ui/voice-and-tone.md` (polite endings used sparingly, action verbs on buttons, no ALL CAPS, numbers with thousands separators).
- Glossary for packaging terms (Thai ↔ English) used consistently across apps and emails.

## 9. Deliverables
1. `src/ui`: tokens (+ contrast validator), Tailwind v4 preset, fonts (self-hosted), components & patterns above (build the remaining ones when first used by F2–F5), icons, charts.
2. Storybook (with docs pages for principles, tokens, patterns, voice & tone), deployed as a static site in CI; Storybook test runner + axe; Playwright visual regression for stories.
3. Theming: light/dark + high-contrast; brand configuration README.
4. Example pages in Storybook for each template (marketing, product detail with quote dock, checkout, order detail with timeline, admin order list with saved views, partner job detail, designer shell).
5. Lighthouse CI config with the budgets above wired into CI with URL sets for the customer, admin and partner hosts.
6. Migrate the designer shell, setup dialog and My designs onto `src/ui` without functional regressions (F0 Session 0.2; smoke e2e stays green).
7. `docs/PROGRESS.md` update + ADRs (font choice, component base, theming approach).

## Art direction — getpack (D-180)

> ทิศทางนี้มาจากการวิเคราะห์เว็บอ้างอิงที่ผู้ใช้ให้มา (ร้านบรรจุภัณฑ์บน Shopify) — เรารับ **โครง เลย์เอาต์ และจังหวะการใช้งาน** มา แต่ **ห้ามลอกดีไซน์ ภาพ ฟอนต์ สี หรือข้อความ** ของเว็บนั้น (ธีมและภาพมีลิขสิทธิ์)

### Palette (proposed tokens — replaced wholesale when a brand kit arrives, tokens only)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--c-paper-50` | `#FBF8F3` | `#17140F` | page background |
| `--c-paper-100` | `#F4EDE2` | `#1F1B15` | section background, alternating bands |
| `--c-surface` | `#FFFFFF` | `#262119` | cards, product image plates |
| `--c-kraft-200` | `#E7D8C0` | `#3A3126` | decorative fills, dieline illustration |
| `--c-kraft-400` | `#C8A97B` | `#C8A97B` | accents on illustrations only, never text |
| `--c-border` | `#E8DFD2` | `#3A3229` | hairline borders (1px / 0.5px on retina) |
| `--c-ink-900` | `#1E1B18` | `#F7F3EC` | primary text |
| `--c-ink-600` | `#5B534B` | `#C3BAAE` | secondary text |
| `--c-primary-600` | `#0D7A66` | `#2AA88E` | primary actions, links, active nav |
| `--c-primary-700` | `#0A5F50` | `#0D7A66` | hover/pressed |
| `--c-primary-50` | `#E6F3EF` | `#123029` | tints, selected states |
| `--c-accent-500` | `#E08A18` | `#F0A63A` | campaign badges, "ราคาพิเศษ", highlights |
| `--c-success` `--c-warning` `--c-danger` `--c-info` | `#15803D` `#B45309` `#B42318` `#1D4ED8` | lighter equivalents | status only |
Rules: **one primary accent** — teal is for actions, amber only for promotions; kraft tones are surfaces and illustration, never body text; every semantic pair passes WCAG 2.2 AA in light, dark and high-contrast (the contrast gate in `pnpm test` enforces it).

### Type, shape, depth, motion
- Type (ADR-0001): **Anuphan** display (h1–h3, hero, section titles), **Noto Sans Thai** UI/body, **JetBrains Mono** for codes and quantities in tables; tabular figures for all prices and quantities; Thai line-height ≥ 1.6; h1 clamp(2rem, 5vw, 3.25rem).
- Shape: radius 12 px controls, 16 px cards/media, 999 px pills (nav pill, chips, primary CTA on storefront only — admin keeps 12 px).
- Depth: two elevation levels only — `0 1px 2px rgba(30,27,24,.06)` for cards, `0 8px 24px rgba(30,27,24,.10)` for overlays/sticky quote dock. No neumorphism, no double borders.
- Motion: 150–200 ms ease-out for hovers, 250 ms for sheets/drawers; carousels never auto-advance faster than 6 s and pause on hover/focus; respect `prefers-reduced-motion`.
- Decorative section dividers (the reference uses wavy edges): allowed as a **flat SVG shape in `--c-paper-100`**, max one per two sections, `aria-hidden`, never text over it.

### Imagery
Real getpack product and factory photography in a Thai context; products on white or paper backgrounds with a soft contact shadow; flat-lay for material/finish comparisons; process shots for the production timeline. Dielines and structure diagrams are line art (ink) with kraft fills. **Never** stock photos that imply customers or staff we do not have, and never imagery lifted from another site. Every image: `next/image`, explicit dimensions, AVIF/WebP, descriptive Thai alt text.
