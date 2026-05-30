import express from "express";
import type { ErrorRequestHandler } from "express";
import { contextsRouter } from "./routes/contexts-route";
import { clusterRouter } from "./routes/cluster-route";

// Builds and returns the configured Express application.
// Applies JSON body parsing, mounts both API routers, and installs the
// catch-all error middleware that surfaces adapter errors as 500 responses.
export function createServer(): express.Express {
    const app = express();
    app.use(express.json());
    app.use("/api", contextsRouter);
    app.use("/api", clusterRouter);
    const errorHandler: ErrorRequestHandler = (err: Error, _req, res, _next) => {
        res.status(500).json({
            error: err.message,
        });
    };
    app.use(errorHandler);
    return app;
}
