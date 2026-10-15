"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ifMatch } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { useCan } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { loose } from "../../catalogue/api";
import { factoryWithEtag } from "../FactoryWorkspace";
import { useFactoryPart, useFactoryRefresh } from "../hooks";
import { FormDialog, Section } from "../parts";
import type { Factory } from "../resources";

type Address = Schemas["CreateFactoryAddressDto"];
type Contact = Schemas["CreateFactoryContactDto"];

/** Who the factory is: the legal entity (edited under its ETag), its addresses and contacts. */
export function Profile({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.profile");
  const canManage = useCan("partners.manage");
  const refresh = useFactoryRefresh(factory.id);
  const addresses = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/addresses");
  const contacts = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/contacts");
  const [open, setOpen] = useState<"company" | "address" | "contact" | null>(null);
  // The address or contact being edited (PATCH); null adds a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [company, setCompany] = useState(factory);
  const [address, setAddress] = useState<Address>({
    kind: "plant",
    line1: "",
    line2: null,
    postcode: null,
    subdistrictId: null,
    lat: null,
    lng: null,
  });
  const [contact, setContact] = useState<Contact>({
    name: "",
    roleTitle: null,
    phone: null,
    email: null,
    isPrimary: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("company")}
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart="edit"
              onClick={() => {
                setCompany(factory);
                setOpen("company");
              }}
            >
              {t("edit")}
            </Button>
          ) : null
        }
      >
        <DescriptionList
          columns={3}
          items={[
            { term: t("legalName"), description: factory.legalName, wide: true },
            { term: t("tradeName"), description: factory.tradeName ?? "–" },
            { term: t("taxId"), description: <span className="font-mono">{factory.taxId}</span> },
            { term: t("branchCode"), description: <span className="font-mono">{factory.branchCode}</span> },
            { term: t("juristicType"), description: t(`juristic.${factory.juristicType}`) },
            {
              term: t("vat"),
              description: factory.isVatRegistered
                ? t("vatSince", { date: factory.vatRegisteredOn ?? "–" })
                : t("notVat"),
            },
            { term: t("lineGroup"), description: factory.lineGroupId ?? "–" },
          ]}
        />
      </Section>

      <Section
        title={t("addresses")}
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart="plus"
              onClick={() => {
                setEditingId(null);
                setAddress({
                  kind: "plant",
                  line1: "",
                  line2: null,
                  postcode: null,
                  subdistrictId: null,
                  lat: null,
                  lng: null,
                });
                setOpen("address");
              }}
            >
              {t("addAddress")}
            </Button>
          ) : null
        }
      >
        <ul className="divide-border divide-y text-sm">
          {(addresses.data ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
              <Badge size="sm">{t(`addressKinds.${item.kind}`)}</Badge>
              <span>{[item.line1, item.line2, item.postcode].filter(Boolean).join(" ")}</span>
              {canManage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => {
                    setEditingId(item.id);
                    setAddress({
                      kind: item.kind,
                      line1: item.line1,
                      line2: item.line2,
                      postcode: item.postcode,
                      subdistrictId: item.subdistrictId,
                      lat: item.lat,
                      lng: item.lng,
                    });
                    setOpen("address");
                  }}
                >
                  {t("edit")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={t("contacts")}
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart="plus"
              onClick={() => {
                setEditingId(null);
                setContact({ name: "", roleTitle: null, phone: null, email: null, isPrimary: false });
                setOpen("contact");
              }}
            >
              {t("addContact")}
            </Button>
          ) : null
        }
      >
        <ul className="divide-border divide-y text-sm">
          {(contacts.data ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium">{item.name}</span>
              {item.roleTitle ? <span className="text-muted">{item.roleTitle}</span> : null}
              {item.isPrimary ? (
                <Badge size="sm" tone="primary">
                  {t("primary")}
                </Badge>
              ) : null}
              <span className="text-muted">{[item.phone, item.email].filter(Boolean).join(" · ")}</span>
              {canManage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => {
                    setEditingId(item.id);
                    setContact({
                      name: item.name,
                      roleTitle: item.roleTitle,
                      phone: item.phone,
                      email: item.email,
                      isPrimary: item.isPrimary,
                    });
                    setOpen("contact");
                  }}
                >
                  {t("edit")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {open === "company" ? (
        <FormDialog
          title={t("editTitle")}
          description={t("editBody", { code: factory.code })}
          submitLabel={t("save")}
          onClose={() => setOpen(null)}
          onSubmit={async () => {
            const { etag } = await factoryWithEtag(factory.id);
            await loose(adminBrowserApis().contract).PATCH("/v1/admin/factories/{factoryId}", {
              params: { path: { factoryId: factory.id } },
              body: {
                legalName: company.legalName,
                tradeName: company.tradeName?.trim() || null,
                taxId: company.taxId,
                branchCode: company.branchCode,
                juristicType: company.juristicType,
                isVatRegistered: company.isVatRegistered,
                vatRegisteredOn: company.isVatRegistered ? company.vatRegisteredOn : null,
                lineGroupId: company.lineGroupId?.trim() || null,
                onboardingMode: company.onboardingMode,
              },
              headers: ifMatch(etag),
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("legalName")} required>
            <Input
              value={company.legalName}
              onChange={(event) => setCompany({ ...company, legalName: event.target.value })}
            />
          </Field>
          <Field label={t("tradeName")}>
            <Input
              value={company.tradeName ?? ""}
              onChange={(event) => setCompany({ ...company, tradeName: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("taxId")} required>
              <Input
                inputMode="numeric"
                value={company.taxId}
                onChange={(event) => setCompany({ ...company, taxId: event.target.value })}
              />
            </Field>
            <Field label={t("branchCode")} required>
              <Input
                inputMode="numeric"
                value={company.branchCode}
                onChange={(event) => setCompany({ ...company, branchCode: event.target.value })}
              />
            </Field>
          </div>
          <Switch
            label={t("vatRegistered")}
            checked={company.isVatRegistered}
            onCheckedChange={(checked) => setCompany({ ...company, isVatRegistered: checked })}
          />
        </FormDialog>
      ) : null}

      {open === "address" ? (
        <FormDialog
          title={editingId ? t("editAddress") : t("addAddress")}
          submitLabel={t("save")}
          onClose={() => setOpen(null)}
          onSubmit={async () => {
            if (editingId)
              await adminBrowserApis().contract.PATCH("/v1/admin/factories/{factoryId}/addresses/{addressId}", {
                params: { path: { factoryId: factory.id, addressId: editingId } },
                body: address,
              });
            else
              await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/addresses", {
                params: { path: { factoryId: factory.id } },
                body: address,
              });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("addressKind")}>
            <SearchableSelect
              value={address.kind}
              onValueChange={(kind) => setAddress({ ...address, kind: kind as Address["kind"] })}
              options={(["registered", "plant", "pickup"] as const).map((value) => ({
                value,
                label: t(`addressKinds.${value}`),
              }))}
            />
          </Field>
          <Field label={t("line1")} required>
            <Input value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} />
          </Field>
          <Field label={t("line2")}>
            <Input
              value={address.line2 ?? ""}
              onChange={(event) => setAddress({ ...address, line2: event.target.value || null })}
            />
          </Field>
          <Field label={t("postcode")}>
            <Input
              inputMode="numeric"
              value={address.postcode ?? ""}
              onChange={(event) => setAddress({ ...address, postcode: event.target.value || null })}
            />
          </Field>
        </FormDialog>
      ) : null}

      {open === "contact" ? (
        <FormDialog
          title={editingId ? t("editContact") : t("addContact")}
          submitLabel={t("save")}
          onClose={() => setOpen(null)}
          onSubmit={async () => {
            if (editingId)
              await adminBrowserApis().contract.PATCH("/v1/admin/factories/{factoryId}/contacts/{contactId}", {
                params: { path: { factoryId: factory.id, contactId: editingId } },
                body: contact,
              });
            else
              await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/contacts", {
                params: { path: { factoryId: factory.id } },
                body: contact,
              });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("contactName")} required>
            <Input value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} />
          </Field>
          <Field label={t("roleTitle")}>
            <Input
              value={contact.roleTitle ?? ""}
              onChange={(event) => setContact({ ...contact, roleTitle: event.target.value || null })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("phone")}>
              <Input
                inputMode="tel"
                value={contact.phone ?? ""}
                onChange={(event) => setContact({ ...contact, phone: event.target.value || null })}
              />
            </Field>
            <Field label={t("email")}>
              <Input
                type="email"
                value={contact.email ?? ""}
                onChange={(event) => setContact({ ...contact, email: event.target.value || null })}
              />
            </Field>
          </div>
          <Switch
            label={t("primary")}
            checked={contact.isPrimary ?? false}
            onCheckedChange={(checked) => setContact({ ...contact, isPrimary: checked })}
          />
        </FormDialog>
      ) : null}
    </div>
  );
}
