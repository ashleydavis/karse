jest.mock("../../command-runner");
jest.mock("../../audit-log");
jest.mock("../../kubectl/cache");

import type { CommandResult } from "../../command-runner";
import {
    listPods, setCurrentContext, listNodes, getCurrentContext, listContexts,
} from "../../kubectl/kubectl-adapter";

const { run } = jest.requireMock("../../command-runner");
const cache = jest.requireMock("../../kubectl/cache");

// A successful kubectl result with the given stdout.
function ok(stdout: string): CommandResult {
    return { stdout, stderr: "", exitCode: 0 };
}

// A failed kubectl result with the given stderr and exit code 1.
function fail(stderr: string): CommandResult {
    return { stdout: "", stderr, exitCode: 1 };
}

beforeEach(() => {
    run.mockReset();
    cache.cacheKey.mockReset();
    cache.isFresh.mockReset();
    cache.readCacheConfig.mockReset();
    cache.readCacheEntry.mockReset();
    cache.writeCacheEntry.mockReset();

    // Sensible defaults: a configured threshold, a stable key, no entry on disk.
    cache.cacheKey.mockImplementation((args: readonly string[]) => args.join(" "));
    cache.readCacheConfig.mockResolvedValue({ stalenessSeconds: 60 });
    cache.readCacheEntry.mockResolvedValue(null);
    cache.isFresh.mockReturnValue(false);
    cache.writeCacheEntry.mockResolvedValue(undefined);
});

describe("read caching in the kubectl adapter", () => {
    test("serves a fresh cached read without shelling out", async () => {
        cache.readCacheEntry.mockResolvedValue({
            savedAt: "2026-01-01T00:00:00.000+00:00",
            args: ["--context", "c", "get", "pods", "-A", "-o", "json"],
            result: ok('{"items":[]}'),
        });
        cache.isFresh.mockReturnValue(true);

        const pods = await listPods("c");

        expect(pods).toEqual([]);
        expect(run).not.toHaveBeenCalled();
        expect(cache.writeCacheEntry).not.toHaveBeenCalled();
    });

    test("on a stale entry, re-fetches and re-caches the fresh read", async () => {
        cache.readCacheEntry.mockResolvedValue({
            savedAt: "2000-01-01T00:00:00.000+00:00",
            args: ["--context", "c", "get", "pods", "-A", "-o", "json"],
            result: ok('{"items":[]}'),
        });
        cache.isFresh.mockReturnValue(false);
        run.mockResolvedValue(ok('{"items":[]}'));

        await listPods("c");

        expect(run).toHaveBeenCalledTimes(1);
        expect(cache.writeCacheEntry).toHaveBeenCalledTimes(1);
        const [argsArg, resultArg] = cache.writeCacheEntry.mock.calls[0];
        expect(argsArg).toEqual(["--context", "c", "get", "pods", "-A", "-o", "json"]);
        expect(resultArg).toEqual(ok('{"items":[]}'));
    });

    test("on a cache miss, fetches live and caches the successful read", async () => {
        run.mockResolvedValue(ok('{"items":[]}'));

        await listNodes("c");

        expect(run).toHaveBeenCalledTimes(1);
        expect(cache.writeCacheEntry).toHaveBeenCalledTimes(1);
    });

    test("does not cache a failed read", async () => {
        run.mockResolvedValue(fail("boom"));

        await expect(listNodes("c")).rejects.toThrow("boom");
        expect(cache.writeCacheEntry).not.toHaveBeenCalled();
    });
});

describe("config commands bypass the cache", () => {
    test("setCurrentContext (a kubeconfig write) never reads or writes the cache", async () => {
        run.mockResolvedValue(ok(""));

        await setCurrentContext("c");

        expect(run).toHaveBeenCalledWith("kubectl", ["config", "use-context", "c"]);
        // A kubeconfig write must not be served from, nor stored in, the cache.
        expect(cache.readCacheEntry).not.toHaveBeenCalled();
        expect(cache.writeCacheEntry).not.toHaveBeenCalled();
    });

    test("getCurrentContext (a local config read) is always read live, never cached", async () => {
        run.mockResolvedValue(ok("my-ctx\n"));

        await getCurrentContext();

        // A kubeconfig read must reflect local state immediately, so it bypasses the
        // cache entirely (a context switch must not be masked by a stale entry).
        expect(run).toHaveBeenCalledWith("kubectl", ["config", "current-context"]);
        expect(cache.readCacheEntry).not.toHaveBeenCalled();
        expect(cache.writeCacheEntry).not.toHaveBeenCalled();
    });

    test("listContexts (config view) is always read live, never cached", async () => {
        run.mockResolvedValue(ok('{"contexts":[]}'));

        await listContexts();

        expect(run).toHaveBeenCalledWith("kubectl", ["config", "view", "-o", "json"]);
        expect(cache.readCacheEntry).not.toHaveBeenCalled();
        expect(cache.writeCacheEntry).not.toHaveBeenCalled();
    });
});
