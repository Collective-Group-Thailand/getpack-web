export {
  isUpstreamPathAllowed,
  isZone,
  PATH_HEADER,
  upstreamPrefixes,
  ZONE_CONFIG,
  ZONE_HEADER,
  ZONES,
  type Zone,
  type ZoneConfig,
} from "./zones";
export { BROWSER_BFF_PATH, browserBffUrl } from "./zones";
export { isInternalOnlyPath, normaliseHost, resolveZone, type ZoneHosts } from "./resolve";
