import {
    type EventFilter,
    type FilterableItem,
    workloadName,
    serviceName,
    normalizedMessage,
    detailsKey,
    detailsHash,
    extendedHash,
    groupSummary,
    itemScopeValue,
    filterMatchesItem,
    countMatchingItems,
    applyEventFilters,
    filterKey,
    addEventFilter,
    removeEventFilter,
    rowFilterActions,
    filterActionText,
    filterCoverageText,
    filterChipText,
} from "../../lib/event-filter";

// Builds an event/error with realistic field shapes, overriding whichever fields a test
// cares about. Mirrors the fields ClusterEvent and ClusterError share.
function item(overrides: Partial<FilterableItem> = {}): FilterableItem {
    return {
        reason: "BackOff",
        message: "Back-off restarting failed container app in pod web-7d9f8b6c5-x2k9p",
        namespace: "default",
        objectKind: "Pod",
        objectName: "web-7d9f8b6c5-x2k9p",
        ...overrides,
    };
}

// Kubernetes generates the random parts of a name from one alphabet with no vowels in it:
// "bcdfghjklmnpqrstvwxz2456789". Two consequences drive these fixtures, and neither is
// optional if the tests are to catch what a real cluster does:
//
//   1. A generated suffix need contain no digit at all. Nineteen of the alphabet's
//      twenty-seven characters are consonants, so a suffix like "jmnbk" is ordinary — it
//      turns up on roughly one pod in six. Fixtures that all carry a digit ("x2k9p") test
//      the code against itself rather than against Kubernetes, so several fixtures below
//      are deliberately all-consonant.
//   2. A segment holding a vowel cannot have been generated. "plane" (of
//      "etcd-kind-control-plane") and "alpine3" are ordinary parts of a name a human
//      wrote, and stripping them would merge unrelated workloads into one service.
describe("workloadName", () => {
    describe("pods Kubernetes named itself", () => {
        test("strips a deployment pod's random suffix and its replicaset's pod-template hash", () => {
            expect(workloadName("web-7d9f8b6c5-x2k9p", "Pod")).toBe("web");
        });

        test("strips an all-consonant random suffix, which carries no digit at all", () => {
            // The regression this suite exists to catch: "jmnbk" is exactly as ordinary a
            // suffix as "x2k9p", and a real coredns pod looks just like this.
            expect(workloadName("coredns-5d78c9869d-jmnbk", "Pod")).toBe("coredns");
        });

        test("two pods of one replicaset resolve to the same workload, digits or none", () => {
            expect(workloadName("coredns-5d78c9869d-jmnbk", "Pod")).toBe("coredns");
            expect(workloadName("coredns-5d78c9869d-qzwtk", "Pod")).toBe("coredns");
            expect(workloadName("coredns-5d78c9869d-x2k9p", "Pod")).toBe("coredns");
        });

        test("strips a daemonset pod's random suffix", () => {
            expect(workloadName("kube-proxy-bktzq", "Pod")).toBe("kube-proxy");
        });

        test("strips a statefulset pod's ordinal", () => {
            expect(workloadName("postgres-0", "Pod")).toBe("postgres");
            expect(workloadName("postgres-11", "Pod")).toBe("postgres");
        });

        test("strips a statefulset ordinal from a hyphenated name", () => {
            expect(workloadName("prometheus-k8s-0", "Pod")).toBe("prometheus-k8s");
        });

        test("strips a cronjob pod's job timestamp along with its random suffix", () => {
            expect(workloadName("report-27128010-2xkfh", "Pod")).toBe("report");
        });
    });

    describe("objects that own pods", () => {
        test("strips a replicaset's pod-template hash", () => {
            expect(workloadName("coredns-5d78c9869d", "ReplicaSet")).toBe("coredns");
        });

        test("strips the timestamp from a job a cronjob created", () => {
            expect(workloadName("report-27128010", "Job")).toBe("report");
        });

        test("leaves a deployment's name alone", () => {
            expect(workloadName("coredns", "Deployment")).toBe("coredns");
        });

        test("leaves a name alone for a kind that carries no generated suffix", () => {
            // A deployment may legitimately be named like a generated suffix; nothing is
            // stripped, because a deployment is named by a human, not by Kubernetes.
            expect(workloadName("web-7d9f8b6c5", "Deployment")).toBe("web-7d9f8b6c5");
            expect(workloadName("postgres-0", "StatefulSet")).toBe("postgres-0");
            expect(workloadName("node-1", "Node")).toBe("node-1");
        });
    });

    describe("names a human wrote, which must not be stripped", () => {
        test("keeps a segment holding a vowel, which Kubernetes never generates", () => {
            // "plane" is five characters, but Kubernetes cannot have generated it: every
            // control-plane pod in a kind cluster is named this way.
            expect(workloadName("etcd-kind-control-plane", "Pod")).toBe("etcd-kind-control-plane");
        });

        test("keeps a name that ends in a word plus a digit", () => {
            expect(workloadName("nginx-alpine3", "Pod")).toBe("nginx-alpine3");
        });

        test("keeps an api-version-like suffix", () => {
            expect(workloadName("my-service-v2beta1", "Pod")).toBe("my-service-v2beta1");
        });

        test("keeps a long run of digits, which is no statefulset ordinal", () => {
            expect(workloadName("app-123456", "Pod")).toBe("app-123456");
        });

        test("keeps a plain two-word name", () => {
            expect(workloadName("web-server", "Pod")).toBe("web-server");
        });

        test("keeps a short versioned name", () => {
            expect(workloadName("api-v2", "Pod")).toBe("api-v2");
        });

        test("keeps a name that is nothing but a generated-looking segment", () => {
            expect(workloadName("x2k9p", "Pod")).toBe("x2k9p");
        });
    });
});

