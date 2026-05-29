import { spawn } from "node:child_process";

// The stdout, stderr, and exit code produced by a spawned subprocess.
export type CommandResult = { stdout: string; stderr: string; exitCode: number };

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
