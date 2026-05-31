import { run, runStream } from "../command-runner";

describe("command-runner", () => {
  test("Case A: happy path", async () => {
    const result = await run("bash", ["-c", "echo hi"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hi");
    expect(result.stderr).toBe("");
  });

  test("Case B: non-zero exit", async () => {
    const result = await run("bash", ["-c", "exit 7"]);
    expect(result.exitCode).toBe(7);
  });

  test("Case C: stderr capture", async () => {
    const result = await run("bash", ["-c", "echo err >&2"]);
    expect(result.stderr.trim()).toBe("err");
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  });

  test("Case D: mixed streams", async () => {
    const result = await run("bash", ["-c", "echo out; echo err >&2; exit 3"]);
    expect(result.stdout.trim()).toBe("out");
    expect(result.stderr.trim()).toBe("err");
    expect(result.exitCode).toBe(3);
  });

  test("Case E: binary not found", async () => {
    await expect(run("definitely-not-a-binary-xyz", [])).rejects.toThrow();
  });

  test("Case F: chunked stdout", async () => {
    const result = await run("bash", ["-c", "printf abc; sleep 0.05; printf def"]);
    expect(result.stdout).toBe("abcdef");
    expect(result.exitCode).toBe(0);
  });

  test("Case G: signal-killed", async () => {
    const result = await run("bash", ["-c", "kill -TERM $$"]);
    expect(result.exitCode).toBe(1);
  });
});

describe("runStream", () => {
  test("forwards stdout chunks then calls onClose on clean exit", async () => {
    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      runStream("bash", ["-c", "printf abc; sleep 0.05; printf def"], {
        onData: (chunk) => { chunks.push(chunk); },
        onError: (message) => { reject(new Error(message)); },
        onClose: () => { resolve(); },
      });
    });
    expect(chunks.join("")).toBe("abcdef");
  });

  test("calls onError with stderr on non-zero exit", async () => {
    const message = await new Promise<string>((resolve) => {
      runStream("bash", ["-c", "echo boom >&2; exit 2"], {
        onData: () => {},
        onError: (msg) => { resolve(msg); },
        onClose: () => { resolve("CLOSED"); },
      });
    });
    expect(message).toContain("boom");
  });

  test("calls onError when the binary cannot be spawned", async () => {
    const message = await new Promise<string>((resolve) => {
      runStream("definitely-not-a-binary-xyz", [], {
        onData: () => {},
        onError: (msg) => { resolve(msg); },
        onClose: () => { resolve("CLOSED"); },
      });
    });
    expect(message).not.toBe("CLOSED");
  });

  test("stop() terminates the process without firing onError", async () => {
    let errored = false;
    const handle = runStream("bash", ["-c", "sleep 5"], {
      onData: () => {},
      onError: () => { errored = true; },
      onClose: () => {},
    });
    handle.stop();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(errored).toBe(false);
  });
});