describe("serviceName", () => {
    test("qualifies the workload by its namespace", () => {
        expect(serviceName(item({ objectName: "web-7d9f8b6c5-x2k9p", namespace: "staging" }))).toBe("staging/web");
    });

    test("a pod, its replicaset and its deployment all resolve to the one service", () => {
        const pod = item({ namespace: "kube-system", objectKind: "Pod", objectName: "coredns-5d78c9869d-jmnbk" });
        const replicaSet = item({ namespace: "kube-system", objectKind: "ReplicaSet", objectName: "coredns-5d78c9869d" });
        const deployment = item({ namespace: "kube-system", objectKind: "Deployment", objectName: "coredns" });
        expect(serviceName(pod)).toBe("kube-system/coredns");
        expect(serviceName(replicaSet)).toBe("kube-system/coredns");
        expect(serviceName(deployment)).toBe("kube-system/coredns");
    });

    test("keeps two same-named services in different namespaces distinct", () => {
        expect(serviceName(item({ namespace: "default" }))).toBe("default/web");
        expect(serviceName(item({ namespace: "staging" }))).toBe("staging/web");
    });

    test("does not merge two distinct services with similar names", () => {
        const alpine = item({ objectName: "nginx-alpine3" });
        const plain = item({ objectName: "nginx" });
        expect(serviceName(alpine)).not.toBe(serviceName(plain));
    });
});

