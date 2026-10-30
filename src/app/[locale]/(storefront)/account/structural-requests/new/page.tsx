import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getProductTypes } from "@/features/customer/catalog/api.server";
import { RequestStructure } from "@/features/customer/structural/RequestStructure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("styles.request");
  return { title: t("newTitle"), robots: { index: false, follow: false } };
}

/** "ไม่เจอแบบที่ต้องการ" — ask getpack's structural designers for a box (U3.6, D-273). Signed in. */
export default async function Page() {
  await requireCustomer();
  const [t, locale, types] = await Promise.all([getTranslations("styles.request"), getLocale(), getProductTypes()]);
  const options = types.map((type) => ({ value: type.code, label: locale === "en" ? type.nameEn : type.nameTh }));
  const steps = [t("steps.submitted"), t("steps.assigned"), t("steps.approved"), t("steps.published")];
  return (
    <div>
      <AccountHeader
        back={{ href: "/account/structural-requests", label: t("back") }}
        title={t("newTitle")}
        lede={t("newIntro")}
      />
      {/* Project B3: the form in its card, and beside it what happens after sending — the same steps the
          request's own page tracks. */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="border-border bg-surface rounded-card min-w-0 border p-4 sm:p-6">
          <RequestStructure productTypes={options} />
        </div>
        <aside
          aria-labelledby="structural-how"
          className="bg-primary-subtle text-primary-subtle-fg rounded-card p-5 lg:sticky lg:top-[calc(var(--site-sticky-top,0px)+1rem)]"
        >
          <h2 id="structural-how" className="font-semibold">
            {t("ctaTitle")}
          </h2>
          <p className="mt-1.5 text-sm text-pretty">{t("ctaBody")}</p>
          <ol className="mt-4 flex flex-col gap-3 text-sm">
            {steps.map((label, index) => (
              <li key={label} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="border-primary bg-surface text-primary grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
                >
                  {index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
