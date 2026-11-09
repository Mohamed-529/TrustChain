# Bryntum License & Feature Entitlement Matrix

## 1. Transparency & License Compliance

In accordance with TrustChain engineering principles and ethical hackathon disclosure:

| Attribute | Specification | Status |
| :--- | :--- | :---: |
| **Package Distribution** | `@bryntum/gantt-trial@^7.3.8` | Verified in `package.json` |
| **License Type** | Bryntum 45-day Evaluation / Trial License | Active |
| **Watermark Integrity** | Official Bryntum trial watermark untouched | **100% UNTAMPERED** |
| **CSS Overrides** | Zero CSS rules hiding trial badges or dialogs | **VERIFIED** |
| **Production Upgrade Path** | Drop-in replacement via Bryntum private npm registry with commercial key | Documented & Ready |

---

## 2. Feature Entitlement & Utilization Matrix

| Feature | Bryntum Edition Required | TrustChain Implementation | Utilization Status |
| :--- | :--- | :--- | :---: |
| **Interactive Gantt Chart** | Trial / Standard | `BryntumGantt` component mounted | **ACTIVE** |
| **Hierarchical WBS Tree** | Trial / Standard | Parent milestone + child criteria tasks | **ACTIVE** |
| **Dependencies (FS, SS, FF, SF)** | Trial / Standard | Full dependency store with type mapping | **ACTIVE** |
| **Critical Path Visualization** | Trial / Standard | Critical Path toggle with custom styling | **ACTIVE** |
| **Time Axis Zooming** | Trial / Standard | Preset zoom levels (Day, Week, Month) | **ACTIVE** |
| **Baseline Snapshots** | Trial / Standard | Stored in SQLite + SHA-256 audit log | **ACTIVE** |
| **Stockholm Light Theme** | Trial / Standard | Styled to match TrustChain dark/light UI | **ACTIVE** |
| **Resource Histogram** | Advanced / Pro | Not used (out of MVP scope) | **EXCLUDED** |
| **Task Scheduler Pro** | Advanced / Pro | Not used (out of MVP scope) | **EXCLUDED** |

---

## 3. Commercial Upgrade Plan

To transition MilestoneProof AI to production:
1. Acquire a Bryntum Gantt Commercial License.
2. Configure `.npmrc` with Bryntum private npm registry token (`@bryntum:registry=https://npm.bryntum.com`).
3. Replace dependency in `package.json` with `@bryntum/gantt: ^7.3.8`.
4. Zero application code changes are required.
