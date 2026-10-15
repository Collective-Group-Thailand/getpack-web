"""Packio style-library master catalogue (original work).
Base structures x variant axes -> distinct producible dielines.
Reference codes marked 'verify' must be checked against the official FEFCO / ECMA editions before publishing."""
import csv, json, itertools, math

# product_type = the Packio calculator that prices the structure (D-100): folding, corrugate, label, tag_sleeve,
# pouch, standard_product (stock items only), service. Types WITHOUT a calculator route to RFQ (D-100):
# rigid, paper_bag, mailer, shrink_sleeve. The live pricing path is decided at runtime by the API's quote-path
# service (calculator signed off + a factory price path + capability, D-043); the field below is a planning hint only.
CALCULATOR_TYPES = ("folding", "corrugate", "label", "tag_sleeve", "pouch", "standard_product", "service")
BASE = []
def add(code, family, cat, ptype, th, en, construction, material, axes, wave, cx, ref=""):
    BASE.append(dict(code=code, family=family, category=cat, product_type=ptype, name_th=th, name_en=en,
                     construction=construction, material_class=material, variant_axes=axes,
                     wave=wave, complexity=cx, reference=ref))

# ---------- Variant axes (shared) ----------
AX = {
 "tuck_top": ["straight_tuck","reverse_tuck","airplane_tuck","seal"],
 "tuck_bottom": ["tuck","snap_lock_123","crash_lock","seal","four_flap_lock"],
 "hang": ["none","euro_slot","round_hole","sombrero_header"],
 "window": ["none","front_window","top_window"],
 "tuck_corner": ["square","rounded"],
 "lock": ["friction","slit_lock"],
 "handle": ["none","die_cut_handle","insert_handle"],
 "lid_depth": ["full","partial"],
 "joint": ["glue_flap","stitch_flap","tape_joint"],
 "hand_holes": ["none","end_panels","side_panels"],
 "vents": ["none","round","oblong"],
 "mailer_front": ["tuck","tab_lock"],
 "tear_strip": ["none","zip_tear_strip"],
 "adhesive": ["none","single_strip","dual_strip_return"],
 "shelves": ["1","2","3","4"],
 "header": ["none","header_card"],
 "insert": ["none","die_cut_insert"],
 "thumb": ["none","thumb_notch"],
 "corner": ["glued","lock_corner"],
 "closure_rigid": ["none","magnetic","ribbon"],
 "shape_flat": ["rectangle","rounded_rectangle","circle","oval","custom_path"],
 "pouch_feat": ["zipper","tear_notch","hang_hole","window"],  # combinable on/off -> 2^4
 "bag_gusset": ["gusseted","flat"],
 "bag_handle": ["twisted_paper","flat_paper","rope","die_cut","none"],
 "partition": ["2x2","2x3","3x3","3x4","4x4","4x6"],
 "fold": ["bi_fold","tri_fold","z_fold","gate_fold"],
}

# ---------- Folding carton (paperboard) ----------
add("PK-TE-01","tuck_end","folding_carton","folding","กล่องฝาเสียบ (ปรับฝาบน-ล่างได้)","Tuck-end carton (configurable ends)",
    "Four side panels + glue flap; top and bottom closures chosen from the tuck/lock/seal set; dust flaps on side panels.","paperboard",
    ["tuck_top","tuck_bottom","hang","window"],1,"M")
add("PK-TE-02","tuck_end","folding_carton","folding","กล่องฝาเสียบล็อกกันเปิด","Tuck-end with slit or friction lock",
    "Tuck-end with lock tabs engaging slits or dust-flap friction to resist opening in transit.","paperboard",
    ["tuck_top","lock","tuck_corner"],1,"M")
add("PK-TE-03","tuck_end","folding_carton","folding","กล่องฝาเสียบผนังสองชั้น","Double-wall tuck-front carton",
    "Side and end walls fold over for double thickness; tuck-front lid; e-commerce strength in paperboard.","paperboard",
    ["window","thumb"],2,"H")
add("PK-FT-01","flip_top","folding_carton","folding","กล่องฝาพับเปิด (ฝาติดตัว)","Hinged flip-top carton",
    "Lid hinged to the back panel with a front tuck; bottom tuck or crash-lock.","paperboard",
    ["tuck_bottom","window","insert"],1,"M")
add("PK-FT-02","flip_top","folding_carton","folding","กล่องฝาพับเปิดมีลิ้นกันฝุ่นยาว","Flip-top with extended dust flaps",
    "Hinged lid with long dust flaps that tuck inside the body for a cleaner close.","paperboard",["tuck_bottom","insert"],2,"M")
add("PK-DS-01","display","folding_carton","folding","กล่องโชว์สินค้าหน้าร้าน (มีป้ายหัว)","Counter display tray with header card",
    "Open-front tray with raised back header for branding; lock-corner or glued; optional divider.","paperboard",
    ["corner","insert"],1,"M")
add("PK-DS-02","display","folding_carton","folding","กล่องโชว์ฝาฉีกเปิด","Tear-away display carton",
    "Closed carton with perforated front/top panel that tears off to become a display.","paperboard",
    ["tuck_bottom","hang"],2,"M")
add("PK-DS-03","display","folding_carton","folding","กล่องโชว์ก้นล็อกพนักสูง","Auto-bottom display with raised back",
    "Crash-lock bottom, cut-down front and sides, raised back panel.","paperboard",["window"],2,"H")
add("PK-DS-04","display","folding_carton","folding","ขาตั้งโชว์พับได้","Easel-back display stand",
    "Flat printed panel with a folding easel strut; optional shelf lip.","paperboard",["thumb"],3,"L")
add("PK-TR-01","tray","folding_carton","folding","ถาด 4 มุมทากาว","Four-corner glued tray",
    "Base with four walls; glue tabs at corners.","paperboard",["corner","insert"],1,"L")
