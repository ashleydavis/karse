import { useTimestampFormat } from "../lib/use-timestamp-format";

// Renders one Kubernetes timestamp in the app-wide timestamp mode: the age since
// it happened, or the absolute local time. Every timestamp the app displays goes
// through this component, so the header's toggle switches all of them together.
// An absent timestamp renders as "-".
export function Timestamp({ value }: { value: string }) {
    const { format } = useTimestampFormat();
    return <>{format(value)}</>;
}
