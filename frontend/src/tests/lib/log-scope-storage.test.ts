import {
    LOG_SCOPE_STORAGE_KEY,
    emptyLogScope,
    loadLogScope,
    saveLogScope,
    clearLogScope,
    prunePods,
} from "../../lib/log-scope-storage";

// A minimal in-memory stand-in for the browser's localStorage, so the helpers can be
// exercised under the node test environment. Only the four methods the helpers call are
// implemented, backed by a plain map, and values are stringified the way the real API
// does so a test cannot accidentally round-trip a non-string.
class FakeStorage {
    private entries = new Map<string, string>();

    getItem(key: string): string | null {
        const value = this.entries.get(key);
        return value === undefined ? null : value;
    }

    setItem(key: string, value: string): void {
        this.entries.set(key, String(value));
    }

    removeItem(key: string): void {
        this.entries.delete(key);
    }

    has(key: string): boolean {
        return this.entries.has(key);
    }
}

let storage: FakeStorage;

beforeEach(() => {
    storage = new FakeStorage();
    (globalThis as any).localStorage = storage;
});

describe("emptyLogScope", () => {
    test("is the page's original empty state", () => {
        expect(emptyLogScope()).toEqual({
            namespace: "",
            pods: [],
            search: "",
        });
    });

    test("hands out a fresh object each call, so one caller cannot alter another's", () => {
        const first = emptyLogScope();
        first.pods.push("nginx-abc");
        expect(emptyLogScope().pods).toEqual([]);
    });
});

describe("saveLogScope and loadLogScope round trip", () => {
    test("restores the namespace, the ticked pods and the search text", () => {
        saveLogScope({
            namespace: "kube-system",
            pods: ["coredns-abc", "kube-proxy-xyz"],
            search: "core",
        });
        expect(loadLogScope()).toEqual({
            namespace: "kube-system",
            pods: ["coredns-abc", "kube-proxy-xyz"],
            search: "core",
        });
    });

    test("restores a search-only scope, with no namespace and nothing ticked", () => {
        saveLogScope({
            namespace: "",
            pods: [],
            search: "nginx",
        });
        expect(loadLogScope()).toEqual({
            namespace: "",
            pods: [],
            search: "nginx",
        });
    });

    test("stores an empty scope as no entry at all", () => {
        saveLogScope({
            namespace: "default",
            pods: ["nginx-abc"],
            search: "",
        });
        expect(storage.has(LOG_SCOPE_STORAGE_KEY)).toBe(true);
        saveLogScope(emptyLogScope());
        expect(storage.has(LOG_SCOPE_STORAGE_KEY)).toBe(false);
        expect(loadLogScope()).toEqual(emptyLogScope());
    });
});

describe("loadLogScope with nothing usable stored", () => {
    test("returns the empty state when there is no entry", () => {
        expect(loadLogScope()).toEqual(emptyLogScope());
    });

    test("returns the empty state when the entry is not JSON", () => {
        storage.setItem(LOG_SCOPE_STORAGE_KEY, "{not json");
        expect(loadLogScope()).toEqual(emptyLogScope());
    });

    test("returns the empty state when the entry is JSON but not an object", () => {
        storage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify("kube-system"));
        expect(loadLogScope()).toEqual(emptyLogScope());
        storage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify(null));
        expect(loadLogScope()).toEqual(emptyLogScope());
        storage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify(["nginx-abc"]));
        expect(loadLogScope()).toEqual(emptyLogScope());
    });

    test("returns the empty state when pods is not an array", () => {
        storage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify({
            namespace: "default",
            pods: "nginx-abc",
            search: "",
        }));
        expect(loadLogScope()).toEqual(emptyLogScope());
    });

    test("returns the empty state when the namespace is wrong-typed", () => {
        storage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify({
            namespace: 7,
            pods: ["nginx-abc"],
            search: "",
        }));
        expect(loadLogScope()).toEqual(emptyLogScope());
    });

    test("returns the empty state when the search text is wrong-typed", () => {
        storage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify({
            namespace: "default",
            pods: ["nginx-abc"],
            search: { value: "nginx" },
        }));
        expect(loadLogScope()).toEqual(emptyLogScope());
    });

    test("returns the empty state when the record has no fields at all", () => {
        storage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify({}));
        expect(loadLogScope()).toEqual(emptyLogScope());
    });

    test("drops wrong-typed pod names but keeps the rest of the selection", () => {
        storage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify({
            namespace: "default",
            pods: ["nginx-abc", 42, null, "redis-xyz"],
            search: "",
        }));
        expect(loadLogScope()).toEqual({
            namespace: "default",
            pods: ["nginx-abc", "redis-xyz"],
            search: "",
        });
    });

    test("never throws when localStorage itself is unavailable", () => {
        (globalThis as any).localStorage = undefined;
        expect(loadLogScope()).toEqual(emptyLogScope());
    });
});

describe("clearLogScope", () => {
    test("removes the stored entry, so a later load comes back empty", () => {
        saveLogScope({
            namespace: "default",
            pods: ["nginx-abc"],
            search: "ngi",
        });
        expect(storage.has(LOG_SCOPE_STORAGE_KEY)).toBe(true);
        clearLogScope();
        expect(storage.has(LOG_SCOPE_STORAGE_KEY)).toBe(false);
        expect(loadLogScope()).toEqual(emptyLogScope());
    });

    test("is a no-op when there was nothing stored", () => {
        clearLogScope();
        expect(storage.has(LOG_SCOPE_STORAGE_KEY)).toBe(false);
    });
});

describe("prunePods", () => {
    test("drops pods the cluster no longer has and keeps the survivors", () => {
        expect(prunePods(["nginx-abc", "redis-xyz"], ["nginx-abc", "coredns-123"]))
            .toEqual(["nginx-abc"]);
    });

    test("drops every pod when a rolled deployment renamed them all", () => {
        expect(prunePods(["web-7d9f8b6c5-x2k9p"], ["web-59c4d7f88b-q4trm"])).toEqual([]);
    });

    test("keeps the whole selection when every stored pod still exists", () => {
        expect(prunePods(["nginx-abc", "redis-xyz"], ["redis-xyz", "nginx-abc", "coredns-123"]))
            .toEqual(["nginx-abc", "redis-xyz"]);
    });

    test("keeps an empty selection empty", () => {
        expect(prunePods([], ["nginx-abc"])).toEqual([]);
    });
});
