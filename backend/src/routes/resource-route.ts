import { Router } from "express";
import { RESOURCE_KINDS } from "karse-types";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /resource/:type/:name, returning the common metadata (kind, name,
// namespace, creation timestamp, labels, annotations) of a single resource of any kind
// Karse is allowed to read. It backs the generic detail page, the page shown for a kind
// with no purpose-built page of its own.
//
// The kind is never taken from the request as-is: `:type` is checked against the
// RESOURCE_KINDS whitelist and the kubectl resource name comes from that table, so an
// arbitrary string cannot reach the kubectl argument list. The read itself is a single
// `kubectl get ... -o json`, consistent with the read-only invariant.
export const resourceRouter = Router();

resourceRouter.get("/resource/:type/:name", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { type, name } = req.params;
    if (!kubectl.isResourceKindToken(type!)) {
        res.status(400).json({ error: `unsupported resource type: ${type}` });
        return;
    }
    const info = RESOURCE_KINDS[type];
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    // A namespaced kind cannot be identified by name alone, so refuse rather than run a
    // read that would silently target the kubeconfig's default namespace.
    if (info.namespaced && namespace === undefined) {
        res.status(400).json({ error: `namespace query parameter is required for ${info.kind}` });
        return;
    }
    const detail = await kubectl.getResourceDetail(context, type, name!, info.namespaced ? namespace : undefined);
    if (detail === null) {
        res.status(404).json({ error: `${info.kind} "${name}" was not found in this cluster` });
        return;
    }
    res.json(detail);
});
