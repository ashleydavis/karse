import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { CommandResult } from "../command-runner";
import { formatLocalISO } from "../audit-log";

// Base directory for the on-disk cluster-data cache; overridable via KARSE_CACHE_DIR.
// Defaults to "../cache", which resolves to the repo root cache/ when the backend
// runs with cwd backend/ (the same convention KARSE_LOGS_DIR uses for logs/).
const CACHE_DIR = process.env.KARSE_CACHE_DIR ?? "../cache";

// File holding the cache configuration (the staleness threshold). Kept inside the
// cache dir so a single directory holds everything the cache owns.
const CONFIG_FILE = "config.json";

// Default staleness threshold in seconds. Cached data older than the configured
// threshold is treated as stale and re-fetched on the next request. 60s keeps the
// dashboard responsive while still sparing repeat kubectl calls within a short window.
export const DEFAULT_STALENESS_SECONDS = 60;

// The configuration the cache reads to decide when an entry is stale.
export type CacheConfig = {
    // How long (in seconds) a cached entry is served before it is re-fetched.
    stalenessSeconds: number;
};

// A single cached kubectl result, as stored on disk. savedAt is the local-ISO
// timestamp the entry was written (the "date/time it was saved" stamp); args is the
// kubectl argv it answers, retained for debuggability; result is the captured output.
export type CacheEntry = {
    savedAt: string;
    args: readonly string[];
    result: CommandResult;
};

// Returns the directory the cache stores its files in.
export function getCacheDir(): string {
    return CACHE_DIR;
}

// Derives the per-query cache key (a hex digest) from a kubectl argv. The argv is
// joined with a NUL separator that cannot appear in an argument, so distinct argvs
// never collide on the same key. The digest is the on-disk file's base name.
export function cacheKey(args: readonly string[]): string {
    return createHash("sha256").update(args.join("\0")).digest("hex");
}

// Returns the on-disk file path for a given cache key inside baseDir.
function entryPath(baseDir: string, key: string): string {
    return join(baseDir, key + ".json");
}

// Whether a cached entry stamped savedAt is still fresh relative to now and the
// staleness threshold. A non-positive threshold means "never serve the cache"
// (every read is treated as stale), so callers always re-fetch.
export function isFresh(savedAt: string, stalenessSeconds: number, now: Date = new Date()): boolean {
    if (stalenessSeconds <= 0) {
        return false;
    }
    const savedMs = new Date(savedAt).getTime();
    if (Number.isNaN(savedMs)) {
        return false;
    }
    const ageSeconds = (now.getTime() - savedMs) / 1000;
    return ageSeconds >= 0 && ageSeconds < stalenessSeconds;
}

// Reads the cache configuration from disk, falling back to the default threshold
// when the file is absent or unreadable/corrupt. A stored threshold that is not a
// finite, non-negative number is ignored in favour of the default.
export async function readCacheConfig(baseDir: string = CACHE_DIR): Promise<CacheConfig> {
    try {
        const raw = await readFile(join(baseDir, CONFIG_FILE), "utf8");
        const parsed = JSON.parse(raw);
        const value = parsed?.stalenessSeconds;
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
            return { stalenessSeconds: value };
        }
    }
    catch {
        // Absent or corrupt config: fall through to the default.
    }
    return { stalenessSeconds: DEFAULT_STALENESS_SECONDS };
}

// Persists the cache configuration to disk, creating the cache directory on first
// write. Returns the stored config so callers can echo it back to the UI.
export async function writeCacheConfig(
    config: CacheConfig,
    baseDir: string = CACHE_DIR,
): Promise<CacheConfig> {
    await mkdir(baseDir, { recursive: true });
    await writeFile(join(baseDir, CONFIG_FILE), JSON.stringify(config), "utf8");
    return config;
}

// Reads a cached entry by key, or null when no entry exists (or the stored file is
// unreadable/corrupt). The config file is never returned as an entry.
export async function readCacheEntry(
    key: string,
    baseDir: string = CACHE_DIR,
): Promise<CacheEntry | null> {
    try {
        const raw = await readFile(entryPath(baseDir, key), "utf8");
        const parsed = JSON.parse(raw) as CacheEntry;
        if (parsed && typeof parsed.savedAt === "string" && parsed.result) {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}

// Writes a cached entry for the given argv and result, stamping it with the current
// date/time. Creates the cache directory on first write. when defaults to now.
export async function writeCacheEntry(
    args: readonly string[],
    result: CommandResult,
    baseDir: string = CACHE_DIR,
    when: Date = new Date(),
): Promise<void> {
    await mkdir(baseDir, { recursive: true });
    const entry: CacheEntry = {
        savedAt: formatLocalISO(when),
        args,
        result,
    };
    await writeFile(entryPath(baseDir, cacheKey(args)), JSON.stringify(entry), "utf8");
}

// Empties the local cache of cluster data: deletes every cached entry file while
// preserving the configuration file (the staleness threshold survives a refresh).
// Used by the navbar refresh button so the next request re-fetches fresh kubectl
// data. Tolerates an absent cache directory (nothing to clear).
export async function clearCache(baseDir: string = CACHE_DIR): Promise<void> {
    let entries: string[];
    try {
        entries = await readdir(baseDir);
    }
    catch {
        return;
    }
    await Promise.all(
        entries
            .filter((name) => name.endsWith(".json") && name !== CONFIG_FILE)
            .map((name) => rm(join(baseDir, name), { force: true })),
    );
}
