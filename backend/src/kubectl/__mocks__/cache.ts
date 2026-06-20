// Manual mock of the on-disk cache. The cache's own behaviour is tested against the
// real module in cache.test.ts; here every export is a jest.fn so tests can drive the
// adapter's caching path (hit / miss / stale / write) and route handlers without
// touching disk.
//
// Defaults make the cache inert: readCacheEntry misses, isFresh is false, and
// readCacheConfig returns the default threshold, so the kubectl-adapter unit tests
// (which assert on the mocked command-runner) always shell out as before.
export const DEFAULT_STALENESS_SECONDS = 60;

export const cacheKey = jest.fn((args: readonly string[]) => args.join(" "));
export const isFresh = jest.fn(() => false);
export const readCacheConfig = jest.fn(async () => ({ stalenessSeconds: DEFAULT_STALENESS_SECONDS }));
export const readCacheEntry = jest.fn(async () => null);
export const writeCacheEntry = jest.fn(async () => undefined);
export const writeCacheConfig = jest.fn(async (config: { stalenessSeconds: number }) => config);
export const clearCache = jest.fn(async () => undefined);
export const getCacheDir = jest.fn(() => "/tmp/karse-test-cache");
