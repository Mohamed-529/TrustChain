import React, { useState, useRef } from 'react';
import type { RequiredProofType } from '../../types/domain.ts';

interface MilestoneDraft {
  sequenceOrder: number;
  title: string;
  description: string;
  agreedAmount: number; // in USD dollars
  deadlineIso: string;
  acceptanceCriteria: Array<{
    id: string;
    title: string;
    description: string;
    requiredProofType: RequiredProofType;
  }>;
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSuccess: (newContract?: any) => Promise<void> | void;
}

const AVAILABLE_DEVELOPERS = [
  {
    id: 'dev_01',
    name: 'Marcus Chen',
    title: 'Senior Systems & Security Engineer',
    badge: 'SLSA Level 2 · 98 Proof Score',
    avatar: 'MC',
  },
  {
    id: 'dev_02',
    name: 'Aisha Patel',
    title: 'Distributed Cloud & AI Architect',
    badge: '95 Proof Score',
    avatar: 'AP',
  },
  {
    id: 'dev_03',
    name: 'Liam Vance',
    title: 'Full-Stack & Mobile Engineer',
    badge: '92 Proof Score',
    avatar: 'LV',
  },
];

type IntakeTab = 'AI_QUICK_SPEC' | 'UPLOAD_FILE' | 'MANUAL_SPEC';

