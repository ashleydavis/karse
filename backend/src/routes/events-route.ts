import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /events (cluster- or namespace-wide Kubernetes events).
export const eventsRouter = Router();

eventsRouter.get("/events", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    const events = await kubectl.listEvents(context, namespace);
    res.json({ events });
});
