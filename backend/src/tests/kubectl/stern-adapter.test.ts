jest.mock("../../command-runner");
jest.mock("../../audit-log");

import { isSternAvailable, streamStern } from "../../kubectl/stern-adapter";

const { run, stream } = jest.requireMock("../../command-runner");

afterEach(() => {
    delete process.env.KARSE_FAKE_STERN;
    run.mockReset();
    stream.mockReset();
});

describe("isSternAvailable", () => {
    test("returns true without probing when KARSE_FAKE_STERN=1", async () => {
        process.env.KARSE_FAKE_STERN = "1";
        await expect(isSternAvailable()).resolves.toBe(true);
        expect(run).not.toHaveBeenCalled();
    });

    test("returns true when `stern --version` exits 0", async () => {
        run.mockResolvedValue({ stdout: "version 1.30.0", stderr: "", exitCode: 0 });
        await expect(isSternAvailable()).resolves.toBe(true);
        expect(run).toHaveBeenCalledWith("stern", ["--version"]);
    });

    test("returns false when stern exits non-zero", async () => {
        run.mockResolvedValue({ stdout: "", stderr: "boom", exitCode: 1 });
        await expect(isSternAvailable()).resolves.toBe(false);
    });

    test("returns false when spawning stern throws (not on PATH)", async () => {
        run.mockRejectedValue(new Error("spawn stern ENOENT"));
        await expect(isSternAvailable()).resolves.toBe(false);
    });
});

describe("streamStern", () => {
    // Captures the StreamHandlers passed to the mocked command-runner stream() so
    // tests can drive stdout/close callbacks as a real spawned process would.
    function captureStream(): { handlers: any; kill: jest.Mock } {
        const kill = jest.fn();
        let captured: any = null;
        stream.mockImplementation((_binary: string, _args: readonly string[], handlers: any) => {
            captured = handlers;
            return { kill };
        });
        return {
            get handlers() {
                return captured;
            },
            kill,
        };
    }

    test("invokes stern with the query, context, namespace and tail", () => {
        captureStream();
        streamStern("ctx", "default", "nginx-*", 50, {
            onLine: jest.fn(),
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        expect(stream).toHaveBeenCalledWith(
            "stern",
            [
                "--context", "ctx",
                "--namespace", "default",
                "--tail", "50",
                "--color", "never",
                "--template", "{{.Namespace}} {{.PodName}} {{.Message}}",
                "nginx-*",
            ],
            expect.any(Object)
        );
    });

    test("uses --all-namespaces when no namespace is given", () => {
        captureStream();
        streamStern("ctx", undefined, ".*", 100, {
            onLine: jest.fn(),
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        const args = stream.mock.calls[0][1] as string[];
        expect(args).toContain("--all-namespaces");
        expect(args).not.toContain("--namespace");
    });

    test("splits streamed chunks into complete lines", () => {
        const cap = captureStream();
        const onLine = jest.fn();
        streamStern("ctx", "default", "nginx", 100, {
            onLine,
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        cap.handlers.onStdout("line one\nline two\npart");
        expect(onLine).toHaveBeenCalledTimes(2);
        expect(onLine).toHaveBeenNthCalledWith(1, "line one");
        expect(onLine).toHaveBeenNthCalledWith(2, "line two");
    });

    test("flushes a trailing partial line on close", () => {
        const cap = captureStream();
        const onLine = jest.fn();
        const onClose = jest.fn();
        streamStern("ctx", "default", "nginx", 100, {
            onLine,
            onError: jest.fn(),
            onClose,
        });
        cap.handlers.onStdout("complete\ntrailing");
        cap.handlers.onClose(0);
        expect(onLine).toHaveBeenCalledWith("trailing");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("forwards stream errors", () => {
        const cap = captureStream();
        const onError = jest.fn();
        streamStern("ctx", "default", "nginx", 100, {
            onLine: jest.fn(),
            onError,
            onClose: jest.fn(),
        });
        cap.handlers.onError(new Error("spawn failed"));
        expect(onError).toHaveBeenCalledWith(new Error("spawn failed"));
    });

    test("stop() kills the underlying process", () => {
        const cap = captureStream();
        const handle = streamStern("ctx", "default", "nginx", 100, {
            onLine: jest.fn(),
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        handle.stop();
        expect(cap.kill).toHaveBeenCalled();
    });

    test("emits fake stern lines without spawning when KARSE_FAKE_STERN=1", () => {
        process.env.KARSE_FAKE_STERN = "1";
        const onLine = jest.fn();
        streamStern("ctx", "default", "", 100, {
            onLine,
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        expect(stream).not.toHaveBeenCalled();
        const emitted = onLine.mock.calls.map((c: any[]) => c[0]).join("\n");
        expect(emitted).toContain("nginx-abc");
        expect(emitted).toContain("redis-xyz");
    });

    test("fake mode filters lines by a substring query", () => {
        process.env.KARSE_FAKE_STERN = "1";
        const onLine = jest.fn();
        streamStern("ctx", "default", "redis", 100, {
            onLine,
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        const emitted = onLine.mock.calls.map((c: any[]) => c[0]);
        expect(emitted.every((l: string) => l.includes("redis-xyz"))).toBe(true);
        expect(emitted.length).toBeGreaterThan(0);
    });
});