add("PK-TR-02","tray","folding_carton","folding","ถาด 6 มุมทากาว","Six-corner glued tray",
    "Tray with extended side walls folding into six glued corners for stackable display.","paperboard",["insert"],1,"M")
add("PK-TR-03","tray","folding_carton","folding","ถาดผนังสองชั้น","Double-wall tray",
    "Walls fold over into double thickness, locked by tabs into the base; no glue.","paperboard",["insert"],1,"M")
add("PK-TR-04","tray","folding_carton","folding","ถาดฝาเสียบพับขอบ","Roll-end tray with tuck lid (paperboard mailer)",
    "Roll-end side walls, integrated lid with front tuck and dust flaps.","paperboard",["tuck_corner","insert","thumb"],1,"M")
add("PK-SL-01","sleeve","folding_carton","folding","ปลอกสวม","Open-end sleeve",
    "Four-panel tube with glue flap, open both ends.","paperboard",["window","thumb"],1,"L")
add("PK-SL-02","sleeve","folding_carton","folding","กล่องลิ้นชัก (ปลอก+ถาด)","Sleeve and drawer (matchbox)",
    "Two pieces: sleeve sized from drawer outer + clearance; drawer as a tray.","paperboard",["thumb","window","insert"],1,"M")
add("PK-SL-03","sleeve","folding_carton","folding","ปลอกคาดกลาง","Belly band / wrap band",
    "Narrow band wrapping product or box, glued or tab-locked.","paperboard",["lock"],1,"L")
add("PK-LB-01","lid_base","folding_carton","folding","กล่องฝาครอบสองชิ้น","Two-piece telescope (paperboard)",
    "Base tray + lid tray; lid sized from base outer + 2x caliper + clearance.","paperboard",["lid_depth","corner","window","thumb"],1,"M")
add("PK-SP-01","specialty","folding_carton","folding","กล่องหมอน","Pillow box","Curved-crease ends formed by arcs; single glue flap.","paperboard",["hang","window"],1,"M")
add("PK-SP-02","specialty","folding_carton","folding","กล่องหูหิ้ว (หลังคาจั่ว)","Gable handle box","Gable top with interlocking handle cut-out; crash-lock or snap-lock bottom.","paperboard",["tuck_bottom","window"],1,"H")
add("PK-SP-03","specialty","folding_carton","folding","กล่องหกเหลี่ยม","Hexagonal carton","Six side panels, tuck or lid closure.","paperboard",["tuck_top","window"],2,"H")
add("PK-SP-04","specialty","folding_carton","folding","กล่องแปดเหลี่ยม","Octagonal carton","Eight side panels, tuck or lid closure.","paperboard",["tuck_top"],3,"H")
add("PK-SP-05","specialty","folding_carton","folding","กล่องสามเหลี่ยม (ปริซึม)","Triangular prism carton","Three side panels with tuck ends.","paperboard",["hang","window"],2,"M")
add("PK-SP-06","specialty","folding_carton","folding","กล่องหูหิ้วใส่ขวด","Bottle carrier with handle","Open or closed carrier with partitions and centre handle.","paperboard",["partition"],2,"H")
add("PK-SP-07","specialty","folding_carton","folding","กล่องเค้กมีหน้าต่าง","Cake box","Lock-corner tray base with hinged lid and front tuck; window option.","paperboard",["window","handle"],2,"M")
add("PK-SP-08","specialty","folding_carton","folding","กล่องอาหารทรงถังพับ","Food pail / noodle box","Tapered pail with interlocking top flaps; food-contact board required.","food_board",["handle"],2,"H")
add("PK-SP-09","specialty","folding_carton","folding","กล่องแฮมเบอร์เกอร์ฝาหอย","Clamshell burger box","One-piece hinged clamshell with lock tab.","food_board",[],2,"M")
add("PK-SP-10","specialty","folding_carton","folding","ถาดอาหารทรงเรือ","Food boat tray","Four-corner tray with angled walls; food-contact board.","food_board",[],2,"L")
add("PK-SP-11","specialty","folding_carton","folding","กรวยป๊อปคอร์น/ขนม","Cone / popcorn box","Tapered carton with flat bottom or cone.","food_board",[],3,"M")
add("PK-SP-12","specialty","folding_carton","folding","แฟ้มเอกสารพรีเซนเทชัน","Presentation folder","Folder with pockets and business-card slits.","paperboard",["thumb"],2,"M")
add("PK-SP-13","specialty","folding_carton","folding","ซองกระดาษแข็ง","Paperboard envelope / wallet","Wallet with flap and tuck or peel-seal.","paperboard",["lock"],2,"L")
add("PK-IN-01","insert","insert","folding","แผ่นรองเจาะช่อง","Die-cut cavity insert","Platform with die-cut holes sized to product footprint; optional raised legs.","paperboard",["thumb"],1,"M")
add("PK-IN-02","insert","insert","folding","ตัวรองคอขวด","Bottle-neck insert","Collar or platform holding bottles by the neck/shoulder.","paperboard",[],2,"M")
add("PK-IN-03","insert","insert","folding","ถาดรองในกล่อง","Tray insert","Inner tray with cut-outs sized to the outer box interior.","paperboard",[],1,"M")

