# Packio: survey of new base structures (deduplicated against our 105)

Notes on method:
- Kumopack's mockup workshop could not be scraped. It is a JavaScript-only single-page app, WebFetch only got "Loading…", and the proxy blocks curl. Its parent site kumopack.com lists 12 types, and we already cover all of them: RSC, FTD, RTE, mailer, pizza, die-cut fruit, document, drawer, folding, handle, roll-end tray and shoe box.
- Dedup was checked against the `tuck_top`/`tuck_bottom` values in missing.json. We already have `straight_tuck`, `airplane_tuck` and `seal` tops, and `tuck`, `snap_lock_123`, `crash_lock`, `four_flap_lock` and `seal` bottoms. So STE, RTE, French/airplane, TTAB, TTSLB, seal-end, 1-2-3 and cereal-style boxes are not new.
- Codes: FEFCO families are given where the sources confirm them. ECMA only names families (A = tube, B = tray, F = special), because the exact sub-codes are paywalled. The "~" sign means "family, not a verified exact code".
- Legend: FC = folding_carton, COR = corrugated, RIG = rigid, TRAY = tray, DISP = display, INS = insert, BAG = bag, TAG = label/tag, OTH = other. Difficulty is for the parametric engine: L = low, M = medium, H = high.

## Tier A: offered by several vendors (highest commercial value)

