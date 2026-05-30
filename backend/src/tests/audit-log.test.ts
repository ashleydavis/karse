import { mkdtemp, rm, mkdir, stat } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
    formatLocalISO,
    getAuditDir,
    getAuditFile,
    audit,
    pruneOldLogs,
} from "../audit-log";

describe("formatLocalISO", () => {
    test("returns local ISO with offset (never UTC Z)", () => {
        const result = formatLocalISO(new Date());
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    });
});

describe("getAuditDir", () => {
    test("returns zero-padded baseDir/YYYY/MM/DD path", () => {
        const when = new Date(2026, 2, 5, 10, 0, 0);
        expect(getAuditDir("/base", when)).toBe(join("/base", "2026", "03", "05"));
    });
});

describe("getAuditFile", () => {
    test("returns .../HH.log path with zero-padded hour", () => {
        const when = new Date(2026, 2, 5, 7, 0, 0);
        expect(getAuditFile("/base", when)).toBe(join(getAuditDir("/base", when), "07.log"));
    });
});

describe("audit", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), "karse-audit-test-"));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    test("appends correctly-formatted lines in order", async () => {
        const when = new Date(2026, 2, 5, 10, 30, 0, 0);
        await audit(tmpDir, "kubectl", ["get", "nodes"], when);
        await audit(tmpDir, "kubectl", ["get", "nodes"], when);

        const filePath = getAuditFile(tmpDir, when);
        const contents = await readFile(filePath, "utf8");
        const lines = contents.split("\n").filter((l) => l.length > 0);

        expect(lines.length).toBe(2);
        const prefix = formatLocalISO(when);
        expect(lines[0]!.startsWith(prefix)).toBe(true);
        expect(lines[0]!.endsWith("kubectl get nodes")).toBe(true);
        expect(lines[1]!.startsWith(prefix)).toBe(true);
        expect(lines[1]!.endsWith("kubectl get nodes")).toBe(true);
    });
});

describe("pruneOldLogs", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), "karse-prune-test-"));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    async function makeDir(...parts: string[]): Promise<string> {
        const p = join(tmpDir, ...parts);
        await mkdir(p, { recursive: true });
        return p;
    }

    async function exists(path: string): Promise<boolean> {
        try {
            await stat(path);
            return true;
        }
        catch {
            return false;
        }
    }

    test("removes a 4-month-old day dir but keeps a 1-month-old one", async () => {
        const now = new Date(2026, 4, 15);
        const oldDir = await makeDir("2026", "01", "15");
        const recentDir = await makeDir("2026", "04", "15");

        await pruneOldLogs(tmpDir, now);

        expect(await exists(oldDir)).toBe(false);
        expect(await exists(recentDir)).toBe(true);
    });

    test("does not delete the current day's dir", async () => {
        const now = new Date(2026, 4, 15);
        const nowDir = await makeDir("2026", "05", "15");
        const oldDir = await makeDir("2026", "01", "10");

        await pruneOldLogs(tmpDir, now);

        expect(await exists(nowDir)).toBe(true);
        expect(await exists(oldDir)).toBe(false);
    });

    test("handles month-end now (2026-05-31) without off-by-one drift", async () => {
        const now = new Date(2026, 4, 31);
        const oldDir = await makeDir("2026", "01", "15");
        const recentDir = await makeDir("2026", "05", "20");

        await pruneOldLogs(tmpDir, now);

        expect(await exists(oldDir)).toBe(false);
        expect(await exists(recentDir)).toBe(true);
    });

    test("does not throw on an empty baseDir", async () => {
        await expect(pruneOldLogs(tmpDir, new Date())).resolves.toBeUndefined();
    });
});
