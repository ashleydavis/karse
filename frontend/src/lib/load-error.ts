import type { AxiosError } from "axios";

// How long a data load is allowed to run before it is treated as a connectivity
// failure. Kept short so an unreachable cluster (VPN/internet down) surfaces an
// error quickly instead of spinning forever, but long enough to tolerate a slow
// but working cluster. Applied as the default axios timeout for every /api request.
export const LOAD_TIMEOUT_MS = 15_000;

// The hint appended to every connectivity-failure message. Surfaced verbatim in
// the error state so a user whose cluster is unreachable knows the most common cause.
export const CONNECTIVITY_HINT = "Make sure your internet or VPN is connected";

// Message shown when a data load times out before the cluster responds.
export const TIMEOUT_MESSAGE = `The cluster did not respond in time. ${CONNECTIVITY_HINT}.`;

// Message shown when the request never reached a responding server at all
// (connection refused, DNS failure, dropped network), which looks the same to a
// user as an unreachable cluster.
export const UNREACHABLE_MESSAGE = `Could not reach the cluster. ${CONNECTIVITY_HINT}.`;

// Maps a failed request into the message Karse shows in the error state.
//
// A timeout (axios aborts the request after LOAD_TIMEOUT_MS) or a request that
// produced no HTTP response (network unreachable) is reported as a connectivity
// failure with the VPN/internet hint. Any error that did get an HTTP response
// (the server replied with an error) keeps its server-provided message.
export function loadErrorMessage(error: unknown): string {
    const axiosError = error as AxiosError | undefined;

    if (axiosError?.code === "ECONNABORTED") {
        return TIMEOUT_MESSAGE;
    }

    // An axios error with a request but no response never reached a responding
    // server: the cluster/backend was unreachable.
    if (axiosError?.isAxiosError && axiosError.request && !axiosError.response) {
        return UNREACHABLE_MESSAGE;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return UNREACHABLE_MESSAGE;
}
