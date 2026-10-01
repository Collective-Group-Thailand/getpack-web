/**
 * How `/v1/partner/me` names a factory (`FactoryAccessDto.code` / `name`, U-B0.3) without the auth
 * mock importing the factory rows: `mocks/auth.ts` is loaded by the rows' own module graph, so a
 * direct import would be a cycle. The partner mocks register the lookup when they load.
 */

type FactoryName = { code: string; name: string };

let lookup: (factoryId: string) => FactoryName | undefined = () => undefined;

export function registerFactoryNames(next: (factoryId: string) => FactoryName | undefined) {
  lookup = next;
}

export const factoryNameOf = (factoryId: string): FactoryName | undefined => lookup(factoryId);