describe("normalizedMessage", () => {
    test("masks the involved object's name", () => {
        const normalized = normalizedMessage(item({
            objectName: "web-7d9f8b6c5-x2k9p",
            message: "Failed to pull image for web-7d9f8b6c5-x2k9p",
        }));
        expect(normalized).toBe("failed to pull image for <object>");
    });

    test("masks the namespace", () => {
        const normalized = normalizedMessage(item({
            namespace: "staging",
            objectName: "db",
            message: "Created pod in staging",
        }));
        expect(normalized).toBe("created pod in <namespace>");
    });

    test("masks a name only where it is the whole word", () => {
        // The object is named "api"; the "api" inside "rapid" is not a reference to it.
        const normalized = normalizedMessage(item({
            objectName: "api",
            namespace: "prod",
            message: "Rapid teardown of api container",
        }));
        expect(normalized).toBe("rapid teardown of <object> container");
    });

    test("masks another object Kubernetes named, not just the involved one", () => {
        // A replicaset's SuccessfulCreate names the *pod* it made, not itself. Masking only
        // the involved object would leave the pod's name in, and no two of these would ever
        // group — which is the case the feature exists for.
        const normalized = normalizedMessage(item({
            reason: "SuccessfulCreate",
            objectKind: "ReplicaSet",
            objectName: "web-7d9f8b6c5",
            message: "Created pod: web-7d9f8b6c5-x2k9p",
        }));
        expect(normalized).toBe("created pod: <object>");
    });

    test("masks a pod UID", () => {
        const normalized = normalizedMessage(item({
            objectName: "web-7d9f8b6c5-x2k9p",
            namespace: "default",
            message: "Back-off restarting failed container app in pod web-7d9f8b6c5-x2k9p_default(9c1a7c9e-4b2d-4c3a-9f11-2b7c4d5e6f70)",
        }));
        expect(normalized).toBe("back-off restarting failed container app in pod <object>_<namespace>(<uid>)");
    });

    test("masks an IP address and its port", () => {
        const normalized = normalizedMessage(item({
            objectName: "db",
            namespace: "prod",
            message: "Liveness probe failed: dial tcp 10.244.1.5:8080: connect: connection refused",
        }));
        expect(normalized).toBe("liveness probe failed: dial tcp <address>: connect: connection refused");
    });

    test("keeps an exit code, which says what went wrong rather than where", () => {
        expect(normalizedMessage(item({ objectName: "db", namespace: "prod", message: "Container exited with code 137" })))
            .toBe("container exited with code 137");
    });

    test("keeps an image tag", () => {
        expect(normalizedMessage(item({ objectName: "db", namespace: "prod", message: "Pulling image nginx:1.25.3" })))
            .toBe("pulling image nginx:1.25.3");
    });

    test("lower-cases and collapses whitespace", () => {
        const normalized = normalizedMessage(item({
            objectName: "db",
            namespace: "prod",
            message: "  Readiness   probe\nFAILED  ",
        }));
        expect(normalized).toBe("readiness probe failed");
    });

    test("leaves an empty message empty", () => {
        expect(normalizedMessage(item({ message: "" }))).toBe("");
    });
});

// The whole point of the details hash is that hiding a group hides only what the user
// meant to hide. A number in a message is usually the *problem* (an exit code, an HTTP
// status), so erasing numbers wholesale would merge an OOM kill with a clean exit, and a
// benign 404 with a 500. These are the cases that must stay apart.
describe("detailsHash keeps different failures apart", () => {
    const failed = (message: string) => item({ reason: "Failed", objectName: "web-7d9f8b6c5-x2k9p", message });

    test("exit code 1 and exit code 137 are different problems", () => {
        expect(detailsHash(failed("Container exited with code 1")))
            .not.toBe(detailsHash(failed("Container exited with code 137")));
    });

    test("an HTTP 404 and an HTTP 500 probe failure are different problems", () => {
        expect(detailsHash(failed("Readiness probe failed: HTTP probe failed with statuscode: 404")))
            .not.toBe(detailsHash(failed("Readiness probe failed: HTTP probe failed with statuscode: 500")));
    });

    test("a different reason is a different group", () => {
        expect(detailsHash(item({ reason: "BackOff" }))).not.toBe(detailsHash(item({ reason: "Failed" })));
    });

    test("a genuinely different message is a different group", () => {
        expect(detailsHash(item({ message: "Back-off restarting failed container" })))
            .not.toBe(detailsHash(item({ message: "Failed to pull image" })));
    });
});

