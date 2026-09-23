/**
 * GENERATED FILE — do not edit.
 * Source: contract/openapi.json (packio-api 0.1.0) · Regenerate: pnpm gen:api · Gate: pnpm gen:api --check
 */

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check the API and its dependencies
         * @description Pings PostgreSQL, Redis and object storage (S3) with a 2 s timeout each. 200 when all are up; 503 `service.unavailable` when any is down. Unauthenticated and not rate limited, for load balancers.
         *
         *     Implements: ADR-0001, ADR-0003.
         */
        get: operations["ops.health.check"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in staff member with menu entitlements
         * @description Roles (D-140), effective permissions, the admin-zone menu entries those permissions open, and the feature flags enabled for this user. Cost and margin permissions follow D-141.
         *
         *     Implements: ADR-0004, D-140, D-141.
         */
        get: operations["admin.me.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/.well-known/jwks.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Public keys that verify access tokens
         * @description JWKS of the Ed25519 keys (EdDSA) that sign access tokens; during rotation it lists old and new keys.
         *
         *     Implements: ADR-0004.
         */
        get: operations["auth.tokens.jwks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/customer/firebase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in with Google or Apple (Firebase ID token)
         * @description Exchanges a Firebase Auth ID token. A known identity signs in its customer; a new one is linked to the signed-in customer when a customer bearer token is sent, otherwise a new customer is created. Accounts are never linked by e-mail alone.
         *
         *     Implements: ADR-0004.
         */
        post: operations["auth.customer.firebase"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/customer/line": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in with LINE (LINE Login or LIFF)
         * @description Send a LINE Login `idToken` (web) or a `liffAccessToken` (inside LINE, D-151). A known LINE account signs in its customer. A new one is linked: to the signed-in customer (bearer token), else to the customer of a verified `link_phone` OTP (`otpChallengeId` + `otpCode`, account created if new), else a new customer is created.
         *
         *     Implements: ADR-0004, D-151.
         */
        post: operations["auth.customer.line"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/customer/otp/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a one-time code by SMS
         * @description Sends a 6-digit code to the phone (ThaiBulkSMS; SMS is used for OTP per D-143). Limits from `auth.otp_policy`: resend cool-down, requests per phone and per IP per hour → 429 `auth.otp_rate_limited` with `Retry-After`. `purpose: link_phone` verifies a phone to link a LINE account.
         *
         *     Implements: ADR-0004, D-143.
         */
        post: operations["auth.customer.requestOtp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/customer/otp/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in with the SMS code
         * @description Checks the code (limited attempts per challenge; a code works once). Signs in the customer with that phone, creating the account on first use (`customer.registered` event).
         *
         *     Implements: ADR-0004.
         */
        post: operations["auth.customer.verifyOtp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign out (revoke the session)
         * @description Revokes the session of the refresh token, including access tokens already issued for it. Unknown or already revoked tokens also return 204.
         *
         *     Implements: ADR-0004.
         */
        post: operations["auth.tokens.logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/partner/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in a partner-factory user
         * @description Either e-mail + password, or e-mail + `deviceId` + `pin` on a device whose PIN the user registered (`POST /v1/partner/me/device-pins`). The token carries the factory scopes of the user's roles (`factory:<uuid>`); a user without an available factory scope is refused with `auth.scope_unavailable`.
         *
         *     Implements: ADR-0004, D-140, D-011.
         */
        post: operations["auth.partner.login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate a refresh token
         * @description Exchanges a refresh token for a new token pair; the old refresh token stops working. Presenting a refresh token that was already used revokes the whole session (`auth.refresh_reused`, theft detection).
         *
         *     Implements: ADR-0004.
         */
        post: operations["auth.tokens.refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/staff/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in a Packio staff member
         * @description E-mail + password (argon2id). Returns a staff-audience token pair (contract §4). Repeated failures lock the account for a while (`auth.password_lockout`); unknown e-mails and wrong passwords return the same problem.
         *
         *     Implements: ADR-0004, D-140.
         */
        post: operations["auth.staff.login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get a token for a partner machine client (OAuth2 client credentials)
         * @description RFC 6749 §4.4 for factory systems. Client id and secret in HTTP Basic auth or in the body. The response follows RFC 6749 (snake_case fields); errors are problem details like every other endpoint. The partner-audience token carries the client's factory scope; there is no refresh token.
         *
         *     Implements: ADR-0004.
         */
        post: operations["auth.tokens.clientCredentials"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in factory user and their factories
         * @description Roles per factory (D-140). Only the factories in the token scope are listed.
         *
         *     Implements: ADR-0004, D-140.
         */
        get: operations["partner.me.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/me/device-pins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register a PIN for this device
         * @description Lets a factory user sign in on a shared shop-floor device with e-mail + PIN (`auth.device_pin_policy`). Replaces any earlier PIN of the same device.
         *
         *     Implements: ADR-0004.
         */
        post: operations["partner.me.setDevicePin"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/me/device-pins/{deviceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove the PIN of a device
         * @description PIN sign-in stops working on that device.
         *
         *     Implements: ADR-0004.
         */
        delete: operations["partner.me.removeDevicePin"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in customer
         * @description Profile, linked sign-in methods and company scopes of the signed-in customer.
         *
         *     Implements: ADR-0004, D-140.
         */
        get: operations["store.me.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AdminMeDto: {
            /** @example ผู้ใช้ ทดสอบ */
            displayName: string;
            /** @example user.one@example.com */
            email: string | null;
            /**
             * @description Feature flags enabled for this user
             * @example []
             */
            featureFlags: string[];
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            id: string;
            /** @example th */
            locale: components["schemas"]["LocaleCode"];
            /** @description Admin-zone menu entries this user may open */
            menu: components["schemas"]["MenuEntryDto"][];
            /** @example [] */
            permissions: string[];
            /** @example [] */
            roles: string[];
        };
        ClientCredentialsDto: {
            /**
             * @description Or send it in HTTP Basic auth
             * @example pc_example_factory_erp
             */
            client_id?: string;
            /**
             * Format: password
             * @description Or send it in HTTP Basic auth
             * @example example-client-secret
             */
            client_secret?: string;
            /** @example client_credentials */
            grant_type: components["schemas"]["OAuthGrantType"];
            /**
             * @description Ignored: the token always carries the client’s configured scopes
             * @example jobs.read
             */
            scope?: string;
        };
        ClientCredentialsTokenDto: {
            /** @example eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl */
            access_token: string;
            /**
             * @description Seconds
             * @example 600
             */
            expires_in: number;
            /**
             * @description Space-separated scopes
             * @example factory:0192f3a0-7c1e-7d2a-9b1f-000000000f01
             */
            scope: string;
            /** @example Bearer */
            token_type: components["schemas"]["OAuthTokenType"];
        };
        DevicePinDto: {
            /** @example tablet-line-2 */
            deviceId: string;
            /** @example 123456 */
            pin: string;
        };
        FactoryAccessDto: {
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-000000000f01
             */
            factoryId: string;
            /**
             * @example [
             *       "factory_owner"
             *     ]
             */
            roles: string[];
        };
        FirebaseLoginDto: {
            /**
             * @description Firebase Auth ID token (Google or Apple)
             * @example eyJhbGciOiJSUzI1NiIsImtpZCI6ImV4YW1wbGUifQ.eyJzdWIiOiJleGFtcGxlIn0.c2ln
             */
            idToken: string;
        };
        HealthIndicatorState: {
            /** @example up */
            status: components["schemas"]["HealthIndicatorStatus"];
        };
        /** @enum {string} */
        HealthIndicatorStatus: "up" | "down" | "degraded";
        HealthResponse: {
            /**
             * @description Every dependency, by name
             * @example {
             *       "database": {
             *         "status": "up"
             *       },
             *       "redis": {
             *         "status": "up"
             *       },
             *       "storage": {
             *         "status": "up"
             *       }
             *     }
             */
            details: {
                [key: string]: components["schemas"]["HealthIndicatorState"];
            };
            /**
             * @description Dependencies that are down, by name
             * @example {}
             */
            error?: {
                [key: string]: components["schemas"]["HealthIndicatorState"];
            };
            /**
             * @description Dependencies that are up, by name
             * @example {
             *       "database": {
             *         "status": "up"
             *       },
             *       "redis": {
             *         "status": "up"
             *       },
             *       "storage": {
             *         "status": "up"
             *       }
             *     }
             */
            info?: {
                [key: string]: components["schemas"]["HealthIndicatorState"];
            };
            /** @example ok */
            status: components["schemas"]["HealthStatus"];
        };
        /** @enum {string} */
        HealthStatus: "ok" | "error" | "shutting_down";
        /** @enum {string} */
        IdentityProvider: "phone_otp" | "firebase_google" | "firebase_apple" | "line";
        JwkDto: {
            /** @example EdDSA */
            alg: string;
            /** @example Ed25519 */
            crv: string;
            /** @example packio-2026-09 */
            kid: string;
            /** @example OKP */
            kty: string;
            /** @example sig */
            use: string;
            /** @example 11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo */
            x: string;
        };
        JwksDto: {
            keys: components["schemas"]["JwkDto"][];
        };
        LineLoginDto: {
            /**
             * @description LINE Login ID token (web)
             * @example eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJleGFtcGxlIn0.c2ln
             */
            idToken?: string;
            /**
             * @description LIFF access token (inside LINE, D-151)
             * @example liff-access-token-example
             */
            liffAccessToken?: string;
            /**
             * Format: uuid
             * @description Verified `link_phone` challenge to link to that phone
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000c0de
             */
            otpChallengeId?: string;
            /** @example 123456 */
            otpCode?: string;
        };
        LinkedIdentityDto: {
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            linkedAt: string;
            /** @example line */
            provider: components["schemas"]["IdentityProvider"];
        };
        /** @enum {string} */
        LocaleCode: "th" | "en";
        MenuEntryDto: {
            /**
             * @description Stable key; the frontend owns the label
             * @example approvals
             */
            key: string;
            /** @example /admin/approvals */
            path: string;
        };
        /** @enum {string} */
        OAuthGrantType: "client_credentials";
        /** @enum {string} */
        OAuthTokenType: "Bearer";
        OtpChallengeDto: {
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000c0de
             */
            challengeId: string;
            /**
             * Format: date-time
             * @example 2026-09-23T14:10:00+07:00
             */
            expiresAt: string;
            /**
             * Format: date-time
             * @description When a new code may be requested
             * @example 2026-09-23T14:06:00+07:00
             */
            resendAvailableAt: string;
        };
        OtpRequestDto: {
            /**
             * @description Thai mobile or E.164 number
             * @example 081-000-1234
             */
            phone: string;
            /**
             * @description `link_phone` = verify a phone to link a LINE account to it
             * @default login
             * @example login
             */
            purpose: components["schemas"]["OtpRequestPurpose"];
        };
        /**
         * @description `link_phone` = verify a phone to link a LINE account to it
         * @enum {string}
         */
        OtpRequestPurpose: "login" | "link_phone";
        OtpVerifyDto: {
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000c0de
             */
            challengeId: string;
            /** @example 123456 */
            code: string;
        };
        PartnerLoginDto: {
            /**
             * @description Device-PIN login: the registered device id
             * @example tablet-line-2
             */
            deviceId?: string;
            /**
             * Format: email
             * @example planner@factory.example
             */
            email: string;
            /**
             * Format: password
             * @description Password login
             * @example correct horse battery staple
             */
            password?: string;
            /**
             * @description Device-PIN login: the PIN (`auth.device_pin_policy`)
             * @example 123456
             */
            pin?: string;
        };
        PartnerMeDto: {
            /** @example ผู้ใช้ ทดสอบ */
            displayName: string;
            /** @example user.one@example.com */
            email: string | null;
            /** @description Factories this user acts for (token scopes) */
            factories: components["schemas"]["FactoryAccessDto"][];
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            id: string;
            /** @example th */
            locale: components["schemas"]["LocaleCode"];
            /** @example [] */
            permissions: string[];
            /** @example [] */
            roles: string[];
        };
        ProblemDetails: {
            /**
             * @description Stable machine-readable code; never renamed.
             * @example order.invalid_transition
             */
            code: string;
            /**
             * @description Localised by `Accept-Language` (`th` default, `en`).
             * @example ไม่สามารถเปลี่ยนสถานะคำสั่งซื้อได้
             */
            detail: string;
            errors?: components["schemas"]["ProblemFieldError"][];
            /** @example 6f1c2d8e-2c7b-4d0e-9d1c-3f1a2b3c4d5e */
            requestId: string;
            /** @example 422 */
            status: number;
            /** @example Invalid order transition */
            title: string;
            /** @example https://errors.packio/order.invalid_transition */
            type: string;
        };
        ProblemFieldError: {
            /**
             * @description Machine-readable rule that failed, e.g. `min`, `isUuid`.
             * @example min
             */
            code: string;
            /** @example quantity must not be less than 1 */
            message: string;
            /**
             * @description Path of the offending field, e.g. `items[0].quantity`.
             * @example items[0].quantity
             */
            path: string;
        };
        RefreshDto: {
            /** @example rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0 */
            refreshToken: string;
        };
        StaffLoginDto: {
            /**
             * Format: email
             * @example finance.one@example.com
             */
            email: string;
            /**
             * Format: password
             * @example correct horse battery staple
             */
            password: string;
        };
        StoreMeDto: {
            /** @example ผู้ใช้ ทดสอบ */
            displayName: string;
            /** @example user.one@example.com */
            email: string | null;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            id: string;
            identities: components["schemas"]["LinkedIdentityDto"][];
            /** @example th */
            locale: components["schemas"]["LocaleCode"];
            /** @example [] */
            permissions: string[];
            /**
             * @description E.164
             * @example +66810001234
             */
            phone: string | null;
            /** @example [] */
            roles: string[];
            /**
             * @description Company scopes (`company:<uuid>`) of B2B members
             * @example []
             */
            scopes: string[];
        };
        /** @enum {string} */
        TokenAudience: "customer" | "staff" | "partner";
        TokenPairDto: {
            /**
             * @description EdDSA JWT, 10–15 minutes (ADR-0004)
             * @example eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl
             */
            accessToken: string;
            /**
             * Format: date-time
             * @example 2026-09-23T14:15:00+07:00
             */
            accessTokenExpiresAt: string;
            /**
             * @description Opaque, single use; rotate with `POST /v1/auth/refresh`
             * @example rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0
             */
            refreshToken: string;
            /**
             * Format: date-time
             * @description Idle expiry; each refresh extends it up to the absolute session lifetime
             * @example 2026-09-23T16:05:00+07:00
             */
            refreshTokenExpiresAt: string;
            subject: components["schemas"]["TokenSubjectDto"];
        };
        TokenSubjectDto: {
            /**
             * Format: uuid
             * @description Public id of the user (JWT `sub`)
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            id: string;
            /**
             * @description Permission keys `resource.action`
             * @example [
             *       "approvals.act",
             *       "approvals.read"
             *     ]
             */
            permissions: string[];
            /**
             * @description Role keys (D-140)
             * @example [
             *       "finance"
             *     ]
             */
            roles: string[];
            /**
             * @description Scopes such as `factory:<uuid>` or `company:<uuid>`
             * @example []
             */
            scopes: string[];
            /** @example staff */
            type: components["schemas"]["TokenAudience"];
        };
    };
    responses: never;
    parameters: {
        /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
        AcceptLanguage: string;
    };
    requestBodies: never;
    headers: {
        /** @description Requests allowed in the current window. */
        RateLimitLimit: number;
        /** @description Requests left in the current window. */
        RateLimitRemaining: number;
        /** @description Seconds until the window resets. */
        RateLimitReset: number;
        /** @description Seconds to wait before retrying. */
        RetryAfter: number;
        /** @description Request id (echoes a valid incoming `X-Request-Id`); also in every problem as `requestId`. */
        XRequestId: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "ops.health.check": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All dependencies are up */
            200: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "details": {
                     *         "database": {
                     *           "status": "up"
                     *         },
                     *         "redis": {
                     *           "status": "up"
                     *         },
                     *         "storage": {
                     *           "status": "up"
                     *         }
                     *       },
                     *       "error": {},
                     *       "info": {
                     *         "database": {
                     *           "status": "up"
                     *         },
                     *         "redis": {
                     *           "status": "up"
                     *         },
                     *         "storage": {
                     *           "status": "up"
                     *         }
                     *       },
                     *       "status": "ok"
                     *     }
                     */
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `service.unavailable` */
            503: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "admin.me.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The staff member */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "displayName": "การเงิน ทดสอบ",
                     *       "email": "finance.one@example.com",
                     *       "featureFlags": [],
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "locale": "th",
                     *       "menu": [
                     *         {
                     *           "key": "dashboard",
                     *           "path": "/admin"
                     *         },
                     *         {
                     *           "key": "approvals",
                     *           "path": "/admin/approvals"
                     *         },
                     *         {
                     *           "key": "audit_logs",
                     *           "path": "/admin/audit-logs"
                     *         }
                     *       ],
                     *       "permissions": [
                     *         "approvals.act",
                     *         "approvals.read",
                     *         "audit_logs.read"
                     *       ],
                     *       "roles": [
                     *         "finance"
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["AdminMeDto"];
                };
            };
            /** @description Problem: `auth.session_revoked`, `auth.token_expired`, `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden`, `auth.wrong_audience` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.tokens.jwks": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Key set */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "keys": [
                     *         {
                     *           "alg": "EdDSA",
                     *           "crv": "Ed25519",
                     *           "kid": "packio-2026-09",
                     *           "kty": "OKP",
                     *           "use": "sig",
                     *           "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["JwksDto"];
                };
            };
            /** @description Problem: `http.not_found` */
            404: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.customer.firebase": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FirebaseLoginDto"];
            };
        };
        responses: {
            /** @description Signed in */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0",
                     *       "refreshTokenExpiresAt": "2026-09-23T16:05:00+07:00",
                     *       "subject": {
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *         "permissions": [],
                     *         "roles": [],
                     *         "scopes": [],
                     *         "type": "customer"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPairDto"];
                };
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.identity_token_invalid`, `auth.token_expired`, `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.account_inactive` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.identity_linked_elsewhere` */
            409: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `provider.unavailable` */
            503: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.customer.line": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LineLoginDto"];
            };
        };
        responses: {
            /** @description Signed in */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0",
                     *       "refreshTokenExpiresAt": "2026-09-23T16:05:00+07:00",
                     *       "subject": {
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *         "permissions": [],
                     *         "roles": [],
                     *         "scopes": [],
                     *         "type": "customer"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPairDto"];
                };
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.identity_token_invalid`, `auth.token_expired`, `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.account_inactive` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.identity_linked_elsewhere` */
            409: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.otp_expired`, `auth.otp_invalid`, `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `provider.unavailable` */
            503: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.customer.requestOtp": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OtpRequestDto"];
            };
        };
        responses: {
            /** @description Code sent */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "challengeId": "0192f3a0-7c1e-7d2a-9b1f-00000000c0de",
                     *       "expiresAt": "2026-09-23T14:10:00+07:00",
                     *       "resendAvailableAt": "2026-09-23T14:06:00+07:00"
                     *     }
                     */
                    "application/json": components["schemas"]["OtpChallengeDto"];
                };
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.otp_rate_limited`, `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `provider.unavailable` */
            503: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.customer.verifyOtp": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OtpVerifyDto"];
            };
        };
        responses: {
            /** @description Signed in */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0",
                     *       "refreshTokenExpiresAt": "2026-09-23T16:05:00+07:00",
                     *       "subject": {
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *         "permissions": [],
                     *         "roles": [],
                     *         "scopes": [],
                     *         "type": "customer"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPairDto"];
                };
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.account_inactive` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.otp_expired`, `auth.otp_invalid`, `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.tokens.logout": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshDto"];
            };
        };
        responses: {
            /** @description Signed out */
            204: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.partner.login": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PartnerLoginDto"];
            };
        };
        responses: {
            /** @description Signed in */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0",
                     *       "refreshTokenExpiresAt": "2026-09-23T16:05:00+07:00",
                     *       "subject": {
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *         "permissions": [
                     *           "factory_profile.read",
                     *           "factory_users.manage"
                     *         ],
                     *         "roles": [
                     *           "factory_owner"
                     *         ],
                     *         "scopes": [
                     *           "factory:0192f3a0-7c1e-7d2a-9b1f-000000000f01"
                     *         ],
                     *         "type": "partner"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPairDto"];
                };
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.account_locked`, `auth.invalid_credentials`, `auth.pin_invalid` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.account_inactive`, `auth.scope_unavailable` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.tokens.refresh": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshDto"];
            };
        };
        responses: {
            /** @description New token pair */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0",
                     *       "refreshTokenExpiresAt": "2026-09-23T16:05:00+07:00",
                     *       "subject": {
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *         "permissions": [
                     *           "approvals.act",
                     *           "approvals.read"
                     *         ],
                     *         "roles": [
                     *           "finance"
                     *         ],
                     *         "scopes": [],
                     *         "type": "staff"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPairDto"];
                };
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.refresh_invalid`, `auth.refresh_reused` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.scope_unavailable` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.staff.login": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StaffLoginDto"];
            };
        };
        responses: {
            /** @description Signed in */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0",
                     *       "refreshTokenExpiresAt": "2026-09-23T16:05:00+07:00",
                     *       "subject": {
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *         "permissions": [
                     *           "approvals.act",
                     *           "approvals.read"
                     *         ],
                     *         "roles": [
                     *           "finance"
                     *         ],
                     *         "scopes": [],
                     *         "type": "staff"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPairDto"];
                };
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.account_locked`, `auth.invalid_credentials` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.account_inactive` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "auth.tokens.clientCredentials": {
        parameters: {
            query?: never;
            header: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClientCredentialsDto"];
                "application/x-www-form-urlencoded": components["schemas"]["ClientCredentialsDto"];
            };
        };
        responses: {
            /** @description Access token */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "access_token": "eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl",
                     *       "expires_in": 600,
                     *       "scope": "factory:0192f3a0-7c1e-7d2a-9b1f-000000000f01",
                     *       "token_type": "Bearer"
                     *     }
                     */
                    "application/json": components["schemas"]["ClientCredentialsTokenDto"];
                };
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.invalid_client` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.scope_unavailable` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "partner.me.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The factory user */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "displayName": "โรงงาน ทดสอบ",
                     *       "email": "planner@factory.example",
                     *       "factories": [
                     *         {
                     *           "factoryId": "0192f3a0-7c1e-7d2a-9b1f-000000000f01",
                     *           "roles": [
                     *             "factory_planner"
                     *           ]
                     *         }
                     *       ],
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "locale": "th",
                     *       "permissions": [
                     *         "factory_profile.read"
                     *       ],
                     *       "roles": [
                     *         "factory_planner"
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["PartnerMeDto"];
                };
            };
            /** @description Problem: `auth.session_revoked`, `auth.token_expired`, `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden`, `auth.wrong_audience` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "partner.me.setDevicePin": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DevicePinDto"];
            };
        };
        responses: {
            /** @description PIN registered */
            204: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Problem: `http.bad_request`, `http.malformed_json` */
            400: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.token_expired`, `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "partner.me.removeDevicePin": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                deviceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PIN removed */
            204: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Problem: `auth.token_expired`, `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `validation.failed` */
            422: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    "store.me.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The customer */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "displayName": "ลูกค้า ทดสอบ",
                     *       "email": "customer.one@example.com",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "identities": [
                     *         {
                     *           "linkedAt": "2026-09-23T14:05:00+07:00",
                     *           "provider": "phone_otp"
                     *         }
                     *       ],
                     *       "locale": "th",
                     *       "permissions": [],
                     *       "phone": "+66810001234",
                     *       "roles": [],
                     *       "scopes": []
                     *     }
                     */
                    "application/json": components["schemas"]["StoreMeDto"];
                };
            };
            /** @description Problem: `auth.session_revoked`, `auth.token_expired`, `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden`, `auth.wrong_audience` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `http.too_many_requests` */
            429: {
                headers: {
                    "Retry-After": components["headers"]["RetryAfter"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `internal.unexpected` */
            500: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
}
