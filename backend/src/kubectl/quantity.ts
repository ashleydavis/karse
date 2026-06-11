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

// Decimal SI multipliers (in cores) for the suffixes a CPU quantity may carry.
// Kubernetes expresses CPU in cores, so a suffixed value scales the core count:
// "1k" -> 1000 cores. These are the same decimal-SI suffixes used for memory, but
// applied to cores rather than bytes. kwok reports node allocatable CPU as e.g. "1k".
const CPU_SI_SUFFIXES: Record<string, number> = {
    k: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6,
};

// Parses a CPU quantity into millicores. Handles the millicore form ("250m" -> 250),
// whole and fractional cores ("1" -> 1000, "1.5" -> 1500), the nanocore form the
// Metrics API returns ("123456789n" -> 123, floored after dividing by 1e6), and
// decimal-SI core counts ("1k" -> 1,000,000, as kwok reports node allocatable). An
// empty string yields 0. Any other non-empty value throws.
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
    // Decimal-SI cores: a (possibly fractional) number followed by a k/M/G/T/P/E
    // suffix, giving a core count that is then scaled to millicores.
    const siMatch = /^(\d+(?:\.\d+)?)(k|M|G|T|P|E)$/.exec(quantity);
    if (siMatch !== null) {
        const cores = Number(siMatch[1]) * CPU_SI_SUFFIXES[siMatch[2]!]!;
        return Math.round(cores * 1000);
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
