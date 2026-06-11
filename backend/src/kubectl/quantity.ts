// Parsers for Kubernetes resource quantity strings into canonical numeric units.
// CPU is normalised to millicores, memory to bytes, so downstream code does
// arithmetic on plain numbers rather than re-parsing suffixed strings. Both
// parsers return 0 for an empty string and throw on a malformed non-empty value,
// so bad metrics data surfaces as an error rather than silently becoming 0.

// Memory suffix multipliers. Binary suffixes (Ki/Mi/...) are powers of 1024;
// decimal suffixes (K/M/...) are powers of 1000, matching the Kubernetes
// resource.Quantity definitions.
const MEMORY_SUFFIXES: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6,
};

// CPU suffix multipliers expressed in cores. A CPU quantity is a Kubernetes
// resource.Quantity, so it can carry the same SI decimal suffixes (k/M/G/T/P/E) and
// binary suffixes (Ki/Mi/...) as memory, all denominated in cores rather than bytes.
// Node allocatable CPU in particular comes back suffixed (e.g. kwok reports "1k" for
// 1000 cores), so these must be handled rather than rejected. The millicore ("m") and
// nanocore ("n") forms are handled separately below.
const CPU_SUFFIXES: Record<string, number> = {
    k: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6,
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
};

// Parses a CPU quantity into millicores. Handles the millicore form ("250m" -> 250),
// whole and fractional cores ("1" -> 1000, "1.5" -> 1500), the nanocore form the Metrics
// API returns ("123456789n" -> 123, floored after dividing by 1e6), and SI/binary
// core suffixes ("1k" -> 1,000,000 millicores). An empty string yields 0. Any other
// non-empty value throws.
export function parseCpuToMillicores(quantity: string): number {
    if (quantity === "") {
        return 0;
    }
    // Nanocores: integer followed by "n". Floor of nanocores / 1e6 gives millicores.
    const nanoMatch = /^(\d+)n$/.exec(quantity);
    if (nanoMatch !== null) {
        return Math.floor(Number(nanoMatch[1]) / 1e6);
    }
    // Millicores: a (possibly fractional) number followed by "m".
    const milliMatch = /^(\d+(?:\.\d+)?)m$/.exec(quantity);
    if (milliMatch !== null) {
        return Math.floor(Number(milliMatch[1]));
    }
    // Suffixed cores: a number followed by an SI (k/M/...) or binary (Ki/Mi/...) suffix,
    // scaled to cores then to millicores.
    const suffixMatch = /^(\d+(?:\.\d+)?)(k|M|G|T|P|E|Ki|Mi|Gi|Ti|Pi|Ei)$/.exec(quantity);
    if (suffixMatch !== null) {
        const multiplier = CPU_SUFFIXES[suffixMatch[2]!]!;
        return Math.round(Number(suffixMatch[1]) * multiplier * 1000);
    }
    // Bare cores: a whole or fractional number, scaled to millicores.
    const coreMatch = /^(\d+(?:\.\d+)?)$/.exec(quantity);
    if (coreMatch !== null) {
        return Math.round(Number(coreMatch[1]) * 1000);
    }
    throw new Error(`invalid CPU quantity: ${quantity}`);
}

// Parses a memory quantity into bytes. Handles binary suffixes (Ki/Mi/Gi/Ti/Pi/Ei),
// decimal suffixes (K/M/G/T/P/E), and a plain integer (bytes). An empty string yields
// 0. Any other non-empty value throws.
export function parseMemoryToBytes(quantity: string): number {
    if (quantity === "") {
        return 0;
    }
    // Plain integer: already in bytes.
    if (/^\d+$/.test(quantity)) {
        return Number(quantity);
    }
    // A (possibly fractional) number followed by a known suffix.
    const match = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|Pi|Ei|K|M|G|T|P|E)$/.exec(quantity);
    if (match !== null) {
        const multiplier = MEMORY_SUFFIXES[match[2]!]!;
        return Math.round(Number(match[1]) * multiplier);
    }
    throw new Error(`invalid memory quantity: ${quantity}`);
}
