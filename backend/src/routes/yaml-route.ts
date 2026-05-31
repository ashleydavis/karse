import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /yaml/:type/:name, returning the raw YAML for a single resource.
// Works generically for every viewable resource type (nodes, pods, deployments,
// daemonsets, statefulsets, namespaces). The adapter enforces the allowed-type whitelist.
export const yamlRouter = Router();

yamlRouter.get("/yaml/:type/:name", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { type, name } = req.params;
    if (!kubectl.isYamlResourceType(type!)) {
        res.status(400).json({ error: `unsupported resource type: ${type}` });
        return;
    }
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    const yaml = await kubectl.getResourceYaml(context, type!, name!, namespace);
    res.json({ yaml });
});
