import { spawn } from "node:child_process";

// The stdout, stderr, and exit code produced by a spawned subprocess.
export type CommandResult = { stdout: string; stderr: string; exitCode: number };

// Callbacks invoked while a long-running streamed subprocess is alive.
// onStdout receives decoded stdout chunks as they arrive; onError receives a
// spawn/runtime error; onClose fires once when the process exits.
export type StreamHandlers = {
    onStdout: (chunk: string) => void;
    onError: (err: Error) => void;
    onClose: (exitCode: number) => void;
};

// A handle to a running streamed subprocess, exposing only a kill operation.
export type StreamHandle = { kill: () => void };

// Spawns `binary` with `args` and streams its stdout to the given handlers as it
// arrives, rather than buffering until exit. Used for follow-mode commands such
// as `kubectl logs -f`. Returns a handle the caller uses to terminate the child.
export function stream(binary: string, args: readonly string[], handlers: StreamHandlers): StreamHandle {
    const child = spawn(binary, [...args]);
    let settled = false;

    child.stdout.on("data", (chunk: Buffer) => {
        handlers.onStdout(chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
        // kubectl writes warnings and "unable to retrieve" notices to stderr;
        // surface them as stdout lines so the viewer shows what happened.
        handlers.onStdout(chunk.toString("utf8"));
    });

    child.on("error", (err) => {
        if (settled) {
            return;
        }
        settled = true;
        handlers.onError(err);
    });

    child.on("close", (code, signal) => {
        if (settled) {
            return;
        }
        settled = true;
        handlers.onClose(code ?? (signal ? 1 : 0));
    });

    return {
        kill: () => {
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
