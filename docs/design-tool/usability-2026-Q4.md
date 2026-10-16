# getpack 3D Studio — usability pass, 2026 Q4

Status: **moderated sessions not yet run.** U4.8 asks for five moderated sessions with first-time
users (Thai SMEs) against the targets in `studio-spec.md` §1. Those sessions need a moderator and
recruited participants. An agent cannot run them, and the session log below must not be filled from
anything else. This document holds:

1. the protocol, ready to run;
2. an empty session log;
3. an **expert walkthrough** made while building U4.6–U4.8. This is *not* user research, and it is
   labelled as such. It lists the issues found and fixed, so the sessions start from a cleaner build.

## 1. Protocol

**Participants (5).** Owners or staff of Thai SMEs who sell a packaged product (food, cosmetics,
retail goods). None has used getpack or another online box designer. At least two work mostly on a
phone, and at least one is over 45. They speak Thai; the session runs in Thai. Each is paid an
incentive. Consent covers screen and voice recording; recordings are kept 90 days.

**Setup.** Production-like build on the staging API, an account per participant (no company for
three, a company member for two). A mid-range Android phone over 4G for the phone participants, a
laptop for the others. Think-aloud protocol; the moderator does not help unless a participant is
stuck for 3 minutes, and each assist is logged.

**Tasks** (each maps to a §1 metric):

| # | Task given to the participant | Measures | Target (§1) |
|---|---|---|---|
| T1 | "You sell ground coffee in 250 g bags. Make a box for it and get it into your cart." | time from the studio's first screen to add-to-cart; assists | ≤ 10 min, alone |
| T2 | "Put your shop's name and a picture on the front, and make sure it will print well." | checks reached clean; fixes used | files right first time (≥ 90 % pass preflight) |
| T3 | "How much would 3,000 cost, and when would it arrive?" | correct answer from the dock or order sheet | no price surprises (checkout = studio) |
| T4 | "Ask a colleague to comment on the lid." | share link made with the right scope; a pinned comment | — |
| T5 | (company members) "Your manager must approve before you pay." | approval link sent | — |
| T6 | "You'd rather have getpack design it." | hand-off brief completed and sent | — |

**After each task:** Single Ease Question (1–7). **After the session:** SUS questionnaire (Thai
version), then three open questions: what was hardest, what was missing, what would make them come
back.

**Analysis.** Each issue gets a severity: 4 means the participant could not finish, 3 means they
finished with an assist or a wrong result, 2 means they finished but were slowed or unsure, 1 is
cosmetic. Issues are ranked by severity × the number of participants affected, and the top five
are fixed before launch. Findings go in §2 with links to the commits.

## 2. Session log

| Session | Date | Profile | Device | T1 time | Assists | SEQ (T1–T6) | SUS | Top issues |
|---|---|---|---|---|---|---|---|---|
| P1 | — | — | — | — | — | — | — | not yet run |
| P2 | — | — | — | — | — | — | — | not yet run |
| P3 | — | — | — | — | — | — | — | not yet run |
| P4 | — | — | — | — | — | — | — | not yet run |
| P5 | — | — | — | — | — | — | — | not yet run |

## 3. Expert walkthrough (not user research)

Made while building U4.6–U4.8, by working through T1–T6 on the mock and on the real getpack-api
(v0.41.0). Every item below was fixed in the build the sessions will use.

| Found in | Issue | Severity (expected) | Fix |
|---|---|---|---|
| T1 (real API) | The order sheet showed an empty price table for a product with no quantity presets. | 3 | A hint sends the customer to the quantity in the price bar (U4.6). |
| T1 (real API) | A failed upload of the print files showed the browser's "Failed to fetch". | 3 | Plain Thai copy: "ส่งไฟล์งานพิมพ์ไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง" (U4.6). |
| T1 | The keyboard shortcuts overlay showed raw keys instead of its section names. | 1 | The missing copy was added (U4.6). |
| T2 | A warning that was not yet accepted blocked ordering with no way forward from ⑤. | 2 | ⑤ says how many warnings are open and links to ④ (U4.6). |
| T4 | Pinning a comment on the flat sheet hit the artwork under the click and selected it instead. | 3 | While pinning, the design does not take the click (U4.7). |
| T4 | One "share" button made only a view link. | 2 | One dialog with view, comment and edit, as many links as needed, each revocable (U4.7). |
| T1 | Changing the box size left the artwork where it was in millimetres, off its faces. | 3 | The artwork is re-fitted to the new size as one undo step, with a message (U4.8). |
| T6 | The hand-off was refused by getpack-api: a quotation without graphic design has no design fee. | 4 | The handed-over version asks for graphic design, and the button only shows where the product offers it (U4.8). |
| all | The studio's funnel events (`studio_*`) were refused by the mock's analytics, so the §1 metrics could not be checked locally. | — | The mock now accepts every published event name; getpack-api accepts them (checked on v0.41.0). |

## 4. Instrumentation for the §1 metrics

| Metric | Measured by | Status |
|---|---|---|
| Time to first add-to-cart | `studio_started` → `studio_add_to_cart` (session) | sent (D-286); the report is getpack-api's monthly review |
| Studio session → add-to-cart | `studio_first_artwork` → `studio_add_to_cart` | sent |
| Preflight pass without prepress changes | getpack-api's print job and preflight per studio order | server side (D-280) |
| Checkout total = studio price | `e2e/storefront-studio-order.spec.ts` (test) and the saved studio quotation (D-277) | tested on the mock; the real flow waits on storage in the integration stack |
| Interactive ≤ 3 s, 60 fps orbit, input ≤ 100 ms | Lighthouse `studio` set; `e2e/studio-perf.spec.ts` | 0.98–0.99 performance; 54–56 fps under 4× CPU throttle |
| WCAG 2.2 AA | axe in every studio e2e | pass |
