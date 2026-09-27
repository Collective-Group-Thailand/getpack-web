"use client";

import { createContext, useContext, useMemo } from "react";

interface FactoryValue {
  factoryId: string;
  permissions: readonly string[];
}

const FactoryContext = createContext<FactoryValue | null>(null);

/**
 * The factory the signed-in user is acting for, and what they may do there, for the client
 * islands of the partner zone. Set once by the console layout from `/me`; the API still decides.
 */
export function FactoryProvider({ factoryId, permissions, children }: FactoryValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ factoryId, permissions }), [factoryId, permissions]);
  return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>;
}

export function useFactory() {
  const value = useContext(FactoryContext);
  if (!value) throw new Error("useFactory() outside the partner console");
  return {
    factoryId: value.factoryId,
    can: (permission: string) => value.permissions.includes(permission),
  };
}
