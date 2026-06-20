import { Router } from "express";
import type { CacheConfigResponse, CacheClearResponse } from "karse-types";
import { readCacheConfig, writeCacheConfig, clearCache } from "../kubectl/cache";

// Router handling the on-disk cluster-data cache:
//   GET  /cache/config  - read the current staleness threshold.
//   PUT  /cache/config  - update the staleness threshold (configured from the UI).
//   POST /cache/clear   - empty the cache (the navbar refresh button).
export const cacheRouter = Router();

cacheRouter.get("/cache/config", async (_req, res) => {
    const config = await readCacheConfig();
    const body: CacheConfigResponse = { stalenessSeconds: config.stalenessSeconds };
    res.json(body);
});

cacheRouter.put("/cache/config", async (req, res) => {
    const value = req.body?.stalenessSeconds;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        res.status(400).json({
            error: "stalenessSeconds must be a non-negative number",
        });
        return;
    }
    const config = await writeCacheConfig({ stalenessSeconds: value });
    const body: CacheConfigResponse = { stalenessSeconds: config.stalenessSeconds };
    res.json(body);
});

cacheRouter.post("/cache/clear", async (_req, res) => {
    await clearCache();
    const body: CacheClearResponse = { cleared: true };
    res.json(body);
});