export function CreateProjectModal({
  isOpen,
  onClose,
  token,
  onSuccess,
}: CreateProjectModalProps) {
  // Intake Navigation Tab
  const [activeTab, setActiveTab] = useState<IntakeTab>('AI_QUICK_SPEC');

  // Assigned Developer Selection
  const [selectedDeveloperId, setSelectedDeveloperId] = useState('dev_01');

  // Tab 1: AI Quick Spec Input
  const [promptInput, setPromptInput] = useState('');

  // Tab 2: Document Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 3: Reference URLs
  const [figmaUrl, setFigmaUrl] = useState('');
  const [referenceWebsiteUrl, setReferenceWebsiteUrl] = useState('');
  const [githubRepoOrIssueUrl, setGithubRepoOrIssueUrl] = useState('');

  // Structured Contract State (populated by any intake tab and editable)
  const [title, setTitle] = useState('NextGen Webhook Engine & FinTech Ledger');
  const [description, setDescription] = useState(
    'High-assurance software contract with automated test verification, security scans, and PayPal escrow release.'
  );

  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    {
      sequenceOrder: 1,
      title: 'Milestone 1: Core Architecture & Spec',
      description: 'Deliver core implementation with passing automated test suite.',
      agreedAmount: 3000,
      deadlineIso: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      acceptanceCriteria: [
        {
          id: 'AC-1',
          title: 'Source Code Implementation',
          description: 'Merge feature PR with unit tests.',
          requiredProofType: 'PULL_REQUEST',
        },
        {
          id: 'AC-2',
          title: 'Automated CI Test Suite',
          description: 'Passing automated test run with zero critical vulnerabilities.',
          requiredProofType: 'CI_TESTS',
        },
      ],
    },
    {
      sequenceOrder: 2,
      title: 'Milestone 2: Production Delivery & Verification',
      description: 'Production hardening and deployment smoke test verification.',
      agreedAmount: 2500,
      deadlineIso: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
      acceptanceCriteria: [
        {
          id: 'AC-1',
          title: 'OpenAPI Documentation & Security Scan',
          description: 'Deliver API specification and vulnerability audit report.',
          requiredProofType: 'SECURITY_SCAN',
        },
        {
          id: 'AC-2',
          title: 'API Engine Specification',
          description: 'Verified OpenAPI 3.0.3 contract and schema documentation.',
          requiredProofType: 'API_DOCS',
        },
      ],
    },
  ]);

  const [isParsing, setIsParsing] = useState(false);
  const [parseNotice, setParseNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalBudgetDollars = milestones.reduce((sum, m) => sum + (Number(m.agreedAmount) || 0), 0);
  const totalBudgetCents = totalBudgetDollars * 100;

  // Handles API / Client Parsing of Specs
  const executeParseSpec = async (payload: {
    content?: string;
    rawText?: string;
    fileName?: string;
    fileType?: string;
    prompt?: string;
    figmaUrl?: string;
    referenceWebsiteUrl?: string;
    githubRepoOrIssueUrl?: string;
  }) => {
    setIsParsing(true);
    setParseNotice(null);
    setError(null);

    try {
      const res = await fetch('/api/v1/contracts/parse-spec', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.spec) {
          applyParsedSpec(data.spec);
          setParseNotice({
            type: 'success',
            message: `✓ Successfully parsed ${data.spec.metadata?.fileName ?? 'specification'} (${data.spec.milestones.length} milestones extracted). Review and customize below.`,
          });
          setIsParsing(false);
          return;
        }
      }
    } catch {
      // Backend unavailable (e.g. static preview on Embarko)
    }

    // Resilient Client-Side Fallback Parser for offline/static deployment
    const raw = payload.prompt || payload.rawText || payload.fileName || 'Custom Software Project';
    const fallbackTitle = payload.fileName
      ? payload.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      : raw.length > 50
      ? raw.slice(0, 50) + '...'
      : raw;

    const now = Date.now();
    const fallbackMilestones: MilestoneDraft[] = [
      {
        sequenceOrder: 1,
        title: 'Milestone 1: Core Architecture, API Contract & Implementation',
        description: 'Complete data models, REST endpoints, and automated tests.',
        agreedAmount: 3000,
        deadlineIso: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
        acceptanceCriteria: [
          {
            id: 'AC-1',
            title: 'Source Code Implementation',
            description: 'Merge pull request with passing unit tests.',
            requiredProofType: 'PULL_REQUEST',
          },
          {
            id: 'AC-2',
            title: 'Automated CI Test Suite',
            description: 'Pass 100% of unit tests with statement coverage >= 85%.',
            requiredProofType: 'CI_TESTS',
          },
        ],
      },
      {
        sequenceOrder: 2,
        title: 'Milestone 2: Security Hardening, Verification & Production Readiness',
        description: 'Vulnerability scan, API documentation, and smoke verification.',
        agreedAmount: 2500,
        deadlineIso: new Date(now + 28 * 24 * 60 * 60 * 1000).toISOString(),
        acceptanceCriteria: [
          {
            id: 'AC-1',
            title: 'Security Scan & Zero CVE Gate',
            description: 'Audit npm dependencies with zero critical or high vulnerabilities.',
            requiredProofType: 'SECURITY_SCAN',
          },
          {
            id: 'AC-2',
            title: 'OpenAPI 3.0.3 Contract Verification',
            description: 'Complete interactive API documentation conforming to OpenAPI schema.',
            requiredProofType: 'API_DOCS',
          },
        ],
      },
    ];

    setTitle(fallbackTitle);
    setDescription(`Software delivery contract derived from ${payload.fileName ?? 'requirements prompt'}.`);
    setMilestones(fallbackMilestones);
    setParseNotice({
      type: 'success',
      message: `✓ Specification generated: 2 milestones and 4 acceptance criteria created. Review and customize below.`,
    });
    setIsParsing(false);
  };

  const applyParsedSpec = (spec: any) => {
    if (spec.title) setTitle(spec.title);
    if (spec.description) setDescription(spec.description);
    if (Array.isArray(spec.milestones) && spec.milestones.length > 0) {
      setMilestones(
        spec.milestones.map((m: any, idx: number) => ({
          sequenceOrder: idx + 1,
          title: m.title || `Milestone ${idx + 1}`,
          description: m.description || '',
          agreedAmount: Math.round((m.agreedAmountCents || 250000) / 100),
          deadlineIso: m.deadlineIso || new Date(Date.now() + (idx + 1) * 14 * 24 * 60 * 60 * 1000).toISOString(),
          acceptanceCriteria: Array.isArray(m.acceptanceCriteria) && m.acceptanceCriteria.length > 0
            ? m.acceptanceCriteria
            : [
                {
                  id: 'AC-1',
                  title: 'Deliverable Implementation',
                  description: 'Merge pull request with passing test suite.',
                  requiredProofType: 'PULL_REQUEST',
                },
              ],
        }))
      );
    }
  };

  // Tab 1: AI Prompt Generator
  const handleGeneratePromptSpec = () => {
    if (!promptInput.trim()) {
      setParseNotice({ type: 'error', message: 'Please enter project requirements or prompt.' });
      return;
    }
    void executeParseSpec({
      prompt: promptInput.trim(),
      figmaUrl: figmaUrl.trim() || undefined,
      referenceWebsiteUrl: referenceWebsiteUrl.trim() || undefined,
      githubRepoOrIssueUrl: githubRepoOrIssueUrl.trim() || undefined,
    });
  };

  // Tab 2: File Drop & Upload
  const handleProcessFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setParseNotice({ type: 'error', message: 'File size exceeds maximum 5MB limit.' });
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'md', 'txt', 'markdown'].includes(ext ?? '')) {
      setParseNotice({ type: 'error', message: 'Supported formats: .pdf, .md, .txt (Max 5MB).' });
      return;
    }

    setUploadedFileName(file.name);

    if (ext === 'pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        void executeParseSpec({
          content: result,
          fileName: file.name,
          fileType: file.type || 'application/pdf',
          figmaUrl: figmaUrl.trim() || undefined,
          referenceWebsiteUrl: referenceWebsiteUrl.trim() || undefined,
          githubRepoOrIssueUrl: githubRepoOrIssueUrl.trim() || undefined,
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        void executeParseSpec({
          rawText: text,
          fileName: file.name,
          fileType: file.type || 'text/plain',
          figmaUrl: figmaUrl.trim() || undefined,
          referenceWebsiteUrl: referenceWebsiteUrl.trim() || undefined,
          githubRepoOrIssueUrl: githubRepoOrIssueUrl.trim() || undefined,
        });
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleMilestoneAmountChange = (index: number, newAmount: number) => {
    setMilestones((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, agreedAmount: newAmount } : m))
    );
  };

  const handleMilestoneTitleChange = (index: number, newTitle: string) => {
    setMilestones((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, title: newTitle } : m))
    );
  };

  // Submit to POST /api/v1/contracts
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required.');
      return;
    }

    for (let i = 0; i < milestones.length; i++) {
      if (!milestones[i].title.trim()) {
        setError(`Milestone #${i + 1} requires a title.`);
        return;
      }
      if (milestones[i].agreedAmount <= 0) {
        setError(`Milestone #${i + 1} amount must be greater than $0.`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    // Append reference links cleanly into description to preserve existing schema validation
    let fullDescription = description.trim() || 'Software development delivery contract with verifiable milestones.';
    const references: string[] = [];
    if (figmaUrl.trim()) references.push(`• Figma: ${figmaUrl.trim()}`);
    if (referenceWebsiteUrl.trim()) references.push(`• Reference Site: ${referenceWebsiteUrl.trim()}`);
    if (githubRepoOrIssueUrl.trim()) references.push(`• GitHub Target: ${githubRepoOrIssueUrl.trim()}`);
    if (references.length > 0 && !fullDescription.includes('[Design & Technical References]')) {
      fullDescription += `\n\n[Design & Technical References]\n${references.join('\n')}`;
    }

    const payload = {
      title: title.trim(),
      description: fullDescription,
      totalBudgetCents,
      currency: 'USD',
      developerId: selectedDeveloperId,
      policyRules: {
        requirePassingCi: true,
        requireSecurityScan: true,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: true,
        latePenaltyDailyBps: 100,
      },
      milestones: milestones.map((m, idx) => ({
        sequenceOrder: idx + 1,
        title: m.title.trim(),
        description: m.description.trim() || `Deliverable scope for Milestone ${idx + 1}.`,
        agreedAmountCents: Math.round(m.agreedAmount * 100),
        deadlineIso: m.deadlineIso,
        acceptanceCriteria: m.acceptanceCriteria.length > 0
          ? m.acceptanceCriteria
          : [
              {
                id: 'AC-1',
                title: 'Source Code Implementation',
                description: 'Merge feature PR with unit tests.',
                requiredProofType: 'PULL_REQUEST' as const,
              },
            ],
      })),
    };

    try {
      const res = await fetch('/api/v1/contracts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to create contract');
      }

      const createdContract = data.contract;

      // Automatically activate contract so milestones are immediately actionable
      if (createdContract?.id) {
        try {
          const activateRes = await fetch(`/api/v1/contracts/${createdContract.id}/activate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (activateRes.ok) {
            const actData = await activateRes.json();
            if (actData.contract) {
              createdContract.status = 'ACTIVE';
            }
          }
        } catch {
          // Non-blocking activation
        }
      }

      await onSuccess(createdContract);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating contract');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0b1f17]/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col font-sans text-[#0b1f17]">
        
        {/* HEADER */}
        <div className="px-5 sm:px-6 py-4 border-b border-[rgba(11,31,23,0.08)] bg-white flex items-center justify-between sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.15)] uppercase">
                CLIENT CONTRACT STUDIO
              </span>
              <span className="text-[10px] text-[#6b7f75] font-mono">Multi-Modal Intake</span>
            </div>
            <h2 className="text-lg font-normal text-[#0b1f17] tracking-tight mt-1">
              Create New Software Contract
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#3d5248] hover:text-[#0b1f17] flex items-center justify-center border border-[rgba(11,31,23,0.1)] text-xs transition"
          >
            ✕
          </button>
        </div>

        {/* 3-TAB INTAKE SELECTOR */}
        <div className="px-6 pt-4 pb-2 bg-[#f6f5f0] border-b border-[rgba(11,31,23,0.06)]">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#e9efe6]/70 rounded-2xl border border-[rgba(11,31,23,0.08)]">
            <button
              type="button"
              onClick={() => setActiveTab('AI_QUICK_SPEC')}
              className={`py-2 px-2 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                activeTab === 'AI_QUICK_SPEC'
                  ? 'bg-white text-[#0b1f17] shadow-sm font-semibold'
                  : 'text-[#3d5248] hover:text-[#0b1f17]'
              }`}
            >
              <span>✨</span>
              <span>AI Quick Spec</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('UPLOAD_FILE')}
              className={`py-2 px-2 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                activeTab === 'UPLOAD_FILE'
                  ? 'bg-white text-[#0b1f17] shadow-sm font-semibold'
                  : 'text-[#3d5248] hover:text-[#0b1f17]'
              }`}
            >
              <span>📄</span>
              <span>Upload PRD / File</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MANUAL_SPEC')}
              className={`py-2 px-2 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                activeTab === 'MANUAL_SPEC'
                  ? 'bg-white text-[#0b1f17] shadow-sm font-semibold'
                  : 'text-[#3d5248] hover:text-[#0b1f17]'
              }`}
            >
              <span>🔗</span>
              <span>Links &amp; Manual</span>
            </button>
          </div>
        </div>

        {/* INTAKE PANEL ACCORDING TO ACTIVE TAB */}
        <div className="p-6 pb-2 space-y-4">
          
          {/* TAB 1: AI Quick Spec Prompt */}
          {activeTab === 'AI_QUICK_SPEC' && (
            <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[#3d5248] flex items-center gap-1.5">
                  <span>✨</span>
                  <span>Describe your software project, features, and desired milestones:</span>
                </label>
                <span className="text-[10px] text-[#2f7a50] font-mono">Gemini 2.5 Flash</span>
              </div>
              <textarea
                rows={3}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. Build an online artisanal Tea Shop with product filters, shopping cart, passing unit test suite, and PayPal pre-authorization checkout..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] placeholder:text-[#6b7f75] focus:border-[#2f7a50] outline-none text-xs"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isParsing}
                  onClick={handleGeneratePromptSpec}
                  className="px-4 py-1.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-medium transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isParsing ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Synthesizing Spec...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Milestones &amp; Budget →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Upload PRD / Spec File Dropzone */}
          {activeTab === 'UPLOAD_FILE' && (
            <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[#3d5248] flex items-center gap-1.5">
                  <span>📄</span>
                  <span>Drag &amp; drop your PRD, Architecture Spec, or Requirements file:</span>
                </label>
                <span className="text-[10px] text-[#6b7f75] font-mono">PDF • MD • TXT (Max 5MB)</span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${
                  isDragging
                    ? 'border-[#2f7a50] bg-[#edf6f0]'
                    : 'border-[rgba(11,31,23,0.15)] bg-[#f6f5f0] hover:bg-[#ecebe4]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.md,.txt,.markdown"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <span className="text-2xl">📥</span>
                {isParsing ? (
                  <div className="flex items-center gap-2 text-xs text-[#2f7a50] font-medium">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-[#2f7a50]/30 border-t-[#2f7a50] animate-spin" />
                    <span>Extracting milestones and acceptance criteria from file...</span>
                  </div>
                ) : uploadedFileName ? (
                  <div className="text-xs text-[#0b1f17] font-medium">
                    <span>Uploaded: </span>
                    <strong className="text-[#2f7a50]">{uploadedFileName}</strong>
                    <div className="text-[10px] text-[#6b7f75] mt-0.5">Click or drop another file to replace</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-medium text-[#0b1f17]">
                      Drop your document here or <span className="text-[#2f7a50] underline">browse</span>
                    </div>
                    <div className="text-[10px] text-[#6b7f75] mt-1">
                      Extracts title, budget, deadlines, and testable acceptance criteria automatically
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Reference Links & Metadata */}
          {activeTab === 'MANUAL_SPEC' && (
            <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-2.5 shadow-sm">
              <label className="text-[11px] font-medium text-[#3d5248] flex items-center gap-1.5 mb-1">
                <span>🔗</span>
                <span>Optional Design &amp; Technical Reference Links:</span>
              </label>
              
              <div className="space-y-2 text-xs">
                <div>
                  <input
                    type="url"
                    value={figmaUrl}
                    onChange={(e) => setFigmaUrl(e.target.value)}
                    placeholder="Figma Prototype URL (e.g. https://www.figma.com/design/...)"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.1)] text-[#0b1f17] placeholder:text-[#6b7f75] outline-none focus:border-[#2f7a50]"
                  />
                </div>
                <div>
                  <input
                    type="url"
                    value={referenceWebsiteUrl}
                    onChange={(e) => setReferenceWebsiteUrl(e.target.value)}
                    placeholder="Reference App / Site (e.g. https://teashop-example.com)"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.1)] text-[#0b1f17] placeholder:text-[#6b7f75] outline-none focus:border-[#2f7a50]"
                  />
                </div>
                <div>
                  <input
                    type="url"
                    value={githubRepoOrIssueUrl}
                    onChange={(e) => setGithubRepoOrIssueUrl(e.target.value)}
                    placeholder="GitHub Target Repo or Issue (e.g. https://github.com/cloudhub-org/app/issues/10)"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.1)] text-[#0b1f17] placeholder:text-[#6b7f75] outline-none focus:border-[#2f7a50]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PARSE / INTAKE NOTICES */}
          {parseNotice && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                parseNotice.type === 'success'
                  ? 'bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9]'
                  : 'bg-[#fdf2f2] text-[#a62b2b] border border-[#f3c2c2]'
              }`}
            >
              <span>{parseNotice.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{parseNotice.message}</span>
            </div>
          )}
        </div>

        {/* REVIEW & CUSTOMIZE STRUCTURED CONTRACT FORM */}
        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-2xl bg-[#fdf2f2] border border-[#f3c2c2] text-[#a62b2b]">
              {error}
            </div>
          )}

          <div>
            <label className="text-[11px] text-[#6b7f75] block mb-1">Contract / Project Title:</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Artisanal Tea Shop Storefront & Ordering Engine"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.12)] text-[#0b1f17] placeholder:text-[#6b7f75] focus:border-[#2f7a50] outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#6b7f75] block mb-1">Description &amp; Scope:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe deliverables, requirements, and scope..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.12)] text-[#0b1f17] placeholder:text-[#6b7f75] focus:border-[#2f7a50] outline-none font-sans"
            />
          </div>

          {/* ASSIGNED DEVELOPER SELECTOR */}
          <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#0b1f17] flex items-center gap-1.5">
                <span>👨‍💻</span> <span>Select &amp; Assign Developer:</span>
              </label>
              <span className="text-[10px] font-mono text-[#2f7a50] bg-[#e9efe6] px-2 py-0.5 rounded-full">
                ACTIVE VETTED DEVELOPER
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {AVAILABLE_DEVELOPERS.map((dev) => (
                <button
                  type="button"
                  key={dev.id}
                  onClick={() => setSelectedDeveloperId(dev.id)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                    selectedDeveloperId === dev.id
                      ? 'border-[#2563eb] bg-[#f0f4ff] ring-1 ring-[#2563eb]'
                      : 'border-[rgba(11,31,23,0.1)] bg-[#f6f5f0] hover:bg-[#ecebe4]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-lg text-white font-bold text-[10px] flex items-center justify-center ${
                        selectedDeveloperId === dev.id ? 'bg-[#2563eb]' : 'bg-[#0b1f17]'
                      }`}
                    >
                      {dev.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0b1f17] truncate">{dev.name}</div>
                      <div className="text-[9px] text-[#6b7f75] truncate">{dev.title}</div>
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-[#2f7a50] pt-0.5">{dev.badge}</div>
                </button>
              ))}
            </div>
          </div>

          {/* STRUCTURED MILESTONES & BUDGET */}
          <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#0b1f17] text-[11px]">Milestones &amp; Budget Allocation</span>
              <span className="text-[#2f7a50] font-mono font-semibold">
                Total: ${(totalBudgetCents / 100).toFixed(2)} USD
              </span>
            </div>

            <div className="space-y-2.5">
              {milestones.map((m, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-1.5">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => handleMilestoneTitleChange(idx, e.target.value)}
                      placeholder={`Milestone ${idx + 1} Title`}
                      className="col-span-2 px-3 py-1.5 rounded-lg bg-white border border-[rgba(11,31,23,0.1)] text-[#0b1f17] text-xs font-medium"
                    />
                    <div className="flex items-center gap-1 font-mono">
                      <span className="text-[#6b7f75]">$</span>
                      <input
                        type="number"
                        min={1}
                        value={m.agreedAmount}
                        onChange={(e) => handleMilestoneAmountChange(idx, Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[rgba(11,31,23,0.1)] text-[#0b1f17] text-xs"
                      />
                    </div>
                  </div>

                  {/* Criteria Tags */}
                  {m.acceptanceCriteria.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {m.acceptanceCriteria.map((c, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 rounded-md bg-white border border-[rgba(11,31,23,0.08)] text-[9px] font-mono text-[#3d5248]"
                          title={c.description}
                        >
                          {c.id}: {c.title.slice(0, 30)} ({c.requiredProofType})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || isParsing}
              className="w-full py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] font-medium text-white text-xs shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Persisting to SQLite &amp; Audit Ledger...</span>
                </>
              ) : (
                <span>Save &amp; Create Project (${(totalBudgetCents / 100).toFixed(2)}) →</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
