# Journey funnels — events, steps and alerts

> U5.0 item 3 (`docs/prompts/U5-ux-excellence.md`) and scorecard §4: "funnel dashboards (studio
> start → add to cart, configurator → quote → cart, claim start → submit) with alerts on drops
> > 15 % week over week". One vocabulary for the browser, the API's rollups and the admin
> dashboard. The names are the closed union in `src/lib/analytics/events.ts`; a name that is not
> there cannot be sent.

## Rules every event follows

- **First-party only.** Events go to Packio's own API through the storefront BFF (`track()`),
  never to GTM, and carry no advertising identifier. They are necessary to run the service and
  are not consent-gated (`src/lib/analytics/consent.ts`); session replay is, separately.
- **Dimensions, never identities** (D-102, PDPA): route *pattern*, product type code, quantity
  *band*, province, quote mode, a reason code. Never an order code, a design id, a name or an
  exact quantity.
- **The API decides the business date** from `occurredAt`; the browser does no date maths.
- **One event per user intent**, not per render: a design is "started" once, "saved" once per
  editing session, a claim "submitted" once per successful submit.

## The five funnels

Step conversion is *reached this step ÷ reached the previous step*, per session, over the period.

### Configurator — configure → quote → cart
| Step | Event | Sent from |
|---|---|---|
| 1 | `configurator_opened` | `Configurator.tsx` on mount |
| 2 | `configuration_changed` | first change in the session |
| 3 | `quote_shown` | a real price is in the dock |
| 4 | `cart_item_added` | "เพิ่มลงตะกร้า" succeeded |
Leak signal: `quote_abandoned` (declared, not sent yet — needs a session end the API can see).

### Checkout — cart → placed → paid
| Step | Event | Sent from |
|---|---|---|
| 1 | `checkout_started` | cart → checkout |
| 2 | `order_placed` | the order group was created |
| 3 | `order_paid` | the payment page saw it settled |

### Studio — start → saved → ordered
| Step | Event | Sent from |
|---|---|---|
| 1 | `design_started` | the designer created a new design (`EditorSession.onCreated`) |
| 2 | `design_saved` | first successful save after an edit, once per editing session (`EditorSession.onSaved`) |
| 3 | `design_ordered` | "สั่งทำแบบนี้" in the studio opened the pre-filled configurator (`OrderAction.tsx`); from there the configurator funnel takes over |
**U4.1 adds** the studio's own steps between 2 and 3 — box confirmed, first artwork, checks clean
(`studio-spec.md` §1). They join this table; they are not invented here.

### Claims — start → submit
| Step | Event | Sent from |
|---|---|---|
| 1 | `claim_started` | the claim form was shown for a delivered order |
| 2 | `claim_submitted` | the claim was accepted by the API; `reason` = the claim type (`print_defect`, `damaged` …) |

### Reorder — start → cart
| Step | Event | Sent from |
|---|---|---|
| 1 | `reorder_started` | the reorder page was shown (account or LINE) |
| 2 | `reorder_added_to_cart` | the reorder was accepted; `quantityBand`, and `reason` = `checkout` or `cart` |
| 3 | `order_placed` | as in checkout |

## Alerts

The API computes, per funnel and step, the conversion for the last complete week and the week
before, and raises `alert` when a step's conversion dropped by more than the configured threshold
(**15 %** relative, scorecard §4 — a setting the API owns, not a number in the UI). The dashboard
shows the flag and the two figures; it never compares them itself.

## Contract

| Id | What | Status |
|---|---|---|
| `analytics.events` | ingest; the published `POST /v1/store/analytics/events` is a batch with a closed `AnalyticsEventName` of five names — U-F0.2 moves `track()` onto it | mapping in `docs/contract-requests.md` |
| `analytics.journey-events` | add the journey names above to `AnalyticsEventName` | requested (U5.0) |
| `admin.analytics-journeys` | `GET /v1/admin/analytics/journeys` — the funnels above with the week-over-week alert | requested (U5.0), mocked |
