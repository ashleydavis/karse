import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /pods.
export const podsRouter = Router();

podsRouter.get("/pods", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    const pods = await kubectl.listPods(context, namespace);
    res.json({ pods });
});