| # | Name (TH) | Code | Cat | Construction (for the dieline engineer) | Axes | Evidence | Diff |
|---|---|---|---|---|---|---|---|
| 1 | Five-panel hanger box (กล่องแขวน 5 แผง) | ~ECMA A (tube, hanger) | FC | A 4-panel tube plus glue flap. A 5th panel extends the back panel above the top score and folds down behind it to make a 2-ply header. The hang hole is die-cut through both plies. The top tuck closes under the header. The bottom is a tuck, snap or crash lock. | tuck_bottom, hang, window, thumb | refinepackaging.com/products; Pakfactory guide; UPrinting; packsdo | M |
| 2 | Display-lid carton (lid flips back to form a header) | ~ECMA A/B | FC | The body is a 4-corner glued tray, a 1-2-3-bottom tube or a double-wall tray. The hinged lid has a perforated or reverse-scored line. When opened, it folds 180° behind the back wall and locks with a tab into a slot, standing up as a printed header. | base (4corner / snap / double_wall), window, insert | Refine (3 variants: "Four Corner/1-2-3 Bottom/Double Wall with Display Lid") | M |
| 3 | Corrugated snap-lock / tuck-top slotted box (กล่องลูกฟูกฝาเสียบก้นล็อค) | FEFCO 0215/0216 (0204/0215 combos) | COR | An RSC body with a glued joint. The bottom flaps are cut as a 1-2-3 snap lock (two hook flaps plus two cut-outs). The top is either RSC flaps or an extended major flap made into a tuck lid with dust flaps. | joint, tuck_top (flaps / tuck), tuck_bottom (snap / crash), hand_holes | renubox FEFCO 0215; packsdo "Slotted container with 1-2-3 bottom"; kasbox "ฝาเสียบก้นขัด" | L |
| 4 | Slotted box with tuck-in lid flap | FEFCO 0210/0211 (also 0229) | COR | An RSC/HSC where one top major flap is lengthened and scored into a tuck tongue that goes inside the opposite wall. The minor flaps act as dust flaps, so the box can be reclosed without tape. | joint, hand_holes, tuck_corner | labelprint24 FEFCO page; Pacdora "FEFCO 0211" | L |
| 5 | Holster / slipcase (one end closed, กล่องสวมปลายปิด) | ~ECMA A01 (slipcases) | FC (+RIG flag) | A glued sleeve closed at one end by glued flaps or a tuck, open at the other end. A book-style slipcase instead closes 3 sides and is open on one long face. The open edge has a thumb notch. | thumb, window, end (tuck / glued), construction (folding / rigid) | Pakfactory "Holster Boxes"; packaging-warehouse ECMA A01 | L |
| 6 | Beers tray, 4- and 6-corner, with optional hinged lid | ~ECMA B | TRAY | A glued tray where each corner is a diagonal-scored web gusset folded inside and glued to the end wall. It ships flat and pops up. The 6-corner version adds a lid hinged to the back wall with a front lock tab or tuck. This differs from our PK-TR-01/02 glue-tab corners. | corner (4/6), lid (none / tuck / lock), window, insert | cartoncraftinc; RRD box-styles PDF; packmage D004; johnsbyrne | M |
| 7 | Simplex / Kwikset pre-glued pop-up tray | ~ECMA B / FEFCO 07xx | TRAY | Side walls are pre-glued with collapsing diagonal corner folds, so the tray erects when you push the base. Shallow and deep presets. Also the base for "frame" display trays. | window, insert, depth presets | RRD PDF; cartoncraftinc | M |
| 8 | Bliss box (3-piece) | FEFCO 06xx (0601–0608 family) | COR | A wrap body (bottom, 2 long walls and flaps) plus two separate end panels, glued or stitched to the body's end flaps. Very high stacking strength for produce and bulk. Can be open or have a cover. | hand_holes, vents, lid (none / cover) | Kindermann FEFCO PDF; Packhelp FEFCO (0605 example) | M |
| 9 | Paper envelope family (ซองจดหมาย/ซองเอกสาร) | ISO DL/C6/C5/C4 | OTH | One blank: a body panel, two side flaps glued to a bottom flap, and a seal flap. Seal-flap shapes are square, pointed (kite), wallet or pocket (open end). Options are a window, peel-and-seal, a hang slot and a thumb tab. | flap_shape, window, adhesive, hang, thumb | packsdo (10 envelope templates); templatemaker "Envelope"; Pacdora envelope dielines | L |
| 10 | Blister card / skin card / slide or trapped blister (การ์ดแพ็คแขวน) | — | TAG | A heat-seal-coated printed card with a euro slot or hang hole. In the trapped/slide versions, a folded 2-ply card has a die-cut window that holds the blister flange, sometimes with a slide channel. | hang, fold (single / trapped / slide), window | ezcustomboxes custom blister cards; rohrer.com blister cards | L |
| 11 | Gable-top "milk carton" box (กล่องทรงกล่องนม) | — | FC | A 4-panel tube with a glued seam. The top panels form a roof gable with infolding triangular gussets and a fin seal strip, which is glued or tab-locked. The bottom is a seal, crash or tuck. An optional spout punch. Not the same as our handle gable box (PK-SP-02). | tuck_bottom, closure (glue / tab), window, hang | templatemaker "Milk Carton"; Adobe Stock milk-box dielines | M |
| 12 | Bag-shaped / briefcase handle box (กล่องทรงกระเป๋า) | — | FC | A tuck- or crash-bottom tube whose front and back panels extend into die-cut handle flaps. The flaps interlock or glue above a flat or sloped top, giving a purse or briefcase silhouette. | tuck_bottom, handle_shape, window | Refine "Paper Briefcase"; packsdo "Bag Shaped Box" | M |
| 13 | Gusseted flat-top handle carton (กล่องหูหิ้วฝาเรียบ) | — | FC | A cube tube. The top has two infolding gusset panels, and two handle flaps rise vertically and lock or glue back-to-back to make a carry handle over a flat top. The bottom is a crash lock or 1-2-3. | tuck_bottom, handle, window | johnsbyrne "Gusset flat top closure with handle"; kumopack "กล่องหูหิ้ว" | M |
| 14 | Corrugated dump bin | FEFCO 08xx (POS) | DISP | A free-standing open bin: an RSC or 4-wall tube with a crash or 1-2-3 bottom. A printed header extends from the back wall, with an optional pocket tray or divider. Rectangular or octagonal. | header, shelves, partition, sides (4/8) | Pakfactory dump-bin displays | M |
| 15 | Paper cup wrap (fan) plus bottom disc (แก้วกระดาษพิมพ์โลโก้) | — | OTH | An annular-sector blank with r1, r2 and θ worked out from top diameter, bottom diameter and height, plus a side-seam overlap. The bottom is a disc with a skirt. Sizes 4–22 oz. Optional double wall or ripple outer fan. | size, wall (single / double), rim allowance | Pacdora cup-container dielines; TPBI paper cup; kimecopak | M |
| 16 | Paper bowl / food container fan (ชามกระดาษ) | — | OTH | The same frustum geometry as #15, but lower and wider. Optional flat or dome lid disc. | size, lid | TPBI "Paper Bowl"; Pacdora | M |
| 17 | Sloped / angled-top tuck-end | ~ECMA A | FC | A tuck-end tube whose side panels are trapezoids, so the top panel is inclined. The tuck and dust flaps follow the slant. | tuck_top, tuck_bottom, window, hang | packsdo "Sloped Top RTE"; diecuttemplates "Angled boxes" | M |
| 18 | Polygonal two-piece lid and base (hex/oct, กล่องหกเหลี่ยม/แปดเหลี่ยมฝาครอบ) | — | FC | An n-gon tray base (walls with a glue tab per corner, or a lock bottom) plus an n-gon lid that is 2 board thicknesses larger. Flip-top variant: the lid is hinged on one wall. | sides (5/6/8), lid_depth, window, insert | templatemaker "Polygonal Box with Lid"; packsdo "Octagonal Base and Lid / Tray with Lid / Flip-Top" | M |
| 19 | Round folding box (paperboard cylinder, กล่องทรงกลม) | — | FC | A curved wall with a glued seam. The bottom edge has notched tabs glued to a base disc. The lid is a band plus a disc, or the top is a petal closure. Not a wound tube (our PK-RG-07). | lid_depth, window, insert | templatemaker "Round box"; packsdo "Round Box" | H |
| 20 | Molded pulp insert / tray (ถาดเยื่อกระดาษ) | — | INS | A thermoformed 3D pulp shell with draft angles, ≥1.5 mm wall, and cavity, rib and flange geometry. Not a flat dieline, so the engine needs a 3D shell plus a 2D outline export. | cavities, depth, flange | PackMojo "Molded Pulp Inserts" | H |