# ---------- Corrugated (FEFCO-series based; codes to verify) ----------
add("PK-CS-01","slotted","corrugated","corrugate","กล่องฝาชน","Regular slotted container","Four panels, glue/stitch joint, flaps = half width meeting at centre.","corrugated",["joint","hand_holes"],1,"L","FEFCO 0201")
add("PK-CS-02","slotted","corrugated","corrugate","กล่องฝาเปิดครึ่ง (ไม่มีฝาบน)","Half slotted container","RSC without top flaps.","corrugated",["joint","hand_holes"],1,"L","FEFCO 0200")
add("PK-CS-03","slotted","corrugated","corrugate","กล่องฝาเกยเต็ม","Full overlap slotted container","Outer flaps full width, overlapping completely.","corrugated",["joint","hand_holes"],1,"L","FEFCO 0203")
add("PK-CS-04","slotted","corrugated","corrugate","กล่องฝาชนพิเศษ (ฝาในชนกัน)","Centre special slotted container","Inner and outer flaps both meet at centre.","corrugated",["joint"],1,"L","FEFCO 0204")
add("PK-CS-05","slotted","corrugated","corrugate","กล่องฝาเกยบางส่วน","Overlap slotted container","Outer flaps overlap by a set amount.","corrugated",["joint"],2,"L","FEFCO 02xx (verify)")
add("PK-CS-06","slotted","corrugated","corrugate","กล่องฝาชนมีหูหิ้วเจาะ","Slotted container with hand holes","RSC with die-cut hand holes on end panels.","corrugated",["joint"],1,"M","FEFCO 0201 + hand holes")
add("PK-CT-01","telescope","corrugated","corrugate","กล่องฝาครอบเต็ม (ถาด+ฝา)","Full telescope, two trays","Base and lid as separate trays; lid full depth.","corrugated",["lid_depth","hand_holes"],1,"M","FEFCO 03xx (verify)")
add("PK-CT-02","telescope","corrugated","corrugate","กล่องผลไม้ฝาครอบ (ครึ่งสลอต)","Half-slotted body with telescope lid","HSC body with separate telescope cover.","corrugated",["hand_holes","vents"],1,"M","FEFCO 03xx (verify)")
add("PK-CT-03","telescope","corrugated","corrugate","กล่องฝาครอบแบบดีไซน์","Design-style telescope (double cover)","Body with deep-flap lid and base covers.","corrugated",["joint"],2,"M","FEFCO 03xx (verify)")
add("PK-CF-01","folder","corrugated","corrugate","กล่องไดคัทหูช้าง (เมลเลอร์)","Roll-end tuck-front mailer","One-piece die-cut with roll-end side walls, tuck front, dust flaps.","corrugated",["mailer_front","tear_strip","adhesive","thumb","insert"],1,"M","FEFCO 0427")
add("PK-CF-02","folder","corrugated","corrugate","กล่องพิซซ่า","Pizza box","Roll-end tray with hinged lid and front tuck; vent holes option.","corrugated",["thumb"],1,"M","FEFCO 04xx (verify)")
add("PK-CF-03","folder","corrugated","corrugate","กล่องห่อรอบสินค้า","Wrap-around blank","Product placed on blank; panels fold around and are glued/taped.","corrugated",["joint"],1,"M","FEFCO 04xx (verify)")
add("PK-CF-04","folder","corrugated","corrugate","ซองกระดาษลูกฟูกห่อหนังสือ","Book wrap folder","Flat folder that wraps books/documents with crush zones.","corrugated",["lock"],2,"M","FEFCO 04xx (verify)")
add("PK-CF-05","folder","corrugated","corrugate","ถาดลูกฟูกล็อกมุม","Corrugated lock-corner tray","Open tray with self-locking corners, no glue.","corrugated",["handle"],1,"M","FEFCO 04xx (verify)")
add("PK-CF-06","folder","corrugated","corrugate","กล่องเอกสาร/แฟ้ม","Archive / document box","Die-cut box with integral lid and hand holes.","corrugated",["handle"],1,"M","FEFCO 04xx (verify)")
add("PK-CF-07","folder","corrugated","corrugate","กล่องรองเท้า","Shoe box","One-piece die-cut with hinged lid, or two-piece lid/base.","corrugated",["lid_depth"],2,"M")
add("PK-CF-08","folder","corrugated","corrugate","กล่องผลไม้ไดคัท","Produce tray / die-cut fruit box","Open or ventilated tray with stacking tabs and hand holes.","corrugated",["hand_holes","vents"],1,"M")
add("PK-CZ-01","slide","corrugated","corrugate","กล่องสไลด์ลูกฟูก","Corrugated slide box","Outer sleeve + inner tray.","corrugated",["thumb"],2,"M","FEFCO 05xx (verify)")
add("PK-CG-01","ready_glued","corrugated","corrugate","กล่องลูกฟูกก้นล็อกอัตโนมัติ","Corrugated crash-lock bottom box","Pre-glued body with auto-erecting bottom; tuck or flap top.","corrugated",["joint","hand_holes"],2,"H","FEFCO 07xx (verify)")
add("PK-CG-02","ready_glued","corrugated","corrugate","กล่องหิ้วลูกฟูก","Corrugated carry box with handle","Crash-lock bottom and interlocking handle top.","corrugated",[],2,"H","FEFCO 07xx (verify)")
add("PK-CD-01","display","corrugated","corrugate","กล่องพร้อมวางชั้น (SRP) ฉีกเปิด","Shelf-ready tray with tear-off top","Shipper whose perforated top/front removes to leave a display tray.","corrugated",["joint","header"],2,"H")
add("PK-CD-02","display","corrugated","corrugate","ชั้นวางโชว์ลูกฟูก (ขาตั้งพื้น)","Floor display unit","Multi-shelf corrugated stand; header and shelves as separate pieces.","corrugated",["shelves","header"],3,"H")
add("PK-CI-01","insert","insert","corrugate","ช่องกั้นกากบาท","Cross partition set","Slotted strips interlocking into a grid.","corrugated",["partition"],1,"M","FEFCO 09xx (verify)")
add("PK-CI-02","insert","insert","corrugate","แผ่นรอง/แผ่นกั้น","Pad and divider sheet","Flat pads, scored dividers and liners.","corrugated",["thumb"],1,"L","FEFCO 09xx (verify)")
add("PK-CI-03","insert","insert","corrugate","ตัวกันกระแทกมุม/ขอบ","Corner and edge protector","Folded die-cut corners and edge guards.","corrugated",[],2,"M","FEFCO 09xx (verify)")
add("PK-CI-04","insert","insert","corrugate","กล่องส่งขวดมีช่องกั้น","Bottle shipper with cells","RSC + partition set sized per bottle diameter/height.","corrugated",["partition"],2,"M")
add("PK-CB-01","bulk","corrugated","corrugate","กล่องบรรจุภัณฑ์ขนาดใหญ่ (พาเลท)","Bulk bin / pallet box","Heavy double/triple wall container sized to pallet footprint.","corrugated",["lid_depth"],3,"H")

