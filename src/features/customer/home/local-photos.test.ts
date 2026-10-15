// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { checkThirdPartyAssets } from "../../../../build-checks/no-untracked-third-party-assets.mjs";
import { photosOf } from "./content.server";
import { fillEmptySlots, type LocalManifestAsset, photosFromManifest } from "./local-photos";

const asset = (position: string, file = `${position}.jpg`, extra: Partial<LocalManifestAsset> = {}) => ({
  file,
  position,
  altTh: `ภาพ ${position}`,
  captionTh: "",
  ...extra,
});

const MANIFEST = [
  asset("hero"),
  ...[1, 2, 3, 4, 5].map((n) => asset(`mosaic-${n}`)),
  asset("sage"),
  asset("frame-4"),
  asset("frame-9"),
  asset("template-mailer", "stack.jpg", { styleCode: "PK-CF-01" }),
  asset("template-bakery", "bag.jpg"),
  asset("category-paper_bag", "kraft-bag.jpg"),
  asset("category-Not A Code", "x.jpg"),
];

describe("local home-photo fallback", () => {
  it("maps manifest positions to the page's slots under /media/home", () => {
    const photos = photosFromManifest("th", MANIFEST);
    expect(photos.hero).toEqual({ src: "/media/home/hero.jpg", alt: "ภาพ hero", caption: null });
    expect(photos.mosaic?.map((p) => p.src)).toEqual([1, 2, 3, 4, 5].map((n) => `/media/home/mosaic-${n}.jpg`));
    expect(photos.quality?.src).toBe("/media/home/sage.jpg");
    expect(photos.process.sample?.src).toBe("/media/home/frame-4.jpg");
    expect(photos.process.packing?.src).toBe("/media/home/frame-9.jpg");
    // A template photo is keyed by style code; one without a code is left out, never guessed.
    expect([...photos.templates.keys()]).toEqual(["PK-CF-01"]);
    // A category photo is keyed by the category's code; anything else is ignored.
    expect([...photos.categories.keys()]).toEqual(["paper_bag"]);
  });

  it("needs all five mosaic tiles", () => {
    expect(
      photosFromManifest(
        "th",
        MANIFEST.filter((a) => a.position !== "mosaic-3"),
      ).mosaic,
    ).toBeNull();
  });

  it("fills only the slots the CMS left empty", () => {
    const cms = photosOf("th", {
      hero: { url: "/v1/store/catalog/images/cms-hero", alt: { th: "จาก CMS" } },
      templates: { "PK-CF-01": { url: "/v1/store/catalog/images/cms-mailer", alt: { th: "เมลเลอร์" } } },
    });
    const filled = fillEmptySlots(cms, photosFromManifest("th", MANIFEST));
    expect(filled.hero?.src).toBe("/bff/v1/store/catalog/images/cms-hero");
    expect(filled.templates.get("PK-CF-01")?.src).toBe("/bff/v1/store/catalog/images/cms-mailer");
    expect(filled.quality?.src).toBe("/media/home/sage.jpg");
    expect(filled.mosaic).toHaveLength(5);
  });
});

describe("no-untracked-third-party-assets", () => {
  const fixture = (assets: unknown[], files: string[]) => {
    const root = mkdtempSync(join(tmpdir(), "assets-"));
    const dir = join(root, "public", "media", "home");
    mkdirSync(dir, { recursive: true });
    for (const file of files) writeFileSync(join(dir, file), "x");
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ assets }));
    return root;
  };

  it("passes images listed with a known licence", () => {
    const root = fixture(
      [
        { file: "a.jpg", source: "pexels" },
        { file: "b.jpg", source: "unsplash" },
      ],
      ["a.jpg", "b.jpg"],
    );
    expect(checkThirdPartyAssets(root)).toEqual([]);
  });

  it("fails interim, unsourced and unlisted images", () => {
    const root = fixture(
      [{ file: "a.jpg", source: "interim-unverified" }, { file: "b.jpg" }],
      ["a.jpg", "b.jpg", "c.png"],
    );
    const problems = checkThirdPartyAssets(root);
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toMatch(/a\.jpg: source "interim-unverified"/);
    expect(problems.join("\n")).toMatch(/c\.png: not listed/);
  });

  it("has nothing to check without public/media", () => {
    expect(checkThirdPartyAssets(mkdtempSync(join(tmpdir(), "empty-")))).toEqual([]);
  });
});
