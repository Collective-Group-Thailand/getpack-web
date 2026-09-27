"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getActor } from "@/lib/auth/actor";

import { FACTORY_COOKIE } from "./cookie";

/**
 * Acts for another of the user's factories. Only a factory in their own `/me` scopes is
 * accepted — the cookie is a preference, not a permission, and the API checks the token's
 * scopes on every call regardless (D-044).
 */
export async function chooseFactory(formData: FormData): Promise<void> {
  const factoryId = String(formData.get("factoryId") ?? "");
  const actor = await getActor("partner");
  if (!actor?.factories.some((factory) => factory.factoryId === factoryId)) return;
  (await cookies()).set(FACTORY_COOKIE, factoryId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}