## Tier B: common in Thai food service, POS, retail and beverage

| # | Name (TH) | Code | Cat | Construction | Axes | Evidence | Diff |
|---|---|---|---|---|---|---|---|
| 21 | Fries scoop (กล่องใส่เฟรนฟราย) | — | FC | A flat glued tube with a tall back panel and a lower V- or U-cut front, plus side gussets. The bottom is 2-point glued or a lock bottom. | size, window(none) | yellowpages.co.th "กล่องใส่เฟรนฟราย" | L |
| 22 | Cake-slice wedge box (กล่องเค้กชิ้น) | — | FC | A triangular prism: two triangle faces and three walls. The tuck lid is on the top triangle. Optional window and handle. | window, handle, tuck_top | templatemaker "Cake Slice Box" | M |
| 23 | Sandwich wedge pack (กล่องแซนวิช) | — | FC | A right-triangle prism that stands on its square face, with a window on the sloped face. Opens with a tear strip or tuck. Glued. | window, tear_strip | tumtook.com "กล่องแซนวิช" | M |
| 24 | Pizza slice box (triangular) | — | COR | A flat triangular tray with roll-end walls and a hinged triangular lid with a front tuck or lock tab. | thumb, vents | packsdo "Pizza Slice Box" | M |
| 25 | Compartment meal / bento box (กล่องข้าว 2–3 ช่อง) | — | FC | A lock-corner food tray (like PK-SP-16) with an integral fold-up or glued divider wall, plus a hinged lid with a tuck or lock. | compartments, window, handle | yellowpages "กล่องใส่อาหาร/ถาดใส่อาหาร" | M |
| 26 | Wrap-around can/bottle multipack | — | FC | Board wraps around 4, 6 or 8 cans. The ends are open with heel cut-outs, the bottom has lock tabs, and the top has finger holes. | count, handle | US5351817 (clip carrier); Smurfit Westrock TopClip | M |
| 27 | Clip-top can carrier (TopClip/KeelClip style) | — | FC | A flat die-cut topper with can-diameter apertures. Inward fingers grip the can chimes. Finger holes. No glue. | count, handle | eu.smurfitwestrock.com topclip; packagingeurope (Graphic Packaging topper) | M |
| 28 | Wine-glass carrier | — | FC | A handle carton whose top partition has keyhole slots that hold glass stems upside down. Side walls lock. | count, handle | Refine "Glass Carrier Boxes" | M |
| 29 | Brochure / leaflet holder (ชั้นวางโบรชัวร์) | — | DISP | A back panel with a fold-out easel strut, plus a glued front pocket (1–3 tiers). | pockets, easel | tumtook.com (brochure stands) | M |
| 30 | Table tent / tent card (ป้ายตั้งโต๊ะ) | — | DISP | A 3- or 4-panel scored triangle closed by a glue or lock tab. Optional pocket. | panels, lock | tradeprint POS displays | L |
| 31 | Shelf wobbler / shelf talker / dangler | — | TAG | A flat die-cut card with a shelf-edge flap or a PET wobbler-strip mount. | shape_flat, mount | tradeprint POS displays | L |
| 32 | Walker-lock tray (glueless) | ~ECMA B | TRAY | Glue-free. Double end walls fold over inward to mirror the outer ends and lock with tabs into slots in the base. Check against PK-CF-05; this one is paperboard, double-end. | lock, handle, vents | cartoncraftinc "Walker Lock Tray" | M |
| 33 | Infold/outfold tray | ~ECMA B | TRAY | A glued tray with angled side panels. The lid panels collapse inward over the outfolded base walls. | lid, window | cartoncraftinc; packmage D004 | M |
| 34 | Frame-view tray (Frame Vue) | ~ECMA B | TRAY | A glued double side wall that forms a raised picture-frame rim around the product, usually with a sleeve or window lid. | window, sleeve | cartoncraftinc "Frame Vue" | M |
| 35 | Brightwood tray | ~ECMA B | TRAY | Shipped flat and unglued, then machine-formed. The ends are doubled with glue flaps from the side walls. 4- or 6-corner, optional double-wall sides. | corner, double_wall | cartoncraftinc "Brightwood Tray" | M |
| 36 | V-bottom and flat merchant paper bags (ถุงกระดาษก้นแหลม / ถุงแบน) | — | BAG | A flat tube with a glued back seam. V-bottom: pleated side gussets make a pointed bottom fold. Flat merchant bag: no gusset, glued bottom fold. No handles. | window, gusset, size | yellowpages "ถุงกระดาษ" (bakery bags) | L |
| 37 | Corrugated end caps / die-cut buffers | FEFCO 09xx | INS | Folded corrugated caps that fit over product ends, with crush-zone flaps. Used in pairs. | profile, depth | Kindermann FEFCO PDF (09 series) | M |
| 38 | Corrugated liner / U-sleeve / tube insert | FEFCO 0900–0911 | INS | A scored blank folded into a U, tube or frame liner that doubles the inside walls of an RSC. | shape (U / tube / frame) | Kindermann / Packhelp FEFCO 09 | L |
| 39 | Suspension / retention pack | — | INS | A corrugated frame with stretch film. The frame flaps fold under to tension the film, which holds the product in place. | size | Packhelp FEFCO 09 (inserts) | M |
| 40 | Foam / EVA layered insert | — | INS | Stacked die-cut foam layers (top, cavity and base) laminated together. Export one 2D layer per sheet. | layers, cavities | PackMojo "Custom Foam Inserts" | M |
| 41 | CD/DVD jacket (2-, 4- or 6-panel) | — | FC | A folded multi-panel wallet with a glued pocket or die-cut disc slot. Optional tray-mount panel. | panels, pocket | Refine CD jackets | L |
| 42 | Folded card holder / gift-card carrier (ซองใส่บัตร) | — | TAG | A bi-fold card with die-cut corner slits or a slot that holds a CR80 card. Optional hang hole. | hang, slits | templatemaker "Card Box"; packsdo "Folded Card" | L |
| 43 | Bottle necker (neck hang tag) | — | TAG | A card with a die-cut ring hole plus a relief slit, sized to the neck diameter. | shape_flat | packsdo "Hang Tag" family | L |
| 44 | Folded leaflet / package insert (ใบแทรก) | — | TAG | A flat sheet with fold schemes: bi-fold, tri-fold, Z-fold or map fold. Pharma and supplement outserts. | fold_scheme | diecuttemplates (folders/tags) | L |
| 45 | Multi-depth (Econoflex) shipping box | — | COR | An RSC with extra horizontal score lines at set heights, so the box can be cut down to the fill height. | joint, depth_steps | Packlane "Econoflex Shipping Boxes" | L |
| 46 | Calendar / flat book mailer | FEFCO 0474 | COR | A one-piece low-profile folder: a base panel with side tuck walls and a wrap lid with a tuck. Check against PK-CF-04/CF-10. | thumb, adhesive, tear_strip | renubox FEFCO 0474 | L |
| 47 | Tent cup carrier (A-frame) | — | FC | An A-frame handle carrier. The base panel has 2 or 4 die-cut cup holes and the gable sides carry the handle. Check against PK-TG-03. | count, handle | packsdo "Tent Cup Carrier" | M |
| 48 | Handle sleeve / gourd sleeve | — | FC | An open sleeve whose top panels extend into a die-cut carry handle (gourd version: a waisted outline). Fits over trays and cups. | handle, window | packsdo "Sleeve with Carry Handle / Gourd Shaped Sleeve / Handle Strip Sleeve" | L |
| 49 | Ice-cream cone holder | — | FC | A tray or partition with circular holes sized for cones, inside a gable or tray outer. | count | Refine "Ice Cream Cone Holder" | L |