describe("detailsHash groups like items", () => {
    test("is stable for the same item", () => {
        expect(detailsHash(item())).toBe(detailsHash(item()));
    });

    test("is 8 hex characters", () => {
        expect(detailsHash(item())).toMatch(/^[0-9a-f]{8}$/);
    });

    test("groups the same failure reported against two different services", () => {
        const web = item({
            objectName: "web-7d9f8b6c5-x2k9p",
            message: "Back-off restarting failed container app in pod web-7d9f8b6c5-x2k9p",
        });
        const api = item({
            objectName: "api-6c4bdf295-jmnbk",
            message: "Back-off restarting failed container app in pod api-6c4bdf295-jmnbk",
        });
        expect(detailsHash(web)).toBe(detailsHash(api));
    });

    test("groups a replicaset's create events, which each name a different pod", () => {
        const created = (pod: string) => item({
            reason: "SuccessfulCreate",
            objectKind: "ReplicaSet",
            objectName: "web-7d9f8b6c5",
            message: `Created pod: ${pod}`,
        });
        expect(detailsHash(created("web-7d9f8b6c5-x2k9p"))).toBe(detailsHash(created("web-7d9f8b6c5-qzwtk")));
    });

    test("groups the same failure on two pods with different UIDs and addresses", () => {
        const probe = (pod: string, uid: string, ip: string) => item({
            reason: "Unhealthy",
            objectName: pod,
            message: `Liveness probe failed for ${pod}_default(${uid}): dial tcp ${ip}:8080: connection refused`,
        });
        expect(detailsHash(probe("web-7d9f8b6c5-x2k9p", "9c1a7c9e-4b2d-4c3a-9f11-2b7c4d5e6f70", "10.244.1.5")))
            .toBe(detailsHash(probe("web-7d9f8b6c5-qzwtk", "1f2e3d4c-5b6a-4978-8695-a4b3c2d1e0f9", "10.244.2.9")));
    });

    test("is seeded by the reason and the normalised message", () => {
        expect(detailsKey(item({ reason: "BackOff", message: "boom", objectName: "web", namespace: "default" })))
            .toBe("BackOff|boom");
    });
});

describe("extendedHash", () => {
    test("is stable for the same item", () => {
        expect(extendedHash(item())).toBe(extendedHash(item()));
    });

    test("groups like items from the same service", () => {
        const first = item({
            objectName: "web-7d9f8b6c5-x2k9p",
            message: "Back-off restarting failed container app in pod web-7d9f8b6c5-x2k9p",
        });
        const second = item({
            objectName: "web-7d9f8b6c5-q4m2t",
            message: "Back-off restarting failed container app in pod web-7d9f8b6c5-q4m2t",
        });
        expect(extendedHash(first)).toBe(extendedHash(second));
    });

    test("groups like items from one service across all-consonant and digit-bearing pods", () => {
        // A pod whose random suffix happens to hold no digit belongs to the same service as
        // its siblings, so it shares their extended hash. Before the suffix alphabet was
        // taken from Kubernetes, this pod shared an extended hash with nothing at all.
        const consonants = item({
            namespace: "kube-system",
            objectName: "coredns-5d78c9869d-jmnbk",
            message: "Back-off restarting failed container coredns in pod coredns-5d78c9869d-jmnbk",
        });
        const digits = item({
            namespace: "kube-system",
            objectName: "coredns-5d78c9869d-x2k9p",
            message: "Back-off restarting failed container coredns in pod coredns-5d78c9869d-x2k9p",
        });
        expect(serviceName(consonants)).toBe("kube-system/coredns");
        expect(extendedHash(consonants)).toBe(extendedHash(digits));
    });

    test("a pod shares its service's extended hash with its replicaset", () => {
        const pod = item({
            reason: "Scaled",
            namespace: "kube-system",
            objectKind: "Pod",
            objectName: "coredns-5d78c9869d-jmnbk",
            message: "Scaled up",
        });
        const replicaSet = item({
            reason: "Scaled",
            namespace: "kube-system",
            objectKind: "ReplicaSet",
            objectName: "coredns-5d78c9869d",
            message: "Scaled up",
        });
        expect(extendedHash(pod)).toBe(extendedHash(replicaSet));
    });

    test("separates the same details reported by a different service", () => {
        const web = item({
            objectName: "web-7d9f8b6c5-x2k9p",
            message: "Back-off restarting failed container app in pod web-7d9f8b6c5-x2k9p",
        });
        const api = item({
            objectName: "api-6c4bdf295-jmnbk",
            message: "Back-off restarting failed container app in pod api-6c4bdf295-jmnbk",
        });
        expect(detailsHash(web)).toBe(detailsHash(api));
        expect(extendedHash(web)).not.toBe(extendedHash(api));
    });

    test("separates the same service in a different namespace", () => {
        expect(extendedHash(item({ namespace: "default" }))).not.toBe(extendedHash(item({ namespace: "staging" })));
    });

    test("differs from the details hash", () => {
        expect(extendedHash(item())).not.toBe(detailsHash(item()));
    });
});

