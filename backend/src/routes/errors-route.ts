import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /errors (cluster- or namespace-wide error conditions:
// Warning events and problem pods).
export const errorsRouter = Router();

errorsRouter.get("/errors", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    const errors = await kubectl.listClusterErrors(context, namespace);
    res.json({ errors });
});
