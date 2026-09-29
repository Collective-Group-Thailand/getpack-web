# Moderator guide — competitive UX scorecard rounds

> How to run one round of `competitive-scorecard.md`: the competitor baseline (U5.0, now), the
> Packio release gate (U5.8) and every quarterly round after launch. Same guide, same cards
> (`task-cards.md`), same counting rule (`step-counting.md`), same results template
> (`scorecard-results/_template.md`) — otherwise two rounds cannot be compared.
> Operating text is English for the team; everything said to a participant is Thai, in the
> boxes marked **พูด**.

## 1. Roles

| Role | Does | Does not |
|---|---|---|
| **Moderator** (one per session) | runs the script, reads the cards, keeps time, asks SEQ and SUS | help with the task, explain the UI, react to success or failure |
| **Note-taker** | fills the per-task sheet live: completion, time, steps, errors, quotes | speak to the participant |
| **Observers** (optional, max 2) | watch the stream muted, post questions to the note-taker for the debrief | join the call with camera or microphone on |

The moderator and note-taker are named per round in the results file. Who they are for the
baseline round is collected in the U2.0 intake (`RUN-ORDER-U1-U5.md` §3).

## 2. Participants

**8–10 per round** (scorecard §1), recruited to these quotas:

| Segment | Count | Tasks | Device |
|---|---|---|---|
| Thai SME owner — food, cosmetics or e-commerce (mixed) | 5–6 | T1–T10 | ≥ 3 of all participants on a mid-range Android phone |
| Procurement officer, mid-size company | 1–2 | T1–T10 | laptop |
| Freelance graphic designer | 1 | T2, T3, T12 | laptop with Illustrator |
| Screen-reader user (may overlap a segment above) | 1 | T1, T4, T7 | own device and screen reader |
| Factory floor staff (launch factory) | 1–2, extra to the 8–10 | T11 | Android phone |

**Screener** (ask in Thai, by phone or form; record answers, not names, in the results file):

| # | Question (พูด) | Keep if |
|---|---|---|
| S1 | "ปัจจุบันคุณทำงานหรือทำธุรกิจอะไรคะ/ครับ" | matches a segment |
| S2 | "ใน 12 เดือนที่ผ่านมา คุณเคยสั่งทำบรรจุภัณฑ์หรือกล่องพิมพ์ลายไหม ประมาณกี่ครั้ง" | ≥ 1 (buyers); any (designer) |
| S3 | "ปกติคุณใช้อุปกรณ์อะไรสั่งซื้อของออนไลน์ มือถือยี่ห้อ/รุ่นอะไร" | device quota |
| S4 | "คุณหรือคนในครอบครัวทำงานกับ Collective Group, โรงพิมพ์ หรือแพลตฟอร์มสั่งทำบรรจุภัณฑ์ไหม" | no (except the factory group) |
| S5 | "เคยเข้าร่วมการทดสอบเว็บไซต์เรื่องบรรจุภัณฑ์ใน 6 เดือนที่ผ่านมาไหม" | no |
| S6 | "คุณใช้โปรแกรมอ่านหน้าจอหรือเครื่องมือช่วยการเข้าถึงไหม" | yes → screen-reader slot |

Participants are paid the same incentive whatever they say, and are told so (§5).

## 3. Before the round

- Consent form (`consent-pdpa.md`) sent **at least 24 hours before** the session, so it is read,
  not clicked through; signed copy back before the session starts.
- One results file per round: copy `scorecard-results/_template.md` to
  `scorecard-results/<YYYY-MM-DD>-<competitor|packio>.md` and fill the header (product, build,
  environment, seed list, moderator, note-taker).
- **Seed data** (Packio rounds): the UAT environment's buyer persona per participant, the
  in-production order (T7), the delivered order (T8–T10) with a tax invoice, the job waiting in
  the partner zone (T11), the T3 design with its seeded issues. List every id in the results file.
- **Files on the test device**: `logo.png` (T2, our own), `claim-1.jpg` and `claim-2.jpg` (T9,
  product and carton, our own photos), the info card (T4, T8–T10).
- Randomise the block order per participant (§6) and write it into the participant row.

## 4. Test data and the competitor — rules that are never bent

1. **On the competitor, nothing is submitted, paid, or sent to a factory.** Every task card that
   could create a request says where to stop; the moderator stops the participant there, even
   mid-sentence ("ขอหยุดตรงนี้ก่อนนะคะ/ครับ"). No fake requests, ever (scorecard §1).