describe("groupSummary", () => {
    test("is the reason plus the normalised message the group is keyed on", () => {
        expect(groupSummary(item())).toBe("BackOff: back-off restarting failed container app in pod <object>");
    });

    test("falls back to the reason alone when there is no message", () => {
        expect(groupSummary(item({ message: "" }))).toBe("BackOff");
    });
});

describe("itemScopeValue", () => {
    const subject = item();

    test("returns the details hash for the details scope", () => {
        expect(itemScopeValue(subject, "details")).toBe(detailsHash(subject));
    });

    test("returns the extended hash for the details-service scope", () => {
        expect(itemScopeValue(subject, "details-service")).toBe(extendedHash(subject));
    });

    test("returns the service name for the service scope", () => {
        expect(itemScopeValue(subject, "service")).toBe("default/web");
    });
});

// The four items the filter-predicate tests work against: a BackOff on the "web" service,
// the same BackOff on a second "web" pod, the same BackOff on the "api" service (so it
// shares web's details hash but not its extended hash), and an unrelated FailedScheduling
// on "web". The api pod's random suffix is all consonants, so every predicate below is
// also exercised against the pod shape the old suffix rule could not resolve.
const webBackOff = item({
    reason: "BackOff",
    objectName: "web-7d9f8b6c5-x2k9p",
    message: "Back-off restarting failed container app in pod web-7d9f8b6c5-x2k9p",
});
const apiBackOff = item({
    reason: "BackOff",
    objectName: "api-6c4bdf295-jmnbk",
    message: "Back-off restarting failed container app in pod api-6c4bdf295-jmnbk",
});
const webScheduling = item({
    reason: "FailedScheduling",
    objectName: "web-7d9f8b6c5-q4m2t",
    message: "0/3 nodes are available: insufficient cpu",
});
const allItems = [webBackOff, apiBackOff, webScheduling];

// The filter a row's "..." menu produces for a given item, mode and scope.
function actionFor(subject: FilterableItem, mode: EventFilter["mode"], scope: EventFilter["scope"]): EventFilter {
    const action = rowFilterActions(subject).find((candidate) => candidate.mode === mode && candidate.scope === scope);
    if (action === undefined) {
        throw new Error(`No ${mode}/${scope} action for the item`);
    }
    return action;
}

