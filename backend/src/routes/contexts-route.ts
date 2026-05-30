import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /contexts (list + current) and POST /contexts/current (switch).
export const contextsRouter = Router();

contextsRouter.get("/contexts", async (_req, res) => {
    const [contexts, current] = await Promise.all([
        kubectl.listContexts(),
        kubectl.getCurrentContext(),
    ]);
    res.json({
        contexts,
        current,
    });
});

contextsRouter.post("/contexts/current", async (req, res) => {
    const name: any = req.body.name;
    if (typeof name !== "string" || name.trim() === "") {
        res.status(400).json({
            error: "name must be a non-empty string",
        });
        return;
    }
    if (name.startsWith("-")) {
        res.status(400).json({
            error: "name must not start with '-'",
        });
        return;
    }
    await kubectl.setCurrentContext(name);
    const [contexts, current] = await Promise.all([
        kubectl.listContexts(),
        kubectl.getCurrentContext(),
    ]);
    res.json({
        contexts,
        current,
    });
});