2. **The competitor is used through the moderator's own demo account**, signed in before the
   session. A participant never types their own name, phone, company or address into the
   competitor's site — only the test data on the info card, and only up to the stop point.
3. **Nothing from the competitor is copied** into Packio: not screenshots into designs, not
   wording into copy. Recordings of the competitor are evidence for this study only
   (`docs/benchmark/kumopack-2026-09-29.md` header applies).
4. On Packio, only the UAT environment and its seeded personas are used — never production data.

## 5. Session script (buyer session, ~75 minutes)

**Setup (5 min, before the participant joins):** recording ready, test device on Do Not Disturb,
browser history cleared, demo account signed in (competitor) or UAT persona ready (Packio),
start page open.

**Welcome and consent (5 min)**

> **พูด:** "สวัสดีค่ะ/ครับ ขอบคุณที่มาช่วยวันนี้นะคะ/ครับ วันนี้เราอยากดูว่าเว็บไซต์สั่งทำบรรจุภัณฑ์ใช้งานง่ายหรือยากแค่ไหน สิ่งที่เราทดสอบคือ **เว็บไซต์** ไม่ใช่ตัวคุณ ไม่มีคำตอบถูกหรือผิด ถ้าอะไรทำไม่ได้หรืองง นั่นคือสิ่งที่เราต้องการรู้ที่สุด"
>
> "เราไม่ได้เป็นคนทำเว็บไซต์นี้ ติได้เต็มที่ ไม่มีใครเสียใจค่ะ/ครับ ค่าตอบแทนของคุณเท่าเดิมไม่ว่าคุณจะพูดอะไร"
>
> "ก่อนเริ่ม ขอทวนเรื่องความยินยอมที่ส่งไปให้นะคะ/ครับ — เราจะบันทึกหน้าจอและเสียง [และภาพจากกล้อง ถ้าคุณยินยอม] เพื่อใช้ปรับปรุงบริการเท่านั้น คุณหยุดเมื่อไรก็ได้ และขอให้ลบข้อมูลได้ ยังโอเคไหมคะ/ครับ"

Start recording only after a spoken yes; say the date and participant id aloud for the record.

**Think-aloud practice (3 min)**

> **พูด:** "ระหว่างทำงาน ขอให้พูดสิ่งที่คิดออกมาดัง ๆ เช่น กำลังมองหาอะไร คาดว่าจะเกิดอะไรขึ้น หรือรู้สึกแปลกใจตรงไหน ลองซ้อมกันก่อน — ช่วยเปิดแอปแผนที่ในมือถือ แล้วหาร้านกาแฟที่ใกล้ที่สุด พร้อมพูดไปด้วยค่ะ/ครับ"

**Tasks (≈ 50 min)** — per task:
1. Read the card aloud, hand it over.
   > **พูด:** "พร้อมเมื่อไรบอกนะคะ/ครับ" … "เริ่มได้เลย" ← **timer starts here**
2. Stay silent. Allowed prompts only:
   - "ตอนนี้กำลังคิดอะไรอยู่คะ/ครับ" (after 10 seconds of silence)
   - "คาดว่าถ้ากดตรงนั้นจะเกิดอะไรขึ้น"
   - "ถ้าอยู่คนเดียวที่บ้าน ตอนนี้จะทำอะไรต่อ"
   Never: "ลองดูด้านบนสิ", "ใช่แล้ว", "เกือบแล้ว", or any hint about where to go.
3. **Timer stops** when the participant says they are done, gives up, or hits the time cap
   (T1–T5, T8–T10: 5 min · T6: 5 min · T7: 3 min · T11: 3 min · T12: 5 min).
4. If the participant is stuck at the cap, or asks for help twice, the moderator may give one
   neutral hint — the task is then **partial**, never complete.
5. SEQ, immediately (§8).

**SUS and debrief (10 min)** — SUS (§8) for the product just used, then:

> **พูด:** "ถ้าให้เลือก 3 เรื่องที่น่าหงุดหงิดที่สุดวันนี้ จะเป็นอะไรคะ/ครับ" … "มีอะไรที่ชอบหรือทำให้แปลกใจในทางดีไหม" … "ถ้าเพื่อนจะสั่งทำกล่อง คุณจะแนะนำให้ใช้เว็บนี้ไหม เพราะอะไร"

**Close (2 min)**

> **พูด:** "ขอบคุณมากค่ะ/ครับ ข้อมูลวันนี้ช่วยได้มาก ถ้าเปลี่ยนใจเรื่องการบันทึกภายหลัง แจ้งมาที่ [ช่องทางติดต่อในแบบยินยอม] ได้เลย"

## 6. Task order