# ---------- Rigid (set-up) ----------
add("PK-RG-01","rigid","rigid","rigid","กล่องแข็งฝาครอบ","Rigid lid and base","Greyboard trays wrapped in printed paper; separate lid.","rigid",["lid_depth","window","insert","thumb"],2,"M")
add("PK-RG-02","rigid","rigid","rigid","กล่องแข็งมีคอ (ไหล่)","Rigid shoulder-neck box","Base with inner neck the lid seats on, flush exterior.","rigid",["insert"],2,"H")
add("PK-RG-03","rigid","rigid","rigid","กล่องแข็งเปิดแบบหนังสือ","Rigid book-style box","Tray glued into a hinged cover wrap.","rigid",["closure_rigid","insert","window"],2,"M")
add("PK-RG-04","rigid","rigid","rigid","กล่องแข็งพับได้ (แม่เหล็ก)","Collapsible rigid box","Ships flat, erects with magnetic or tab locks.","rigid",["closure_rigid","insert"],2,"H")
add("PK-RG-05","rigid","rigid","rigid","กล่องแข็งลิ้นชัก","Rigid drawer box","Wrapped sleeve with wrapped drawer; pull ribbon or thumb notch.","rigid",["thumb","insert"],2,"M")
add("PK-RG-06","rigid","rigid","rigid","กล่องแข็งฝาพับ (ฝาติดตัว)","Rigid hinged-lid box","One-piece hinged lid, optional magnetic front.","rigid",["closure_rigid","insert","window"],2,"M")
add("PK-RG-07","rigid","rigid","rigid","กระบอกกระดาษ","Paper tube / cylinder","Spiral or convolute tube with lid, optional shoulder.","rigid",["lid_depth"],2,"H")

# ---------- Flexible & paper bags ----------
add("PK-PB-01","pouch","flexible","pouch","ถุงตั้งได้","Stand-up pouch","Front, back and bottom gusset; laminated film or kraft laminate.","flexible",["pouch_feat"],1,"M")
add("PK-PB-02","pouch","flexible","pouch","ซองซีล 3 ด้าน","Three-side-seal flat pouch","Two webs sealed on three sides.","flexible",["pouch_feat"],1,"L")
add("PK-PB-03","pouch","flexible","pouch","ซองกลางหลัง (ซีลหลัง)","Centre-seal (pillow) pouch","Fin or lap seal on the back, sealed top and bottom.","flexible",["pouch_feat"],2,"L")
add("PK-PB-04","pouch","flexible","pouch","ถุงก้นแบน (ทรงกล่อง)","Flat-bottom box pouch","Five panels with side gussets and flat base.","flexible",["pouch_feat"],2,"H")
add("PK-PB-05","pouch","flexible","pouch","ถุงมีข้างจีบ","Side-gusset bag","Front/back with side gussets, quad or fin seal.","flexible",["pouch_feat"],2,"M")
add("PK-PB-06","mailer","flexible","mailer","ซองไปรษณีย์พลาสติก","Courier poly mailer","Co-ex film with adhesive flap and tear strip.","flexible",["adhesive","tear_strip"],1,"L")
add("PK-PB-07","mailer","flexible","mailer","ซองกันกระแทก (บับเบิ้ล)","Bubble mailer","Kraft or film outer with bubble lining, adhesive flap.","flexible",[],2,"L")
add("PK-PG-01","paper_bag","flexible","paper_bag","ถุงกระดาษมีหูหิ้ว","Paper carrier bag","Gusseted or flat paper bag, reinforced top, handle options.","paper",["bag_handle","bag_gusset"],1,"M")
add("PK-PG-02","paper_bag","flexible","paper_bag","ถุงกระดาษก้นตั้ง (ไม่มีหู)","SOS paper bag","Self-opening square-bottom bag, no handle.","paper",["window"],2,"L")

# ---------- Labels / stickers ----------
add("PK-LA-01","label","label","label","ฉลากม้วน","Roll label","Die-cut labels on liner in rolls; core/wind direction specified.","label_stock",["shape_flat"],1,"L")
add("PK-LA-02","label","label","label","สติกเกอร์แผ่น","Sheet sticker","Kiss-cut stickers on sheets.","label_stock",["shape_flat"],1,"L")
add("PK-LA-03","label","label","label","ฉลากพันรอบขวด","Wrap-around bottle label","Rectangular label sized from container circumference + overlap.","label_stock",["tuck_corner"],1,"L")
add("PK-LA-04","label","label","label","สติกเกอร์ซีลกันแกะ","Tamper-evident seal","Destructible/void label bridging a closure.","label_stock",["shape_flat"],2,"L")

# ---------- Tags / sleeves ----------
add("PK-TG-01","tag","tag_sleeve","tag_sleeve","ป้ายแท็กห้อย","Hang tag","Flat or folded tag with hole/string options.","paperboard",["shape_flat","hang"],1,"L")
add("PK-TG-02","sleeve","tag_sleeve","tag_sleeve","ปลอกแก้ว","Cup sleeve","Conical band computed from cup top/bottom diameters and height.","paperboard",[],1,"M")
add("PK-TG-03","sleeve","tag_sleeve","tag_sleeve","ที่ใส่แก้ว (ถาดหิ้ว)","Cup carrier","Two- or four-cup carrier with handle.","paperboard",[],2,"M")

