import { mkdtemp, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CommandResult } from "../../command-runner";
import {
    DEFAULT_STALENESS_SECONDS,
    cacheKey,
    isFresh,
    readCacheConfig,
    writeCacheConfig,
    readCacheEntry,
    writeCacheEntry,
    clearCache,
    type CacheEntry,
} from "../../kubectl/cache";
import { formatLocalISO } from "../../audit-log";

// A successful kubectl result fixture (the shape the adapter caches).
function ok(stdout: string): CommandResult {
    return { stdout, stderr: "", exitCode: 0 };
}

describe("cacheKey", () => {
    test("is stable for the same argv", () => {
        expect(cacheKey(["get", "pods", "-A"])).toBe(cacheKey(["get", "pods", "-A"]));
    });

    test("differs for different argvs", () => {
        expect(cacheKey(["get", "pods"])).not.toBe(cacheKey(["get", "nodes"]));
    });

    test("does not collide when argument boundaries shift", () => {
        // "a b" + "c" must not key the same as "a" + "b c": a naive concat would.
        expect(cacheKey(["a b", "c"])).not.toBe(cacheKey(["a", "b c"]));
    });
});

describe("isFresh", () => {
    const now = new Date(2026, 0, 1, 12, 0, 0);

    test("an entry saved within the threshold is fresh", () => {
        const savedAt = formatLocalISO(new Date(2026, 0, 1, 11, 59, 30)); // 30s ago
        expect(isFresh(savedAt, 60, now)).toBe(true);
    });

    test("an entry older than the threshold is stale", () => {
        const savedAt = formatLocalISO(new Date(2026, 0, 1, 11, 58, 30)); // 90s ago
        expect(isFresh(savedAt, 60, now)).toBe(false);
    });

    test("an entry exactly at the threshold is stale", () => {
        const savedAt = formatLocalISO(new Date(2026, 0, 1, 11, 59, 0)); // 60s ago
        expect(isFresh(savedAt, 60, now)).toBe(false);
    });

    test("a zero threshold is never fresh", () => {
        const savedAt = formatLocalISO(now);
        expect(isFresh(savedAt, 0, now)).toBe(false);
    });

    test("an unparseable stamp is treated as stale", () => {
        expect(isFresh("not-a-date", 60, now)).toBe(false);
    });
});

describe("cache config", () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "karse-cache-cfg-"));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test("returns the default threshold when no config exists", async () => {
        const config = await readCacheConfig(dir);
        expect(config).toEqual({ stalenessSeconds: DEFAULT_STALENESS_SECONDS });
    });

    test("round-trips a written threshold", async () => {
        await writeCacheConfig({ stalenessSeconds: 120 }, dir);
        const config = await readCacheConfig(dir);
        expect(config).toEqual({ stalenessSeconds: 120 });
    });

    test("a zero threshold round-trips (disables the cache)", async () => {
        await writeCacheConfig({ stalenessSeconds: 0 }, dir);
        expect(await readCacheConfig(dir)).toEqual({ stalenessSeconds: 0 });
    });

    test("falls back to the default when the file is corrupt", async () => {
        await writeFile(join(dir, "config.json"), "{ not json", "utf8");
        expect(await readCacheConfig(dir)).toEqual({ stalenessSeconds: DEFAULT_STALENESS_SECONDS });
    });

    test("ignores a negative stored threshold", async () => {
        await writeFile(join(dir, "config.json"), JSON.stringify({ stalenessSeconds: -5 }), "utf8");
        expect(await readCacheConfig(dir)).toEqual({ stalenessSeconds: DEFAULT_STALENESS_SECONDS });
    });
});

describe("cache entries", () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "karse-cache-entry-"));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test("returns null for a key that was never written", async () => {
        expect(await readCacheEntry(cacheKey(["get", "pods"]), dir)).toBeNull();
    });

    test("writes a date-stamped entry and reads it back", async () => {
        const args = ["--context", "c", "get", "pods", "-A", "-o", "json"];
        const when = new Date(2026, 0, 1, 9, 30, 0);
        await writeCacheEntry(args, ok('{"items":[]}'), dir, when);

        const entry = await readCacheEntry(cacheKey(args), dir);
        expect(entry).not.toBeNull();
        expect(entry!.savedAt).toBe(formatLocalISO(when));
        expect(entry!.args).toEqual(args);
        expect(entry!.result).toEqual(ok('{"items":[]}'));
    });

    test("the saved stamp is a local-ISO timestamp", async () => {
        await writeCacheEntry(["get", "nodes"], ok("{}"), dir);
        const entry = await readCacheEntry(cacheKey(["get", "nodes"]), dir);
        expect(entry!.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    });

    test("the stamped entry on disk is readable as JSON", async () => {
        const args = ["get", "deployments"];
        await writeCacheEntry(args, ok("payload"), dir);
        const raw = await readFile(join(dir, cacheKey(args) + ".json"), "utf8");
        const parsed = JSON.parse(raw) as CacheEntry;
        expect(parsed.result.stdout).toBe("payload");
        expect(typeof parsed.savedAt).toBe("string");
    });

    test("a re-write overwrites the prior entry with a new stamp", async () => {
        const args = ["get", "pods"];
        await writeCacheEntry(args, ok("first"), dir, new Date(2026, 0, 1, 9, 0, 0));
        await writeCacheEntry(args, ok("second"), dir, new Date(2026, 0, 1, 9, 5, 0));
        const entry = await readCacheEntry(cacheKey(args), dir);
        expect(entry!.result.stdout).toBe("second");
        expect(entry!.savedAt).toBe(formatLocalISO(new Date(2026, 0, 1, 9, 5, 0)));
    });
});

describe("clearCache", () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "karse-cache-clear-"));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test("deletes every cached entry", async () => {
        await writeCacheEntry(["get", "pods"], ok("a"), dir);
        await writeCacheEntry(["get", "nodes"], ok("b"), dir);
        await clearCache(dir);
        expect(await readCacheEntry(cacheKey(["get", "pods"]), dir)).toBeNull();
        expect(await readCacheEntry(cacheKey(["get", "nodes"]), dir)).toBeNull();
    });

    test("preserves the config file (the threshold survives a refresh)", async () => {
        await writeCacheConfig({ stalenessSeconds: 300 }, dir);
        await writeCacheEntry(["get", "pods"], ok("a"), dir);
        await clearCache(dir);
        expect(await readCacheConfig(dir)).toEqual({ stalenessSeconds: 300 });
        const remaining = await readdir(dir);
        expect(remaining).toEqual(["config.json"]);
    });

    test("tolerates an absent cache directory", async () => {
        await expect(clearCache(join(dir, "does-not-exist"))).resolves.toBeUndefined();
    });
});
