import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /cluster/overview and GET /cluster/nodes.
export const clusterRouter = Router();

clusterRouter.get("/cluster/overview", async (_req, res) => {
    const overview = await kubectl.getClusterOverview();
    res.json(overview);
});

clusterRouter.get("/cluster/nodes", async (_req, res) => {
    const nodes = await kubectl.listNodes();
    res.json({
        nodes,
    });
});