# ---------- Additional bases (wave 2-3) ----------
add("PK-TE-04","tuck_end","folding_carton","folding","กล่องฝาเสียบมีช่องกั้นในตัว","Tuck-end with integral partition","Extended panels fold inward to form built-in dividers.","paperboard",["hang"],2,"H")
add("PK-TE-05","tuck_end","folding_carton","folding","กล่องฝาเสียบแถบฉีกกันแกะ","Tamper-evident tuck-end","Perforated tear-strip tuck that must be torn to open.","paperboard",["tuck_bottom","hang"],2,"M")
add("PK-TR-05","tray","folding_carton","folding","ถาดล็อกมุมมีฝาพับ","Lock-corner tray with hinged lid","Glue-free lock-corner tray with hinged lid and front tuck.","paperboard",["window","insert"],2,"M")
add("PK-SL-04","sleeve","folding_carton","folding","ปลอกมีฝาพับ","Sleeve with hinged lid","Tube with one hinged tuck lid and one fixed or open end.","paperboard",["thumb","window"],3,"M")
add("PK-SP-14","specialty","folding_carton","folding","กล่องปิดแบบกลีบดอก","Petal-close carton","Curved interlocking top flaps forming a petal closure.","paperboard",["tuck_bottom"],3,"H")
add("PK-SP-15","specialty","folding_carton","folding","กล่องทรงพีระมิด","Pyramid carton","Four triangular side panels meeting at an apex, square base.","paperboard",["hang"],3,"M")
add("PK-SP-16","specialty","folding_carton","folding","กล่องอาหารมีหน้าต่าง (ล็อกมุม)","Lock-corner food box with window lid","Food-contact lock-corner tray with hinged windowed lid.","food_board",["handle"],2,"M")
add("PK-SP-17","specialty","folding_carton","folding","ถาดฮอทด็อก/ของทอด","Hot dog / snack tray","Small four-wall tray with product cradle.","food_board",[],3,"L")
add("PK-SP-18","specialty","folding_carton","folding","กล่องไวน์ทรงสูงล็อกคอขวด","Tall bottle carton with neck lock","Tall tuck-end with integrated neck-holding insert.","paperboard",["window","hang"],2,"H")
add("PK-SP-19","specialty","folding_carton","folding","กล่องทิชชู/กล่องดึงหยิบ","Dispenser carton","Carton with perforated dispenser opening on top or front.","paperboard",["tuck_bottom"],2,"M")
add("PK-CF-09","folder","corrugated","corrugate","กล่องห้าแผงพับ","Five-panel folder","Long narrow items; five panels fold around the product, ends tuck.","corrugated",["joint"],2,"M","FEFCO 04xx (verify)")
add("PK-CF-10","folder","corrugated","corrugate","กล่องเมลเลอร์ปิดด้วยเทปกาวในตัว","Self-seal e-commerce mailer","Crash-lock or roll-end mailer with peel-and-seal strips and tear strip for return shipping.","corrugated",["tear_strip","adhesive","insert"],2,"M")
add("PK-CG-03","ready_glued","corrugated","corrugate","กล่องส่งของไม่ต้องใช้เทป","Tape-free shipping box","Pre-glued crash-lock bottom with adhesive-strip top closure.","corrugated",["tear_strip","adhesive"],2,"H","FEFCO 07xx (verify)")
add("PK-CB-02","bulk","corrugated","corrugate","ถังลูกฟูกแปดเหลี่ยม","Octagonal bulk bin","Eight-sided heavy-duty bin, flap bottom, optional lid.","corrugated",["lid_depth"],3,"H")
add("PK-CB-03","bulk","corrugated","corrugate","ปลอกพาเลทพร้อมฝา","Pallet sleeve with cap and base tray","Tube sleeve with separate cap and base trays for pallet loads.","corrugated",["hand_holes"],3,"M")
add("PK-RG-08","rigid","rigid","rigid","กล่องแข็งเปิดสองบาน","Double-door rigid box","Tray with two hinged front doors meeting at centre.","rigid",["closure_rigid","insert"],3,"H")
add("PK-PB-08","pouch","flexible","pouch","ถุงมีจุกเท","Spouted pouch","Stand-up pouch with corner or centre spout fitment.","flexible",[],3,"H")
add("PK-LA-05","label","label","label","ฉลากคอขวด","Neck collar label","Arc label computed from neck taper (top/bottom diameters).","label_stock",[],2,"M")
add("PK-LA-06","label","label","label","ฉลากหลายชั้นเปิดอ่าน","Peel-back booklet label","Multi-ply label with resealable top layer.","label_stock",["shape_flat"],3,"M")
add("PK-LA-07","label","label","shrink_sleeve","ฉลากหดรัดรูป","Shrink sleeve label","Lay-flat width from max circumference + seam; height with shrink allowance.","shrink_film",[],3,"M")
add("PK-TG-04","tag","tag_sleeve","tag_sleeve","หัวกระดาษปิดถุง","Bag header card","Folded card stapled over a poly bag with hang hole.","paperboard",["hang"],2,"L")
add("PK-TG-05","tag","tag_sleeve","tag_sleeve","การ์ดแทรก/การ์ดขอบคุณ","Insert / thank-you card","Flat or folded printed card, optional die-cut shape.","paperboard",["shape_flat"],1,"L")


