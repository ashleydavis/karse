import { useConfig } from "./config";
import { formatTimestamp, type TimestampMode } from "./timestamps";

// What `useTimestampFormat()` hands a component: the active mode, and a
// formatter already bound to it.
export type TimestampFormat = {
    mode: TimestampMode;
    format: (timestamp: string) => string;
};

// Reads the app-wide timestamp mode and returns a formatter bound to it, so a
// component renders a timestamp without knowing which mode is active. Changing
// the mode re-renders every consumer, which is what makes the header toggle
// switch every timestamp in the app at once.
export function useTimestampFormat(): TimestampFormat {
    const { config: { timestampMode } } = useConfig();
    return {
        mode: timestampMode,
        format: (timestamp: string) => formatTimestamp(timestamp, timestampMode),
    };
}
