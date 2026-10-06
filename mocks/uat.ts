/**
 * The UAT dataset of a scorecard round (U5.8, `docs/ux/uat-round-data.md`): one account per
 * participant, P01–P10, from the segments of `docs/ux/competitive-scorecard.md` §1, each owning
 * the seeded orders the task cards start from (`docs/ux/task-cards.md` Part B) — so every
 * participant meets the same state, and one participant's claim or reorder never changes another's.
 *
 *   T7       an order in production, shipping in three days, reached from its notification link
 *   T8–T10   an order delivered yesterday — reorder, claim, and its tax invoice / receipt
 *   T11      a factory job waiting for acceptance, the participant's own, for the partner floor
 *
 * Off unless `MOCK_DATASET=uat` (`pnpm dev:uat`, `pnpm start:uat`), so no automated test meets it
 * and the seeded orders' positions stay what the suites expect. Restarting the server resets it —
 * between two sessions, as the moderator guide asks.
 *
 * Every name is invented and marked "(ข้อมูลจำลอง)", like the rest of the mock; the products are
 * Packio's own catalogue rows. The same records, for the round on the real UAT backend, are the
 * contract request `api.uat-scorecard-seed`.
 */

export const UAT_ENABLED = process.env.MOCK_DATASET === "uat";

export type UatSegment = "food" | "cosmetics" | "ecommerce" | "procurement" | "designer";

export interface UatParticipant {
  /** The participant code of the round (`moderator-guide.md`); never a real name. */
  code: `P${string}`;
  segment: UatSegment;
  /** The account's display name: the business or the person, invented. */
  name: string;
  /** The company a juristic account buys for, or `null` for an individual. */
  company: string | null;
  /** Signs in with OTP `000000` (the mock's code). */
  phone: string;
  province: string;
  postcode: string;
  /** What the delivered order was: the T1 mailer box, sized for this business. */
  box: { lengthMm: number; widthMm: number; heightMm: number; quantity: number; unitSatang: number };
}

export const UAT_PARTICIPANTS: readonly UatParticipant[] = [
  {
    code: "P01",
    segment: "food",
    name: "ร้านขนมบ้านใบเตย (ข้อมูลจำลอง)",
    company: null,
    phone: "0950000101",
    province: "กรุงเทพมหานคร",
    postcode: "10310",
    box: { lengthMm: 200, widthMm: 150, heightMm: 80, quantity: 1000, unitSatang: 1240 },
  },
  {
    code: "P02",
    segment: "food",
    name: "โรงคั่วกาแฟดอยหมอก (ข้อมูลจำลอง)",
    company: "บริษัท ดอยหมอกคอฟฟี่ จำกัด",
    phone: "0950000102",
    province: "เชียงใหม่",
    postcode: "50200",
    box: { lengthMm: 180, widthMm: 120, heightMm: 70, quantity: 2000, unitSatang: 960 },
  },
  {
    code: "P03",
    segment: "cosmetics",
    name: "แบรนด์สบู่ใบบัว (ข้อมูลจำลอง)",
    company: null,
    phone: "0950000103",
    province: "นนทบุรี",
    postcode: "11000",
    box: { lengthMm: 150, widthMm: 110, heightMm: 60, quantity: 1000, unitSatang: 1180 },
  },
  {
    code: "P04",
    segment: "cosmetics",
    name: "ลีลาวดีสกินแคร์ (ข้อมูลจำลอง)",
    company: "บริษัท ลีลาวดี คอสเมติกส์ จำกัด",
    phone: "0950000104",
    province: "กรุงเทพมหานคร",
    postcode: "10250",
    box: { lengthMm: 200, widthMm: 150, heightMm: 80, quantity: 3000, unitSatang: 890 },
  },
  {
    code: "P05",
    segment: "ecommerce",
    name: "ร้านเสื้อยืดลายเส้น ออนไลน์ (ข้อมูลจำลอง)",
    company: null,
    phone: "0950000105",
    province: "ชลบุรี",
    postcode: "20000",
    box: { lengthMm: 300, widthMm: 220, heightMm: 60, quantity: 2000, unitSatang: 1350 },
  },
  {
    code: "P06",
    segment: "ecommerce",
    name: "ร้านอุปกรณ์มือถือ ทันใจ (ข้อมูลจำลอง)",
    company: "บริษัท ทันใจ ดีไวซ์ จำกัด",
    phone: "0950000106",
    province: "ขอนแก่น",
    postcode: "40000",
    box: { lengthMm: 200, widthMm: 150, heightMm: 80, quantity: 5000, unitSatang: 720 },
  },
  {
    code: "P07",
    segment: "procurement",
    name: "ฝ่ายจัดซื้อ สยามฟู้ดโปรดักส์ (ข้อมูลจำลอง)",
    company: "บริษัท สยามฟู้ดโปรดักส์ จำกัด",
    phone: "0950000107",
    province: "สมุทรปราการ",
    postcode: "10280",
    box: { lengthMm: 250, widthMm: 200, heightMm: 100, quantity: 10000, unitSatang: 640 },
  },
  {
    code: "P08",
    segment: "procurement",
    name: "ฝ่ายจัดซื้อ เฮลท์ตี้ไลฟ์ (ข้อมูลจำลอง)",
    company: "บริษัท เฮลท์ตี้ไลฟ์ อินเตอร์ จำกัด",
    phone: "0950000108",
    province: "ปทุมธานี",
    postcode: "12120",
    box: { lengthMm: 200, widthMm: 150, heightMm: 80, quantity: 5000, unitSatang: 760 },
  },
  {
    code: "P09",
    segment: "designer",
    name: "นักออกแบบอิสระ ภูมิ (ข้อมูลจำลอง)",
    company: null,
    phone: "0950000109",
    province: "กรุงเทพมหานคร",
    postcode: "10400",
    box: { lengthMm: 160, widthMm: 160, heightMm: 90, quantity: 500, unitSatang: 1850 },
  },
  {
    code: "P10",
    segment: "designer",
    name: "สตูดิโอออกแบบ มะลิ (ข้อมูลจำลอง)",
    company: null,
    phone: "0950000110",
    province: "สงขลา",
    postcode: "90110",
    box: { lengthMm: 200, widthMm: 150, heightMm: 80, quantity: 1000, unitSatang: 1240 },
  },
];

/** The participants in the dataset this process serves: none unless `MOCK_DATASET=uat`. */
export const uatParticipants = (): readonly UatParticipant[] => (UAT_ENABLED ? UAT_PARTICIPANTS : []);

/** The storefront persona key of a participant (`mocks/store/customers.ts`): lower case, as mock tokens carry it. */
export const uatPersona = (participant: UatParticipant) => `uat_p${participant.code.slice(1)}` as const;

/** What a participant's seeded orders are for, in the order they are appended to the commerce seed. */
export const UAT_ORDER_ROLES = ["delivered", "inProduction", "jobWaiting"] as const;
export type UatOrderRole = (typeof UAT_ORDER_ROLES)[number];