# ---------- Market survey additions (wave 4, D-409, 2026-10-15) ----------
add("PK-CS-07","slotted","corrugated","corrugate","กล่องลูกฟูกฝาชน ก้นล็อก 1-2-3","Slotted box with snap-lock (1-2-3) bottom","RSC top flaps; 1-2-3 snap-lock bottom that closes without tape.","corrugated",["hand_holes"],4,"L","FEFCO 0215 family (verify)")
add("PK-CS-08","slotted","corrugated","corrugate","กล่องลูกฟูกฝาเสียบ","Slotted box with tuck-in lid","Top is a lid with a tuck from the back panel, minor flaps as dust flaps; reclosable; RSC bottom.","corrugated",["hand_holes"],4,"L","FEFCO 0211 family (verify)")
add("PK-CS-09","slotted","corrugated","corrugate","กล่องลูกฟูกปรับความสูงได้","Multi-depth shipping box","RSC scored round at several heights; cut down to the fill height and fold the flaps on the score.","corrugated",["joint"],4,"L")
add("PK-SL-05","sleeve","folding_carton","folding","กล่องสวมปลายปิด (ฮอลสเตอร์)","Holster / slipcase","Sleeve closed at one end by a tuck, open at the other with a thumb notch.","paperboard",["window","thumb"],4,"L")
add("PK-TE-06","tuck_end","folding_carton","folding","กล่องแขวน 5 แผง","Five-panel hanger box","Back panel carried up and folded down behind itself as a two-ply header; hang hole through both plies; top lid tucks from the front.","paperboard",["tuck_bottom","hang","window"],4,"M")
add("PK-DS-05","display","folding_carton","folding","ป้ายตั้งโต๊ะทรงสามเหลี่ยม","Table tent card","Two printed faces leaning to an apex over a base, glue tab at the apex.","paperboard",[],4,"L")
add("PK-DS-06","display","corrugated","corrugate","ถังโชว์สินค้าลูกฟูก (ดัมพ์บิน)","Corrugated dump bin","Free-standing open bin, crash-lock bottom, header carried up from the back wall.","corrugated",["header"],4,"M")
add("PK-TG-06","leaflet","tag_sleeve","tag_sleeve","ใบแทรก / แผ่นพับ","Folded leaflet / package insert","One sheet in panels creased for a bi, tri (roll), Z or gate fold.","paperboard",["fold"],4,"L")
add("PK-TG-07","tag","tag_sleeve","tag_sleeve","การ์ดแพ็คแขวน (บลิสเตอร์)","Blister / hang card","Printed backing card for a blister or skin pack, hang hole at the top.","paperboard",["hang"],4,"L")
add("PK-TG-08","tag","tag_sleeve","tag_sleeve","ป้ายคล้องคอขวด","Bottle necker","Card with a hole sized to the bottle neck.","paperboard",[],4,"L")
add("PK-SP-20","specialty","folding_carton","folding","ถาดใส่โคนไอศกรีม","Ice-cream cone holder","Lock-corner tray with a platform of round holes holding cones or cups upright.","food_board",[],4,"L")
add("PK-SP-22","specialty","folding_carton","folding","กล่องของขวัญทรงสอบ","Tapered gift box","Top narrower than the base; trapezoid walls glued at the corners; four top flaps.","paperboard",[],4,"M")
add("PK-TR-06","tray","folding_carton","folding","ถาดทรงสอบซ้อนได้","Nestable tapered tray","Drafted walls glued at the corners; trays nest when stacked.","food_board",[],4,"L")
add("PK-SP-23","specialty","folding_carton","folding","แก้วกระดาษพิมพ์ลาย","Paper cup blank","Unrolled cone-frustum wall with side-seam overlap plus a skirted bottom disc.","food_board",[],4,"M")
add("PK-SP-24","specialty","folding_carton","folding","ชามกระดาษ","Paper bowl blank","Low wide frustum wall plus a skirted bottom disc.","food_board",[],4,"M")
add("PK-SP-26","specialty","folding_carton","folding","กล่องห้าเหลี่ยม","Pentagonal carton","Five equal side panels, pentagonal tuck lids top and bottom.","paperboard",[],4,"M")
add("PK-IN-04","insert","insert","corrugate","แผ่นรองลูกฟูกพับตัวยู","Corrugated U-liner","Pad scored twice into a U, doubling two walls and the floor of a shipper.","corrugated",[],4,"L","FEFCO 09xx family (verify)")


