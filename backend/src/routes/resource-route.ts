import { Router } from "express";
import { isReadableResourceKind, knownResourceKind } from "karse-types";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /resource/:type/:name, returning the common metadata (kind, name,
// namespace, creation timestamp, labels, annotations) of a single resource of any kind
// the cluster serves. It backs the generic detail page, the page shown for a kind with no
// purpose-built page of its own.
//
// `:type` is checked with isReadableResourceKind before it is used: it must look like a
// kubectl resource name (so it can never be read as a flag) and must not name a kind
// Karse refuses to read (Secrets). It is not checked against a list of known kinds,
// because a kind Karse has never heard of is still a resource the dashboard should show;
// whether it exists is the cluster's answer to give. The read itself is a single
// `kubectl get ... -o json`, consistent with the read-only invariant.
export const resourceRouter = Router();

resourceRouter.get("/resource/:type/:name", async (req, res) => {
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
    const known = knownResourceKind(type!);
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    // A kind Karse knows to be namespaced cannot be identified by name alone, so refuse
    // rather than run a read that would silently target the kubeconfig's default
    // namespace. For a kind Karse does not know, the caller supplying a namespace is the
    // only signal of scope there is, so the read follows what it was given.
    if (known?.namespaced === true && namespace === undefined) {
        res.status(400).json({ error: `namespace query parameter is required for ${known.kind}` });
        return;
    }
    const detail = await kubectl.getResourceDetail(
        context, type!, name!, known?.namespaced === false ? undefined : namespace,
    );
    if (detail === null) {
        res.status(404).json({ error: `${known?.kind ?? type} "${name}" was not found in this cluster` });
        return;
    }
    res.json(detail);
});
