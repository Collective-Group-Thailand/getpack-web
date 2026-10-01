"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";

export type PostcodeArea = Schemas["StorePostcodeAreaDto"];

/** The area an address is filed under: the ids the API takes and the postcode they match. */
export interface ChosenArea {
  postcode: string;
  provinceId: string;
  subdistrictId: string;
}

/**
 * The areas a five-digit postcode covers (`store.catalog.lookupPostcode`, D-161): each sub-district
 * with its district and province, and the ids an address, a tax profile or a branch is filed under.
 */
export function usePostcodeAreas(postcode: string) {
  return useQuery({
    queryKey: queryKeys.detail("customer", "postcode", postcode),
    enabled: /^\d{5}$/.test(postcode),
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: async (): Promise<PostcodeArea[]> =>
      (
        await browserApi().GET("/v1/store/catalog/geo/postcodes/{postcode}", {
          params: { path: { postcode } },
        })
      ).data ?? [],
  });
}

/**
 * The postcode first, then its sub-district (design-system.md §3 "AddressForm"): the postcode names
 * the province and district and offers its sub-districts, so nobody types a province. A postcode
 * with one sub-district picks it at once.
 */
export function PostcodeAreaField({
  postcode,
  subdistrictId,
  onChange,
  errors,
}: {
  postcode: string;
  subdistrictId: string;
  onChange: (next: { postcode: string; area: ChosenArea | null }) => void;
  errors?: { postcode?: string; subdistrict?: string };
}) {
  const t = useTranslations("account.area");
  const locale = useLocale();
  const areas = usePostcodeAreas(postcode);
  const list = areas.data ?? [];
  const chosen =
    list.find((area) => area.subdistrict.id === subdistrictId) ?? (list.length === 1 ? list[0] : undefined);
  const name = (ref: { nameTh: string; nameEn: string }) => pick(locale, ref.nameTh, ref.nameEn);
  const choose = (area: PostcodeArea | undefined) =>
    onChange({
      postcode,
      area: area ? { postcode, provinceId: area.province.id, subdistrictId: area.subdistrict.id } : null,
    });

  // A postcode with one sub-district picks it at once — the form is told, not only the select.
  const only = list.length === 1 ? list[0] : undefined;
  useEffect(() => {
    if (only && only.subdistrict.id !== subdistrictId)
      onChange({
        postcode,
        area: { postcode, provinceId: only.province.id, subdistrictId: only.subdistrict.id },
      });
  }, [only, subdistrictId, postcode, onChange]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={t("postcode")}
        hint={t("postcodeHint")}
        error={errors?.postcode}
        required
        requiredLabel={t("requiredMark")}
      >
        <Input
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          value={postcode}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 5);
            onChange({ postcode: next, area: null });
          }}
        />
      </Field>
      <Field
        label={t("subdistrict")}
        error={errors?.subdistrict ?? (areas.isSuccess && list.length === 0 ? t("unknown") : undefined)}
        required
        requiredLabel={t("requiredMark")}
      >
        <Select
          value={chosen?.subdistrict.id}
          onValueChange={(id) => choose(list.find((area) => area.subdistrict.id === id))}
          placeholder={t("choose")}
          disabled={list.length === 0}
          options={list.map((area) => ({
            value: area.subdistrict.id,
            label: `${name(area.subdistrict)} · ${name(area.district)} · ${name(area.province)}`,
          }))}
        />
      </Field>
    </div>
  );
}
