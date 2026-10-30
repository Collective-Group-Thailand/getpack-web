import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { ErpSettingsForm, WarehouseManager } from "@/features/partner/erp/ErpSettings";
import { erpWarehouses } from "@/features/partner/erp/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SettingsFrame } from "@/features/partner/settings/SettingsFrame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.settings"))("title") };
}

/** The factory's warehouses, document numbering and stock rules (D-318, D-320, D-322, D-323, D-325). */
export default async function ErpSettingsPage() {
  const [t, tSettings, context] = await Promise.all([
    getTranslations("partnerErp.settings"),
    getTranslations("partnerAccount.settings"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [settings, warehouses] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/settings", {
        params: { path: { factoryId: context.factoryId } },
      });
      return { settings: data!, etag: response.headers.get("etag") };
    }),
    attempt(() => erpWarehouses(contract, context.factoryId)),
  ]);
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      back={{ href: "/settings", label: tSettings("title") }}
    >
      <SettingsFrame current="erp">
        <PartnerSection title={t("warehouses")} description={t("warehousesBody")}>
          {warehouses.data ? (
            <WarehouseManager warehouses={warehouses.data} canEdit={canAt(context, "factory_inventory.manage")} />
          ) : (
            <PageError error={warehouses.error} />
          )}
        </PartnerSection>
        {settings.data ? (
          <ErpSettingsForm
            settings={settings.data.settings}
            etag={settings.data.etag}
            canEdit={canAt(context, "factory_erp.configure")}
          />
        ) : (
          <PageError error={settings.error} />
        )}
      </SettingsFrame>
    </PartnerPage>
  );
}