## Tier C: shaped, gift and novelty (seasonal: วาเลนไทน์, ตรุษจีน, Christmas, Halloween)

| # | Name (TH) | Code | Cat | Construction | Axes | Evidence | Diff |
|---|---|---|---|---|---|---|---|
| 50 | Heart-shaped box (กล่องรูปหัวใจ) | — | FC/RIG | A heart-outline base and lid, with side walls as curved strips with notched glue tabs. | lid_depth, window, construction | templatemaker "Heart Shaped Box"; Pacdora candy dielines | H |
| 51 | Tapered (frustum) gift / trapezoid box | — | FC | A tube with trapezoid side panels, so the top is smaller than the base. Rectangular or n-gon, with a tuck or lock top. | sides, tuck_top, window | templatemaker "Trapezoid Box"; packsdo "Octagon Gift Box (Tapered)" | M |
| 52 | Exploding box (กล่องระเบิด) | — | FC | 2 or 3 nested cross-shaped blanks: a base with 4 flaps that fall open when the separate lid comes off, often with an inner cube. | layers, lid_depth | templatemaker "Exploding Box" | M |
| 53 | Coffin box | — | FC | An elongated-hexagon tray and lid with glue tabs per corner. | lid_depth, window | templatemaker "Coffin" | M |
| 54 | Star box | — | FC | A star-prism tube (n points) with petal or tuck top and bottom. | points, closure | templatemaker "Star Box / Star Shape" | H |
| 55 | Sphere / ornament gore box | — | FC | n lens-shaped gores joined by tabs into a ball. | gores | templatemaker "Sphere"; Pacdora "Sphere Box Template" | H |
| 56 | Gem / diamond box | — | FC | A faceted bipyramid (crown plus pavilion) made from triangular facets with tabs. | facets | templatemaker "Gem Stone Box" | H |
| 57 | Parallelepiped / rhombus box | — | FC | A slanted prism with rhombic end panels and tuck closures. | angle, tuck_top | templatemaker "Parallelepiped / Rhombus Box" | M |
| 58 | Curved-score / elliptical box | — | FC | Curved-crease panels (arc scores) that make a lens or ellipse cross-section, closed by the curved folds alone. | curvature | templatemaker "Curved Box / Elliptical Box" | H |
| 59 | Egg-shaped box | — | FC | An egg-profile outline built from curved gores. | size | templatemaker "Egg Shaped Box" | H |
| 60 | Nestable tapered tray | — | TRAY | A tray with drafted walls (corner glue tabs) that nest when stacked. | draft, depth | templatemaker "Nestable Tray" | L |
| 61 | Rigid ring binder / portfolio (แฟ้มแข็ง) | — | RIG | A case-bound board cover (front, spine, back) with a wrap, plus a ring mechanism or pocket. Also covers swatch cards. | spine, pocket, mechanism | diecuttemplates "Binders / Swatch cards" | M |

