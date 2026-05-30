import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /namespaces (list) and POST /namespaces/default (set terminal default).
export const namespacesRouter = Router();

namespacesRouter.get("/namespaces", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({
            error: "context query parameter is required",
        });
        return;
    }
    const namespaces = await kubectl.listNamespaces(context);
    res.json({
        namespaces,
    });
});

namespacesRouter.post("/namespaces/default", async (req, res) => {
    const context: any = req.body.context;
    const namespace: any = req.body.namespace;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({
            error: "context must be a non-empty string",
        });
        return;
    }
    if (typeof namespace !== "string") {
        res.status(400).json({
            error: "namespace must be a string",
        });
        return;
    }
    await kubectl.setContextNamespace(context, namespace);
    res.json({
        ok: true,
    });
});