# ---------- What each structure suits (D-410) ----------
# Use cases group the styles on the storefront's "boxes for …" pages (กล่องครีม, กล่องสบู่ …); a base may suit several.
# Vocabulary: cosmetics, soap, supplements, food, snack, bakery, beverage, tea_coffee, jewelry, apparel, electronics,
# candle_fragrance, produce, gift, luxury, retail, shipping, ecommerce, protection, branding.
CARTON = ["cosmetics", "soap", "supplements", "retail"]
USE_CASES = {
    "PK-TE-01": CARTON + ["snack", "tea_coffee", "electronics", "candle_fragrance"],
    "PK-TE-02": CARTON + ["snack", "tea_coffee"],
    "PK-TE-03": ["cosmetics", "luxury", "gift", "candle_fragrance", "jewelry"],
    "PK-TE-04": ["cosmetics", "supplements", "beverage", "candle_fragrance"],
    "PK-TE-05": ["supplements", "food", "snack", "cosmetics", "ecommerce"],
    "PK-TE-06": ["retail", "electronics", "cosmetics", "snack"],
    "PK-FT-01": ["cosmetics", "snack", "tea_coffee", "supplements", "retail"],
    "PK-FT-02": ["snack", "tea_coffee", "retail"],
    "PK-DS-01": ["retail", "snack", "cosmetics", "branding"],
    "PK-DS-02": ["retail", "snack", "supplements"],
    "PK-DS-03": ["retail", "snack", "cosmetics"],
    "PK-DS-04": ["retail", "branding"],
    "PK-DS-05": ["branding", "retail", "food"],
    "PK-DS-06": ["retail", "snack", "branding"],
    "PK-TR-01": ["food", "bakery", "produce", "gift"],
    "PK-TR-02": ["food", "bakery", "gift"],
    "PK-TR-03": ["gift", "bakery", "apparel"],
    "PK-TR-04": ["ecommerce", "gift", "cosmetics", "apparel", "jewelry"],
    "PK-TR-05": ["food", "bakery", "snack"],
    "PK-TR-06": ["food", "snack", "produce"],
    "PK-SL-01": ["gift", "food", "soap", "branding"],
    "PK-SL-02": ["gift", "jewelry", "cosmetics", "tea_coffee", "luxury"],
    "PK-SL-03": ["branding", "food", "soap", "gift"],
    "PK-SL-04": ["gift", "cosmetics", "tea_coffee"],
    "PK-SL-05": ["gift", "electronics", "cosmetics"],
    "PK-LB-01": ["gift", "apparel", "jewelry", "bakery", "luxury"],
    "PK-SP-01": ["gift", "jewelry", "cosmetics", "snack"],
    "PK-SP-02": ["gift", "bakery", "snack", "food"],
    "PK-SP-03": ["gift", "tea_coffee", "candle_fragrance", "snack"],
    "PK-SP-04": ["gift", "tea_coffee", "candle_fragrance"],
    "PK-SP-05": ["gift", "snack", "food", "cosmetics"],
    "PK-SP-06": ["beverage", "gift"],
    "PK-SP-07": ["bakery", "food", "gift"],
    "PK-SP-08": ["food", "snack"],
    "PK-SP-09": ["food"],
    "PK-SP-10": ["food", "snack"],
    "PK-SP-11": ["snack", "food"],
    "PK-SP-12": ["branding"],
    "PK-SP-13": ["branding", "gift"],
    "PK-SP-14": ["gift", "candle_fragrance", "snack"],
    "PK-SP-15": ["gift", "snack", "candle_fragrance"],
    "PK-SP-16": ["food", "bakery"],
    "PK-SP-17": ["food", "snack"],
    "PK-SP-18": ["beverage", "gift", "luxury"],
    "PK-SP-19": ["retail", "food"],
    "PK-SP-20": ["food", "snack"],
    "PK-SP-22": ["gift", "candle_fragrance", "cosmetics"],
    "PK-SP-23": ["beverage", "tea_coffee"],
    "PK-SP-24": ["food"],
    "PK-SP-26": ["gift", "tea_coffee", "candle_fragrance"],
    "PK-IN-01": ["protection", "cosmetics", "beverage", "electronics"],
    "PK-IN-02": ["protection", "beverage"],
    "PK-IN-03": ["protection", "gift"],
    "PK-IN-04": ["protection", "shipping"],
    "PK-CS-01": ["shipping", "ecommerce"],
    "PK-CS-02": ["shipping", "produce"],
    "PK-CS-03": ["shipping", "protection"],
    "PK-CS-04": ["shipping"],
    "PK-CS-05": ["shipping"],
    "PK-CS-06": ["shipping", "produce"],
    "PK-CS-07": ["shipping", "ecommerce"],
    "PK-CS-08": ["shipping", "ecommerce"],
    "PK-CS-09": ["shipping", "ecommerce"],
    "PK-CT-01": ["shipping", "gift", "apparel"],
    "PK-CT-02": ["produce", "shipping"],
    "PK-CT-03": ["gift", "apparel", "shipping"],
    "PK-CF-01": ["ecommerce", "apparel", "cosmetics", "gift", "shipping"],
    "PK-CF-02": ["food"],
    "PK-CF-03": ["shipping", "ecommerce"],
    "PK-CF-04": ["ecommerce", "shipping"],
    "PK-CF-05": ["produce", "shipping"],
    "PK-CF-06": ["shipping"],
    "PK-CF-07": ["apparel", "ecommerce"],
    "PK-CF-08": ["produce"],
    "PK-CF-09": ["ecommerce", "shipping"],
    "PK-CF-10": ["ecommerce", "apparel", "shipping"],
    "PK-CZ-01": ["ecommerce", "gift"],
    "PK-CG-01": ["shipping", "ecommerce"],
    "PK-CG-02": ["produce", "beverage", "gift"],
    "PK-CG-03": ["ecommerce", "shipping"],
    "PK-CD-01": ["retail", "snack"],
    "PK-CD-02": ["retail", "branding"],
    "PK-CI-01": ["beverage", "protection", "shipping"],
    "PK-CI-02": ["protection", "shipping"],
    "PK-CI-03": ["protection", "shipping"],
    "PK-CI-04": ["beverage", "shipping", "protection"],
    "PK-CB-01": ["shipping"],
    "PK-CB-02": ["shipping", "produce"],
    "PK-CB-03": ["shipping"],
    "PK-RG-01": ["luxury", "gift", "jewelry", "cosmetics", "apparel"],
    "PK-RG-02": ["luxury", "candle_fragrance", "cosmetics", "jewelry"],
    "PK-RG-03": ["luxury", "gift", "electronics", "cosmetics"],
    "PK-RG-04": ["luxury", "gift", "apparel", "ecommerce"],
    "PK-RG-05": ["luxury", "jewelry", "gift", "cosmetics"],
    "PK-RG-06": ["luxury", "jewelry", "gift"],
    "PK-RG-07": ["tea_coffee", "candle_fragrance", "beverage", "luxury"],
    "PK-RG-08": ["luxury", "beverage", "gift"],
    "PK-PB-01": ["snack", "tea_coffee", "food", "supplements"],
    "PK-PB-02": ["snack", "cosmetics", "supplements"],
    "PK-PB-03": ["snack", "food"],
    "PK-PB-04": ["tea_coffee", "snack", "food"],
    "PK-PB-05": ["tea_coffee", "food"],
    "PK-PB-06": ["ecommerce", "apparel", "shipping"],
    "PK-PB-07": ["ecommerce", "protection", "shipping"],
    "PK-PB-08": ["beverage", "food", "cosmetics"],
    "PK-PG-01": ["retail", "apparel", "gift", "branding"],
    "PK-PG-02": ["food", "bakery", "retail"],
    "PK-LA-01": ["branding", "food", "beverage", "cosmetics"],
    "PK-LA-02": ["branding", "ecommerce"],
    "PK-LA-03": ["beverage", "cosmetics", "branding"],
    "PK-LA-04": ["ecommerce", "food", "branding"],
    "PK-LA-05": ["beverage", "branding"],
    "PK-LA-06": ["supplements", "cosmetics", "branding"],
    "PK-LA-07": ["beverage", "cosmetics", "branding"],
    "PK-TG-01": ["apparel", "branding", "retail", "gift"],
    "PK-TG-02": ["tea_coffee", "beverage", "branding"],
    "PK-TG-03": ["tea_coffee", "beverage", "food"],
    "PK-TG-04": ["snack", "retail", "branding"],
    "PK-TG-05": ["ecommerce", "branding", "gift"],
    "PK-TG-06": ["supplements", "cosmetics", "branding"],
    "PK-TG-07": ["retail", "electronics", "cosmetics"],
    "PK-TG-08": ["beverage", "branding"],
}

