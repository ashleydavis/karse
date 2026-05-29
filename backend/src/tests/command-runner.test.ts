import { run } from "../command-runner";

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
