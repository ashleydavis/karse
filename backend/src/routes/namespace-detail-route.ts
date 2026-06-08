import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /namespaces/:name, returning the detailed view of a single
// namespace (phase, labels, annotations, contained resources, quotas, limits).
export const namespaceDetailRouter = Router();

namespaceDetailRouter.get("/namespaces/:name", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { name } = req.params;
    const detail = await kubectl.getNamespaceDetail(context, name!);
    res.json(detail);
});
