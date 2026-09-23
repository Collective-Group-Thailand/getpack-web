/**
 * GENERATED FILE — do not edit.
 * Source: mocks/seed-openapi.json — SEED, not agreed by packio-api · Regenerate: pnpm gen:api · Gate: pnpm gen:api --check
 */

export interface paths {
    "/v1/admin/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in staff member, with permissions, menu entitlements and feature flags
         * @description SEED. Requires a `staff` token. The admin sidebar is built from `menu` rather than from hard-coded role checks (F1 1.3); the API stays the enforcement point (ADR-0005).
         */
        get: operations["admin.me.show"];
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
         * Exchange a Firebase ID token (Google or Apple) for a customer session
         * @description SEED. The browser obtains the ID token from the Firebase SDK; this app's server exchanges it, so no provider token ever reaches JS-readable storage.
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
         * Exchange a LINE Login authorisation code or LIFF token for a customer session
         * @description SEED. Covers both LINE Login on the web (authorisation code + redirect URI) and LIFF inside the LINE app (access token). Account linking is the backend's job (D-151, D-135 rewards linking).
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
         * Send a login OTP to a Thai mobile number
         * @description SEED. SMS OTP is the customer's primary sign-in (D-143 lists OTP as one of the critical SMS events). The response carries the policy — code length, expiry, resend cooldown, attempts left — so the UI renders API-owned values instead of hard-coding them (CLAUDE.md). No decision owns these numbers yet; see docs/contract-requests.md.
         */
        post: operations["auth.customer.otp.request"];
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
         * Exchange an OTP for a customer session
         * @description SEED. Issues a token with `aud: customer`, accepted only on `/v1/store/*`.
         */
        post: operations["auth.customer.otp.verify"];
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
         * Revoke the current session
         * @description SEED. Revokes the session behind the refresh token. Idempotent: an unknown or already-revoked token still answers 204, so signing out never fails in the UI.
         */
        post: operations["auth.logout"];
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
         * Sign a partner-factory user in
         * @description SEED. Username + password, with an optional device PIN for shared shop-floor devices. Issues a token with `aud: partner` carrying `factory:<uuid>` scopes.
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
         * Rotate a refresh token for a new session
         * @description SEED. Refresh tokens are opaque, single-use and rotating; presenting an already-rotated token revokes the whole session family (api-conventions §4).
         */
        post: operations["auth.refresh"];
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
         * Sign a staff member in with email and password
         * @description SEED. Email + password (argon2id server side), per packio-api ADR-0004. Issues a token with `aud: staff`, accepted only on `/v1/admin/*`.
         */
        post: operations["auth.staff.login"];
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
         * The signed-in partner-factory user and the factories they may act for
         * @description SEED. Requires a `partner` token. `factories` mirrors the `factory:<uuid>` scopes in the token.
         */
        get: operations["partner.me.show"];
        put?: never;
        post?: never;
        delete?: never;
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
         * @description SEED. Requires a `customer` token.
         */
        get: operations["store.me.show"];
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
        CustomerMe: {
            companies?: {
                /** Format: uuid */
                id: string;
                name: string;
                roles: string[];
            }[];
            displayName: string;
            email?: string;
            /** Format: uuid */
            id: string;
            lineLinked?: boolean;
            /** @enum {string} */
            locale: "th" | "en";
            phone?: string;
            scopes: string[];
            type: components["schemas"]["SubjectType"];
            userCode?: string;
        };
        FirebaseLoginRequest: {
            idToken: string;
        };
        LineLoginRequest: {
            /** @description LIFF access token (in-app flow). */
            accessToken?: string;
            /** @description LINE Login authorisation code (web flow). */
            code?: string;
            /** @description Must match the one used to obtain the code. */
            redirectUri?: string;
        };
        MenuEntitlement: {
            /** @description Optional count key the shell may poll. */
            badge?: string;
            children?: components["schemas"]["MenuEntitlement"][];
            href: string;
            icon?: string;
            /** @description Stable key; the label comes from src/i18n, never from the API. */
            key: string;
        };
        OtpChallenge: {
            attemptsRemaining: number;
            /** @description Digits in the code. The UI sizes its input from this rather than assuming 6. */
            codeLength: number;
            /** Format: date-time */
            expiresAt: string;
            /** @description Shown to the user so they can match the SMS they received. */
            ref: string;
            /** @description Cooldown before Resend is offered again. */
            resendAfterSeconds: number;
        };
        OtpRequest: {
            /** @description Thai mobile number, national or E.164 form; the API normalises it. */
            phone: string;
        };
        OtpVerifyRequest: {
            code: string;
            phone: string;
            ref: string;
        };
        PartnerLoginRequest: {
            /** @description Optional PIN for a shared shop-floor device. */
            devicePin?: string;
            password: string;
            username: string;
        };
        PartnerMe: {
            displayName: string;
            factories: {
                /** Format: uuid */
                id: string;
                name: string;
                status: string;
            }[];
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            locale: "th" | "en";
            permissions: string[];
            roles: string[];
            scopes: string[];
            type: components["schemas"]["SubjectType"];
        };
        ProblemDetails: {
            code: string;
            detail: string;
            errors?: components["schemas"]["ProblemFieldError"][];
            requestId: string;
            status: number;
            title: string;
            type: string;
        };
        ProblemFieldError: {
            code: string;
            message: string;
            /** @description Bracketed path, e.g. items[0].quantity. */
            path: string;
        };
        RefreshRequest: {
            refreshToken: string;
        };
        SessionResponse: {
            accessToken: string;
            /** Format: date-time */
            accessTokenExpiresAt: string;
            refreshToken: string;
            /** Format: date-time */
            refreshTokenExpiresAt: string;
            subject: components["schemas"]["Subject"];
        };
        StaffLoginRequest: {
            /** Format: email */
            email: string;
            password: string;
        };
        StaffMe: {
            displayName: string;
            email?: string;
            features: {
                [key: string]: boolean;
            };
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            locale: "th" | "en";
            menu: components["schemas"]["MenuEntitlement"][];
            permissions: string[];
            roles: string[];
            scopes: string[];
            type: components["schemas"]["SubjectType"];
        };
        Subject: {
            /** Format: uuid */
            id: string;
            permissions: string[];
            roles: string[];
            scopes: string[];
            type: components["schemas"]["SubjectType"];
        };
        /** @enum {string} */
        SubjectType: "customer" | "staff" | "partner";
    };
    responses: {
        /** @description SEED. RFC 9457 problem details (api-conventions §3). */
        Problem: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "https://errors.packio/auth.invalid_credentials",
                 *       "title": "Invalid credentials",
                 *       "status": 401,
                 *       "code": "auth.invalid_credentials",
                 *       "detail": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
                 *       "requestId": "00000000-0000-4000-8000-00000000000e"
                 *     }
                 */
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "admin.me.show": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description SEED. The signed-in staff member. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "00000000-0000-4000-8000-000000000002",
                     *       "type": "staff",
                     *       "displayName": "พนักงานตัวอย่าง (ข้อมูลจำลอง)",
                     *       "email": "seed.staff@packio.invalid",
                     *       "locale": "th",
                     *       "roles": [
                     *         "cs"
                     *       ],
                     *       "permissions": [
                     *         "orders.read",
                     *         "orders.update",
                     *         "quotations.create"
                     *       ],
                     *       "scopes": [
                     *         "platform"
                     *       ],
                     *       "menu": [
                     *         {
                     *           "key": "dashboard",
                     *           "href": "/",
                     *           "icon": "box"
                     *         },
                     *         {
                     *           "key": "orders",
                     *           "href": "/orders",
                     *           "icon": "package",
                     *           "children": [
                     *             {
                     *               "key": "orders.all",
                     *               "href": "/orders"
                     *             }
                     *           ]
                     *         }
                     *       ],
                     *       "features": {
                     *         "labelCalculator": true
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["StaffMe"];
                };
            };
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    "auth.customer.firebase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "idToken": "seed.firebase.id-token"
                 *     }
                 */
                "application/json": components["schemas"]["FirebaseLoginRequest"];
            };
        };
        responses: {
            /** @description SEED. Tokens in the body; this app puts them in httpOnly cookies (api-conventions §4). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "seed.access.token.customer",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "seed-refresh-token-customer",
                     *       "refreshTokenExpiresAt": "2026-10-23T14:00:00+07:00",
                     *       "subject": {
                     *         "id": "00000000-0000-4000-8000-000000000001",
                     *         "type": "customer",
                     *         "roles": [
                     *           "customer"
                     *         ],
                     *         "permissions": [],
                     *         "scopes": []
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            401: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
        };
    };
    "auth.customer.line": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "code": "seed-line-auth-code",
                 *       "redirectUri": "https://packio.invalid/auth/line/callback"
                 *     }
                 */
                "application/json": components["schemas"]["LineLoginRequest"];
            };
        };
        responses: {
            /** @description SEED. Tokens in the body; this app puts them in httpOnly cookies (api-conventions §4). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "seed.access.token.customer",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "seed-refresh-token-customer",
                     *       "refreshTokenExpiresAt": "2026-10-23T14:00:00+07:00",
                     *       "subject": {
                     *         "id": "00000000-0000-4000-8000-000000000001",
                     *         "type": "customer",
                     *         "roles": [
                     *           "customer"
                     *         ],
                     *         "permissions": [],
                     *         "scopes": []
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            401: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
        };
    };
    "auth.customer.otp.request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "phone": "0812345678"
                 *     }
                 */
                "application/json": components["schemas"]["OtpRequest"];
            };
        };
        responses: {
            /** @description SEED. An OTP was sent (or the cooldown from a previous send still applies). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "ref": "MOCK-4821",
                     *       "codeLength": 6,
                     *       "expiresAt": "2026-09-23T14:10:00+07:00",
                     *       "resendAfterSeconds": 60,
                     *       "attemptsRemaining": 5
                     *     }
                     */
                    "application/json": components["schemas"]["OtpChallenge"];
                };
            };
            422: components["responses"]["Problem"];
            429: components["responses"]["Problem"];
        };
    };
    "auth.customer.otp.verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "phone": "0812345678",
                 *       "ref": "MOCK-4821",
                 *       "code": "000000"
                 *     }
                 */
                "application/json": components["schemas"]["OtpVerifyRequest"];
            };
        };
        responses: {
            /** @description SEED. Tokens in the body; this app puts them in httpOnly cookies (api-conventions §4). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "seed.access.token.customer",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "seed-refresh-token-customer",
                     *       "refreshTokenExpiresAt": "2026-10-23T14:00:00+07:00",
                     *       "subject": {
                     *         "id": "00000000-0000-4000-8000-000000000001",
                     *         "type": "customer",
                     *         "roles": [
                     *           "customer"
                     *         ],
                     *         "permissions": [],
                     *         "scopes": []
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            401: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
            429: components["responses"]["Problem"];
        };
    };
    "auth.logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "refreshToken": "seed-refresh-token"
                 *     }
                 */
                "application/json": components["schemas"]["RefreshRequest"];
            };
        };
        responses: {
            /** @description SEED. The session is revoked. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    "auth.partner.login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "username": "seed.planner",
                 *       "password": "not-a-real-password"
                 *     }
                 */
                "application/json": components["schemas"]["PartnerLoginRequest"];
            };
        };
        responses: {
            /** @description SEED. Tokens in the body; this app puts them in httpOnly cookies (api-conventions §4). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "seed.access.token.partner",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "seed-refresh-token-partner",
                     *       "refreshTokenExpiresAt": "2026-10-23T14:00:00+07:00",
                     *       "subject": {
                     *         "id": "00000000-0000-4000-8000-000000000003",
                     *         "type": "partner",
                     *         "roles": [
                     *           "planner"
                     *         ],
                     *         "permissions": [
                     *           "jobs.read",
                     *           "jobs.update"
                     *         ],
                     *         "scopes": [
                     *           "factory:00000000-0000-4000-8000-0000000000f1"
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            401: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
            429: components["responses"]["Problem"];
        };
    };
    "auth.refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "refreshToken": "seed-refresh-token"
                 *     }
                 */
                "application/json": components["schemas"]["RefreshRequest"];
            };
        };
        responses: {
            /** @description SEED. Tokens in the body; this app puts them in httpOnly cookies (api-conventions §4). The audience follows the refresh token that was presented; this example shows a staff session. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "seed.access.token.staff",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "seed-refresh-token-staff",
                     *       "refreshTokenExpiresAt": "2026-10-23T14:00:00+07:00",
                     *       "subject": {
                     *         "id": "00000000-0000-4000-8000-000000000002",
                     *         "type": "staff",
                     *         "roles": [
                     *           "cs"
                     *         ],
                     *         "permissions": [
                     *           "orders.read",
                     *           "orders.update",
                     *           "quotations.create"
                     *         ],
                     *         "scopes": [
                     *           "platform"
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            401: components["responses"]["Problem"];
        };
    };
    "auth.staff.login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "email": "somchai.staff@packio.invalid",
                 *       "password": "not-a-real-password"
                 *     }
                 */
                "application/json": components["schemas"]["StaffLoginRequest"];
            };
        };
        responses: {
            /** @description SEED. Tokens in the body; this app puts them in httpOnly cookies (api-conventions §4). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "accessToken": "seed.access.token.staff",
                     *       "accessTokenExpiresAt": "2026-09-23T14:15:00+07:00",
                     *       "refreshToken": "seed-refresh-token-staff",
                     *       "refreshTokenExpiresAt": "2026-10-23T14:00:00+07:00",
                     *       "subject": {
                     *         "id": "00000000-0000-4000-8000-000000000002",
                     *         "type": "staff",
                     *         "roles": [
                     *           "cs"
                     *         ],
                     *         "permissions": [
                     *           "orders.read",
                     *           "orders.update",
                     *           "quotations.create"
                     *         ],
                     *         "scopes": [
                     *           "platform"
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            401: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
            429: components["responses"]["Problem"];
        };
    };
    "partner.me.show": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description SEED. The signed-in partner user. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "00000000-0000-4000-8000-000000000003",
                     *       "type": "partner",
                     *       "displayName": "โรงงานตัวอย่าง (ข้อมูลจำลอง)",
                     *       "locale": "th",
                     *       "roles": [
                     *         "planner"
                     *       ],
                     *       "permissions": [
                     *         "jobs.read",
                     *         "jobs.update"
                     *       ],
                     *       "scopes": [
                     *         "factory:00000000-0000-4000-8000-0000000000f1"
                     *       ],
                     *       "factories": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-0000000000f1",
                     *           "name": "โรงงานจำลอง หนึ่ง",
                     *           "status": "active"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["PartnerMe"];
                };
            };
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    "store.me.show": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description SEED. The signed-in customer. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "00000000-0000-4000-8000-000000000001",
                     *       "type": "customer",
                     *       "displayName": "ลูกค้าตัวอย่าง (ข้อมูลจำลอง)",
                     *       "userCode": "MOCK-C-0001",
                     *       "phone": "0812345678",
                     *       "email": "seed.customer@packio.invalid",
                     *       "locale": "th",
                     *       "lineLinked": false,
                     *       "companies": [],
                     *       "scopes": []
                     *     }
                     */
                    "application/json": components["schemas"]["CustomerMe"];
                };
            };
            401: components["responses"]["Problem"];
        };
    };
}
