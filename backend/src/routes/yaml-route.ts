import { Router } from "express";
import { isReadableResourceKind } from "karse-types";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /yaml/:type/:name, returning the raw YAML for a single resource.
// Works generically for every resource kind the cluster serves; `:type` is checked with
// isReadableResourceKind (it must look like a kubectl resource name and must not name a
// kind Karse refuses to read), which the adapter enforces again.
export const yamlRouter = Router();

yamlRouter.get("/yaml/:type/:name", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { type, name } = req.params;
    if (!isReadableResourceKind(type!)) {
        res.status(400).json({ error: `Karse will not read resources of type: ${type}` });
        return;
    }
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    const yaml = await kubectl.getResourceYaml(context, type!, name!, namespace);
    res.json({ yaml });
});
