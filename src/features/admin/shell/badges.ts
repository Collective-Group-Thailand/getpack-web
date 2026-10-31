import { parseListState, toCountQuery } from "../console/list-state";
import type { TabCountSource } from "../console/queues";
import type { ListResource } from "../console/resource";
import { companiesList } from "../companies/resources";
import { inboxList } from "../inbox/resources";
import { claimsList, shipmentsList } from "../logistics/resources";
import { ordersList } from "../orders/resources";
import { bankLinesList, receivablesList, slipsList, unidentifiedList, whtCertificatesList } from "../finance/resources";
import { factoriesList } from "../partners/resources";
import { prepressList } from "../prepress/resources";
import { productionBoardCount } from "../production/resources";
import { structuralRequestsList, styleIntakesList } from "../structural/resources";
import { rfqList } from "../rfq/resources";
import { samplesList } from "../samples/resources";

/** The work lists whose rows a count can be read from, by the page that shows them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LISTS_AT: Readonly<Record<string, ListResource<any>>> = {
  "/orders": ordersList,
  "/rfq": rfqList,
  "/inbox": inboxList,
  "/claims": claimsList,
  "/samples": samplesList,
  "/companies": companiesList,
  "/prepress": prepressList,
  "/production": productionBoardCount,
  "/shipments": shipmentsList,
  "/partners": factoriesList,
  "/style-intakes": styleIntakesList,
  "/structural-requests": structuralRequestsList,
  // G4 — the finance queues that are lists (the others open a page whose rows are not the queue: dashboard count).
  "/finance/slips": slipsList,
  "/finance/banking/lines": bankLinesList,
  "/finance/receivables/wht": whtCertificatesList,
  "/finance/receivables": receivablesList,
  "/finance/banking/unidentified": unidentifiedList,
};

/**
 * The list read behind a link (`/orders?queue=late`): the same query that page sends for its rows, so a count read
 * with `listTotalQuery` is exactly the rows the link opens. `null` for a page that is not one of these lists.
 */
export function rowsSourceAt(href: string): TabCountSource | null {
  const [path = "", search = ""] = href.split("?");
  const resource = LISTS_AT[path];
  if (!resource) return null;
  const state = parseListState(new URLSearchParams(search), resource.defaults);
  return { resource, query: toCountQuery(state) };
}

/**
 * Which tab of a list a sidebar badge counts — the entry opens on that tab, and the badge reads that tab's own rows,
 * as the tab's count does. "คำสั่งซื้อ 4" leads to four rows, never 18 (the dashboard's sum of every order queue,
 * which the list never shows at once).
 */
export interface MenuBadge {
  source: TabCountSource;
  /** The query the entry's link carries to open that tab (`?queue=new`), or none for the list's default tab. */
  search: string;
}

const badge = (path: string, search = ""): MenuBadge => ({ source: rowsSourceAt(`${path}${search}`)!, search });

/** The menu entries whose list has work queues: the queue that asks something of the desk now. */
export const MENU_BADGES: Readonly<Record<string, MenuBadge>> = {
  // The desk opens on "รอชำระ" (the first order queue).
  orders: badge("/orders"),
  rfq: badge("/rfq", "?queue=new"),
  inbox: badge("/inbox", "?sla=waiting"),
  claims: badge("/claims"),
  samples: badge("/samples", "?status=requested"),
  companies: badge("/companies", "?status=kyc_review"),
  // G2 — production and logistics.
  prepress: badge("/prepress"),
  production: badge("/production", "?atRisk=true"),
  shipments: badge("/shipments", "?queue=pod_review"),
  partners: badge("/partners", "?status=applied"),
  style_intakes: badge("/style-intakes"),
  structural_requests: badge("/structural-requests", "?status=submitted"),
};
