/**
 * get_current_time — Returns the current date and time.
 * Optionally accepts a timezone (IANA format, e.g. "America/New_York").
 */

export const definition = {
    name: "get_current_time",
    description:
        "Returns the current date and time. Optionally accepts a timezone in IANA format (e.g. 'America/New_York', 'Europe/London', 'Asia/Tokyo').",
    input_schema: {
        type: "object" as const,
        properties: {
            timezone: {
                type: "string",
                description:
                    "IANA timezone identifier (e.g. 'America/New_York'). Defaults to the system timezone if omitted.",
            },
        },
        required: [],
    },
};

export function execute(input: Record<string, unknown>): string {
    const tz = typeof input.timezone === "string" ? input.timezone : undefined;
    const now = new Date();

    try {
        const formatted = now.toLocaleString("en-US", {
            timeZone: tz,
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
        });
        return formatted;
    } catch {
        // Invalid timezone — fall back to UTC
        return `${now.toUTCString()} (requested timezone "${tz}" was invalid, showing UTC)`;
    }
}
