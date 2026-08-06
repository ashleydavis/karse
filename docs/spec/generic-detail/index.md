# generic-detail

**ID:** generic-detail
**Spec:** Settled
**Implementation:** Complete

A generic detail page for any resource kind that has no purpose-built page of its own (a ReplicaSet, a Job, a Service, a HorizontalPodAutoscaler, a PersistentVolume, and so on). It shows the metadata every Kubernetes object carries plus the resource's raw YAML, so every reference to a resource in Karse is a working link rather than dead text. A kind that already has its own detail page always uses that page instead.

## Sub-features
None.
