/** The agent code a visitor arrived with (`/a/{code}`), until it is claimed after sign-in (D-417). */
export const AGENT_COOKIE = "pk_agent";
/**
 * How long a visit through an agent link is remembered: the programme's `agents.rules.linkCookieDays`
 * as seeded (90). The link is set before anyone signs in, when the setting cannot be read; the claim
 * itself is decided by the API.
 */
export const AGENT_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;
