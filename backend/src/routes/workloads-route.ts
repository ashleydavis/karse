import { Router } from "express";
import type { WorkloadKind } from "karse-types";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling the workload list and detail endpoints for deployments,
// stateful sets, and daemon sets.
export const workloadsRouter = Router();

// Extracts a non-empty namespace string from a query param value, or undefined for all-namespaces.
function parseNs(raw: any): string | undefined {
    return typeof raw === "string" && raw.trim() !== "" ? raw : undefined;
}

// Registers GET /:kind/:namespace/:name for one workload kind, returning the
// detailed view. Shared by deployments, statefulsets, and daemonsets so the three
// detail routes stay identical apart from the kind they pass to the adapter.
function registerWorkloadDetail(kind: WorkloadKind) {
    workloadsRouter.get(`/${kind}/:namespace/:name`, async (req, res) => {
        const context = req.query.context;
        if (typeof context !== "string" || context.trim() === "") {
            res.status(400).json({ error: "context query parameter is required" });
            return;
        }
        const { namespace, name } = req.params;
        const detail = await kubectl.getWorkloadDetail(context, kind, namespace!, name!);
        res.json(detail);
    });
}

registerWorkloadDetail("deployments");
registerWorkloadDetail("statefulsets");
registerWorkloadDetail("daemonsets");

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

workloadsRouter.get("/horizontalpodautoscalers", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = parseNs(req.query.namespace);
    const horizontalPodAutoscalers = await kubectl.listHorizontalPodAutoscalers(context, namespace);
    res.json({ horizontalPodAutoscalers });
});