Tasks run in **blocks** so that dependent tasks stay in order while the rest is randomised
(scorecard §1 "same task order randomised per participant"):

| Block | Tasks (fixed order inside) |
|---|---|
| A | T1 |
| B | T2 → T3 → T4 (each continues the previous design) |
| C | T5, T6 (random order) |
| D | T7, T8, T9, T10 (random order; seeded orders) |

Block order is a Latin square across participants (A-B-C-D, B-C-D-A, C-D-A-B, D-A-B-C, repeat).
The designer session is T2 → T3 → T12; the factory session is T11 alone; the screen-reader
session is T1, T4, T7 in random order.

## 7. What to record

Per participant per task (the results template has the columns):

| Field | Rule |
|---|---|
| **Completion** | **Y** done, unaided, meets the card's "done when" · **P** done with one hint, or done but wrong in a way the participant did not notice (e.g. wrong quantity) · **N** gave up, time cap, or wrong and unnoticed on the key criterion · **NP** not possible on this product |
| **Time** | seconds from "เริ่มได้เลย" to stop |
| **Steps** | counted live by the note-taker with `step-counting.md`, checked against the recording afterwards |
| **Errors** | each time the participant takes an action they then have to undo, or the system rejects an input |
| **SEQ** | 1–7, the participant's number |
| **Notes** | verbatim quotes with a timestamp, not interpretations |

Per session: SUS score, top 3 frustrations (verbatim, tagged with the task), device, block order.

## 8. Questionnaires (th)

**SEQ** — after every task:

> **พูด:** "โดยรวมแล้ว งานเมื่อสักครู่ยากหรือง่ายแค่ไหน ให้คะแนน 1 ถึง 7 — 1 คือยากมาก 7 คือง่ายมาก"

**SUS** — after the last task, on paper or a form, 1 = ไม่เห็นด้วยอย่างยิ่ง … 5 = เห็นด้วยอย่างยิ่ง.
Our own Thai rendering of the System Usability Scale (J. Brooke, 1986; free to use with
attribution). Score as usual: odd items − 1, 5 − even items, sum × 2.5.

| # | ข้อความ |
|---|---|
| 1 | ฉันคิดว่าจะอยากใช้เว็บไซต์นี้บ่อย ๆ |
| 2 | ฉันรู้สึกว่าเว็บไซต์นี้ซับซ้อนเกินความจำเป็น |
| 3 | ฉันคิดว่าเว็บไซต์นี้ใช้งานง่าย |
| 4 | ฉันคิดว่าต้องมีคนช่วยสอน จึงจะใช้เว็บไซต์นี้ได้ |
| 5 | ฉันพบว่าส่วนต่าง ๆ ของเว็บไซต์นี้ทำงานเข้ากันได้ดี |
| 6 | ฉันรู้สึกว่าเว็บไซต์นี้มีส่วนที่ไม่สอดคล้องกันมากเกินไป |
| 7 | ฉันคิดว่าคนส่วนใหญ่จะเรียนรู้การใช้เว็บไซต์นี้ได้อย่างรวดเร็ว |
| 8 | ฉันพบว่าเว็บไซต์นี้ใช้งานยุ่งยาก |
| 9 | ฉันรู้สึกมั่นใจเมื่อใช้เว็บไซต์นี้ |
| 10 | ฉันต้องเรียนรู้หลายอย่างก่อนจะเริ่มใช้เว็บไซต์นี้ได้ |

## 9. Mobile and accessibility sessions

- **Android sessions**: the participant's own mid-range Android if possible (record the model),
  screen mirrored to the recording; otherwise the round's reference device. Do Not Disturb on.
  The mobile gate compares each task's time with the desktop median (scorecard §3).
- **Screen-reader session**: the participant's own device and screen reader (TalkBack or NVDA),
  their own speech rate; allow 10 minutes to set up. Record the screen reader and version. Only
  T1, T4, T7 are gated; stop any task that becomes distressing.
- **Factory session (T11)**: on the floor if the factory allows it, with the phone in one hand —
  the note-taker counts taps, including mis-taps.

## 10. After the session

- Within 24 hours: note-taker completes the participant's rows in the results file; the
  moderator checks the step counts against the recording.
- **Recordings never go into the repository.** They live in the study's restricted storage
  under the participant id; the results file links to the id and a timestamp, nothing else.
  Retention as in `consent-pdpa.md`; deletion requests are handled within the period stated there.
- After the last session: compute the aggregates and the gates table (scorecard §3); every failed
  gate on a Packio round gets a fix ticket linked from the results file.