describe("filterMatchesItem", () => {
    test("a details-scope filter matches like items from every service", () => {
        const filter = actionFor(webBackOff, "hide", "details");
        expect(filterMatchesItem(filter, webBackOff)).toBe(true);
        expect(filterMatchesItem(filter, apiBackOff)).toBe(true);
        expect(filterMatchesItem(filter, webScheduling)).toBe(false);
    });

    test("a details-service-scope filter matches like items from only that service", () => {
        const filter = actionFor(webBackOff, "hide", "details-service");
        expect(filterMatchesItem(filter, webBackOff)).toBe(true);
        expect(filterMatchesItem(filter, apiBackOff)).toBe(false);
        expect(filterMatchesItem(filter, webScheduling)).toBe(false);
    });

    test("a service-scope filter matches every item from that service", () => {
        const filter = actionFor(webBackOff, "hide", "service");
        expect(filterMatchesItem(filter, webBackOff)).toBe(true);
        expect(filterMatchesItem(filter, webScheduling)).toBe(true);
        expect(filterMatchesItem(filter, apiBackOff)).toBe(false);
    });

    test("a filter raised from the all-consonant pod matches its own service", () => {
        const filter = actionFor(apiBackOff, "hide", "service");
        expect(filter.value).toBe("default/api");
        expect(filterMatchesItem(filter, apiBackOff)).toBe(true);
        expect(filterMatchesItem(filter, webBackOff)).toBe(false);
    });
});

describe("countMatchingItems", () => {
    test("counts every item a details-scope filter covers, across services", () => {
        expect(countMatchingItems(allItems, actionFor(webBackOff, "hide", "details"))).toBe(2);
    });

    test("counts every item a service-scope filter covers", () => {
        expect(countMatchingItems(allItems, actionFor(webBackOff, "hide", "service"))).toBe(2);
    });

    test("counts one when a filter covers only the item it was raised from", () => {
        expect(countMatchingItems(allItems, actionFor(webScheduling, "hide", "details-service"))).toBe(1);
    });
});

describe("applyEventFilters", () => {
    test("keeps every item when no filter is active", () => {
        expect(applyEventFilters(allItems, [])).toEqual(allItems);
    });

    test("hide by details removes like items from every service", () => {
        const result = applyEventFilters(allItems, [actionFor(webBackOff, "hide", "details")]);
        expect(result).toEqual([webScheduling]);
    });

    test("hide by details + service removes like items from only that service", () => {
        const result = applyEventFilters(allItems, [actionFor(webBackOff, "hide", "details-service")]);
        expect(result).toEqual([apiBackOff, webScheduling]);
    });

    test("hide by service removes every item from that service", () => {
        const result = applyEventFilters(allItems, [actionFor(webBackOff, "hide", "service")]);
        expect(result).toEqual([apiBackOff]);
    });

    test("show only by details keeps like items from every service", () => {
        const result = applyEventFilters(allItems, [actionFor(webBackOff, "only", "details")]);
        expect(result).toEqual([webBackOff, apiBackOff]);
    });

    test("show only by details + service keeps like items from only that service", () => {
        const result = applyEventFilters(allItems, [actionFor(webBackOff, "only", "details-service")]);
        expect(result).toEqual([webBackOff]);
    });

    test("show only by service keeps every item from that service", () => {
        const result = applyEventFilters(allItems, [actionFor(webBackOff, "only", "service")]);
        expect(result).toEqual([webBackOff, webScheduling]);
    });

    test("two show-only filters keep the union of what each matches", () => {
        const result = applyEventFilters(allItems, [
            actionFor(webBackOff, "only", "details-service"),
            actionFor(webScheduling, "only", "details-service"),
        ]);
        expect(result).toEqual([webBackOff, webScheduling]);
    });

    test("two hide filters remove everything either matches", () => {
        const result = applyEventFilters(allItems, [
            actionFor(webBackOff, "hide", "details"),
            actionFor(webScheduling, "hide", "details"),
        ]);
        expect(result).toEqual([]);
    });

    test("a hide beats an overlapping show-only", () => {
        const result = applyEventFilters(allItems, [
            actionFor(webBackOff, "only", "details"),
            actionFor(webBackOff, "hide", "details-service"),
        ]);
        expect(result).toEqual([apiBackOff]);
    });

    test("the hidden count is the items the filters removed", () => {
        const result = applyEventFilters(allItems, [actionFor(webBackOff, "hide", "service")]);
        expect(allItems.length - result.length).toBe(2);
    });

    test("hiding one exit code leaves the other showing", () => {
        // The user hides a clean exit; the OOM kill must survive it.
        const clean = item({ reason: "Failed", message: "Container exited with code 1" });
        const oomKilled = item({ reason: "Failed", message: "Container exited with code 137" });
        const result = applyEventFilters([clean, oomKilled], [actionFor(clean, "hide", "details")]);
        expect(result).toEqual([oomKilled]);
    });

    test("hiding a 404 probe failure leaves a 500 probe failure showing", () => {
        const notFound = item({ reason: "Unhealthy", message: "Readiness probe failed: HTTP probe failed with statuscode: 404" });
        const serverError = item({ reason: "Unhealthy", message: "Readiness probe failed: HTTP probe failed with statuscode: 500" });
        const result = applyEventFilters([notFound, serverError], [actionFor(notFound, "hide", "details")]);
        expect(result).toEqual([serverError]);
    });

    test("hiding a replicaset's create events hides them all, not just the one row", () => {
        // Each SuccessfulCreate names a different pod, so before the pod names were masked
        // this hid exactly one row — the opposite of what the action says it does.
        const created = (pod: string) => item({
            reason: "SuccessfulCreate",
            objectKind: "ReplicaSet",
            objectName: "web-7d9f8b6c5",
            message: `Created pod: ${pod}`,
        });
        const creates = [created("web-7d9f8b6c5-x2k9p"), created("web-7d9f8b6c5-qzwtk"), created("web-7d9f8b6c5-q4m2t")];
        expect(applyEventFilters(creates, [actionFor(creates[0], "hide", "details")])).toEqual([]);
    });

    test("hiding a service does not hide a distinct service with a similar name", () => {
        const alpine = item({ objectName: "nginx-alpine3", message: "Failed" });
        const plain = item({ objectName: "nginx", message: "Failed" });
        expect(applyEventFilters([alpine, plain], [actionFor(alpine, "hide", "service")])).toEqual([plain]);
    });
});

