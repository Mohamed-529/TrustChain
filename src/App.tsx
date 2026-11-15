/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  ContractScheduleResponse,
  EvidencePassport,
  EvidenceProvenanceVerificationRecord,
  FinancialLedgerRow,
  MilestoneReviewDetails,
  PayPalTransactionRecord,
  ScheduleRecoveryProposal,
  User,
  DisputeEvidencePack,
  AuditLogEntry,
  Contract,
} from './types/domain.ts';

import { RouterProvider, usePathname, useNavigate } from './router/Router.tsx';
import { AppShell } from './components/layout/AppShell.tsx';
import { InteractiveWalkthroughModal } from './components/walkthrough/InteractiveWalkthroughModal.tsx';
import { GlobalSearchModal } from './components/search/GlobalSearchModal.tsx';
import { CreateProjectModal } from './components/contracts/CreateProjectModal.tsx';
import { WelcomeLandingPage } from './components/landing/WelcomeLandingPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { IntelligencePage } from './pages/IntelligencePage.tsx';
import { TimelinePage } from './pages/TimelinePage.tsx';
import { ReviewsPage } from './pages/ReviewsPage.tsx';
import { TrustPage } from './pages/TrustPage.tsx';
import { DisputesPage } from './pages/DisputesPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { DeveloperPortalPage } from './pages/DeveloperPortalPage.tsx';

