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
    "/v1/admin/approval-delegations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My delegations (given and received)
         * @description Time-boxed delegations of approvals.
         *
         *     Implements: ADR-0006.
         */
        get: operations["admin.approvalDelegations.list"];
        put?: never;
        /**
         * Delegate my approvals for a period
         * @description The delegate approves on my behalf (recorded as such) for all policies or one; never my own requests. Audited.
         *
         *     Implements: ADR-0006.
         */
        post: operations["admin.approvalDelegations.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/approval-delegations/{delegationId}/actions/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * End a delegation now
         * @description Only the delegator revokes.
         *
         *     Implements: ADR-0006.
         */
        post: operations["admin.approvalDelegations.revoke"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/approvals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List approval requests
         * @description All requests of the generic approval engine (discount memos, credit limits, payout runs, price proposals…), newest first.
         *
         *     Implements: ADR-0006, D-052, D-121, D-022.
         */
        get: operations["admin.approvals.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/approvals/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one approval request with steps and actions
         * @description Request snapshot, materialised steps and the action trail.
         *
         *     Implements: ADR-0006.
         */
        get: operations["admin.approvals.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/approvals/{requestId}/actions/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve the current step
         * @description Needs the step's role (or a delegation from someone who holds it). The requester never approves, one person approves at most one step, and SoD rules are checked. The last step approves the request (`approval.approved`).
         *
         *     Implements: ADR-0006, D-166, D-169.
         */
        post: operations["admin.approvals.approve"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/approvals/{requestId}/actions/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reject the request
         * @description Ends the request; remaining steps are skipped. A comment is required.
         *
         *     Implements: ADR-0006.
         */
        post: operations["admin.approvals.reject"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/approvals/{requestId}/actions/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Withdraw my pending request
         * @description Only the requester withdraws, while the request is pending.
         *
         *     Implements: ADR-0006.
         */
        post: operations["admin.approvals.withdraw"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/approvals/inbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Requests waiting for my decision
         * @description Pending requests whose current step I can decide through my roles or an active delegation; my own requests and requests I already approved a step of are excluded (maker-checker, ADR-0006).
         *
         *     Implements: ADR-0006.
         */
        get: operations["admin.approvals.inbox"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/audit-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search the audit log
         * @description Security- and finance-relevant actions (logins, role changes, permission denials, setting changes, exports, approvals), newest first. Data is redacted before storage (PDPA). Read-only for the time-boxed Auditor (§8).
         *
         *     Implements: D-140, D-033.
         */
        get: operations["admin.auditLogs.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/audit-logs/exports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Export the audit log as CSV
         * @description Up to 50000 rows per export as UTF-8 CSV (formula-safe), served by a 5-minute signed URL. The export itself is audited (`export.generated`).
         *
         *     Implements: D-033.
         */
        post: operations["admin.auditLogs.export"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/consent-purposes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consent purposes and their texts
         * @description Packio's own PDPA consent management (D-005, D-144).
         *
         *     Implements: D-005, D-144.
         */
        get: operations["admin.consentPurposes.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/consent-purposes/{key}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Publish a new consent text from a date
         * @description Versioned and effective-dated; earlier consents stay tied to the text they accepted (ADR-0005).
         *
         *     Implements: D-144, ADR-0005.
         */
        post: operations["admin.consentPurposes.publishText"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/feature-flags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List feature flags
         * @description Operational toggles (e.g. R2 adapters off, D-111). Business values are settings, not flags (ADR-0005).
         *
         *     Implements: ADR-0005, D-111.
         */
        get: operations["admin.featureFlags.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/feature-flags/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Create or change a feature flag
         * @description Audited; takes effect on every process within seconds.
         *
         *     Implements: ADR-0005, D-063.
         */
        put: operations["admin.featureFlags.set"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/files/{fileId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * File metadata
         * @description Visible to the uploader, their factory/company scope, staff with `files.read`, or through an attachment of a record the caller can see; otherwise 404.
         *
         *     Implements: ADR-0003, D-142.
         */
        get: operations["admin.files.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/files/{fileId}/actions/abort": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel an unfinished upload
         * @description Deletes whatever was uploaded so far.
         *
         *     Implements: ADR-0003.
         */
        post: operations["admin.files.abort"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/files/{fileId}/actions/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Finish an upload
         * @description Checks the stored object (size must match) and queues the malware scan; the file is downloadable once `scanStatus` is `clean`.
         *
         *     Implements: ADR-0003.
         */
        post: operations["admin.files.complete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/files/{fileId}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Short-lived download URL
         * @description A signed URL valid 5 minutes, after the access check. Files still scanning are `file.not_ready`; infected files are never served.
         *
         *     Implements: ADR-0003.
         */
        get: operations["admin.files.download"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/files/presign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start an upload (presigned PUT)
         * @description Returns a presigned URL (or, for large files, multipart part URLs). PUT the bytes to S3, then call `…/actions/complete`. The purpose decides retention, accepted types and size (financial records ≥ 10 years).
         *
         *     Implements: ADR-0003.
         */
        post: operations["admin.files.presign"];
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
    "/v1/admin/notification-routes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The routing matrix
         * @description Event × audience × channel → template (D-143).
         *
         *     Implements: D-143, D-144.
         */
        get: operations["admin.notificationRoutes.list"];
        put?: never;
        /**
         * Add a route to the matrix
         * @description SMS routes must be critical (D-143); marketing routes get consent and quiet-hour handling (D-144).
         *
         *     Implements: D-143, D-144.
         */
        post: operations["admin.notificationRoutes.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/notification-routes/{routeId}/actions/set-enabled": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Switch a route on or off
         * @description Audited.
         *
         *     Implements: D-143.
         */
        post: operations["admin.notificationRoutes.setEnabled"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/notification-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List notification templates
         * @description Templates per event key and channel, with their th/en versions.
         *
         *     Implements: D-143.
         */
        get: operations["admin.notificationTemplates.list"];
        put?: never;
        /**
         * Create a template
         * @description One template per key and channel; add versions per locale, then publish.
         *
         *     Implements: D-143.
         */
        post: operations["admin.notificationTemplates.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/notification-templates/{templateId}/actions/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Render a template with a sample payload
         * @description Nothing is sent.
         *
         *     Implements: D-143.
         */
        post: operations["admin.notificationTemplates.preview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/notification-templates/{templateId}/actions/test-send": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a test to my own address
         * @description E-mail, SMS or LINE to the signed-in staff member only (never to others). Audited; not logged as a notification.
         *
         *     Implements: D-143.
         */
        post: operations["admin.notificationTemplates.testSend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/notification-templates/{templateId}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add a draft version for a locale
         * @description The template must compile (Handlebars; MJML for e-mail). E-mail needs a subject.
         *
         *     Implements: D-143.
         */
        post: operations["admin.notificationTemplates.addVersion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/notification-templates/{templateId}/versions/{locale}/{versionNo}/actions/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Publish a draft version
         * @description The previously published version of that locale is retired. Audited.
         *
         *     Implements: D-143.
         */
        post: operations["admin.notificationTemplates.publish"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My in-app notifications
         * @description Newest first, cursor-paginated. Realtime signals (`notification.created`) tell the client to refetch.
         *
         *     Implements: D-143.
         */
        get: operations["admin.notifications.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/notifications/{notificationId}/actions/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark an in-app notification read
         * @description Idempotent.
         *
         *     Implements: D-143.
         */
        post: operations["admin.notifications.markRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/outbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List outbox messages (dead-letter list)
         * @description Domain events and their relay status; `status=dead` lists events a subscriber could not process after all retries.
         *
         *     Implements: ADR-0006, ADR-0005.
         */
        get: operations["admin.outbox.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/outbox/{eventId}/actions/replay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Replay a failed or dead event
         * @description Queues the event again. Subscribers that already processed it skip it (idempotent consumers), so only the failed ones run. Audited.
         *
         *     Implements: ADR-0006.
         */
        post: operations["admin.outbox.replay"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/realtime/auth": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Authorise a realtime stream
         * @description Returns a 60-second token for the channels of the signed-in principal (own user, factory/company scopes).
         *
         *     Implements: ADR-0003.
         */
        post: operations["admin.realtime.auth"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/realtime/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Server-sent events for the signed-in principal
         * @description Called with the bearer token (the BFF proxies the stream) and the channel token from `POST …/realtime/auth`. Events carry `{ type, id?, channel }` only — never business data; the client refetches through the API (contract §6). A heartbeat event keeps proxies from closing the connection.
         *
         *     Implements: ADR-0003.
         */
        get: operations["admin.realtime.stream"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The role catalogue with permissions
         * @description Roles of D-140 for every audience with their permissions (`docs/rbac.md` is generated from the same catalogue).
         *
         *     Implements: D-140, D-141.
         */
        get: operations["admin.roles.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List effective-dated settings
         * @description Every configurable business value with the version in force, scheduled versions and any pending change (ADR-0005). Sensitive values are masked without `settings.read_sensitive`.
         *
         *     Implements: ADR-0005, D-063.
         */
        get: operations["admin.settings.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/settings/{settingId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one setting with its full history
         * @description Versions are immutable; history is never rewritten (ADR-0005).
         *
         *     Implements: ADR-0005.
         */
        get: operations["admin.settings.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/settings/{settingId}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Change a setting from a date (new version)
         * @description Adds a version effective from `effectiveFrom` (now or later). Only the setting's owner role may change it (Superadmin for platform thresholds, D-063). When the setting names an approval policy the version waits for approval (ADR-0006); otherwise it is approved at once. Audited; emits `setting.changed`.
         *
         *     Implements: ADR-0005, D-063.
         */
        post: operations["admin.settings.changeValue"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List staff, partner and customer accounts
         * @description Filter by kind and status; `q` searches e-mail and display name. Anonymised accounts are hidden.
         *
         *     Implements: D-140.
         */
        get: operations["admin.users.list"];
        put?: never;
        /**
         * Create a staff or partner account
         * @description With an initial password (argon2id). Roles are granted separately. Customers sign up themselves (OTP, LINE, Google/Apple).
         *
         *     Implements: D-140, ADR-0004.
         */
        post: operations["admin.users.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one account with its role grants
         * @description Active grants only.
         *
         *     Implements: D-140.
         */
        get: operations["admin.users.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{userId}/actions/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Deactivate an account
         * @description Sign-in stops and every open session ends at once. Nobody can deactivate themselves.
         *
         *     Implements: D-140, ADR-0004.
         */
        post: operations["admin.users.deactivate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{userId}/actions/reactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reactivate an account
         * @description The user can sign in again.
         *
         *     Implements: D-140.
         */
        post: operations["admin.users.reactivate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{userId}/actions/revoke-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign an account out everywhere
         * @description Revokes every refresh session and the access tokens issued for them.
         *
         *     Implements: ADR-0004.
         */
        post: operations["admin.users.revokeSessions"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{userId}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Grant a role (optionally scoped and time-boxed)
         * @description Factory and company roles need a scope. Nobody grants their own roles; staff roles can be granted only by someone who holds all of the role's permissions; segregation-of-duties role pairs are refused (D-168).
         *
         *     Implements: D-140, D-168.
         */
        post: operations["admin.users.grantRole"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{userId}/roles/{grantId}/actions/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke a role grant
         * @description Takes effect at once for new requests.
         *
         *     Implements: D-140.
         */
        post: operations["admin.users.revokeRole"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/web-push/subscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register this browser for web push
         * @description One subscription per endpoint; the auth secret is stored encrypted. Sent only when the user permits it (D-143).
         *
         *     Implements: D-143.
         */
        post: operations["admin.webPush.subscribe"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/web-push/subscriptions/{subscriptionId}": {
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
         * Stop web push to a browser
         * @description Only the owner can remove it.
         *
         *     Implements: D-143.
         */
        delete: operations["admin.webPush.unsubscribe"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/web-push/vapid-public-key": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * VAPID public key for subscribing
         * @description Null when web push is not configured.
         *
         *     Implements: D-143.
         */
        get: operations["admin.webPush.vapidPublicKey"];
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
    "/v1/partner/files/{fileId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * File metadata
         * @description Visible to the uploader, their factory/company scope, staff with `files.read`, or through an attachment of a record the caller can see; otherwise 404.
         *
         *     Implements: ADR-0003, D-142.
         */
        get: operations["partner.files.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/files/{fileId}/actions/abort": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel an unfinished upload
         * @description Deletes whatever was uploaded so far.
         *
         *     Implements: ADR-0003.
         */
        post: operations["partner.files.abort"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/files/{fileId}/actions/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Finish an upload
         * @description Checks the stored object (size must match) and queues the malware scan; the file is downloadable once `scanStatus` is `clean`.
         *
         *     Implements: ADR-0003.
         */
        post: operations["partner.files.complete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/files/{fileId}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Short-lived download URL
         * @description A signed URL valid 5 minutes, after the access check. Files still scanning are `file.not_ready`; infected files are never served.
         *
         *     Implements: ADR-0003.
         */
        get: operations["partner.files.download"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/files/presign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start an upload (presigned PUT)
         * @description Returns a presigned URL (or, for large files, multipart part URLs). PUT the bytes to S3, then call `…/actions/complete`. The purpose decides retention, accepted types and size (financial records ≥ 10 years).
         *
         *     Implements: ADR-0003.
         */
        post: operations["partner.files.presign"];
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
    "/v1/partner/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My in-app notifications
         * @description Newest first, cursor-paginated. Realtime signals (`notification.created`) tell the client to refetch.
         *
         *     Implements: D-143.
         */
        get: operations["partner.notifications.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/notifications/{notificationId}/actions/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark an in-app notification read
         * @description Idempotent.
         *
         *     Implements: D-143.
         */
        post: operations["partner.notifications.markRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/realtime/auth": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Authorise a realtime stream
         * @description Returns a 60-second token for the channels of the signed-in principal (own user, factory/company scopes).
         *
         *     Implements: ADR-0003.
         */
        post: operations["partner.realtime.auth"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/realtime/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Server-sent events for the signed-in principal
         * @description Called with the bearer token (the BFF proxies the stream) and the channel token from `POST …/realtime/auth`. Events carry `{ type, id?, channel }` only — never business data; the client refetches through the API (contract §6). A heartbeat event keeps proxies from closing the connection.
         *
         *     Implements: ADR-0003.
         */
        get: operations["partner.realtime.stream"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/web-push/subscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register this browser for web push
         * @description One subscription per endpoint; the auth secret is stored encrypted. Sent only when the user permits it (D-143).
         *
         *     Implements: D-143.
         */
        post: operations["partner.webPush.subscribe"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/web-push/subscriptions/{subscriptionId}": {
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
         * Stop web push to a browser
         * @description Only the owner can remove it.
         *
         *     Implements: D-143.
         */
        delete: operations["partner.webPush.unsubscribe"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/partner/web-push/vapid-public-key": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * VAPID public key for subscribing
         * @description Null when web push is not configured.
         *
         *     Implements: D-143.
         */
        get: operations["partner.webPush.vapidPublicKey"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/files/{fileId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * File metadata
         * @description Visible to the uploader, their factory/company scope, staff with `files.read`, or through an attachment of a record the caller can see; otherwise 404.
         *
         *     Implements: ADR-0003, D-142.
         */
        get: operations["store.files.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/files/{fileId}/actions/abort": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel an unfinished upload
         * @description Deletes whatever was uploaded so far.
         *
         *     Implements: ADR-0003.
         */
        post: operations["store.files.abort"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/files/{fileId}/actions/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Finish an upload
         * @description Checks the stored object (size must match) and queues the malware scan; the file is downloadable once `scanStatus` is `clean`.
         *
         *     Implements: ADR-0003.
         */
        post: operations["store.files.complete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/files/{fileId}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Short-lived download URL
         * @description A signed URL valid 5 minutes, after the access check. Files still scanning are `file.not_ready`; infected files are never served.
         *
         *     Implements: ADR-0003.
         */
        get: operations["store.files.download"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/files/presign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start an upload (presigned PUT)
         * @description Returns a presigned URL (or, for large files, multipart part URLs). PUT the bytes to S3, then call `…/actions/complete`. The purpose decides retention, accepted types and size (financial records ≥ 10 years).
         *
         *     Implements: ADR-0003.
         */
        post: operations["store.files.presign"];
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
    "/v1/store/me/consents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My PDPA consents
         * @description Each purpose with the text in force and my latest decision.
         *
         *     Implements: D-005, D-144.
         */
        get: operations["store.me.consents"];
        put?: never;
        /**
         * Give or withdraw a consent
         * @description Recorded against the text version in force (append-only evidence, PDPA). Marketing messages need it (D-144).
         *
         *     Implements: D-144, D-005.
         */
        post: operations["store.me.recordConsent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/me/notification-preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My notification channel choices
         * @description Unset = default on. Order and finance e-mails cannot be switched off (D-144).
         *
         *     Implements: D-143, D-144.
         */
        get: operations["store.me.notificationPreferences"];
        /**
         * Change my notification channel choices
         * @description Marketing can be switched off on every channel; transactional e-mail cannot (D-144).
         *
         *     Implements: D-143, D-144.
         */
        put: operations["store.me.setNotificationPreferences"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My in-app notifications
         * @description Newest first, cursor-paginated. Realtime signals (`notification.created`) tell the client to refetch.
         *
         *     Implements: D-143.
         */
        get: operations["store.notifications.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/notifications/{notificationId}/actions/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark an in-app notification read
         * @description Idempotent.
         *
         *     Implements: D-143.
         */
        post: operations["store.notifications.markRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/realtime/auth": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Authorise a realtime stream
         * @description Returns a 60-second token for the channels of the signed-in principal (own user, factory/company scopes).
         *
         *     Implements: ADR-0003.
         */
        post: operations["store.realtime.auth"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/realtime/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Server-sent events for the signed-in principal
         * @description Called with the bearer token (the BFF proxies the stream) and the channel token from `POST …/realtime/auth`. Events carry `{ type, id?, channel }` only — never business data; the client refetches through the API (contract §6). A heartbeat event keeps proxies from closing the connection.
         *
         *     Implements: ADR-0003.
         */
        get: operations["store.realtime.stream"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/web-push/subscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register this browser for web push
         * @description One subscription per endpoint; the auth secret is stored encrypted. Sent only when the user permits it (D-143).
         *
         *     Implements: D-143.
         */
        post: operations["store.webPush.subscribe"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/web-push/subscriptions/{subscriptionId}": {
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
         * Stop web push to a browser
         * @description Only the owner can remove it.
         *
         *     Implements: D-143.
         */
        delete: operations["store.webPush.unsubscribe"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/store/web-push/vapid-public-key": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * VAPID public key for subscribing
         * @description Null when web push is not configured.
         *
         *     Implements: D-143.
         */
        get: operations["store.webPush.vapidPublicKey"];
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
        /** @enum {string} */
        ActorType: "user" | "api_client" | "system" | "webhook";
        AddTemplateVersionDto: {
            /** @example คำขอ {{payload.policyKey}} รอการอนุมัติของคุณ */
            body: string;
            /** @example th */
            locale: components["schemas"]["LocaleCode"];
            /**
             * @description Required for e-mail
             * @example มีคำขออนุมัติรอคุณ
             */
            subject?: string;
        };
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
        ApprovalActionDto: {
            /** @example approve */
            action: components["schemas"]["ApprovalActionKind"];
            actor: components["schemas"]["UserRefDto"];
            /**
             * Format: date-time
             * @example 2026-09-23T15:00:00+07:00
             */
            at: string;
            /** @example Verified by phone with the factory */
            comment: string | null;
            /** @description Delegator when acting through a delegation */
            onBehalfOf: components["schemas"]["UserRefDto"] | null;
            /** @example 1 */
            stepNo: number | null;
        };
        /** @enum {string} */
        ApprovalActionKind: "approve" | "reject" | "withdraw" | "delegate" | "comment" | "escalate";
        ApprovalRequestDto: {
            actions: components["schemas"]["ApprovalActionDto"][];
            /**
             * @description Money (THB, 2 decimals)
             * @example 120000.00
             */
            amount: string | null;
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            createdAt: string;
            /**
             * @description Always THB (one currency)
             * @example THB
             */
            currency: components["schemas"]["Currency"];
            /** @example 1 */
            currentStepNo: number | null;
            /**
             * Format: date-time
             * @example null
             */
            decidedAt: string | null;
            /**
             * Format: date-time
             * @example null
             */
            expiresAt: string | null;
            /** @example [] */
            flags: string[];
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000a0a0
             */
            id: string;
            /**
             * @description What the approvers decide on, frozen at request time
             * @example {
             *       "bankLast4": "1234",
             *       "vendor": "โรงงาน ทดสอบ"
             *     }
             */
            payload: {
                [key: string]: unknown;
            };
            /**
             * @description Percent, e.g. "12.5000" = 12.5 %
             * @example null
             */
            pct: string | null;
            /**
             * @description Approval policy key
             * @example vendor_bank_account_change
             */
            policy: string;
            requester: components["schemas"]["UserRefDto"];
            /** @example pending */
            status: components["schemas"]["ApprovalStatus"];
            steps: components["schemas"]["ApprovalStepDto"][];
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000b0b0
             */
            subjectId: string;
            /** @example vendor_bank_account */
            subjectType: string;
        };
        /** @enum {string} */
        ApprovalStatus: "pending" | "approved" | "rejected" | "withdrawn" | "expired";
        ApprovalStepDto: {
            /**
             * Format: date-time
             * @example null
             */
            completedAt: string | null;
            /**
             * Format: date-time
             * @description SLA deadline
             * @example 2026-09-24T14:05:00+07:00
             */
            dueAt: string | null;
            /**
             * @description Approvals needed
             * @example 1
             */
            quorum: number;
            /**
             * @description Role that approves this step
             * @example finance
             */
            role: string;
            /** @example pending */
            status: components["schemas"]["ApprovalStepStatus"];
            /** @example 1 */
            stepNo: number;
        };
        /** @enum {string} */
        ApprovalStepStatus: "pending" | "approved" | "rejected" | "skipped" | "expired";
        ApproveDto: {
            /** @example Verified by phone with the factory */
            comment?: string;
        };
        AuditActorDto: {
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            id: string | null;
            /** @example แอดมิน ทดสอบ */
            name: string | null;
            /** @example user */
            type: components["schemas"]["ActorType"];
        };
        /** @enum {string} */
        AuditCategory: "security" | "finance" | "config" | "data_access" | "export" | "approval" | "iam";
        AuditEntryDto: {
            /** @example iam.role_granted */
            action: string;
            actor: components["schemas"]["AuditActorDto"];
            /** @example iam */
            category: components["schemas"]["AuditCategory"];
            /**
             * @description Redacted before storage (PDPA)
             * @example {
             *       "reason": "Joined the finance team",
             *       "role": "finance"
             *     }
             */
            data: {
                [key: string]: unknown;
            };
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            occurredAt: string;
            /**
             * Format: uuid
             * @description CS acting for a customer
             * @example null
             */
            onBehalfOf: string | null;
            /** @example success */
            outcome: components["schemas"]["AuditOutcome"];
            /** @example req-3f2a9c1d */
            requestId: string | null;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000c0c0
             */
            resourceId: string | null;
            /** @example user */
            resourceType: string | null;
        };
        AuditExportDto: {
            /**
             * Format: date-time
             * @example 2026-09-23T14:10:00+07:00
             */
            expiresAt: string;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000f11e
             */
            fileId: string;
            /** @example 1250 */
            rows: number;
            /**
             * @description True when more than 50000 rows matched; narrow the period
             * @example false
             */
            truncated: boolean;
            /** @example https://packio-files.s3.example.com/…&X-Amz-Expires=300 */
            url: string;
        };
        AuditFilterDto: {
            /** @example auth.login_failed */
            action?: string;
            /**
             * Format: uuid
             * @description Acting user
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            actorId?: string;
            /** @example security */
            category?: components["schemas"]["AuditCategory"];
            /**
             * Format: date-time
             * @example 2026-09-01T00:00:00+07:00
             */
            from?: string;
            /** @example denied */
            outcome?: components["schemas"]["AuditOutcome"];
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            resourceId?: string;
            /** @example user */
            resourceType?: string;
            /**
             * Format: date-time
             * @description Exclusive
             * @example 2026-10-01T00:00:00+07:00
             */
            to?: string;
        };
        /** @enum {string} */
        AuditOutcome: "success" | "denied" | "failure";
        ChangeSettingDto: {
            /**
             * Format: date-time
             * @description Now or later; never in the past
             * @example 2027-01-01T00:00:00+07:00
             */
            effectiveFrom: string;
            /** @example Raise the floor for the new fiscal year */
            reason: string;
            /**
             * @description Typed per `valueType`; money and percent as decimal strings
             * @example 12
             */
            value: (string | number | boolean | {
                [key: string]: unknown;
            } | {
                [key: string]: unknown;
            }[]) | null;
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
        CompletedPartDto: {
            /** @example "etag-1" */
            etag: string;
            /** @example 1 */
            partNumber: number;
        };
        CompleteUploadDto: {
            /** @description Multipart uploads only */
            parts?: components["schemas"]["CompletedPartDto"][];
        };
        /** @enum {string} */
        ConfigVersionStatus: "draft" | "proposed" | "pending_acceptance" | "approved" | "rejected" | "withdrawn";
        ConsentDto: {
            /**
             * @description Latest decision; null = never asked
             * @example true
             */
            granted: boolean | null;
            /**
             * @description The latest decision was for an older text version
             * @example false
             */
            outdated: boolean;
            /** @example marketing_line */
            purpose: string;
            /**
             * @description Required purposes (terms, privacy notice) are needed to use Packio
             * @example false
             */
            required: boolean;
            /** @example รับข่าวสารและโปรโมชันทาง LINE */
            summary: string | null;
            /** @example ข้าพเจ้ายินยอมรับข่าวสาร… */
            text: string | null;
            /**
             * @description Text version in force; null = not published yet
             * @example 1
             */
            versionNo: number | null;
        };
        ConsentPurposeDto: {
            /** @example marketing_line */
            key: string;
            /** @example false */
            required: boolean;
            versions: components["schemas"]["ConsentPurposeVersionDto"][];
        };
        ConsentPurposeVersionDto: {
            /**
             * Format: date-time
             * @example 2026-10-01T00:00:00+07:00
             */
            effectiveFrom: string;
            /** @example I agree to receive news… */
            textEn: string;
            /** @example ข้าพเจ้ายินยอมรับข่าวสาร… */
            textTh: string;
            /** @example 1 */
            versionNo: number;
        };
        /** @enum {string} */
        ConsentSource: "web" | "line_liff" | "cs" | "partner_zone";
        CreateDelegationDto: {
            /**
             * Format: uuid
             * @description Staff user who approves for you
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000c0c1
             */
            delegateId: string;
            /**
             * @description Only this policy; omit for all
             * @example discount_memo
             */
            policy?: string;
            /** @example Annual leave */
            reason: string;
            /**
             * Format: date-time
             * @example 2026-10-01T00:00:00+07:00
             */
            validFrom: string;
            /**
             * Format: date-time
             * @example 2026-10-08T00:00:00+07:00
             */
            validTo: string;
        };
        CreateRouteDto: {
            /** @example assignee */
            audience: components["schemas"]["NotificationAudience"];
            /**
             * @description Equality filters on the event payload
             * @example {
             *       "payload.policyKey": "discount_memo"
             *     }
             */
            conditions?: {
                [key: string]: unknown;
            };
            /** @example approval.requested */
            eventType: string;
            /** @example false */
            isCritical: boolean;
            /** @example false */
            isMarketing: boolean;
            /**
             * @description Team code, only for staff_team
             * @example finance
             */
            staffTeam?: string;
            /**
             * Format: uuid
             * @description Template (its channel is the route channel)
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000f00d
             */
            templateId: string;
        };
        CreateTemplateDto: {
            /** @example transactional */
            category: components["schemas"]["NotificationCategory"];
            /** @example in_app */
            channel: components["schemas"]["NotificationChannel"];
            /** @example Approvers: a request waits for your decision */
            description: string;
            /** @example approval.requested:assignee */
            key: string;
        };
        CreateUserDto: {
            /** @example พนักงาน ทดสอบ */
            displayName: string;
            /**
             * Format: email
             * @example new.staff@example.com
             */
            email: string;
            /**
             * Format: password
             * @description Initial password; the user changes it
             * @example temporary-passphrase-1
             */
            initialPassword: string;
            /** @example staff */
            kind: components["schemas"]["ManagedUserKind"];
        };
        /**
         * @description Always THB (one currency)
         * @enum {string}
         */
        Currency: "THB";
        CursorMeta: {
            /** @example eyJpZCI6IjEyMyJ9 */
            nextCursor: string | null;
        };
        DelegationDto: {
            delegate: components["schemas"]["UserRefDto"];
            delegator: components["schemas"]["UserRefDto"];
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000d001
             */
            id: string;
            /**
             * @description Limited to one policy, or null = all
             * @example null
             */
            policy: string | null;
            /** @example Annual leave */
            reason: string;
            /**
             * Format: date-time
             * @example null
             */
            revokedAt: string | null;
            /**
             * Format: date-time
             * @example 2026-10-01T00:00:00+07:00
             */
            validFrom: string;
            /**
             * Format: date-time
             * @example 2026-10-08T00:00:00+07:00
             */
            validTo: string;
        };
        DevicePinDto: {
            /** @example tablet-line-2 */
            deviceId: string;
            /** @example 123456 */
            pin: string;
        };
        DownloadUrlDto: {
            /**
             * Format: date-time
             * @example 2026-09-23T14:10:00+07:00
             */
            expiresAt: string;
            /** @example https://packio-files.s3.example.com/…&X-Amz-Expires=300 */
            url: string;
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
        FeatureFlagDto: {
            /** @example Deliveree carrier adapter (D-114) */
            description: string;
            /** @example true */
            enabled: boolean;
            /** @example carriers.deliveree */
            key: string;
            rules: components["schemas"]["FeatureFlagRulesDto"];
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            updatedAt: string;
        };
        FeatureFlagRulesDto: {
            /**
             * @example [
             *       "staff"
             *     ]
             */
            audiences?: components["schemas"]["TokenAudience"][];
            /**
             * @description Stable share of principals
             * @example 100
             */
            percentage?: number;
            /**
             * @description Users always included
             * @example []
             */
            userIds?: string[];
        };
        FileDto: {
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            createdAt: string;
            /** @example null */
            heightPx: number | null;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000f11e
             */
            id: string;
            /** @example application/pdf */
            mimeType: string;
            /** @example box-front.pdf */
            originalName: string;
            /** @example 2 */
            pageCount: number | null;
            /** @example customer_content */
            retentionClass: components["schemas"]["FileRetentionClass"];
            /**
             * @description Downloads need `clean`
             * @example clean
             */
            scanStatus: components["schemas"]["FileScanStatus"];
            /**
             * @description Hex SHA-256, set after the scan
             * @example null
             */
            sha256: string | null;
            /** @example 2457600 */
            sizeBytes: number;
            /**
             * Format: uuid
             * @description Thumbnail file (images)
             * @example null
             */
            thumbnailId: string | null;
            /** @example uploaded */
            uploadStatus: components["schemas"]["FileUploadStatus"];
            /** @example null */
            widthPx: number | null;
        };
        /**
         * @description Decides retention, accepted types and size limit
         * @enum {string}
         */
        FilePurpose: "artwork" | "proof" | "slip" | "evidence" | "document" | "import" | "avatar";
        /** @enum {string} */
        FileRetentionClass: "transient" | "standard" | "customer_content" | "financial_record";
        /**
         * @description Downloads need `clean`
         * @enum {string}
         */
        FileScanStatus: "pending" | "clean" | "infected" | "failed" | "skipped";
        /** @enum {string} */
        FileUploadStatus: "pending" | "uploaded" | "failed";
        FirebaseLoginDto: {
            /**
             * @description Firebase Auth ID token (Google or Apple)
             * @example eyJhbGciOiJSUzI1NiIsImtpZCI6ImV4YW1wbGUifQ.eyJzdWIiOiJleGFtcGxlIn0.c2ln
             */
            idToken: string;
        };
        GrantRoleDto: {
            /** @example Left the company */
            reason: string;
            /** @example finance */
            role: string;
            /** @description Required for factory and company roles */
            scope?: components["schemas"]["RoleScopeDto"];
            /**
             * Format: date-time
             * @description End of a time-boxed grant
             * @example 2026-12-31T23:59:59+07:00
             */
            validTo?: string;
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
        InboxItemDto: {
            /** @example คำขอ discount_memo รอการอนุมัติของคุณ */
            body: string;
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            createdAt: string;
            /** @example approval.requested */
            eventType: string;
            /**
             * Format: uuid
             * @description Event id; also the item id
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000e001
             */
            id: string;
            /**
             * Format: date-time
             * @example null
             */
            readAt: string | null;
            /** @example มีคำขออนุมัติรอคุณ */
            title: string | null;
        };
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
        /** @enum {string} */
        ManagedUserKind: "staff" | "partner";
        MenuEntryDto: {
            /**
             * @description Stable key; the frontend owns the label
             * @example approvals
             */
            key: string;
            /** @example /admin/approvals */
            path: string;
        };
        MultipartUploadDto: {
            parts: components["schemas"]["UploadPartDto"][];
            /**
             * @description Bytes per part (last part smaller)
             * @example 8388608
             */
            partSize: number;
            /** @example VXBsb2FkSWRFeGFtcGxl */
            uploadId: string;
        };
        /** @enum {string} */
        NotificationAudience: "customer" | "company_member" | "staff_team" | "factory" | "assignee";
        /** @enum {string} */
        NotificationCategory: "transactional" | "marketing" | "security";
        /** @enum {string} */
        NotificationChannel: "email" | "sms" | "line" | "web_push" | "in_app" | "teams";
        NotificationPreferenceDto: {
            /** @example marketing */
            category: components["schemas"]["NotificationCategory"];
            /** @example line */
            channel: components["schemas"]["NotificationChannel"];
            /** @example false */
            enabled: boolean;
        };
        NotificationRouteDto: {
            /** @example assignee */
            audience: components["schemas"]["NotificationAudience"];
            /** @example in_app */
            channel: components["schemas"]["NotificationChannel"];
            /** @example true */
            enabled: boolean;
            /** @example approval.requested */
            eventType: string;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000f0f0
             */
            id: string;
            /**
             * @description SMS is sent only for critical events (D-143)
             * @example false
             */
            isCritical: boolean;
            /**
             * @description Consent + 09:00–20:00 window apply (D-144)
             * @example false
             */
            isMarketing: boolean;
            /**
             * @description Team code for staff_team routes
             * @example null
             */
            staffTeam: string | null;
            /** @example approval.requested:assignee */
            template: string;
        };
        NotificationTemplateDto: {
            /** @example transactional */
            category: components["schemas"]["NotificationCategory"];
            /** @example in_app */
            channel: components["schemas"]["NotificationChannel"];
            /** @example Approvers: a request waits for your decision */
            description: string;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000f00d
             */
            id: string;
            /** @example approval.requested:assignee */
            key: string;
            versions: components["schemas"]["TemplateVersionDto"][];
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
        OutboxMessageDto: {
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000a0a0
             */
            aggregateId: string;
            /** @example approval_request */
            aggregateType: string;
            /** @example 3 */
            attempts: number;
            /**
             * Format: uuid
             * @description Domain event id
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000e001
             */
            eventId: string;
            /** @example notifications.router: Error: provider down */
            lastError: string | null;
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            occurredAt: string;
            /** @example dead */
            status: components["schemas"]["OutboxStatus"];
            /** @example approval.approved */
            type: string;
        };
        /** @enum {string} */
        OutboxStatus: "pending" | "dispatched" | "failed" | "dead";
        PageMeta: {
            /** @example 1 */
            page: number;
            /** @example 25 */
            perPage: number;
            /** @example 1234 */
            total: number;
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
        PresignedUploadDto: {
            /**
             * Format: date-time
             * @example 2026-09-23T14:20:00+07:00
             */
            expiresAt: string;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000f11e
             */
            fileId: string;
            /**
             * @example {
             *       "Content-Type": "application/pdf"
             *     }
             */
            headers: {
                [key: string]: string;
            };
            /** @description Large files: PUT each part, then complete with the ETags */
            multipart: components["schemas"]["MultipartUploadDto"] | null;
            /**
             * @description Single PUT; null for multipart
             * @example https://packio-files.s3.example.com/…
             */
            uploadUrl: string | null;
        };
        PresignFileDto: {
            /**
             * Format: uuid
             * @description Company of the upload when the member has several
             * @example 0192f3a0-7c1e-7d2a-9b1f-000000000c01
             */
            companyId?: string;
            /**
             * Format: uuid
             * @description Factory of the upload when the principal has several
             * @example 0192f3a0-7c1e-7d2a-9b1f-000000000f01
             */
            factoryId?: string;
            /** @example box-front.pdf */
            fileName: string;
            /** @example application/pdf */
            mimeType: string;
            /**
             * @description Decides retention, accepted types and size limit
             * @example artwork
             */
            purpose: components["schemas"]["FilePurpose"];
            /**
             * @description Bytes; must match the uploaded object
             * @example 2457600
             */
            sizeBytes: number;
        };
        PreviewTemplateDto: {
            /** @example th */
            locale: components["schemas"]["LocaleCode"];
            /**
             * @description Sample event payload
             * @example {
             *       "policyKey": "discount_memo"
             *     }
             */
            payload: {
                [key: string]: unknown;
            };
            /**
             * @description A draft to preview; default = published
             * @example 2
             */
            versionNo?: number;
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
        PublishConsentTextDto: {
            /**
             * Format: date-time
             * @example 2026-10-01T00:00:00+07:00
             */
            effectiveFrom: string;
            /** @example Text approved by legal counsel */
            reason: string;
            /** @example News on LINE */
            summaryEn?: string;
            /** @example รับข่าวสารทาง LINE */
            summaryTh?: string;
            /** @example I agree to receive news… */
            textEn: string;
            /** @example ข้าพเจ้ายินยอมรับข่าวสาร… */
            textTh: string;
        };
        RealtimeAuthDto: {
            /**
             * @example [
             *       "user:0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
             *     ]
             */
            channels: string[];
            /**
             * Format: date-time
             * @example 2026-09-23T14:06:00+07:00
             */
            expiresAt: string;
            /** @example /v1/store/realtime/stream */
            streamPath: string;
            /**
             * @description Pass as `?token=` to the stream; valid 60 s
             * @example eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCJ9.eyJjaCI6W119.c2ln
             */
            token: string;
        };
        ReasonDto: {
            /** @example Left the company */
            reason: string;
        };
        RecordConsentDto: {
            /** @example true */
            granted: boolean;
            /** @example marketing_line */
            purpose: string;
            /**
             * @default web
             * @example web
             */
            source: components["schemas"]["ConsentSource"];
        };
        RefreshDto: {
            /** @example rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0 */
            refreshToken: string;
        };
        RejectDto: {
            /** @example Bank letter does not match the vendor name */
            comment: string;
        };
        RenderedMessageDto: {
            /**
             * @description HTML for e-mail, text otherwise
             * @example คำขอ discount_memo รอการอนุมัติของคุณ
             */
            body: string;
            /** @example มีคำขออนุมัติรอคุณ */
            subject: string | null;
        };
        RoleDto: {
            /**
             * @description Audience of users who may hold it
             * @example staff
             */
            audience: components["schemas"]["TokenAudience"];
            /** @example finance */
            key: string;
            /** @example Finance */
            nameEn: string;
            /** @example การเงิน */
            nameTh: string;
            /**
             * @example [
             *       "approvals.act",
             *       "factory_cost.read"
             *     ]
             */
            permissions: string[];
            /** @example platform */
            scopeType: components["schemas"]["RoleScopeType"];
        };
        RoleGrantDto: {
            /**
             * Format: uuid
             * @description Grant id
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000a001
             */
            id: string;
            /** @example Joined the finance team */
            reason: string;
            /** @example finance */
            role: string;
            /**
             * Format: uuid
             * @description Factory/company id; null for platform roles
             * @example null
             */
            scopeId: string | null;
            /** @example platform */
            scopeType: components["schemas"]["RoleScopeType"];
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            validFrom: string;
            /**
             * Format: date-time
             * @description Time-boxed grants (Auditor, §8)
             * @example null
             */
            validTo: string | null;
        };
        RoleScopeDto: {
            /**
             * Format: uuid
             * @description Factory or company id
             * @example 0192f3a0-7c1e-7d2a-9b1f-000000000f01
             */
            id: string;
            /** @example factory */
            type: components["schemas"]["ScopedType"];
        };
        /** @enum {string} */
        RoleScopeType: "platform" | "factory" | "company";
        /** @enum {string} */
        ScopedType: "factory" | "company";
        SetPreferencesDto: {
            items: components["schemas"]["NotificationPreferenceDto"][];
        };
        SetRouteEnabledDto: {
            /** @example false */
            enabled: boolean;
        };
        /** @enum {string} */
        SettingConfirmation: "confirmed" | "proposed" | "pending_cpa" | "pending_business";
        SettingDetailDto: {
            /**
             * @description Approval policy a change goes through
             * @example null
             */
            approvalPolicy: string | null;
            /** @example confirmed */
            confirmationStatus: components["schemas"]["SettingConfirmation"];
            /** @description The version in force now */
            current: components["schemas"]["SettingValueVersionDto"] | null;
            /**
             * @example [
             *       "D-012",
             *       "D-063"
             *     ]
             */
            decisionRefs: string[];
            /** @example D-012 margin floor for automatic reassignment and discounts (percent) */
            description: string;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000e0e0
             */
            id: string;
            /** @example pricing.margin_floor_pct */
            key: string;
            /**
             * @description True when values below are hidden for this user
             * @example false
             */
            masked: boolean;
            /**
             * @description Role allowed to change it (D-063)
             * @example superadmin
             */
            ownerRole: string;
            /** @description Version waiting for approval */
            pending: components["schemas"]["SettingValueVersionDto"] | null;
            /** @description Approved versions that take effect later */
            scheduled: components["schemas"]["SettingValueVersionDto"][];
            /**
             * Format: uuid
             * @description Entity id for entity settings
             * @example null
             */
            scopeId: string | null;
            /** @example platform */
            scopeType: components["schemas"]["SettingScope"];
            /**
             * @description Values hidden without `settings.read_sensitive`
             * @example false
             */
            sensitive: boolean;
            /** @example percent */
            valueType: components["schemas"]["SettingValueType"];
            /** @description Full history, newest first (immutable) */
            versions: components["schemas"]["SettingVersionDto"][];
        };
        SettingDto: {
            /**
             * @description Approval policy a change goes through
             * @example null
             */
            approvalPolicy: string | null;
            /** @example confirmed */
            confirmationStatus: components["schemas"]["SettingConfirmation"];
            /** @description The version in force now */
            current: components["schemas"]["SettingValueVersionDto"] | null;
            /**
             * @example [
             *       "D-012",
             *       "D-063"
             *     ]
             */
            decisionRefs: string[];
            /** @example D-012 margin floor for automatic reassignment and discounts (percent) */
            description: string;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000e0e0
             */
            id: string;
            /** @example pricing.margin_floor_pct */
            key: string;
            /**
             * @description True when values below are hidden for this user
             * @example false
             */
            masked: boolean;
            /**
             * @description Role allowed to change it (D-063)
             * @example superadmin
             */
            ownerRole: string;
            /** @description Version waiting for approval */
            pending: components["schemas"]["SettingValueVersionDto"] | null;
            /** @description Approved versions that take effect later */
            scheduled: components["schemas"]["SettingValueVersionDto"][];
            /**
             * Format: uuid
             * @description Entity id for entity settings
             * @example null
             */
            scopeId: string | null;
            /** @example platform */
            scopeType: components["schemas"]["SettingScope"];
            /**
             * @description Values hidden without `settings.read_sensitive`
             * @example false
             */
            sensitive: boolean;
            /** @example percent */
            valueType: components["schemas"]["SettingValueType"];
        };
        /** @enum {string} */
        SettingScope: "platform" | "entity" | "product_type";
        /** @enum {string} */
        SettingValueType: "string" | "integer" | "decimal" | "money" | "percent" | "boolean" | "duration" | "time_of_day_window" | "date" | "enum" | "json";
        SettingValueVersionDto: {
            /**
             * Format: date-time
             * @example 2027-01-01T00:00:00+07:00
             */
            effectiveFrom: string;
            /**
             * @description null when masked (sensitive setting)
             * @example 12
             */
            value: (string | number | boolean | {
                [key: string]: unknown;
            } | {
                [key: string]: unknown;
            }[]) | null;
            /** @example 2 */
            versionNo: number;
        };
        SettingVersionDto: {
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            createdAt: string;
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            decidedAt: string | null;
            /**
             * Format: date-time
             * @example 2027-01-01T00:00:00+07:00
             */
            effectiveFrom: string;
            /** @example Raise the floor for the new fiscal year */
            reason: string;
            /** @example approved */
            status: components["schemas"]["ConfigVersionStatus"];
            /**
             * @description null when masked (sensitive setting)
             * @example 12
             */
            value: (string | number | boolean | {
                [key: string]: unknown;
            } | {
                [key: string]: unknown;
            }[]) | null;
            /** @example 2 */
            versionNo: number;
        };
        /** @enum {string} */
        SortOrder: "asc" | "desc";
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
        SubscribeWebPushDto: {
            /**
             * Format: uri
             * @example https://push.example.com/subscription/abc123
             */
            endpoint: string;
            keys: components["schemas"]["WebPushKeysDto"];
            /** @example Mozilla/5.0 (fake test agent) */
            userAgent?: string;
        };
        TemplateVersionDto: {
            /**
             * @description Handlebars; MJML allowed for e-mail
             * @example คำขอ {{payload.policyKey}} รอการอนุมัติของคุณ
             */
            body: string;
            /** @example th */
            locale: components["schemas"]["LocaleCode"];
            /**
             * Format: date-time
             * @example 2026-09-23T14:05:00+07:00
             */
            publishedAt: string | null;
            /** @example published */
            status: components["schemas"]["TemplateVersionStatus"];
            /** @example มีคำขออนุมัติรอคุณ */
            subject: string | null;
            /** @example 1 */
            versionNo: number;
        };
        /** @enum {string} */
        TemplateVersionStatus: "draft" | "published" | "retired";
        TestSendResultDto: {
            /**
             * @description Where it went (masked)
             * @example f***@example.com
             */
            sentTo: string | null;
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
        UpdateFeatureFlagDto: {
            /** @example Deliveree carrier adapter (D-114) */
            description?: string;
            /** @example true */
            enabled: boolean;
            rules?: components["schemas"]["FeatureFlagRulesDto"];
        };
        UploadPartDto: {
            /** @example 1 */
            partNumber: number;
            /** @example https://packio-files.s3.example.com/…&partNumber=1 */
            url: string;
        };
        UserAdminDto: {
            /**
             * Format: date-time
             * @example 2026-09-01T09:00:00+07:00
             */
            createdAt: string;
            /** @example การเงิน ทดสอบ */
            displayName: string;
            /** @example finance.one@example.com */
            email: string | null;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            id: string;
            /** @example staff */
            kind: components["schemas"]["TokenAudience"];
            /**
             * Format: date-time
             * @example 2026-09-23T09:00:00+07:00
             */
            lastLoginAt: string | null;
            /** @example +66810001234 */
            phone: string | null;
            roles: components["schemas"]["RoleGrantDto"][];
            /** @example active */
            status: components["schemas"]["UserStatus"];
        };
        UserRefDto: {
            /** @example การเงิน ทดสอบ */
            displayName: string;
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b
             */
            id: string;
        };
        /** @enum {string} */
        UserStatus: "pending_verification" | "active" | "suspended" | "inactive";
        VapidKeyDto: {
            /** @example BFakeVapidPublicKey */
            vapidPublicKey: string | null;
        };
        WebPushKeysDto: {
            /**
             * @description Stored encrypted
             * @example tBHItJI5svbpez7KI4CCXg
             */
            auth: string;
            /** @example BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM */
            p256dh: string;
        };
        WebPushSubscriptionDto: {
            /**
             * Format: uuid
             * @example 0192f3a0-7c1e-7d2a-9b1f-00000000beef
             */
            id: string;
            /**
             * @description VAPID public key for PushManager.subscribe
             * @example BFakeVapidPublicKey
             */
            vapidPublicKey: string | null;
        };
        WithdrawDto: {
            /** @example Raised by mistake */
            reason: string;
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
    "admin.approvalDelegations.list": {
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
            /** @description Delegations */
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
                     * @example [
                     *       {
                     *         "delegate": {
                     *           "displayName": "ผู้แทน ทดสอบ",
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c1"
                     *         },
                     *         "delegator": {
                     *           "displayName": "การเงิน ทดสอบ",
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *         },
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000d001",
                     *         "policy": null,
                     *         "reason": "Annual leave",
                     *         "revokedAt": null,
                     *         "validFrom": "2026-10-01T00:00:00+07:00",
                     *         "validTo": "2026-10-08T00:00:00+07:00"
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["DelegationDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.approvalDelegations.create": {
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
                "application/json": components["schemas"]["CreateDelegationDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
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
                     *       "delegate": {
                     *         "displayName": "ผู้แทน ทดสอบ",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c1"
                     *       },
                     *       "delegator": {
                     *         "displayName": "การเงิน ทดสอบ",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *       },
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000d001",
                     *       "policy": null,
                     *       "reason": "Annual leave",
                     *       "revokedAt": null,
                     *       "validFrom": "2026-10-01T00:00:00+07:00",
                     *       "validTo": "2026-10-08T00:00:00+07:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DelegationDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `approval.delegation_invalid`, `validation.failed` */
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
    "admin.approvalDelegations.revoke": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                delegationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Revoked */
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
                     *       "delegate": {
                     *         "displayName": "ผู้แทน ทดสอบ",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c1"
                     *       },
                     *       "delegator": {
                     *         "displayName": "การเงิน ทดสอบ",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *       },
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000d001",
                     *       "policy": null,
                     *       "reason": "Annual leave",
                     *       "revokedAt": "2026-10-03T09:00:00+07:00",
                     *       "validFrom": "2026-10-01T00:00:00+07:00",
                     *       "validTo": "2026-10-08T00:00:00+07:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DelegationDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.approvals.list": {
        parameters: {
            query?: {
                order?: components["schemas"]["SortOrder"];
                page?: number;
                perPage?: number;
                policy?: string;
                /** @description Free-text search */
                q?: string;
                /** @description Sort field; each endpoint validates it against its own allow-list. */
                sort?: string;
                status?: components["schemas"]["ApprovalStatus"];
                subjectType?: string;
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page of results */
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
                     *       "data": [
                     *         {
                     *           "actions": [
                     *             {
                     *               "action": "approve",
                     *               "actor": {
                     *                 "displayName": "การเงิน ทดสอบ",
                     *                 "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *               },
                     *               "at": "2026-09-23T15:00:00+07:00",
                     *               "comment": "Verified by phone with the factory",
                     *               "onBehalfOf": null,
                     *               "stepNo": 1
                     *             }
                     *           ],
                     *           "amount": null,
                     *           "createdAt": "2026-09-23T14:05:00+07:00",
                     *           "currency": "THB",
                     *           "currentStepNo": 2,
                     *           "decidedAt": null,
                     *           "expiresAt": null,
                     *           "flags": [],
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a0a0",
                     *           "payload": {
                     *             "bankLast4": "1234",
                     *             "vendor": "โรงงาน ทดสอบ"
                     *           },
                     *           "pct": null,
                     *           "policy": "vendor_bank_account_change",
                     *           "requester": {
                     *             "displayName": "ผู้ขอ ทดสอบ",
                     *             "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c0"
                     *           },
                     *           "status": "pending",
                     *           "steps": [
                     *             {
                     *               "completedAt": "2026-09-23T15:00:00+07:00",
                     *               "dueAt": null,
                     *               "quorum": 1,
                     *               "role": "finance",
                     *               "status": "approved",
                     *               "stepNo": 1
                     *             },
                     *             {
                     *               "completedAt": null,
                     *               "dueAt": null,
                     *               "quorum": 1,
                     *               "role": "finance_manager",
                     *               "status": "pending",
                     *               "stepNo": 2
                     *             }
                     *           ],
                     *           "subjectId": "0192f3a0-7c1e-7d2a-9b1f-00000000b0b0",
                     *           "subjectType": "vendor_bank_account"
                     *         }
                     *       ],
                     *       "meta": {
                     *         "page": 1,
                     *         "perPage": 25,
                     *         "total": 1
                     *       }
                     *     }
                     */
                    "application/json": {
                        data: components["schemas"]["ApprovalRequestDto"][];
                        meta: components["schemas"]["PageMeta"];
                    };
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.approvals.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The request */
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
                     *       "actions": [
                     *         {
                     *           "action": "approve",
                     *           "actor": {
                     *             "displayName": "การเงิน ทดสอบ",
                     *             "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *           },
                     *           "at": "2026-09-23T15:00:00+07:00",
                     *           "comment": "Verified by phone with the factory",
                     *           "onBehalfOf": null,
                     *           "stepNo": 1
                     *         }
                     *       ],
                     *       "amount": null,
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "currency": "THB",
                     *       "currentStepNo": 2,
                     *       "decidedAt": null,
                     *       "expiresAt": null,
                     *       "flags": [],
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a0a0",
                     *       "payload": {
                     *         "bankLast4": "1234",
                     *         "vendor": "โรงงาน ทดสอบ"
                     *       },
                     *       "pct": null,
                     *       "policy": "vendor_bank_account_change",
                     *       "requester": {
                     *         "displayName": "ผู้ขอ ทดสอบ",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c0"
                     *       },
                     *       "status": "pending",
                     *       "steps": [
                     *         {
                     *           "completedAt": "2026-09-23T15:00:00+07:00",
                     *           "dueAt": null,
                     *           "quorum": 1,
                     *           "role": "finance",
                     *           "status": "approved",
                     *           "stepNo": 1
                     *         },
                     *         {
                     *           "completedAt": null,
                     *           "dueAt": null,
                     *           "quorum": 1,
                     *           "role": "finance_manager",
                     *           "status": "pending",
                     *           "stepNo": 2
                     *         }
                     *       ],
                     *       "subjectId": "0192f3a0-7c1e-7d2a-9b1f-00000000b0b0",
                     *       "subjectType": "vendor_bank_account"
                     *     }
                     */
                    "application/json": components["schemas"]["ApprovalRequestDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.approvals.approve": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApproveDto"];
            };
        };
        responses: {
            /** @description Updated request */
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
                     *       "actions": [
                     *         {
                     *           "action": "approve",
                     *           "actor": {
                     *             "displayName": "การเงิน ทดสอบ",
                     *             "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *           },
                     *           "at": "2026-09-23T15:00:00+07:00",
                     *           "comment": "Verified by phone with the factory",
                     *           "onBehalfOf": null,
                     *           "stepNo": 1
                     *         }
                     *       ],
                     *       "amount": null,
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "currency": "THB",
                     *       "currentStepNo": 2,
                     *       "decidedAt": null,
                     *       "expiresAt": null,
                     *       "flags": [],
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a0a0",
                     *       "payload": {
                     *         "bankLast4": "1234",
                     *         "vendor": "โรงงาน ทดสอบ"
                     *       },
                     *       "pct": null,
                     *       "policy": "vendor_bank_account_change",
                     *       "requester": {
                     *         "displayName": "ผู้ขอ ทดสอบ",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c0"
                     *       },
                     *       "status": "pending",
                     *       "steps": [
                     *         {
                     *           "completedAt": "2026-09-23T15:00:00+07:00",
                     *           "dueAt": null,
                     *           "quorum": 1,
                     *           "role": "finance",
                     *           "status": "approved",
                     *           "stepNo": 1
                     *         },
                     *         {
                     *           "completedAt": null,
                     *           "dueAt": null,
                     *           "quorum": 1,
                     *           "role": "finance_manager",
                     *           "status": "pending",
                     *           "stepNo": 2
                     *         }
                     *       ],
                     *       "subjectId": "0192f3a0-7c1e-7d2a-9b1f-00000000b0b0",
                     *       "subjectType": "vendor_bank_account"
                     *     }
                     */
                    "application/json": components["schemas"]["ApprovalRequestDto"];
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
            /** @description Problem: `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `approval.not_authorised`, `approval.self_approval`, `auth.forbidden` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
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
            /** @description Problem: `approval.already_acted`, `approval.expired`, `approval.not_pending`, `iam.sod_conflict` */
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
        };
    };
    "admin.approvals.reject": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RejectDto"];
            };
        };
        responses: {
            /** @description Rejected */
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
                     *       "actions": [
                     *         {
                     *           "action": "approve",
                     *           "actor": {
                     *             "displayName": "การเงิน ทดสอบ",
                     *             "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *           },
                     *           "at": "2026-09-23T15:00:00+07:00",
                     *           "comment": "Verified by phone with the factory",
                     *           "onBehalfOf": null,
                     *           "stepNo": 1
                     *         }
                     *       ],
                     *       "amount": null,
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "currency": "THB",
                     *       "currentStepNo": 2,
                     *       "decidedAt": null,
                     *       "expiresAt": null,
                     *       "flags": [],
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a0a0",
                     *       "payload": {
                     *         "bankLast4": "1234",
                     *         "vendor": "โรงงาน ทดสอบ"
                     *       },
                     *       "pct": null,
                     *       "policy": "vendor_bank_account_change",
                     *       "requester": {
                     *         "displayName": "ผู้ขอ ทดสอบ",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c0"
                     *       },
                     *       "status": "rejected",
                     *       "steps": [
                     *         {
                     *           "completedAt": "2026-09-23T15:00:00+07:00",
                     *           "dueAt": null,
                     *           "quorum": 1,
                     *           "role": "finance",
                     *           "status": "approved",
                     *           "stepNo": 1
                     *         },
                     *         {
                     *           "completedAt": null,
                     *           "dueAt": null,
                     *           "quorum": 1,
                     *           "role": "finance_manager",
                     *           "status": "pending",
                     *           "stepNo": 2
                     *         }
                     *       ],
                     *       "subjectId": "0192f3a0-7c1e-7d2a-9b1f-00000000b0b0",
                     *       "subjectType": "vendor_bank_account"
                     *     }
                     */
                    "application/json": components["schemas"]["ApprovalRequestDto"];
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
            /** @description Problem: `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `approval.not_authorised`, `approval.self_approval`, `auth.forbidden` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
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
            /** @description Problem: `approval.expired`, `approval.not_pending` */
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
        };
    };
    "admin.approvals.withdraw": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WithdrawDto"];
            };
        };
        responses: {
            /** @description Withdrawn */
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
                     *       "actions": [
                     *         {
                     *           "action": "approve",
                     *           "actor": {
                     *             "displayName": "การเงิน ทดสอบ",
                     *             "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *           },
                     *           "at": "2026-09-23T15:00:00+07:00",
                     *           "comment": "Verified by phone with the factory",
                     *           "onBehalfOf": null,
                     *           "stepNo": 1
                     *         }
                     *       ],
                     *       "amount": null,
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "currency": "THB",
                     *       "currentStepNo": 2,
                     *       "decidedAt": null,
                     *       "expiresAt": null,
                     *       "flags": [],
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a0a0",
                     *       "payload": {
                     *         "bankLast4": "1234",
                     *         "vendor": "โรงงาน ทดสอบ"
                     *       },
                     *       "pct": null,
                     *       "policy": "vendor_bank_account_change",
                     *       "requester": {
                     *         "displayName": "ผู้ขอ ทดสอบ",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c0"
                     *       },
                     *       "status": "withdrawn",
                     *       "steps": [
                     *         {
                     *           "completedAt": "2026-09-23T15:00:00+07:00",
                     *           "dueAt": null,
                     *           "quorum": 1,
                     *           "role": "finance",
                     *           "status": "approved",
                     *           "stepNo": 1
                     *         },
                     *         {
                     *           "completedAt": null,
                     *           "dueAt": null,
                     *           "quorum": 1,
                     *           "role": "finance_manager",
                     *           "status": "pending",
                     *           "stepNo": 2
                     *         }
                     *       ],
                     *       "subjectId": "0192f3a0-7c1e-7d2a-9b1f-00000000b0b0",
                     *       "subjectType": "vendor_bank_account"
                     *     }
                     */
                    "application/json": components["schemas"]["ApprovalRequestDto"];
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
            /** @description Problem: `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `approval.not_authorised`, `auth.forbidden` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
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
            /** @description Problem: `approval.not_pending` */
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
        };
    };
    "admin.approvals.inbox": {
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
            /** @description Inbox */
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
                     * @example [
                     *       {
                     *         "actions": [
                     *           {
                     *             "action": "approve",
                     *             "actor": {
                     *               "displayName": "การเงิน ทดสอบ",
                     *               "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *             },
                     *             "at": "2026-09-23T15:00:00+07:00",
                     *             "comment": "Verified by phone with the factory",
                     *             "onBehalfOf": null,
                     *             "stepNo": 1
                     *           }
                     *         ],
                     *         "amount": null,
                     *         "createdAt": "2026-09-23T14:05:00+07:00",
                     *         "currency": "THB",
                     *         "currentStepNo": 2,
                     *         "decidedAt": null,
                     *         "expiresAt": null,
                     *         "flags": [],
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a0a0",
                     *         "payload": {
                     *           "bankLast4": "1234",
                     *           "vendor": "โรงงาน ทดสอบ"
                     *         },
                     *         "pct": null,
                     *         "policy": "vendor_bank_account_change",
                     *         "requester": {
                     *           "displayName": "ผู้ขอ ทดสอบ",
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c0"
                     *         },
                     *         "status": "pending",
                     *         "steps": [
                     *           {
                     *             "completedAt": "2026-09-23T15:00:00+07:00",
                     *             "dueAt": null,
                     *             "quorum": 1,
                     *             "role": "finance",
                     *             "status": "approved",
                     *             "stepNo": 1
                     *           },
                     *           {
                     *             "completedAt": null,
                     *             "dueAt": null,
                     *             "quorum": 1,
                     *             "role": "finance_manager",
                     *             "status": "pending",
                     *             "stepNo": 2
                     *           }
                     *         ],
                     *         "subjectId": "0192f3a0-7c1e-7d2a-9b1f-00000000b0b0",
                     *         "subjectType": "vendor_bank_account"
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["ApprovalRequestDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.auditLogs.list": {
        parameters: {
            query?: {
                action?: string;
                actorId?: string;
                category?: components["schemas"]["AuditCategory"];
                cursor?: string;
                from?: string;
                limit?: number;
                outcome?: components["schemas"]["AuditOutcome"];
                resourceId?: string;
                resourceType?: string;
                to?: string;
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One slice of the feed */
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
                     *       "data": [
                     *         {
                     *           "action": "iam.role_granted",
                     *           "actor": {
                     *             "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *             "name": "แอดมิน ทดสอบ",
                     *             "type": "user"
                     *           },
                     *           "category": "iam",
                     *           "data": {
                     *             "reason": "Joined the finance team",
                     *             "role": "finance"
                     *           },
                     *           "occurredAt": "2026-09-23T14:05:00+07:00",
                     *           "onBehalfOf": null,
                     *           "outcome": "success",
                     *           "requestId": "req-3f2a9c1d",
                     *           "resourceId": "0192f3a0-7c1e-7d2a-9b1f-00000000c0c0",
                     *           "resourceType": "user"
                     *         }
                     *       ],
                     *       "meta": {
                     *         "nextCursor": "eyJpZCI6IjEyMyJ9"
                     *       }
                     *     }
                     */
                    "application/json": {
                        data: components["schemas"]["AuditEntryDto"][];
                        meta: components["schemas"]["CursorMeta"];
                    };
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.auditLogs.export": {
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
                "application/json": components["schemas"]["AuditFilterDto"];
            };
        };
        responses: {
            /** @description Export ready */
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
                     *       "expiresAt": "2026-09-23T14:10:00+07:00",
                     *       "fileId": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "rows": 1250,
                     *       "truncated": false,
                     *       "url": "https://packio-files.s3.example.com/…&X-Amz-Expires=300"
                     *     }
                     */
                    "application/json": components["schemas"]["AuditExportDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.consentPurposes.list": {
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
            /** @description Purposes */
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
                     * @example [
                     *       {
                     *         "key": "marketing_line",
                     *         "required": false,
                     *         "versions": [
                     *           {
                     *             "effectiveFrom": "2026-10-01T00:00:00+07:00",
                     *             "textEn": "I agree to receive news…",
                     *             "textTh": "ข้าพเจ้ายินยอมรับข่าวสาร…",
                     *             "versionNo": 1
                     *           }
                     *         ]
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["ConsentPurposeDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.consentPurposes.publishText": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishConsentTextDto"];
            };
        };
        responses: {
            /** @description Published */
            201: {
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
                     *       "key": "marketing_line",
                     *       "required": false,
                     *       "versions": [
                     *         {
                     *           "effectiveFrom": "2026-10-01T00:00:00+07:00",
                     *           "textEn": "I agree to receive news…",
                     *           "textTh": "ข้าพเจ้ายินยอมรับข่าวสาร…",
                     *           "versionNo": 1
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["ConsentPurposeDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `settings.backdated`, `validation.failed` */
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
    "admin.featureFlags.list": {
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
            /** @description Flags */
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
                     * @example [
                     *       {
                     *         "description": "Deliveree carrier adapter (D-114)",
                     *         "enabled": true,
                     *         "key": "carriers.deliveree",
                     *         "rules": {
                     *           "audiences": [
                     *             "staff"
                     *           ],
                     *           "percentage": 100
                     *         },
                     *         "updatedAt": "2026-09-23T14:05:00+07:00"
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["FeatureFlagDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.featureFlags.set": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateFeatureFlagDto"];
            };
        };
        responses: {
            /** @description Saved */
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
                     *       "description": "Deliveree carrier adapter (D-114)",
                     *       "enabled": true,
                     *       "key": "carriers.deliveree",
                     *       "rules": {
                     *         "audiences": [
                     *           "staff"
                     *         ],
                     *         "percentage": 100
                     *       },
                     *       "updatedAt": "2026-09-23T14:05:00+07:00"
                     *     }
                     */
                    "application/json": components["schemas"]["FeatureFlagDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.files.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The file */
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
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "heightPx": null,
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "mimeType": "application/pdf",
                     *       "originalName": "box-front.pdf",
                     *       "pageCount": 2,
                     *       "retentionClass": "customer_content",
                     *       "scanStatus": "clean",
                     *       "sha256": null,
                     *       "sizeBytes": 2457600,
                     *       "thumbnailId": null,
                     *       "uploadStatus": "uploaded",
                     *       "widthPx": null
                     *     }
                     */
                    "application/json": components["schemas"]["FileDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.files.abort": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cancelled */
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
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
        };
    };
    "admin.files.complete": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompleteUploadDto"];
            };
        };
        responses: {
            /** @description Uploaded */
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
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "heightPx": null,
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "mimeType": "application/pdf",
                     *       "originalName": "box-front.pdf",
                     *       "pageCount": null,
                     *       "retentionClass": "customer_content",
                     *       "scanStatus": "pending",
                     *       "sha256": null,
                     *       "sizeBytes": 2457600,
                     *       "thumbnailId": null,
                     *       "uploadStatus": "uploaded",
                     *       "widthPx": null
                     *     }
                     */
                    "application/json": components["schemas"]["FileDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
            409: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `file.upload_incomplete`, `validation.failed` */
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
    "admin.files.download": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signed URL */
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
                     *       "expiresAt": "2026-09-23T14:10:00+07:00",
                     *       "url": "https://packio-files.s3.example.com/…&X-Amz-Expires=300"
                     *     }
                     */
                    "application/json": components["schemas"]["DownloadUrlDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `file.infected`, `file.not_ready` */
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
        };
    };
    "admin.files.presign": {
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
                "application/json": components["schemas"]["PresignFileDto"];
            };
        };
        responses: {
            /** @description Upload started */
            201: {
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
                     *       "expiresAt": "2026-09-23T14:20:00+07:00",
                     *       "fileId": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "headers": {
                     *         "Content-Type": "application/pdf"
                     *       },
                     *       "multipart": null,
                     *       "uploadUrl": "https://packio-files.s3.example.com/…"
                     *     }
                     */
                    "application/json": components["schemas"]["PresignedUploadDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `file.too_large`, `file.type_not_allowed`, `validation.failed` */
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
    "admin.notificationRoutes.list": {
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
            /** @description Routes */
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
                     * @example [
                     *       {
                     *         "audience": "assignee",
                     *         "channel": "in_app",
                     *         "enabled": true,
                     *         "eventType": "approval.requested",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f0f0",
                     *         "isCritical": false,
                     *         "isMarketing": false,
                     *         "staffTeam": null,
                     *         "template": "approval.requested:assignee"
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["NotificationRouteDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.notificationRoutes.create": {
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
                "application/json": components["schemas"]["CreateRouteDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
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
                     *       "audience": "assignee",
                     *       "channel": "in_app",
                     *       "enabled": true,
                     *       "eventType": "approval.requested",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f0f0",
                     *       "isCritical": false,
                     *       "isMarketing": false,
                     *       "staffTeam": null,
                     *       "template": "approval.requested:assignee"
                     *     }
                     */
                    "application/json": components["schemas"]["NotificationRouteDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
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
        };
    };
    "admin.notificationRoutes.setEnabled": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                routeId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetRouteEnabledDto"];
            };
        };
        responses: {
            /** @description Updated */
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
                     *       "audience": "assignee",
                     *       "channel": "in_app",
                     *       "enabled": false,
                     *       "eventType": "approval.requested",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f0f0",
                     *       "isCritical": false,
                     *       "isMarketing": false,
                     *       "staffTeam": null,
                     *       "template": "approval.requested:assignee"
                     *     }
                     */
                    "application/json": components["schemas"]["NotificationRouteDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.notificationTemplates.list": {
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
            /** @description Templates */
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
                     * @example [
                     *       {
                     *         "category": "transactional",
                     *         "channel": "in_app",
                     *         "description": "Approvers: a request waits for your decision",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f00d",
                     *         "key": "approval.requested:assignee",
                     *         "versions": [
                     *           {
                     *             "body": "คำขอ {{payload.policyKey}} รอการอนุมัติของคุณ",
                     *             "locale": "th",
                     *             "publishedAt": "2026-09-23T14:05:00+07:00",
                     *             "status": "published",
                     *             "subject": "มีคำขออนุมัติรอคุณ",
                     *             "versionNo": 1
                     *           }
                     *         ]
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["NotificationTemplateDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.notificationTemplates.create": {
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
                "application/json": components["schemas"]["CreateTemplateDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
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
                     *       "category": "transactional",
                     *       "channel": "in_app",
                     *       "description": "Approvers: a request waits for your decision",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f00d",
                     *       "key": "approval.requested:assignee",
                     *       "versions": []
                     *     }
                     */
                    "application/json": components["schemas"]["NotificationTemplateDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
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
        };
    };
    "admin.notificationTemplates.preview": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                templateId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreviewTemplateDto"];
            };
        };
        responses: {
            /** @description Rendered */
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
                     *       "body": "คำขอ discount_memo รอการอนุมัติของคุณ",
                     *       "subject": "มีคำขออนุมัติรอคุณ"
                     *     }
                     */
                    "application/json": components["schemas"]["RenderedMessageDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.notificationTemplates.testSend": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                templateId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreviewTemplateDto"];
            };
        };
        responses: {
            /** @description Sent */
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
                     *       "sentTo": "f***@example.com"
                     *     }
                     */
                    "application/json": components["schemas"]["TestSendResultDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `notification.channel_unsupported`, `validation.failed` */
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
    "admin.notificationTemplates.addVersion": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                templateId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AddTemplateVersionDto"];
            };
        };
        responses: {
            /** @description Draft added */
            201: {
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
                     *       "category": "transactional",
                     *       "channel": "in_app",
                     *       "description": "Approvers: a request waits for your decision",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f00d",
                     *       "key": "approval.requested:assignee",
                     *       "versions": [
                     *         {
                     *           "body": "คำขอ {{payload.policyKey}} รอการอนุมัติของคุณ",
                     *           "locale": "th",
                     *           "publishedAt": "2026-09-23T14:05:00+07:00",
                     *           "status": "published",
                     *           "subject": "มีคำขออนุมัติรอคุณ",
                     *           "versionNo": 1
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["NotificationTemplateDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.notificationTemplates.publish": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                locale: string;
                templateId: string;
                versionNo: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Published */
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
                     *       "category": "transactional",
                     *       "channel": "in_app",
                     *       "description": "Approvers: a request waits for your decision",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f00d",
                     *       "key": "approval.requested:assignee",
                     *       "versions": [
                     *         {
                     *           "body": "คำขอ {{payload.policyKey}} รอการอนุมัติของคุณ",
                     *           "locale": "th",
                     *           "publishedAt": "2026-09-23T14:05:00+07:00",
                     *           "status": "published",
                     *           "subject": "มีคำขออนุมัติรอคุณ",
                     *           "versionNo": 1
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["NotificationTemplateDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
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
        };
    };
    "admin.notifications.list": {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One slice of the feed */
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
                     *       "data": [
                     *         {
                     *           "body": "คำขอ discount_memo รอการอนุมัติของคุณ",
                     *           "createdAt": "2026-09-23T14:05:00+07:00",
                     *           "eventType": "approval.requested",
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000e001",
                     *           "readAt": null,
                     *           "title": "มีคำขออนุมัติรอคุณ"
                     *         }
                     *       ],
                     *       "meta": {
                     *         "nextCursor": "eyJpZCI6IjEyMyJ9"
                     *       }
                     *     }
                     */
                    "application/json": {
                        data: components["schemas"]["InboxItemDto"][];
                        meta: components["schemas"]["CursorMeta"];
                    };
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.notifications.markRead": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                notificationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Marked read */
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.outbox.list": {
        parameters: {
            query?: {
                order?: components["schemas"]["SortOrder"];
                page?: number;
                perPage?: number;
                /** @description Free-text search */
                q?: string;
                /** @description Sort field; each endpoint validates it against its own allow-list. */
                sort?: string;
                status?: components["schemas"]["OutboxStatus"];
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page of results */
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
                     *       "data": [
                     *         {
                     *           "aggregateId": "0192f3a0-7c1e-7d2a-9b1f-00000000a0a0",
                     *           "aggregateType": "approval_request",
                     *           "attempts": 3,
                     *           "eventId": "0192f3a0-7c1e-7d2a-9b1f-00000000e001",
                     *           "lastError": "notifications.router: Error: provider down",
                     *           "occurredAt": "2026-09-23T14:05:00+07:00",
                     *           "status": "dead",
                     *           "type": "approval.approved"
                     *         }
                     *       ],
                     *       "meta": {
                     *         "page": 1,
                     *         "perPage": 25,
                     *         "total": 1
                     *       }
                     *     }
                     */
                    "application/json": {
                        data: components["schemas"]["OutboxMessageDto"][];
                        meta: components["schemas"]["PageMeta"];
                    };
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.outbox.replay": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Queued again */
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
                     *       "aggregateId": "0192f3a0-7c1e-7d2a-9b1f-00000000a0a0",
                     *       "aggregateType": "approval_request",
                     *       "attempts": 3,
                     *       "eventId": "0192f3a0-7c1e-7d2a-9b1f-00000000e001",
                     *       "lastError": null,
                     *       "occurredAt": "2026-09-23T14:05:00+07:00",
                     *       "status": "pending",
                     *       "type": "approval.approved"
                     *     }
                     */
                    "application/json": components["schemas"]["OutboxMessageDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `outbox.not_replayable` */
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
        };
    };
    "admin.realtime.auth": {
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
            /** @description Stream token */
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
                     *       "channels": [
                     *         "user:0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *       ],
                     *       "expiresAt": "2026-09-23T14:06:00+07:00",
                     *       "streamPath": "/v1/admin/realtime/stream",
                     *       "token": "eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCJ9.eyJjaCI6W119.c2ln"
                     *     }
                     */
                    "application/json": components["schemas"]["RealtimeAuthDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.realtime.stream": {
        parameters: {
            query: {
                /** @description From `POST …/realtime/auth` */
                token: unknown;
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event stream */
            200: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example event: notification.created
                     *     data: {"type":"notification.created","id":"0192f3a0-7c1e-7d2a-9b1f-00000000e001","channel":"user:0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"}
                     */
                    "text/event-stream": string;
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.roles.list": {
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
            /** @description Roles */
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
                     * @example [
                     *       {
                     *         "audience": "staff",
                     *         "key": "finance",
                     *         "nameEn": "Finance",
                     *         "nameTh": "การเงิน",
                     *         "permissions": [
                     *           "approvals.act",
                     *           "factory_cost.read"
                     *         ],
                     *         "scopeType": "platform"
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["RoleDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.settings.list": {
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
            /** @description Settings */
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
                     * @example [
                     *       {
                     *         "approvalPolicy": null,
                     *         "confirmationStatus": "confirmed",
                     *         "current": {
                     *           "effectiveFrom": "2026-01-01T00:00:00+07:00",
                     *           "value": "10",
                     *           "versionNo": 1
                     *         },
                     *         "decisionRefs": [
                     *           "D-012",
                     *           "D-063"
                     *         ],
                     *         "description": "D-012 margin floor for automatic reassignment and discounts (percent)",
                     *         "id": "0192f3a0-7c1e-7d2a-9b1f-00000000e0e0",
                     *         "key": "pricing.margin_floor_pct",
                     *         "masked": false,
                     *         "ownerRole": "superadmin",
                     *         "pending": null,
                     *         "scheduled": [
                     *           {
                     *             "effectiveFrom": "2027-01-01T00:00:00+07:00",
                     *             "value": "12",
                     *             "versionNo": 2
                     *           }
                     *         ],
                     *         "scopeId": null,
                     *         "scopeType": "platform",
                     *         "sensitive": false,
                     *         "valueType": "percent"
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["SettingDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.settings.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                settingId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The setting */
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
                     *       "approvalPolicy": null,
                     *       "confirmationStatus": "confirmed",
                     *       "current": {
                     *         "effectiveFrom": "2026-01-01T00:00:00+07:00",
                     *         "value": "10",
                     *         "versionNo": 1
                     *       },
                     *       "decisionRefs": [
                     *         "D-012",
                     *         "D-063"
                     *       ],
                     *       "description": "D-012 margin floor for automatic reassignment and discounts (percent)",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000e0e0",
                     *       "key": "pricing.margin_floor_pct",
                     *       "masked": false,
                     *       "ownerRole": "superadmin",
                     *       "pending": null,
                     *       "scheduled": [
                     *         {
                     *           "effectiveFrom": "2027-01-01T00:00:00+07:00",
                     *           "value": "12",
                     *           "versionNo": 2
                     *         }
                     *       ],
                     *       "scopeId": null,
                     *       "scopeType": "platform",
                     *       "sensitive": false,
                     *       "valueType": "percent",
                     *       "versions": [
                     *         {
                     *           "createdAt": "2026-09-23T14:05:00+07:00",
                     *           "decidedAt": "2026-09-23T14:05:00+07:00",
                     *           "effectiveFrom": "2027-01-01T00:00:00+07:00",
                     *           "reason": "Raise the floor for the new fiscal year",
                     *           "status": "approved",
                     *           "value": "12",
                     *           "versionNo": 2
                     *         },
                     *         {
                     *           "createdAt": "2026-09-22T09:00:00+07:00",
                     *           "decidedAt": "2026-09-22T09:00:00+07:00",
                     *           "effectiveFrom": "2026-01-01T00:00:00+07:00",
                     *           "reason": "Seed default from D-012",
                     *           "status": "approved",
                     *           "value": "10",
                     *           "versionNo": 1
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["SettingDetailDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.settings.changeValue": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                settingId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeSettingDto"];
            };
        };
        responses: {
            /** @description Version added */
            201: {
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
                     *       "approvalPolicy": null,
                     *       "confirmationStatus": "confirmed",
                     *       "current": {
                     *         "effectiveFrom": "2026-01-01T00:00:00+07:00",
                     *         "value": "10",
                     *         "versionNo": 1
                     *       },
                     *       "decisionRefs": [
                     *         "D-012",
                     *         "D-063"
                     *       ],
                     *       "description": "D-012 margin floor for automatic reassignment and discounts (percent)",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000e0e0",
                     *       "key": "pricing.margin_floor_pct",
                     *       "masked": false,
                     *       "ownerRole": "superadmin",
                     *       "pending": null,
                     *       "scheduled": [
                     *         {
                     *           "effectiveFrom": "2027-01-01T00:00:00+07:00",
                     *           "value": "12",
                     *           "versionNo": 2
                     *         }
                     *       ],
                     *       "scopeId": null,
                     *       "scopeType": "platform",
                     *       "sensitive": false,
                     *       "valueType": "percent",
                     *       "versions": [
                     *         {
                     *           "createdAt": "2026-09-23T14:05:00+07:00",
                     *           "decidedAt": "2026-09-23T14:05:00+07:00",
                     *           "effectiveFrom": "2027-01-01T00:00:00+07:00",
                     *           "reason": "Raise the floor for the new fiscal year",
                     *           "status": "approved",
                     *           "value": "12",
                     *           "versionNo": 2
                     *         },
                     *         {
                     *           "createdAt": "2026-09-22T09:00:00+07:00",
                     *           "decidedAt": "2026-09-22T09:00:00+07:00",
                     *           "effectiveFrom": "2026-01-01T00:00:00+07:00",
                     *           "reason": "Seed default from D-012",
                     *           "status": "approved",
                     *           "value": "10",
                     *           "versionNo": 1
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["SettingDetailDto"];
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
            /** @description Problem: `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden`, `settings.not_owner` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
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
            /** @description Problem: `settings.pending_exists` */
            409: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `approval.no_matching_step`, `settings.backdated`, `validation.failed` */
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
    "admin.users.list": {
        parameters: {
            query?: {
                kind?: components["schemas"]["TokenAudience"];
                order?: components["schemas"]["SortOrder"];
                page?: number;
                perPage?: number;
                /** @description Free-text search */
                q?: string;
                /** @description Sort field; each endpoint validates it against its own allow-list. */
                sort?: string;
                status?: components["schemas"]["UserStatus"];
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page of results */
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
                     *       "data": [
                     *         {
                     *           "createdAt": "2026-09-01T09:00:00+07:00",
                     *           "displayName": "การเงิน ทดสอบ",
                     *           "email": "finance.one@example.com",
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *           "kind": "staff",
                     *           "lastLoginAt": "2026-09-23T09:00:00+07:00",
                     *           "phone": null,
                     *           "roles": [
                     *             {
                     *               "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a001",
                     *               "reason": "Joined the finance team",
                     *               "role": "finance",
                     *               "scopeId": null,
                     *               "scopeType": "platform",
                     *               "validFrom": "2026-09-01T09:00:00+07:00",
                     *               "validTo": null
                     *             }
                     *           ],
                     *           "status": "active"
                     *         }
                     *       ],
                     *       "meta": {
                     *         "page": 1,
                     *         "perPage": 25,
                     *         "total": 1
                     *       }
                     *     }
                     */
                    "application/json": {
                        data: components["schemas"]["UserAdminDto"][];
                        meta: components["schemas"]["PageMeta"];
                    };
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.users.create": {
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
                "application/json": components["schemas"]["CreateUserDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
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
                     *       "createdAt": "2026-09-01T09:00:00+07:00",
                     *       "displayName": "การเงิน ทดสอบ",
                     *       "email": "finance.one@example.com",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "kind": "staff",
                     *       "lastLoginAt": "2026-09-23T09:00:00+07:00",
                     *       "phone": null,
                     *       "roles": [],
                     *       "status": "active"
                     *     }
                     */
                    "application/json": components["schemas"]["UserAdminDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `iam.user_exists` */
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
        };
    };
    "admin.users.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The account */
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
                     *       "createdAt": "2026-09-01T09:00:00+07:00",
                     *       "displayName": "การเงิน ทดสอบ",
                     *       "email": "finance.one@example.com",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "kind": "staff",
                     *       "lastLoginAt": "2026-09-23T09:00:00+07:00",
                     *       "phone": null,
                     *       "roles": [
                     *         {
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a001",
                     *           "reason": "Joined the finance team",
                     *           "role": "finance",
                     *           "scopeId": null,
                     *           "scopeType": "platform",
                     *           "validFrom": "2026-09-01T09:00:00+07:00",
                     *           "validTo": null
                     *         }
                     *       ],
                     *       "status": "active"
                     *     }
                     */
                    "application/json": components["schemas"]["UserAdminDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.users.deactivate": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReasonDto"];
            };
        };
        responses: {
            /** @description Deactivated */
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
                     *       "createdAt": "2026-09-01T09:00:00+07:00",
                     *       "displayName": "การเงิน ทดสอบ",
                     *       "email": "finance.one@example.com",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "kind": "staff",
                     *       "lastLoginAt": "2026-09-23T09:00:00+07:00",
                     *       "phone": null,
                     *       "roles": [
                     *         {
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a001",
                     *           "reason": "Joined the finance team",
                     *           "role": "finance",
                     *           "scopeId": null,
                     *           "scopeType": "platform",
                     *           "validFrom": "2026-09-01T09:00:00+07:00",
                     *           "validTo": null
                     *         }
                     *       ],
                     *       "status": "inactive"
                     *     }
                     */
                    "application/json": components["schemas"]["UserAdminDto"];
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
            /** @description Problem: `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden`, `iam.self_grant` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
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
    "admin.users.reactivate": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReasonDto"];
            };
        };
        responses: {
            /** @description Reactivated */
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
                     *       "createdAt": "2026-09-01T09:00:00+07:00",
                     *       "displayName": "การเงิน ทดสอบ",
                     *       "email": "finance.one@example.com",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "kind": "staff",
                     *       "lastLoginAt": "2026-09-23T09:00:00+07:00",
                     *       "phone": null,
                     *       "roles": [
                     *         {
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a001",
                     *           "reason": "Joined the finance team",
                     *           "role": "finance",
                     *           "scopeId": null,
                     *           "scopeType": "platform",
                     *           "validFrom": "2026-09-01T09:00:00+07:00",
                     *           "validTo": null
                     *         }
                     *       ],
                     *       "status": "active"
                     *     }
                     */
                    "application/json": components["schemas"]["UserAdminDto"];
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
            /** @description Problem: `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden`, `iam.self_grant` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
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
    "admin.users.revokeSessions": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sessions revoked */
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.users.grantRole": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GrantRoleDto"];
            };
        };
        responses: {
            /** @description Granted */
            201: {
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
                     *       "createdAt": "2026-09-01T09:00:00+07:00",
                     *       "displayName": "การเงิน ทดสอบ",
                     *       "email": "finance.one@example.com",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "kind": "staff",
                     *       "lastLoginAt": "2026-09-23T09:00:00+07:00",
                     *       "phone": null,
                     *       "roles": [
                     *         {
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000a001",
                     *           "reason": "Joined the finance team",
                     *           "role": "finance",
                     *           "scopeId": null,
                     *           "scopeType": "platform",
                     *           "validFrom": "2026-09-01T09:00:00+07:00",
                     *           "validTo": null
                     *         }
                     *       ],
                     *       "status": "active"
                     *     }
                     */
                    "application/json": components["schemas"]["UserAdminDto"];
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
            /** @description Problem: `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden`, `iam.role_escalation`, `iam.self_grant` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
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
            /** @description Problem: `http.conflict`, `iam.sod_conflict` */
            409: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `iam.role_scope_mismatch`, `validation.failed` */
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
    "admin.users.revokeRole": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                grantId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReasonDto"];
            };
        };
        responses: {
            /** @description Revoked */
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
                     *       "createdAt": "2026-09-01T09:00:00+07:00",
                     *       "displayName": "การเงิน ทดสอบ",
                     *       "email": "finance.one@example.com",
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b",
                     *       "kind": "staff",
                     *       "lastLoginAt": "2026-09-23T09:00:00+07:00",
                     *       "phone": null,
                     *       "roles": [],
                     *       "status": "active"
                     *     }
                     */
                    "application/json": components["schemas"]["UserAdminDto"];
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
            /** @description Problem: `auth.unauthenticated` */
            401: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `auth.forbidden`, `iam.role_escalation`, `iam.self_grant` */
            403: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
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
    "admin.webPush.subscribe": {
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
                "application/json": components["schemas"]["SubscribeWebPushDto"];
            };
        };
        responses: {
            /** @description Registered */
            201: {
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
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000beef",
                     *       "vapidPublicKey": "BFakeVapidPublicKey"
                     *     }
                     */
                    "application/json": components["schemas"]["WebPushSubscriptionDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.webPush.unsubscribe": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                subscriptionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed */
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
            /** @description Problem: `auth.unauthenticated` */
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
    "admin.webPush.vapidPublicKey": {
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
            /** @description Key */
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
                     *       "vapidPublicKey": "BFakeVapidPublicKey"
                     *     }
                     */
                    "application/json": components["schemas"]["VapidKeyDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "partner.files.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The file */
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
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "heightPx": null,
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "mimeType": "application/pdf",
                     *       "originalName": "box-front.pdf",
                     *       "pageCount": 2,
                     *       "retentionClass": "customer_content",
                     *       "scanStatus": "clean",
                     *       "sha256": null,
                     *       "sizeBytes": 2457600,
                     *       "thumbnailId": null,
                     *       "uploadStatus": "uploaded",
                     *       "widthPx": null
                     *     }
                     */
                    "application/json": components["schemas"]["FileDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "partner.files.abort": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cancelled */
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
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
        };
    };
    "partner.files.complete": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompleteUploadDto"];
            };
        };
        responses: {
            /** @description Uploaded */
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
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "heightPx": null,
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "mimeType": "application/pdf",
                     *       "originalName": "box-front.pdf",
                     *       "pageCount": null,
                     *       "retentionClass": "customer_content",
                     *       "scanStatus": "pending",
                     *       "sha256": null,
                     *       "sizeBytes": 2457600,
                     *       "thumbnailId": null,
                     *       "uploadStatus": "uploaded",
                     *       "widthPx": null
                     *     }
                     */
                    "application/json": components["schemas"]["FileDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
            409: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `file.upload_incomplete`, `validation.failed` */
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
    "partner.files.download": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signed URL */
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
                     *       "expiresAt": "2026-09-23T14:10:00+07:00",
                     *       "url": "https://packio-files.s3.example.com/…&X-Amz-Expires=300"
                     *     }
                     */
                    "application/json": components["schemas"]["DownloadUrlDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `file.infected`, `file.not_ready` */
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
        };
    };
    "partner.files.presign": {
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
                "application/json": components["schemas"]["PresignFileDto"];
            };
        };
        responses: {
            /** @description Upload started */
            201: {
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
                     *       "expiresAt": "2026-09-23T14:20:00+07:00",
                     *       "fileId": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "headers": {
                     *         "Content-Type": "application/pdf"
                     *       },
                     *       "multipart": null,
                     *       "uploadUrl": "https://packio-files.s3.example.com/…"
                     *     }
                     */
                    "application/json": components["schemas"]["PresignedUploadDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `file.too_large`, `file.type_not_allowed`, `validation.failed` */
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
    "partner.notifications.list": {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One slice of the feed */
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
                     *       "data": [
                     *         {
                     *           "body": "คำขอ discount_memo รอการอนุมัติของคุณ",
                     *           "createdAt": "2026-09-23T14:05:00+07:00",
                     *           "eventType": "approval.requested",
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000e001",
                     *           "readAt": null,
                     *           "title": "มีคำขออนุมัติรอคุณ"
                     *         }
                     *       ],
                     *       "meta": {
                     *         "nextCursor": "eyJpZCI6IjEyMyJ9"
                     *       }
                     *     }
                     */
                    "application/json": {
                        data: components["schemas"]["InboxItemDto"][];
                        meta: components["schemas"]["CursorMeta"];
                    };
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "partner.notifications.markRead": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                notificationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Marked read */
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
            /** @description Problem: `auth.unauthenticated` */
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
    "partner.realtime.auth": {
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
            /** @description Stream token */
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
                     *       "channels": [
                     *         "user:0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *       ],
                     *       "expiresAt": "2026-09-23T14:06:00+07:00",
                     *       "streamPath": "/v1/partner/realtime/stream",
                     *       "token": "eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCJ9.eyJjaCI6W119.c2ln"
                     *     }
                     */
                    "application/json": components["schemas"]["RealtimeAuthDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "partner.realtime.stream": {
        parameters: {
            query: {
                /** @description From `POST …/realtime/auth` */
                token: unknown;
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event stream */
            200: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example event: notification.created
                     *     data: {"type":"notification.created","id":"0192f3a0-7c1e-7d2a-9b1f-00000000e001","channel":"user:0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"}
                     */
                    "text/event-stream": string;
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "partner.webPush.subscribe": {
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
                "application/json": components["schemas"]["SubscribeWebPushDto"];
            };
        };
        responses: {
            /** @description Registered */
            201: {
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
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000beef",
                     *       "vapidPublicKey": "BFakeVapidPublicKey"
                     *     }
                     */
                    "application/json": components["schemas"]["WebPushSubscriptionDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "partner.webPush.unsubscribe": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                subscriptionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed */
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
            /** @description Problem: `auth.unauthenticated` */
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
    "partner.webPush.vapidPublicKey": {
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
            /** @description Key */
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
                     *       "vapidPublicKey": "BFakeVapidPublicKey"
                     *     }
                     */
                    "application/json": components["schemas"]["VapidKeyDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "store.files.get": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The file */
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
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "heightPx": null,
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "mimeType": "application/pdf",
                     *       "originalName": "box-front.pdf",
                     *       "pageCount": 2,
                     *       "retentionClass": "customer_content",
                     *       "scanStatus": "clean",
                     *       "sha256": null,
                     *       "sizeBytes": 2457600,
                     *       "thumbnailId": null,
                     *       "uploadStatus": "uploaded",
                     *       "widthPx": null
                     *     }
                     */
                    "application/json": components["schemas"]["FileDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "store.files.abort": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cancelled */
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
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
        };
    };
    "store.files.complete": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompleteUploadDto"];
            };
        };
        responses: {
            /** @description Uploaded */
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
                     *       "createdAt": "2026-09-23T14:05:00+07:00",
                     *       "heightPx": null,
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "mimeType": "application/pdf",
                     *       "originalName": "box-front.pdf",
                     *       "pageCount": null,
                     *       "retentionClass": "customer_content",
                     *       "scanStatus": "pending",
                     *       "sha256": null,
                     *       "sizeBytes": 2457600,
                     *       "thumbnailId": null,
                     *       "uploadStatus": "uploaded",
                     *       "widthPx": null
                     *     }
                     */
                    "application/json": components["schemas"]["FileDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `http.conflict` */
            409: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Problem: `file.upload_incomplete`, `validation.failed` */
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
    "store.files.download": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                fileId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signed URL */
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
                     *       "expiresAt": "2026-09-23T14:10:00+07:00",
                     *       "url": "https://packio-files.s3.example.com/…&X-Amz-Expires=300"
                     *     }
                     */
                    "application/json": components["schemas"]["DownloadUrlDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `file.infected`, `file.not_ready` */
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
        };
    };
    "store.files.presign": {
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
                "application/json": components["schemas"]["PresignFileDto"];
            };
        };
        responses: {
            /** @description Upload started */
            201: {
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
                     *       "expiresAt": "2026-09-23T14:20:00+07:00",
                     *       "fileId": "0192f3a0-7c1e-7d2a-9b1f-00000000f11e",
                     *       "headers": {
                     *         "Content-Type": "application/pdf"
                     *       },
                     *       "multipart": null,
                     *       "uploadUrl": "https://packio-files.s3.example.com/…"
                     *     }
                     */
                    "application/json": components["schemas"]["PresignedUploadDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `file.too_large`, `file.type_not_allowed`, `validation.failed` */
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
    "store.me.consents": {
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
            /** @description Consents */
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
                     * @example [
                     *       {
                     *         "granted": true,
                     *         "outdated": false,
                     *         "purpose": "marketing_line",
                     *         "required": false,
                     *         "summary": "รับข่าวสารและโปรโมชันทาง LINE",
                     *         "text": "ข้าพเจ้ายินยอมรับข่าวสาร…",
                     *         "versionNo": 1
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["ConsentDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "store.me.recordConsent": {
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
                "application/json": components["schemas"]["RecordConsentDto"];
            };
        };
        responses: {
            /** @description Recorded */
            201: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example [
                     *       {
                     *         "granted": true,
                     *         "outdated": false,
                     *         "purpose": "marketing_line",
                     *         "required": false,
                     *         "summary": "รับข่าวสารและโปรโมชันทาง LINE",
                     *         "text": "ข้าพเจ้ายินยอมรับข่าวสาร…",
                     *         "versionNo": 1
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["ConsentDto"][];
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
            /** @description Problem: `auth.unauthenticated` */
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
            /** @description Problem: `consent.purpose_unavailable` */
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
        };
    };
    "store.me.notificationPreferences": {
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
            /** @description Preferences */
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
                     * @example [
                     *       {
                     *         "category": "marketing",
                     *         "channel": "line",
                     *         "enabled": false
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["NotificationPreferenceDto"][];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "store.me.setNotificationPreferences": {
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
                "application/json": components["schemas"]["SetPreferencesDto"];
            };
        };
        responses: {
            /** @description Saved */
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
                     * @example [
                     *       {
                     *         "category": "marketing",
                     *         "channel": "line",
                     *         "enabled": false
                     *       }
                     *     ]
                     */
                    "application/json": components["schemas"]["NotificationPreferenceDto"][];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "store.notifications.list": {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One slice of the feed */
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
                     *       "data": [
                     *         {
                     *           "body": "คำขอ discount_memo รอการอนุมัติของคุณ",
                     *           "createdAt": "2026-09-23T14:05:00+07:00",
                     *           "eventType": "approval.requested",
                     *           "id": "0192f3a0-7c1e-7d2a-9b1f-00000000e001",
                     *           "readAt": null,
                     *           "title": "มีคำขออนุมัติรอคุณ"
                     *         }
                     *       ],
                     *       "meta": {
                     *         "nextCursor": "eyJpZCI6IjEyMyJ9"
                     *       }
                     *     }
                     */
                    "application/json": {
                        data: components["schemas"]["InboxItemDto"][];
                        meta: components["schemas"]["CursorMeta"];
                    };
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "store.notifications.markRead": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                notificationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Marked read */
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
            /** @description Problem: `auth.unauthenticated` */
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
    "store.realtime.auth": {
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
            /** @description Stream token */
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
                     *       "channels": [
                     *         "user:0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"
                     *       ],
                     *       "expiresAt": "2026-09-23T14:06:00+07:00",
                     *       "streamPath": "/v1/store/realtime/stream",
                     *       "token": "eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCJ9.eyJjaCI6W119.c2ln"
                     *     }
                     */
                    "application/json": components["schemas"]["RealtimeAuthDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "store.realtime.stream": {
        parameters: {
            query: {
                /** @description From `POST …/realtime/auth` */
                token: unknown;
            };
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event stream */
            200: {
                headers: {
                    "X-Request-Id": components["headers"]["XRequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example event: notification.created
                     *     data: {"type":"notification.created","id":"0192f3a0-7c1e-7d2a-9b1f-00000000e001","channel":"user:0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b"}
                     */
                    "text/event-stream": string;
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
    "store.webPush.subscribe": {
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
                "application/json": components["schemas"]["SubscribeWebPushDto"];
            };
        };
        responses: {
            /** @description Registered */
            201: {
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
                     *       "id": "0192f3a0-7c1e-7d2a-9b1f-00000000beef",
                     *       "vapidPublicKey": "BFakeVapidPublicKey"
                     *     }
                     */
                    "application/json": components["schemas"]["WebPushSubscriptionDto"];
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
            /** @description Problem: `auth.unauthenticated` */
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
    "store.webPush.unsubscribe": {
        parameters: {
            query?: never;
            header?: {
                /** @description Language of `title`/`detail` in problems and of generated documents: `th` (default) or `en`. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
            };
            path: {
                subscriptionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed */
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
            /** @description Problem: `auth.unauthenticated` */
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
    "store.webPush.vapidPublicKey": {
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
            /** @description Key */
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
                     *       "vapidPublicKey": "BFakeVapidPublicKey"
                     *     }
                     */
                    "application/json": components["schemas"]["VapidKeyDto"];
                };
            };
            /** @description Problem: `auth.unauthenticated` */
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
}
