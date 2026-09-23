import type { OtpChallenge } from "@/lib/api/types";

export type { OtpChallenge };

/**
 * How many digits the SMS code has.
 *
 * `OtpChallengeDto` does not carry it, so there is nothing to read. Six is what packio-api's
 * B1-foundation prompt specifies, and it is named once here rather than spelled into the
 * markup — `docs/contract-requests.md` asks for it on the challenge so the UI can stop
 * assuming.
 *
 * It lives here rather than beside the actions because a `"use server"` module may only
 * export async functions; a constant in one is a build error.
 */
export const OTP_CODE_LENGTH = 6;
