# MULTI_PAGE_ROUTE_MATRIX.md — Multi-Page Route & Persona Permission Matrix

## 1. Route Registry & Navigation Architecture

TrustChain employs a dependency-free, lightweight HTML5 History API router (`src/router/Router.tsx`) that synchronizes URL state across bookmarks, browser back/forward buttons, and programmatic transitions without introducing third-party router dependency overhead.

```
/ (Welcome Landing Experience)
├── /onboarding   (Guided Tour Modal)
├── /dashboard    (Executive Intelligence Dashboard)
├── /intelligence (AG Grid Intelligence Control Room)
├── /timeline     (Bryntum Software Delivery Timeline)
├── /reviews      (Multi-Agent Review Workbench)
├── /trust        (Cryptographic Evidence Passport)
├── /disputes     (Dispute Evidence Pack & Arbitration)
└── /settings     (Workspace Settings & Audit Ledger)
```

---

## 2. Route Specification Matrix

| Route | Page Component | Allowed Roles | Default Persona View | Responsive Breakpoints |
|---|---|---|---|---|
| `/` | `WelcomeLandingPage` | All (Public / Demo) | Clean Hero, 3D Canvas, Sponsor Matrix | Mobile (stacked), Desktop (side-by-side) |
| `/onboarding` | `GuidedTourModal` | All | 6-Stage Modal Overlay | Centered responsive modal with scrollable step body |
| `/dashboard` | `DashboardPage` | All | Executive Overview, Portfolio KPIs, Distribution Charts | 1-col (mobile) -> 4-col (desktop) KPI cards |
| `/intelligence` | `IntelligencePage` | All (Optimized for Reviewer) | AG Grid Community v36, NLP Filter Bar, Master/Detail | Full viewport width, virtualized row scrolling |
| `/timeline` | `TimelinePage` | All (Optimized for Developer) | Bryntum Gantt v7.3, Critical Path, Schedule Shifts | Responsive split: Gantt above, recovery proposals below |
| `/reviews` | `ReviewsPage` | Client, Developer, Reviewer | 4-Column Workbench, Human Review Actions, PayPal API | 1-col mobile -> 4-col responsive grid |
| `/trust` | `TrustPage` | All | Evidence Passport Viewer, GitHub REST API Telemetry | 2-col desktop layout: Passport left, Provenance right |
| `/disputes` | `DisputesPage` | All | Dispute Pack Viewer, Verification, Portable JSON Export | Card layout with accordion event timeline |
| `/settings` | `SettingsPage` | All | Persona Switcher, Tour Reset, Real-time SQLite Audit Trail | 2-col layout: Settings left, Audit table right |

---

## 3. Persona Capability & Authorization Matrix

| Persona | Role | Primary Route | Submit Evidence | Authorize PayPal Order | Approve Milestone Payout | View Audit Logs |
|---|---|---|:---:|:---:|:---:|:---:|
| **Alice (Client)** | `CLIENT` | `/dashboard` | ❌ | ✅ | ❌ | ✅ |
| **Bob (Developer)** | `DEVELOPER` | `/timeline` | ✅ | ❌ | ❌ | ✅ |
| **Charlie (Reviewer)** | `REVIEWER` | `/intelligence` | ❌ | ❌ | ✅ | ✅ |

### Financial Safety Enforcement:
- The UI strictly disables approval buttons for non-Reviewers.
- The backend enforces HMAC/JWT role checks on `/api/v1/contracts/:cId/milestones/:mId/review/approve`.
- Attempts to call financial endpoints with unauthorized tokens receive HTTP 403 `FORBIDDEN_REVIEWER_ONLY`.
