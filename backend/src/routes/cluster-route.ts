import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /cluster/overview and GET /cluster/nodes.
export const clusterRouter = Router();

clusterRouter.get("/cluster/overview", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const overview = await kubectl.getClusterOverview(context);
    res.json(overview);
});

clusterRouter.get("/cluster/nodes", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const nodes = await kubectl.listNodes(context);
    res.json({ nodes });
});

clusterRouter.get("/cluster/performance", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const performance = await kubectl.getClusterPerformance(context);
    res.json(performance);
});
