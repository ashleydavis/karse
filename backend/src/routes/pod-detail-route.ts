import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /pods/:namespace/:name and GET /pods/:namespace/:name/logs.
export const podDetailRouter = Router();

podDetailRouter.get("/pods/:namespace/:name", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { namespace, name } = req.params;
    const detail = await kubectl.getPodDetail(context, namespace!, name!);
    res.json(detail);
});

podDetailRouter.get("/pods/:namespace/:name/logs", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { namespace, name } = req.params;
    const container = typeof req.query.container === "string" && req.query.container.trim() !== ""
        ? req.query.container
        : undefined;
    const tailRaw = req.query.tail;
    const tail = typeof tailRaw === "string" && /^\d+$/.test(tailRaw) ? parseInt(tailRaw, 10) : 100;
    const logs = await kubectl.getPodLogs(context, namespace!, name!, container, tail);
    res.json({ logs });
});
