import { createServer } from "./server";
import { pruneOldLogs } from "./audit-log";
import { resolveRequestedPort, listen, reportPort } from "./listen-server";

const requestedPort = resolveRequestedPort();
const logsDir = process.env.KARSE_LOGS_DIR ?? "../logs";

await pruneOldLogs(logsDir);

const app = createServer();
const { port } = await listen(app, requestedPort, "127.0.0.1");
await reportPort(port);
