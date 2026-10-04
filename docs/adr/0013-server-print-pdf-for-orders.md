# ADR-0013 — An order's print file is assembled by packio-api from the studio's renders

**Status:** Accepted (2026-10-05) · U4.6 · supersedes [ADR-0009](0009-print-pdf-in-the-browser.md) for orders

The U4 prompt names this "ADR-0012"; that number was already taken by the style asset pipeline
(U3.3), so it is 0013. packio-api records the same decision as its own ADR-0011 (D-280).

## Context

ADR-0009 made the print file in the browser: the stage captured at 300 dpi in JPEG tiles, placed
under the engine's vector die by `dielineToPdf`, and uploaded as the artwork. It works, but for an
order the browser is the wrong place to finish the file:

- the file the factory prints must be checked by the same preflight and studio rules the server
  runs (D-278), turned into the customer's **digital proof** and attached to the order line's
  artwork submission — work the browser cannot be trusted to do and should not have to wait for;
- the order must pin an **immutable version** (D-276): the file has to be made from that version,
  not from whatever the canvas shows when the request lands;
- a closed tab or a slow phone must not lose the order half way.

A server renderer of the scene is still out of the question for the reasons in ADR-0009 (a second
implementation of the canvas, Thai shaping).

## Decision

- **The studio renders, the server assembles.** On "เพิ่มลงตะกร้า", "สั่งเลย" or "ส่งขออนุมัติ" the
  studio saves the version, saves its quotation (`store.studio.saveQuote`, D-277), captures the
  version's artwork with ADR-0009's one renderer — `captureArtworkTiles`, 300 dpi JPEG tiles of
  ≤ 4096 px, per printed side (the inside on the mirrored die) — and each finish's area as a PNG
  mask, uploads them (`store.files`) and registers them per version
  (`store.studio.addRender`: kind, side, separation, placement in mm).
- `store.studio.order` (Idempotency-Key = design, version, option) answers **202** with a print job;
  the studio polls the job, showing progress, and continues to the cart or checkout with a client
  navigation once it succeeds. packio-api's worker places the tiles under the engine's vector die,
  adds each finish as its named separation page, runs preflight and the rules, makes the proof
  (PDF + 3D snapshot) and attaches all to the cart line's artwork submission.
- The cart line carries the pinned version (`designDocumentId`, `designVersionNo`); placing the
  order locks it (`DesignDocumentDto.lock`). Editing a locked design makes a new version — the
  studio says so — and the order page and the proof screen link to the locked version.
- **ADR-0009 stays for the customer's own download** ("ดาวน์โหลด PDF" in the designer): the
  browser-made file is a convenience, never what is printed for an order.
- Where packio-api cannot assemble (`studio.print_unavailable`), the studio says so and offers the
  existing route — upload a file with the order (F3 artwork) — instead of a half-made order.

## Consequences

- One renderer of the artwork, still in the browser; the server never draws the scene.
- The upload is a few MB of tiles per side; progress is shown per tile.
- The proof is the authority (as before): the studio's checks and soft proof are previews.
- A tile set is per version: re-ordering the same version reuses it (the idempotent order answers the
  same job).
