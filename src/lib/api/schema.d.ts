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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
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
    };
    responses: never;
    parameters: {
        /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
        AcceptLanguage: string;
    };
    requestBodies: never;
    headers: {
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
}
