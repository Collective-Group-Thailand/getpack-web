"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { adminBrowserApis } from "../console/api";

export type GeoSubdistrict = Schemas["GeoSubdistrictDto"];
export type GeoDistrict = Schemas["GeoDistrictDto"];
export type GeoProvince = Schemas["GeoProvinceDto"];

/** One subdistrict a postcode covers, with the district and province it sits in. */
export interface PostcodeArea {
  subdistrict: GeoSubdistrict;
  district: GeoDistrict;
  province: GeoProvince;
}

/**
 * The areas a five-digit postcode covers, from the admin-maintained geography (D-161, D-170),
 * with the uuids `admin.customers.createAddress` takes. packio-api answers `admin.geo` with the
 * store's postcode lookup, which carries ids since v0.5.0 (`CodeNameRefDto`) — but it is a
 * `/v1/store` path, and the admin zone's BFF serves the admin surface only. So the desk reads the
 * admin geography, which carries the same ids: the postcode's subdistricts, then their districts
 * and provinces. Needs `catalog.read`, which every role that enters addresses holds.
 */
export function usePostcodeAreas(postcode: string) {
  const valid = /^\d{5}$/.test(postcode);
  return useQuery({
    queryKey: queryKeys.detail("admin", "postcode", postcode),
    enabled: valid,
    staleTime: STALE_TIME.stable,
    retry: false,
    queryFn: async (): Promise<PostcodeArea[]> => {
      const { contract } = adminBrowserApis();
      const subdistricts = (
        await contract.GET("/v1/admin/geography/subdistricts", { params: { query: { postcode, perPage: 100 } } })
      ).data!.data;
      const districts = await Promise.all(
        [...new Set(subdistricts.map((row) => row.districtId))].map(
          async (id) => (await contract.GET("/v1/admin/geography/districts/{id}", { params: { path: { id } } })).data!,
        ),
      );
      const provinces = await Promise.all(
        [...new Set(districts.map((row) => row.provinceId))].map(
          async (id) => (await contract.GET("/v1/admin/geography/provinces/{id}", { params: { path: { id } } })).data!,
        ),
      );
      return subdistricts.flatMap((subdistrict) => {
        const district = districts.find((row) => row.id === subdistrict.districtId);
        const province = provinces.find((row) => row.id === district?.provinceId);
        return district && province ? [{ subdistrict, district, province }] : [];
      });
    },
  });
}

/** A geography row's name in the current locale. */
export function useGeoName() {
  const locale = useLocale();
  return (ref: { nameTh: string; nameEn: string } | null | undefined) =>
    ref ? (locale === "en" ? ref.nameEn : ref.nameTh) : null;
}
