import { parseCpuToMillicores, parseMemoryToBytes } from "../../kubectl/quantity";

describe("parseCpuToMillicores", () => {
    test("parses millicore form", () => {
        expect(parseCpuToMillicores("250m")).toBe(250);
    });

    test("parses a whole core to millicores", () => {
        expect(parseCpuToMillicores("1")).toBe(1000);
    });

    test("parses a fractional core to millicores", () => {
        expect(parseCpuToMillicores("1.5")).toBe(1500);
    });

    test("parses nanocores, flooring after dividing by 1e6", () => {
        expect(parseCpuToMillicores("123456789n")).toBe(123);
    });

    test("parses microcores, flooring after dividing by 1000", () => {
        // 1,500,000 microcores = 1500 millicores.
        expect(parseCpuToMillicores("1500000u")).toBe(1500);
    });

    test("parses the 398u case from the bug report (floors to 0 millicores)", () => {
        // 398 microcores is below one millicore, so it floors to 0 rather than throwing.
        expect(parseCpuToMillicores("398u")).toBe(0);
    });

    test("parses an SI decimal core suffix (k) to millicores", () => {
        // 1k cores = 1000 cores = 1,000,000 millicores. kwok reports node allocatable
        // CPU in this form, so it must parse rather than throw.
        expect(parseCpuToMillicores("1k")).toBe(1_000_000);
    });

    test("parses larger SI core suffixes (M)", () => {
        expect(parseCpuToMillicores("2M")).toBe(2 * 1000 ** 2 * 1000);
    });

    test("parses a binary core suffix (Ki) to millicores", () => {
        expect(parseCpuToMillicores("1Ki")).toBe(1024 * 1000);
    });

    test("returns 0 for an empty string", () => {
        expect(parseCpuToMillicores("")).toBe(0);
    });

    test("throws on a malformed value", () => {
        expect(() => parseCpuToMillicores("garbage")).toThrow();
    });

    test("throws on a number with an unknown suffix", () => {
        expect(() => parseCpuToMillicores("10x")).toThrow();
    });
});

describe("parseMemoryToBytes", () => {
    test("parses Ki binary suffix", () => {
        expect(parseMemoryToBytes("1Ki")).toBe(1024);
    });

    test("parses Mi binary suffix", () => {
        expect(parseMemoryToBytes("1Mi")).toBe(1024 ** 2);
    });

    test("parses Gi binary suffix", () => {
        expect(parseMemoryToBytes("1Gi")).toBe(1024 ** 3);
    });

    test("parses Ti binary suffix", () => {
        expect(parseMemoryToBytes("1Ti")).toBe(1024 ** 4);
    });

    test("parses Pi binary suffix", () => {
        expect(parseMemoryToBytes("1Pi")).toBe(1024 ** 5);
    });

    test("parses Ei binary suffix", () => {
        expect(parseMemoryToBytes("1Ei")).toBe(1024 ** 6);
    });

    test("parses K decimal suffix", () => {
        expect(parseMemoryToBytes("1K")).toBe(1000);
    });

    test("parses M decimal suffix", () => {
        expect(parseMemoryToBytes("1M")).toBe(1000 ** 2);
    });

    test("parses G decimal suffix", () => {
        expect(parseMemoryToBytes("1G")).toBe(1000 ** 3);
    });

    test("parses T decimal suffix", () => {
        expect(parseMemoryToBytes("1T")).toBe(1000 ** 4);
    });

    test("parses P decimal suffix", () => {
        expect(parseMemoryToBytes("1P")).toBe(1000 ** 5);
    });

    test("parses E decimal suffix", () => {
        expect(parseMemoryToBytes("1E")).toBe(1000 ** 6);
    });

    test("parses plain integer bytes", () => {
        expect(parseMemoryToBytes("1048576")).toBe(1048576);
    });

    test("returns 0 for an empty string", () => {
        expect(parseMemoryToBytes("")).toBe(0);
    });

    test("throws on a malformed value", () => {
        expect(() => parseMemoryToBytes("garbage")).toThrow();
    });

    test("throws on a number with an unknown suffix", () => {
        expect(() => parseMemoryToBytes("10Zi")).toThrow();
    });
});