describe("addEventFilter and removeEventFilter", () => {
    const hideWeb = actionFor(webBackOff, "hide", "service");
    const hideApi = actionFor(apiBackOff, "hide", "service");

    test("adds a filter to an empty list", () => {
        expect(addEventFilter([], hideWeb)).toEqual([hideWeb]);
    });

    test("appends a second, different filter", () => {
        expect(addEventFilter([hideWeb], hideApi)).toEqual([hideWeb, hideApi]);
    });

    test("adding the same filter twice is a no-op", () => {
        const once = addEventFilter([], hideWeb);
        expect(addEventFilter(once, actionFor(webBackOff, "hide", "service"))).toEqual([hideWeb]);
    });

    test("the same value at a different mode is a distinct filter", () => {
        const onlyWeb = actionFor(webBackOff, "only", "service");
        expect(addEventFilter([hideWeb], onlyWeb)).toEqual([hideWeb, onlyWeb]);
    });

    test("removes a filter by its key", () => {
        expect(removeEventFilter([hideWeb, hideApi], filterKey(hideWeb))).toEqual([hideApi]);
    });

    test("removing an absent key leaves the list unchanged", () => {
        expect(removeEventFilter([hideWeb], "hide:service:default/nothing")).toEqual([hideWeb]);
    });

    test("a filter's key is its mode, scope and value", () => {
        expect(filterKey(hideWeb)).toBe("hide:service:default/web");
    });
});