## Better as option axes on existing bases (no new base needed)
- n-gon `sides` axis on PK-SP-03/04: adds pentagon (packsdo "Pentagonal Box").
- `variant` axis on PK-SP-01: standing pillow, middle-opening pillow and pillow with handles (packsdo).
- PK-CF-01 `mailer_front`: no dust flaps, 3-flap lock, and Thai "หูช้าง-มีฝาด้านใน" (inner lid) from kasbox.
- PK-TE-01 `insert`: an integral tube holder (packsdo "Tuck End Box with Tube Holder").
- PK-SL-01 `lock`: a tab-lock (unglued) sleeve.
- PK-CF-02 `shape`: octagonal, with vent holes and tuck strip (packsdo).
- PK-RG-07: metal lid and shoulder-neck tube (Packhelp).
- `tear_strip` on seal-end.

## Product areas where Thai buyers often ask and we are weak
1. Food-service paper (cups, bowls, fries, bento, sandwich, cake slice). This is the biggest Thai SME print segment for cafés, delivery and bakeries, and we cover only the burger, boat, pail, cone and hot-dog shapes.
2. POS and retail point-of-sale (dump bin, brochure holder, tent card, wobbler, blister/hang cards). Supplements and cosmetics brands in Thai modern trade ask for these.
3. Stationery and printed matter that buyers expect a packaging printer to quote alongside boxes: envelopes, card holders and leaflets.
4. Beverage multipacks (craft beer, RTD, café bottles) and glass carriers.
5. Seasonal gift shapes (heart, round, exploding, tapered) for Valentine's, Chinese New Year and mooncake season. Rigid shaped boxes are a premium upsell.
6. Eco inserts (molded pulp, corrugated end caps, retention packs) to replace foam. Thai brands increasingly ask for "plastic-free".

