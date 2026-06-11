import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /nodes/:name.
export const nodeDetailRouter = Router();

nodeDetailRouter.get("/nodes/:name", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { name } = req.params;
    const detail = await kubectl.getNodeDetail(context, name!);
    res.json(detail);
});

// Node-scoped point-in-time performance: the node's usage plus the pods scheduled on
// it with per-container usage. Backs the node Performance tab.
nodeDetailRouter.get("/nodes/:name/performance", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { name } = req.params;
    const performance = await kubectl.getNodePerformance(context, name!);
    res.json(performance);
});