describe("rowFilterActions", () => {
    const actions = rowFilterActions(webBackOff);

    test("offers six actions: three hide, then three show-only", () => {
        expect(actions.map((action) => `${action.mode}:${action.scope}`)).toEqual([
            "hide:details",
            "hide:details-service",
            "hide:service",
            "only:details",
            "only:details-service",
            "only:service",
        ]);
    });

    test("the details actions carry the item's details hash", () => {
        expect(actionFor(webBackOff, "hide", "details").value).toBe(detailsHash(webBackOff));
        expect(actionFor(webBackOff, "only", "details").value).toBe(detailsHash(webBackOff));
    });

    test("the details + service actions carry the item's extended hash", () => {
        expect(actionFor(webBackOff, "hide", "details-service").value).toBe(extendedHash(webBackOff));
    });

    test("the service actions carry the item's service name", () => {
        expect(actionFor(webBackOff, "hide", "service").value).toBe("default/web");
    });

    test("every action carries the group it covers, so the UI can show it", () => {
        const summary = "BackOff: back-off restarting failed container app in pod <object>";
        expect(actionFor(webBackOff, "hide", "details").summary).toBe(summary);
        expect(actionFor(webBackOff, "hide", "details").service).toBe("");
        expect(actionFor(webBackOff, "hide", "details-service").summary).toBe(summary);
        expect(actionFor(webBackOff, "hide", "details-service").service).toBe("default/web");
        expect(actionFor(webBackOff, "hide", "service").service).toBe("default/web");
    });
});

describe("filterActionText", () => {
    test("names each hide action", () => {
        expect(filterActionText(actionFor(webBackOff, "hide", "details"))).toBe("Hide all like this");
        expect(filterActionText(actionFor(webBackOff, "hide", "details-service"))).toBe("Hide all like this, for this service");
        expect(filterActionText(actionFor(webBackOff, "hide", "service"))).toBe("Hide all from this service");
    });

    test("names each show-only action", () => {
        expect(filterActionText(actionFor(webBackOff, "only", "details"))).toBe("Show only ones like this");
        expect(filterActionText(actionFor(webBackOff, "only", "details-service"))).toBe("Show only ones like this, for this service");
        expect(filterActionText(actionFor(webBackOff, "only", "service"))).toBe("Show only this service");
    });
});

// A group is only honest if the user can see what is in it. These are the strings the
// "..." menu and the active-filter chips show, and they must always name the message the
// group is keyed on, not just the reason: two events sharing a reason can be entirely
// different problems.
describe("filterCoverageText", () => {
    test("spells out the details a details-scope filter covers, and that it spans every service", () => {
        expect(filterCoverageText(actionFor(webBackOff, "hide", "details")))
            .toBe('"BackOff: back-off restarting failed container app in pod <object>" from any service');
    });

    test("spells out the details and names the service for a details + service filter", () => {
        expect(filterCoverageText(actionFor(webBackOff, "hide", "details-service")))
            .toBe('"BackOff: back-off restarting failed container app in pod <object>" from default/web');
    });

    test("says a service-scope filter covers everything from that service", () => {
        expect(filterCoverageText(actionFor(webBackOff, "hide", "service"))).toBe("everything from default/web");
    });
});

describe("filterChipText", () => {
    test("a details chip names the reason, the message and that it spans every service", () => {
        expect(filterChipText(actionFor(webBackOff, "hide", "details")))
            .toBe("Hide (any service): BackOff: back-off restarting failed container…");
    });

    test("a details + service chip names the service it is confined to", () => {
        expect(filterChipText(actionFor(webBackOff, "only", "details-service")))
            .toBe("Only (default/web): BackOff: back-off restarting failed container…");
    });

    test("a service chip reads as what it does", () => {
        expect(filterChipText(actionFor(webBackOff, "hide", "service"))).toBe("Hide: everything from default/web");
    });

    test("a short group is not cut short", () => {
        const short = item({ reason: "Failed", message: "Container exited with code 137" });
        expect(filterChipText(actionFor(short, "hide", "details")))
            .toBe("Hide (any service): Failed: container exited with code 137");
    });
});
