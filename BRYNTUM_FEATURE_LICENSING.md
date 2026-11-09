# BRYNTUM FEATURE LICENSING, COMPLIANCE & SCHEDULER EVALUATION
**Platform:** TrustChain  
**Evaluation:** Bryntum Gantt Licensing & Scheduler Integration Analysis  
**Date:** November 9, 2026  

---

## 1. Bryntum Licensing Tiers & Entitlements

Bryntum offers several commercial licensing tiers tailored to different organizational and deployment requirements. The table below analyzes how these tiers relate to TrustChain:

| License Tier | Typical Entitlements | Watermark Present? | Redistribution Rights | TrustChain Fit |
| :--- | :--- | :--- | :--- | :--- |
| **Commercial Trial (Evaluated)** | 45-day evaluation period, full Gantt & ProjectModel feature set (baselines, critical path, dependencies, tooltips, undo/redo). | **Yes** (Native Bryntum Trial Banner) | Internal evaluation and hackathon staging only. | **Current Baseline:** Used strictly within evaluation terms. |
| **Commercial Single Application** | Production deployment in a single designated application domain; perpetual license with 1-year updates/support. | No | Deployed within the single SaaS platform. | **Target for TrustChain Production GA**. |
| **Commercial Enterprise / OEM** | Multi-application or white-labeled embedded distribution with customized branding and source code access. | No | Full multi-tenant redistribution. | Future enterprise licensing for on-premise deployments. |
| **Academic / Non-Commercial** | Educational and non-profit research use only. | No (with approval) | Non-commercial distribution. | Not applicable for financial escrow SaaS. |

---

## 2. Watermark & License Integrity Compliance

In strict adherence to the project's engineering principles (`AGENTS.md`) and ethical software development standards:

1. **Zero Tampering Policy:** The native trial watermark rendered by `@bryntum/gantt-trial` is preserved without modification.
2. **No CSS Suppression:** No CSS rules (`.b-trial-panel`, `.b-watermark`, etc.) have been written or injected to hide, clip, or obscure the trial banner.
3. **No Script Bypasses:** No runtime monkey-patching or prototype modification has been applied to defeat the license verification mechanism.
4. **Transparent Sponsor Presentation:** The watermark is embraced as authentic evidence of real-world integration of Bryntum's enterprise engine.

---

## 3. Bryntum Scheduler vs. Bryntum Gantt: Architectural Evaluation

A key architectural question evaluated during this sprint was whether **Bryntum Scheduler** or **Bryntum Gantt** serves as the authoritative engine for TrustChain's workflow.

### 3.1 Comparative Architectural Matrix

| Dimension | Bryntum Gantt (Selected for TrustChain) | Bryntum Scheduler (Evaluated for Extension) |
| :--- | :--- | :--- |
| **Primary Domain Model** | Hierarchical Work Breakdown Structure (WBS), task dependencies, critical path, project baselines. | Resource allocation across timelines (e.g., developers, equipment, conference rooms). |
| **Temporal Relationship Engine** | Deterministic Precedence Relationships (FS, SS, FF, SF), lead/lag constraints, calendar constraints. | Linear time booking; events mapped to resources without native hierarchical dependency resolution. |
| **Milestone Contract Alignment** | **Exact match:** Software contracts consist of milestones, acceptance criteria child tasks, and strict delivery sequences. | **Partial match:** Shows who is working on what, but cannot determine if a delayed dependency cascades into a contract breach. |
| **Critical Path Analysis** | Built-in native CPM (Critical Path Method) calculation identifying bottleneck deliverables. | Requires custom extension or Gantt-Scheduler hybrid pairing. |
| **Baseline Snapshot Tracking** | Native baseline tracking (original vs. current variance in days). | Requires external data modelling and manual UI rendering. |

### 3.2 Decision & Roadmap

- **Phase 1 (Authoritative Engine):** **Bryntum Gantt** is the authoritative schedule and execution engine for TrustChain. It directly maps to the legal contract structure, models dependency risks, and drives AI schedule recovery proposals.
- **Phase 2 (Vendor Pool Management Extension):** **Bryntum Scheduler** is architecturally designated as the future *Developer Capacity & Resource Allocation Board*. In multi-developer or agency contracts, Scheduler will allow engineering managers to assign individual developers to Gantt execution tasks based on capacity and skill sets.

```
+-------------------------------------------------------------------------+
|                  TRUSTCHAIN CONTROL TOWER ARCHITECTURE                   |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ BRYNTUM GANTT - AUTHORITATIVE ENGINE ]                                |
|  - Contract Milestones & Child Acceptance Criteria Tasks                |
|  - Dependency Graph (FS/SS/FF/SF) & Kahn's Cycle Validation             |
|  - Deterministic Critical Path & Downstream Cascade Delay Engine        |
|  - Immutable Schedule Baselines & Variance Tracking                     |
|  - Read-Only Payment Status Badges (PayPal Authorization/Capture)       |
|                                                                         |
|                                ^                                        |
|                                | (Task Assignment & Effort Sync)        |
|                                v                                        |
|                                                                         |
|  [ BRYNTUM SCHEDULER - PHASE 2 EXTENSION ]                              |
|  - Agency Resource Capacity & Booking                                   |
|  - Freelancer Time Allocation & Shift Management                        |
|  - Workload Levelling Across Multiple Escrow Contracts                  |
+-------------------------------------------------------------------------+
```

---

## 4. Summary

Bryntum Gantt delivers precisely the temporal and dependency rigor required by TrustChain's escrow and verification pipeline. The integration respects Bryntum's commercial evaluation licensing completely and establishes a clear roadmap for Bryntum Scheduler in multi-developer resource planning.