## Sources
- https://www.templatemaker.nl/en/
- https://packsdo.com/dielines/
- https://refinepackaging.com/products
- https://pakfactory.com/blog/a-guide-to-different-types-of-folding-carton-box-styles
- https://pakfactory.com/dump-bin-displays.html
- https://www.uprinting.com/folding-carton-and-cardstock-packaging.html
- https://www.qinprinting.com/?p=67020
- https://www.customboxmakers.com/?p=14978
- https://packlane.com/
- https://packmojo.com/llms.txt
- https://packhelp.co.uk/shop/boxes/?uc=true
- https://packhelp.com/fefco-codes/
- https://pacdora.com/tools/box-template-maker
- https://www.pacdora.com/dielines
- https://www.pacdora.com/dielines/cup-container-dielines
- https://www.diecuttemplates.com/help/packaging
- https://cartoncraftinc.com/folding-carton-structures/
- https://www.rrd.com/docs/locations/ocpc/Box-Styles.pdf
- https://www.johnsbyrne.com/blog/folding-carton-styles-jump-off-shelf
- https://packmage.com/about/article/436-B_Four_Corner_Beers_Style_Tray_Infold_Outfold_Variation
- https://www.renubox.com/fefco-codes
- https://pwarehouse.labelprint24.com/magazine/fefco-typen-erklart-was-ist-das-wie-sieht-das-aus-91.php
- https://www.kindermann-wellpappen.de/downloads/2022-04-21_FEFCO Code_WEB_unprotected.pdf
- https://kitepackaging.co.uk/mcp/box-style-guide/
- https://www.packaging-warehouse.com/en/adviser/ecma-catalogue-281
- https://www.tis-gdv.de/?p=124
- https://www.ezcustomboxes.com/product/371/custom-blister-cards
- https://www.rohrer.com/product/blister-cards/
- https://www.eu.smurfitwestrock.com/products/packaging/food-and-beverage/topclip
- https://patents.google.com/patent/US5351817
- https://replatform.tradeprint.co.uk/point-of-sale-displays
- https://kumopack.com/
- https://www.kasbox.com/17565439/ (รูปแบบกล่อง page)
- https://www.yellowpages.co.th/heading/Boxes-Paper
- https://www.yellowpages.co.th/lp/squarepack/catalog
- https://www.tumtook.com/artcardpackaging
- https://www.tpbigroup.com/th/products/paper-packaging/paper-cup
- https://www.kimecopak.ca/blogs/news/how-to-design-paper-cup