function AppContent() {
  const currentPath = usePathname();
  const navigate = useNavigate();

  // Authentication & Session
  const [token, setToken] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Active Contract & Milestone Scope
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>('contract_seed_01');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('ms_seed_01');

  // Domain Telemetry & Workbench Data
  const [scheduleData, setScheduleData] = useState<ContractScheduleResponse | null>(null);
  const [reviewDetails, setReviewDetails] = useState<MilestoneReviewDetails | null>(null);
  const [provenanceData, setProvenanceData] = useState<{
    latestProvenance: EvidenceProvenanceVerificationRecord | null;
    provenanceHistory: EvidenceProvenanceVerificationRecord[];
  } | null>(null);
  const [passport, setPassport] = useState<EvidencePassport | null>(null);
  const [disputePack, setDisputePack] = useState<DisputeEvidencePack | null>(null);
  const [paypalTransactions, setPaypalTransactions] = useState<PayPalTransactionRecord[]>([]);
  const [ledgerRows, setLedgerRows] = useState<FinancialLedgerRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Form Inputs & Review Modals
  const [approvedAmountCentsInput, setApprovedAmountCentsInput] = useState<number>(0);
  const [justification, setJustification] = useState<string>('');
  const [scheduleDecisionReason, setScheduleDecisionReason] = useState<string>(
    'Approved +7d recovery window for CI stabilization; contractual budget and acceptance criteria unchanged.'
  );

  // Global UI Controls & Modals
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [quickFilterType, setQuickFilterType] = useState<string>('ALL');
  const [showAiInspector, setShowAiInspector] = useState<boolean>(false);
  const [showWalkthrough, setShowWalkthrough] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showCreateProject, setShowCreateProject] = useState<boolean>(false);

  // Global keyboard shortcut: / or Ctrl+K triggers Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Switch Persona Handler
  const switchPersona = useCallback(async (userId: string) => {
    try {
      const res = await fetch('/api/v1/auth/demo-switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to switch persona');
      }
      setToken(data.token);
      setCurrentUser(data.user);
      setStatusBanner({
        type: 'info',
        message: `Authenticated as ${data.user.name} (${data.user.role})`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Authentication error',
      });
    }
  }, []);

  // 2. Comprehensive Data Refresh Provider
  const refreshAllData = useCallback(
    async (activeToken: string, milestoneId: string, contractId: string) => {
      if (!activeToken) return;
      setLoading(true);
      try {
        const [contractsRes, schedRes, revRes, provRes, ppRes, ledgerRes, passRes, auditRes] = await Promise.all([
          fetch('/api/v1/contracts', {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/contracts/${contractId}/schedule`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/milestones/${milestoneId}/review`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/milestones/${milestoneId}/evidence/provenance`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/milestones/${milestoneId}/paypal/transactions`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch('/api/v1/ledger', {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/contracts/${contractId}/milestones/${milestoneId}/evidence-passport`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch('/api/v1/audit', {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
        ]);

        if (contractsRes.ok) {
          const cData = await contractsRes.json();
          setContracts(cData.contracts ?? []);
        }
        if (schedRes.ok) {
          const schedJson = (await schedRes.json()) as ContractScheduleResponse;
          setScheduleData(schedJson);
        }
        if (revRes.ok) {
          const revData = (await revRes.json()) as MilestoneReviewDetails;
          setReviewDetails(revData);
          setApprovedAmountCentsInput(revData.policyCalculation?.permittedAmountCents ?? 0);
        }
        if (provRes.ok) {
          const provJson = (await provRes.json()) as {
            latestProvenance: EvidenceProvenanceVerificationRecord | null;
            provenanceHistory: EvidenceProvenanceVerificationRecord[];
          };
          setProvenanceData(provJson);
        }
        if (ppRes.ok) {
          const ppData = (await ppRes.json()) as { transactions: PayPalTransactionRecord[] };
          setPaypalTransactions(ppData.transactions);
        }
        if (ledgerRes.ok) {
          const ledgerData = (await ledgerRes.json()) as { rows: FinancialLedgerRow[] };
          setLedgerRows(ledgerData.rows);
        }
        if (passRes.ok) {
          const passData = (await passRes.json()) as { passport: EvidencePassport };
          setPassport(passData.passport);
        }
        if (auditRes.ok) {
          const auditData = (await auditRes.json()) as { logs: AuditLogEntry[] };
          setAuditLogs(auditData.logs);
        }
      } catch (err) {
        setStatusBanner({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to load workbench data',
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial authentication on mount (defaults to client_01 per requirements)
  useEffect(() => {
    void switchPersona('client_01');
  }, [switchPersona]);

  // Refresh domain data when token or selection changes
  useEffect(() => {
    if (token) {
      void refreshAllData(token, selectedMilestoneId, selectedContractId);
    }
  }, [token, selectedMilestoneId, selectedContractId, refreshAllData]);

  // Detect PayPal redirect return parameters (?paypal_return=approved)
  useEffect(() => {
    try {
      const search = window.location.search;
      if (!search) return;
      const params = new URLSearchParams(search);
      const paypalReturn = params.get('paypal_return');
      const milestoneId = params.get('milestone_id');
      if (paypalReturn === 'approved') {
        setStatusBanner({
          type: 'success',
          message: `PayPal Sandbox buyer approval confirmed for milestone ${milestoneId ?? ''}! Step 1 complete. Proceed to Step 2 (Authorize Hold).`,
        });
        if (milestoneId) {
          setSelectedMilestoneId(milestoneId);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paypalReturn === 'cancelled') {
        setStatusBanner({
          type: 'info',
          message: 'PayPal checkout cancelled by user.',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // 3. Operational Handlers
  const handleSubmitDemoEvidence = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const fixtureKey = selectedMilestoneId === 'ms_seed_02' ? 'INCOMPLETE_SUBMISSION' : 'SUCCESSFUL_SUBMISSION';
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/evidence`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ demoFixtureKey: fixtureKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Evidence submission failed');
      }
      setStatusBanner({
        type: 'success',
        message: `Delivery evidence submitted for ${selectedMilestoneId} (Attempt #${data.submission.attemptNumber}). Reviewers may now run evaluation.`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Evidence submission error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunAiEvaluation = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Evaluation execution failed');
      }
      const evalRun = data.evaluation;
      setStatusBanner({
        type: 'success',
        message: `Tri-Agent AI Advisory Synthesis completed (${evalRun.evaluationMode}): Arbitrator recommends ${evalRun.arbitratorRecommendation.recommendedOutcome} (Risk: ${evalRun.riskAnalysis.overallRiskSeverity}). Permitted Cap: $${((evalRun.policyCalculation?.permittedAmountCents ?? 0) / 100).toFixed(2)}.`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Evaluation error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGithubProvenance = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/evidence/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'GitHub provenance verification failed');
      }
      const prov = data.provenance ?? data.verificationRecord;
      setStatusBanner({
        type: 'info',
        message: `Independent GitHub Provenance Verification: status=${prov?.verificationStatus ?? prov?.overallStatus} (integrity=${prov?.integrity?.payloadHashMatches ? 'MATCH' : 'TAMPERED'}).`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'GitHub provenance verification error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidateRuntime = async (previewUrl: string, healthEndpoint?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/contracts/${selectedContractId}/milestones/${selectedMilestoneId}/evidence-passport/runtime-validate`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ previewUrl, healthEndpoint }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Runtime smoke validation failed');
      }
      setStatusBanner({
        type: data.runtimeValidation.overallStatus === 'PASSED' ? 'success' : 'error',
        message: `Runtime Validation (${data.runtimeValidation.overallStatus}): ${data.runtimeValidation.details}`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Runtime validation error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDisputePack = async (reason?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/contracts/${selectedContractId}/milestones/${selectedMilestoneId}/dispute-pack`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason: reason ?? 'Dispute Pack generated for external arbitration',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Dispute pack generation failed');
      }
      setDisputePack(data.disputePack);
      setStatusBanner({
        type: 'success',
        message: `Dispute Evidence Pack generated (Digest: ${data.disputePack.packDigestSha256.slice(0, 16)}...).`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Dispute pack error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDisputePack = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/contracts/${selectedContractId}/milestones/${selectedMilestoneId}/dispute-pack/verify`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Dispute pack verification failed');
      }
      setStatusBanner({
        type: data.verification.overallStatus === 'VERIFIED' ? 'success' : 'error',
        message: `Dispute Pack Verification (${data.verification.overallStatus}): digestMatch=${data.verification.digestMatches}, auditValid=${data.verification.auditChainValid}.`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Verification error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportDisputePack = async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `/api/v1/contracts/${selectedContractId}/milestones/${selectedMilestoneId}/dispute-pack/export`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Dispute pack export failed');
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dispute-pack-${selectedMilestoneId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Dispute pack export error',
      });
    }
  };

  const handleReviewAction = async (
    actionEndpoint: 'approve' | 'reject' | 'request-changes'
  ) => {
    if (!token) return;
    if (!justification.trim()) {
      setStatusBanner({
        type: 'error',
        message: 'A written fiduciary justification is mandatory for audit records.',
      });
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        justification: justification.trim(),
      };
      if (actionEndpoint === 'approve') {
        payload.approvedAmountCents = approvedAmountCentsInput;
      }
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/review/${actionEndpoint}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? `Review action ${actionEndpoint} failed`);
      }
      setStatusBanner({
        type: 'success',
        message: `Fiduciary decision [${actionEndpoint.toUpperCase()}] successfully recorded and committed to hash-chained audit ledger.`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Review action error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayPalAction = async (step: 'order' | 'authorize' | 'capture') => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/paypal/${step}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? `PayPal ${step} failed`);
      }
      setStatusBanner({
        type: 'success',
        message: `PayPal ${step.toUpperCase()} transaction succeeded: status=${data.transaction.status} (${data.transaction.executionMode}). Non-escrow disclosure enforced.`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'PayPal operation error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayPalReconcile = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/paypal/reconcile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'PayPal reconciliation failed');
      }
      setStatusBanner({
        type: 'info',
        message: `Reconciliation result: status=${data.status}, matched=${data.matched}, discrepancyCount=${data.discrepancies?.length ?? 0}`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Reconciliation error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemoContract = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/contracts/${selectedContractId}/reset-demo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to reset demo contract');
      }
      setStatusBanner({
        type: 'success',
        message: 'Demo contract reset to fresh unreviewed state ($8,500.00 USD across 3 milestones). You can record a fresh demo flow!',
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Reset error',
      });
    } finally {
      setLoading(false);
    }
  };

  // 4. Multi-Page Route Dispatcher
  const renderActivePage = () => {
    switch (currentPath) {
      case '/dashboard':
        return (
          <DashboardPage
            currentUser={currentUser}
            ledgerRows={ledgerRows}
            scheduleData={scheduleData}
            contracts={contracts}
            onSelectQuickFilter={(qf) => setQuickFilterType(qf)}
            onOpenCreateProject={() => setShowCreateProject(true)}
            onOpenWalkthrough={() => setShowWalkthrough(true)}
            onResetDemoContract={handleResetDemoContract}
            onSelectMilestone={(id) => setSelectedMilestoneId(id)}
          />
        );

      case '/intelligence':
      case '/ledger':
        return (
          <IntelligencePage
            ledgerRows={ledgerRows}
            token={token}
            selectedMilestoneId={selectedMilestoneId}
            onSelectMilestone={(id) => setSelectedMilestoneId(id)}
            onOpenPassport={(id) => {
              setSelectedMilestoneId(id);
              navigate('/trust');
            }}
            onOpenDisputePack={(id) => {
              setSelectedMilestoneId(id);
              navigate('/disputes');
            }}
            showAiInspector={showAiInspector}
            setShowAiInspector={setShowAiInspector}
            reviewDetails={reviewDetails}
            quickFilterType={quickFilterType}
          />
        );

      case '/timeline':
        return (
          <TimelinePage
            scheduleData={scheduleData}
            loading={loading}
            onLoadControlTowerDemo={async () => {}}
            onAnalyzeScheduleRisk={async () => {}}
            onReviewProposal={async () => {}}
            scheduleDecisionReason={scheduleDecisionReason}
            setScheduleDecisionReason={setScheduleDecisionReason}
            token={token}
            onNavigateToReviews={() => navigate('/reviews')}
            onNavigateToDisputes={() => navigate('/disputes')}
            onNavigateToIntelligence={() => navigate('/intelligence')}
          />
        );

      case '/reviews':
        return (
          <ReviewsPage
            currentUser={currentUser}
            selectedMilestoneId={selectedMilestoneId}
            setSelectedMilestoneId={setSelectedMilestoneId}
            reviewDetails={reviewDetails}
            provenanceData={provenanceData}
            paypalTransactions={paypalTransactions}
            loading={loading}
            approvedAmountCentsInput={approvedAmountCentsInput}
            setApprovedAmountCentsInput={setApprovedAmountCentsInput}
            justification={justification}
            setJustification={setJustification}
            onSubmitDemoEvidence={handleSubmitDemoEvidence}
            onVerifyGithubProvenance={handleVerifyGithubProvenance}
            onRunAiEvaluation={handleRunAiEvaluation}
            onReviewAction={handleReviewAction}
            onPayPalAction={handlePayPalAction}
            onPayPalReconcile={handlePayPalReconcile}
            onOpenAiInspector={() => setShowAiInspector(true)}
            onOpenPassport={() => navigate('/trust')}
            onOpenDisputePack={() => navigate('/disputes')}
          />
        );

      case '/trust':
        return (
          <TrustPage
            passport={passport}
            provenanceData={provenanceData}
            token={token}
            selectedContractId={selectedContractId}
            selectedMilestoneId={selectedMilestoneId}
            onRefreshData={() => refreshAllData(token, selectedMilestoneId, selectedContractId)}
            onVerifyGithubProvenance={handleVerifyGithubProvenance}
            onValidateRuntime={handleValidateRuntime}
            onGeneratePassport={handleVerifyGithubProvenance}
            loading={loading}
          />
        );

      case '/disputes':
        return (
          <DisputesPage
            disputePack={disputePack}
            token={token}
            selectedContractId={selectedContractId}
            selectedMilestoneId={selectedMilestoneId}
            onGenerateDisputePack={handleGenerateDisputePack}
            onVerifyDisputePack={handleVerifyDisputePack}
            onExportDisputePack={handleExportDisputePack}
            loading={loading}
          />
        );

      case '/settings':
        return (
          <SettingsPage
            currentUser={currentUser}
            onSwitchPersona={switchPersona}
            auditLogs={auditLogs}
            onStartTour={() => setShowWalkthrough(true)}
            statusBanner={statusBanner}
          />
        );

      case '/developers':
      case '/docs':
        return <DeveloperPortalPage />;

      case '/':
      case '/onboarding':
      default:
        return <WelcomeLandingPage onStartTour={() => setShowWalkthrough(true)} />;
    }
  };

  return (
    <AppShell
      currentUser={currentUser}
      onSwitchPersona={switchPersona}
      statusBanner={statusBanner}
      onStartTour={() => setShowWalkthrough(true)}
      onOpenSearch={() => setShowSearch(true)}
      onOpenCreateProject={() => setShowCreateProject(true)}
    >
      {renderActivePage()}

      {/* Interactive Contextual Walkthrough Modal with 7 Invariants */}
      <InteractiveWalkthroughModal
        isOpen={showWalkthrough}
        onClose={() => setShowWalkthrough(false)}
        currentUser={currentUser}
      />

      {/* Global Real Database Search Modal */}
      <GlobalSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        token={token}
        onSelectMilestone={(id) => setSelectedMilestoneId(id)}
      />

      {/* Client Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        token={token}
        onSuccess={() => refreshAllData(token, selectedMilestoneId, selectedContractId)}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
