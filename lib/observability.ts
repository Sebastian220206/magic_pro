/**
 * observability.ts
 * Server-side error reporting.
 *
 * Unexpected API failures used to go to `console.error` and stop there. On a
 * serverless host that means they exist only in a log stream nobody reads, with
 * no grouping, no alerting and no way to notice that one route started failing
 * for everyone an hour ago.
 *
 * This does two things:
 *
 * 1. Always emits a single-line JSON record, so a log platform can index and
 *    alert on the fields rather than pattern-matching prose.
 * 2. Optionally forwards to an external collector when `ERROR_WEBHOOK_URL` is
 *    set. The payload is Sentry's `store` envelope shape, which is also what
 *    most log platforms accept, so a Sentry DSN's store endpoint works directly.
 *
 * No SDK: adding one means a dependency, a bundled agent and an account before
 * anything is captured at all. This works with nothing configured, and the sink
 * is one environment variable when you want it.
 */

/** Everything known about where a failure happened. */
export interface ErrorContext {
    /** Route identifier, e.g. `project.save`. */
    context: string;
    userId?: string;
    method?: string;
    path?: string;
    /** Correlates the log line with the `X-Request-Id` sent to the client. */
    requestId?: string;
}

const WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL;
const ENVIRONMENT = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA;

/** Milliseconds a forward may take before it is abandoned. */
const FORWARD_TIMEOUT_MS = 2000;

/**
 * Credential shapes that turn up inside error text.
 *
 * Redacting by *field name* would achieve nothing here: the record is built
 * from a closed set of fields, none of which hold a secret. The real exposure
 * is free text — a driver that quotes its connection string, an HTTP client
 * that echoes an `Authorization` header, a validation error that prints the
 * body it rejected. That text is forwarded to a third-party collector, so it is
 * scrubbed by value.
 *
 * Ordered from most specific to least; each replacement keeps enough context to
 * stay diagnosable.
 */
const SECRET_PATTERNS: [RegExp, string][] = [
    // Credentials embedded in a URL: postgres://user:pw@host, https://u:pw@host
    [/(:\/\/[^:/\s]+:)[^@/\s]+@/g, '$1[redacted]@'],
    // Authorization headers.
    [/\b(bearer|basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '$1 [redacted]'],
    // JWTs, including Supabase anon/service keys.
    [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]'],
    // Vendor-prefixed keys: OpenAI, Stripe, Stripe webhooks, GitHub PATs.
    [/\b(sk|pk|rk)-[A-Za-z0-9_-]{12,}/g, '[redacted]'],
    [/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/g, '[redacted]'],
    [/\bwhsec_[A-Za-z0-9]{8,}/g, '[redacted]'],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, '[redacted]'],
    [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, '[redacted]'],
    // Anything self-describing: password=…, "apiKey": "…", token: …
    [
        /\b(pass(?:word|wd)?|secret|token|api[_-]?key|credential)("?\s*[:=]\s*"?)[^\s"',;)}\]]+/gi,
        '$1$2[redacted]',
    ],
];

/** Remove credential-shaped substrings from free text. */
export function scrubSecrets(text: string): string {
    let out = text;
    for (const [pattern, replacement] of SECRET_PATTERNS) {
        out = out.replace(pattern, replacement);
    }
    return out;
}

function serialiseError(error: unknown): {
    type: string;
    message: string;
    stack?: string;
} {
    if (error instanceof Error) {
        return {
            type: error.name,
            message: scrubSecrets(error.message),
            // Stacks embed the message, so they need the same treatment.
            stack: error.stack ? scrubSecrets(error.stack) : undefined,
        };
    }
    return { type: 'UnknownError', message: scrubSecrets(String(error)) };
}

/** Drop keys that were never set, so a report has no null noise. */
function compact(record: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
}

/**
 * Forward to the configured collector.
 *
 * Deliberately fire-and-forget: reporting an error must never turn a handled
 * 500 into a hang, and a collector being down is not the request's problem.
 */
function forward(payload: Record<string, unknown>): void {
    if (!WEBHOOK_URL) return;

    // AbortSignal.timeout is not in every runtime this may run on.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);

    void fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
    })
        .catch(() => {
            // Swallowed on purpose. Logging a failure to log is a loop, and the
            // structured line below was already written.
        })
        .finally(() => clearTimeout(timer));
}

/**
 * Record an unexpected server error.
 *
 * Returns the request id so the caller can hand it to the client — that is what
 * makes "something went wrong" traceable to an actual log line when a user
 * reports it.
 */
export function reportError(error: unknown, context: ErrorContext): string {
    const requestId = context.requestId ?? crypto.randomUUID();
    const details = serialiseError(error);

    const record = compact({
        level: 'error',
        timestamp: new Date().toISOString(),
        environment: ENVIRONMENT,
        release: RELEASE,
        requestId,
        context: context.context,
        userId: context.userId,
        method: context.method,
        path: context.path,
        errorType: details.type,
        message: details.message,
        stack: details.stack,
    });

    // One line, so a log platform gets one event rather than a stack split
    // across a dozen unrelated entries.
    console.error(JSON.stringify(record));

    forward(record);

    return requestId;
}
