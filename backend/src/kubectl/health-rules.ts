// The pure rules that decide a pod's OOMKilled history and a node's active pressure
// conditions, from raw kubectl JSON items.
//
// These live in one place because two consumers must agree exactly: the cluster
// health-signal counters (computeHealth, behind GET /api/cluster/performance) and the
// per-resource flags carried on the pods and nodes list responses, which the UI filters
// on when a health tile links to the list that produced its count. A second copy of
// either rule would let the tile's number and the filtered list drift apart.

// The node condition types that count as pressure, in the order the health tile lists
// them. A node reports each as a condition whose status is "True" when it is active.
export const PRESSURE_CONDITION_TYPES = ["MemoryPressure", "DiskPressure", "PIDPressure"] as const;

export type PressureConditionType = (typeof PRESSURE_CONDITION_TYPES)[number];

// Whether a pod has been OOM-killed and restarted: any of its containers or init
// containers records a *previous* termination with reason "OOMKilled". This is the pod's
// history, not its current state, so a pod that was OOM-killed and is now Running counts.
// (Contrast the Errors feed, which reports containers in that state right now.)
export function podWasOOMKilled(item: any): boolean {
    const statuses: any[] = [
        ...(item?.status?.containerStatuses ?? []),
        ...(item?.status?.initContainerStatuses ?? []),
    ];
    return statuses.some((cs) => cs?.lastState?.terminated?.reason === "OOMKilled");
}

// The pressure condition types a node currently reports as active ("True"), in
// PRESSURE_CONDITION_TYPES order. An empty array means the node is under no pressure.
// A condition whose status is "False" or "Unknown" is not active and is left out.
export function activeNodePressures(item: any): PressureConditionType[] {
    const conditions: any[] = item?.status?.conditions ?? [];
    const active: PressureConditionType[] = [];
    for (const type of PRESSURE_CONDITION_TYPES) {
        if (conditions.some((condition) => condition?.type === type && condition?.status === "True")) {
            active.push(type);
        }
    }
    return active;
}
