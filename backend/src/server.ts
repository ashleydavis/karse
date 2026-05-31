import express from "express";
import type { ErrorRequestHandler } from "express";
import { contextsRouter } from "./routes/contexts-route";
import { clusterRouter } from "./routes/cluster-route";
import { namespacesRouter } from "./routes/namespaces-route";
import { podsRouter } from "./routes/pods-route";
import { podDetailRouter } from "./routes/pod-detail-route";
import { nodeDetailRouter } from "./routes/node-detail-route";
import { workloadsRouter } from "./routes/workloads-route";
import { yamlRouter } from "./routes/yaml-route";
import { logsStreamRouter } from "./routes/logs-stream-route";

// Builds and returns the configured Express application.
// Applies JSON body parsing, mounts both API routers, and installs the
// catch-all error middleware that surfaces adapter errors as 500 responses.
export function createServer(): express.Express {
    const app = express();
    app.use(express.json());
    app.use("/api", contextsRouter);
    app.use("/api", clusterRouter);
    app.use("/api", namespacesRouter);
    // Pod detail + logs must come before the list route to avoid param conflicts.
    app.use("/api", podDetailRouter);
    app.use("/api", podsRouter);
    app.use("/api", nodeDetailRouter);
    app.use("/api", workloadsRouter);
    app.use("/api", yamlRouter);
    app.use("/api", logsStreamRouter);
    const errorHandler: ErrorRequestHandler = (err: Error, _req, res, _next) => {
        res.status(500).json({
            error: err.message,
        });
    };
    app.use(errorHandler);
    return app;
}
