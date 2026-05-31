import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /deployments, GET /statefulsets, and GET /daemonsets.
export const workloadsRouter = Router();

// Extracts a non-empty namespace string from a query param value, or undefined for all-namespaces.
function parseNs(raw: any): string | undefined {
    return typeof raw === "string" && raw.trim() !== "" ? raw : undefined;
}

workloadsRouter.get("/deployments", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = parseNs(req.query.namespace);
    const deployments = await kubectl.listDeployments(context, namespace);
    res.json({ deployments });
});

workloadsRouter.get("/statefulsets", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = parseNs(req.query.namespace);
    const statefulSets = await kubectl.listStatefulSets(context, namespace);
    res.json({ statefulSets });
});

workloadsRouter.get("/daemonsets", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = parseNs(req.query.namespace);
    const daemonSets = await kubectl.listDaemonSets(context, namespace);
    res.json({ daemonSets });
});
