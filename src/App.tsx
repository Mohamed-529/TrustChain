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
} from './types/domain.ts';

import { RouterProvider, usePathname, useNavigate } from './router/Router.tsx';
import { AppShell } from './components/layout/AppShell.tsx';
import { GuidedTourModal, STORAGE_KEY_ONBOARDING } from './components/onboarding/GuidedTourModal.tsx';
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
  const [selectedContractId] = useState<string>('contract_seed_01');
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

  // Global UI Controls
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [quickFilterType, setQuickFilterType] = useState<string>('ALL');
  const [showAiInspector, setShowAiInspector] = useState<boolean>(false);
  const [showTour, setShowTour] = useState<boolean>(false);

  // 1. Check for First-Visit Guided Tour
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasCompletedTour = localStorage.getItem(STORAGE_KEY_ONBOARDING);
      if (!hasCompletedTour && window.location.pathname === '/') {
        // Automatically invite first-time visitors to the guided tour
        setShowTour(true);
      }
      if (window.location.pathname === '/onboarding') {
        setShowTour(true);
      }
    }
  }, []);

  // 2. Switch Persona Handler
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

  // 3. Comprehensive Data Refresh Provider
  const refreshAllData = useCallback(
    async (activeToken: string, milestoneId: string, contractId: string) => {
      if (!activeToken) return;
      setLoading(true);
      try {
        const [schedRes, revRes, provRes, ppRes, ledgerRes, passRes, auditRes] = await Promise.all([
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

  // Initial authentication on mount
  useEffect(() => {
    void switchPersona('reviewer_01');
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
          message: 'PayPal Sandbox checkout was cancelled by the buyer.',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      // browser environment safe
    }
  }, []);

  // 4. Action Handlers
  const handleLoadControlTowerDemoScenario = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/contracts/${selectedContractId}/schedule/demo-scenario`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to load Control Tower demo scenario');
      }
      setScheduleData(data.schedule);
      setStatusBanner({
        type: 'success',
        message: 'Loaded Bryntum Control Tower 3-Milestone Risk & Recovery Demo.',
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load demo scenario',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeScheduleRisk = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/contracts/${selectedContractId}/schedule/analyze-risk`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          referenceTimeIso: '2026-11-23T12:00:00.000Z',
          recoveryDays: 7,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to analyze schedule risk');
      }
      setScheduleData(data.schedule);
      setStatusBanner({
        type: 'success',
        message: `AI Schedule-Risk Analysis complete: ${data.createdProposals.length} recovery proposal(s) ready for review.`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Schedule risk analysis failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewScheduleProposal = async (
    proposal: ScheduleRecoveryProposal,
    decision: 'APPROVE' | 'REJECT'
  ) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/contracts/${selectedContractId}/schedule/proposals/${proposal.id}/review`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            decision,
            reason: scheduleDecisionReason,
            referenceTimeIso: '2026-11-23T12:00:00.000Z',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to review schedule proposal');
      }
      setScheduleData(data.schedule);
      setStatusBanner({
        type: 'success',
        message: `Schedule proposal ${proposal.id} ${decision}D. Downstream Finish-to-Start dependencies recalculated.`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to submit proposal review',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDemoEvidence = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/evidence/demo-submission`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Demo evidence submission failed');
      }
      setStatusBanner({
        type: 'success',
        message: `Submitted delivery evidence attempt #${data.submission.attemptNumber} (Commit: ${data.submission.evidence.commitHash.slice(0, 10)}).`,
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
        throw new Error(data.error?.message ?? 'AI evaluation failed');
      }
      setStatusBanner({
        type: 'success',
        message: `Tri-Agent AI Advisory Synthesis completed: Arbitrator recommends ${data.evaluation.arbitratorRecommendation.recommendedOutcome} (Risk: ${data.evaluation.riskAnalysis.overallRiskSeverity}).`,
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
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/evidence/verify-provenance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'GitHub provenance verification failed');
      }
      const prov = data.verificationRecord;
      setStatusBanner({
        type: 'info',
        message: `Independent GitHub Provenance Verification: status=${prov.verificationStatus ?? prov.overallStatus} (integrity=${prov.integrity?.payloadHashMatches ? 'MATCH' : 'TAMPERED'}).`,
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
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/milestones/${selectedMilestoneId}/review/${actionEndpoint}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            evaluationId: reviewDetails?.latestEvaluation?.id,
            approvedAmountCents:
              actionEndpoint === 'approve' ? approvedAmountCentsInput : 0,
            justification,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Review submission failed');
      }
      setStatusBanner({
        type: 'success',
        message: `Recorded human review decision: ${data.approval.decision} (Milestone state: ${data.stateMachineStatus}).`,
      });
      setJustification('');
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Review error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayPalAction = async (step: 'order' | 'authorize' | 'capture') => {
    if (!token) return;
    setLoading(true);
    try {
      const requestId = `ppreq_${selectedMilestoneId}_${step}_${Date.now()}`;
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/paypal/${step}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          'PayPal-Request-Id': requestId,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? `PayPal ${step} failed`);
      }
      const rawLinks = Array.isArray(data.transaction?.rawPaypalResponse?.links)
        ? (data.transaction.rawPaypalResponse.links as Array<{ rel: string; href: string }>)
        : null;
      const approveLink = rawLinks?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href;

      let successMsg = `PayPal Orders API v2 (${step.toUpperCase()}) succeeded: status=${data.transaction.status} [PayPal-Request-Id: ${requestId}]`;
      if (step === 'order' && approveLink) {
        successMsg += ' — Action: Complete buyer checkout approval before authorizing hold.';
      }
      setStatusBanner({
        type: 'success',
        message: successMsg,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : `PayPal ${step} error`,
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
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'PayPal reconciliation failed');
      }
      const rec = data.reconciliation;
      setStatusBanner({
        type: rec.outcome === 'IN_SYNC' ? 'info' : 'success',
        message: `PayPal Reconciliation [${rec.outcome}]: ${rec.actionTaken}. Discrepancies: ${rec.discrepancies.length}`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'PayPal reconciliation error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePassport = async () => {
    await handleVerifyGithubProvenance();
  };

  // 5. Multi-Page Route Dispatcher
  const renderActivePage = () => {
    switch (currentPath) {
      case '/dashboard':
        return (
          <DashboardPage
            ledgerRows={ledgerRows}
            scheduleData={scheduleData}
            onSelectQuickFilter={(qf) => setQuickFilterType(qf)}
          />
        );

      case '/intelligence':
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
            onLoadControlTowerDemo={handleLoadControlTowerDemoScenario}
            onAnalyzeScheduleRisk={handleAnalyzeScheduleRisk}
            onReviewProposal={handleReviewScheduleProposal}
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
            onGeneratePassport={handleGeneratePassport}
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
            onStartTour={() => setShowTour(true)}
            statusBanner={statusBanner}
          />
        );

      case '/developers':
      case '/docs':
        return <DeveloperPortalPage />;

      case '/':
      case '/onboarding':
      default:
        return <WelcomeLandingPage onStartTour={() => setShowTour(true)} />;
    }
  };

  return (
    <AppShell
      currentUser={currentUser}
      onSwitchPersona={switchPersona}
      statusBanner={statusBanner}
      onStartTour={() => setShowTour(true)}
    >
      {renderActivePage()}

      {/* Interactive Guided Tour Modal */}
      <GuidedTourModal isOpen={showTour} onClose={() => setShowTour(false)} />
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
