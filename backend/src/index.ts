import { createServer } from "./server";
import { pruneOldLogs } from "./audit-log";

const port = process.env.KARSE_PORT ?? "5172";
const logsDir = process.env.KARSE_LOGS_DIR ?? "../logs";

await pruneOldLogs(logsDir);

const app = createServer();
app.listen(Number(port), "127.0.0.1", () => {
    console.log("Karse backend listening on http://127.0.0.1:" + port);
});
