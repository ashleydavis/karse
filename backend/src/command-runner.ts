import { spawn } from "node:child_process";

// The stdout, stderr, and exit code produced by a spawned subprocess.
export type CommandResult = { stdout: string; stderr: string; exitCode: number };

// Callbacks delivering incremental output from a streaming subprocess.
// onData fires for every stdout chunk (decoded UTF-8); onError fires once on
// spawn failure or non-zero exit; onClose fires once after the process exits cleanly.
export type StreamHandlers = {
    onData: (chunk: string) => void;
    onError: (message: string) => void;
    onClose: () => void;
};

// A handle for a running streaming subprocess; call stop() to terminate it.
export type StreamHandle = { stop: () => void };

// Spawns `binary` with `args` and streams its stdout chunk-by-chunk via handlers.
// Used for follow/tail style reads (e.g. `kubectl logs -f`) where output arrives
// over time and must be forwarded as it appears rather than buffered to completion.
// Returns a handle whose stop() kills the subprocess (used when a client disconnects).
export function runStream(binary: string, args: readonly string[], handlers: StreamHandlers): StreamHandle {
    const child = spawn(binary, [...args]);
    let settled = false;
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
        handlers.onData(chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
        if (settled) {
            return;
        }
        settled = true;
        handlers.onError(err.message);
    });

    child.on("close", (code, signal) => {
        if (settled) {
            return;
        }
        settled = true;
        if (code !== null && code !== 0 && !signal) {
            handlers.onError(stderr.trim() || `kubectl exited with code ${code}`);
            return;
        }
        handlers.onClose();
    });

    return {
        stop: () => {
            if (settled) {
                return;
            }
            settled = true;
            child.kill();
        },
    };
}

// Spawns `binary` with `args` and resolves with its combined output once the process exits.
export function run(binary: string, args: readonly string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(binary, [...args]);
        let stdout = "";
        let stderr = "";
        let settled = false;

        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
        });

        child.on("error", (err) => {
            if (settled) {
                return;
            }
            settled = true;
            reject(err);
        });

        child.on("close", (code, signal) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve({
                stdout,
                stderr,
                exitCode: code ?? (signal ? 1 : 0),
            });
        });
    });
}