# ---------- Variant expansion ----------
ALLOWED_TUCK_PAIRS = [(t,b) for t in AX["tuck_top"] for b in AX["tuck_bottom"] if not (t=="seal" and b=="four_flap_lock")]

# Combinations no factory can build (D-408): each rule names its bases, the axis values that together are impossible,
# and why. packio-api's importer drops them (`excluded_combinations`); the counts below exclude them too.
EXCLUDED = [
    {"bases": ["PK-TE-01"], "when": {"tuck_top": ["straight_tuck"], "hang": ["euro_slot", "round_hole", "sombrero_header"]},
     "reason": "A straight tuck's top lid hinges on the back panel's edge, where a hang tab stands; a hang tab takes a reverse, airplane or seal top."},
    {"bases": ["PK-SP-01"], "when": {"window": ["top_window"]},
     "reason": "A pillow box's faces are its front and back (front_window); its ends are curved closures."},
    {"bases": ["PK-SP-02"], "when": {"window": ["top_window"]},
     "reason": "The gable top is the handle; a window goes in the front panel."},
    {"bases": ["PK-SP-03", "PK-SP-04"], "when": {"tuck_top": ["seal", "airplane_tuck"]},
     "reason": "A polygon carton closes with a polygon tuck lid (straight or reverse); seal and airplane ends are rectangular constructions."},
    {"bases": ["PK-DS-03", "PK-PG-02", "PK-SL-01", "PK-SL-05"], "when": {"window": ["top_window"]},
     "reason": "The top is open (a display, a bag's mouth, a sleeve's or a holster's end); a window goes in the front."},
]

def excluded(code, options):
    return any(code in rule["bases"] and all(options.get(a) in vs for a, vs in rule["when"].items()) for rule in EXCLUDED)

def variant_count(row):
    combos = [{}]
    axes = row["variant_axes"]
    paired = "tuck_top" in axes and "tuck_bottom" in axes
    for a in axes:
        if paired and a == "tuck_bottom":
            continue
        if paired and a == "tuck_top":
            choices = [{"tuck_top": t, "tuck_bottom": b} for t, b in ALLOWED_TUCK_PAIRS]
        elif a == "pouch_feat":
            choices = [{a: k} for k in range(2 ** len(AX[a]))]
        else:
            choices = [{a: v} for v in AX[a]]
        combos = [{**c, **ch} for c in combos for ch in choices]
    return sum(1 for c in combos if not excluded(row["code"], c))

missing = [r["code"] for r in BASE if r["code"] not in USE_CASES]
assert not missing and len(USE_CASES) == len(BASE), f"use cases missing for {missing}"
rows = []
for r in BASE:
    r = dict(r)
    r["distinct_variants"] = variant_count(r)
    r["variant_axes"] = ";".join(r["variant_axes"])
    r["use_cases"] = USE_CASES[r["code"]]
    r["pricing_path_at_launch"] = "instant_after_signoff" if r["product_type"] in CALCULATOR_TYPES else "rfq_no_calculator"
    rows.append(r)

cols = ["code","family","category","product_type","name_th","name_en","construction","material_class","variant_axes",
        "distinct_variants","wave","complexity","reference","pricing_path_at_launch"]
with open("docs/design-tool/style-library-master.csv","w",newline="",encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=cols + ["use_cases"]); w.writeheader()
    [w.writerow({**{k:r[k] for k in cols}, "use_cases": ";".join(r["use_cases"])}) for r in rows]
with open("docs/design-tool/style-library-master.json","w",encoding="utf-8") as f:
    json.dump({"axes":AX,"allowed_tuck_pairs":ALLOWED_TUCK_PAIRS,"excluded_combinations":EXCLUDED,"styles":rows}, f, ensure_ascii=False, indent=2)

# ---------- Summary ----------
from collections import defaultdict
by_cat = defaultdict(lambda:[0,0]); by_wave = defaultdict(lambda:[0,0])
for r in rows:
    by_cat[r["category"]][0]+=1; by_cat[r["category"]][1]+=r["distinct_variants"]
    for w_ in (1,2,3,4):
        if r["wave"]<=w_: by_wave[w_][0]+=1; by_wave[w_][1]+=r["distinct_variants"]
print("base structures:", len(rows), " distinct variants:", sum(r["distinct_variants"] for r in rows))
for k,v in sorted(by_cat.items()): print(f"  {k:15s} base={v[0]:3d} variants={v[1]:5d}")
for k,v in sorted(by_wave.items()): print(f"  cumulative wave {k}: base={v[0]} variants={v[1]}")
print("top families by variants:", sorted(((r['code'],r['distinct_variants']) for r in rows), key=lambda x:-x[1])[:8])
