import React, { useState } from 'react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSuccess: () => Promise<void>;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  token,
  onSuccess,
}: CreateProjectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [m1Title, setM1Title] = useState('Milestone 1: Core Architecture & Spec');
  const [m1Amount, setM1Amount] = useState<number>(3000);
  const [m2Title, setM2Title] = useState('Milestone 2: Production Delivery & Verification');
  const [m2Amount, setM2Amount] = useState<number>(3000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalBudgetCents = (m1Amount + m2Amount) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required.');
      return;
    }
    if (m1Amount <= 0 || m2Amount <= 0) {
      setError('Milestone budgets must be positive integers.');
      return;
    }

    setLoading(true);
    setError(null);

    const now = new Date();
    const d1 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const d2 = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      title: title.trim(),
      description: description.trim() || 'Software development delivery contract with verifiable milestones.',
      totalBudgetCents,
      currency: 'USD',
      developerId: 'dev_01',
      reviewerId: 'reviewer_01',
      policyRules: {
        requirePassingCi: true,
        requireSecurityScan: true,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: true,
        latePenaltyDailyBps: 100,
      },
      milestones: [
        {
          sequenceOrder: 1,
          title: m1Title.trim(),
          description: 'Deliver core implementation with passing automated test suite.',
          agreedAmountCents: m1Amount * 100,
          deadlineIso: d1,
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
          title: m2Title.trim(),
          description: 'Production hardening and deployment smoke test verification.',
          agreedAmountCents: m2Amount * 100,
          deadlineIso: d2,
          acceptanceCriteria: [
            {
              id: 'AC-1',
              title: 'OpenAPI Documentation & Security Scan',
              description: 'Deliver API specification and vulnerability audit report.',
              requiredProofType: 'SECURITY_SCAN',
            },
          ],
        },
      ],
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
      await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating contract');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0b1f17]/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col font-sans text-[#0b1f17]">
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[rgba(11,31,23,0.08)] bg-white flex items-center justify-between sticky top-0 z-10">
          <div>
            <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.15)] uppercase">
              CLIENT ACTION
            </span>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
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
              placeholder="e.g. NextGen Webhook Engine & FinTech Ledger"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.12)] text-[#0b1f17] placeholder:text-[#6b7f75] focus:border-[#2f7a50] outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#6b7f75] block mb-1">Description:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe deliverables, requirements, and scope..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.12)] text-[#0b1f17] placeholder:text-[#6b7f75] focus:border-[#2f7a50] outline-none font-sans"
            />
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#0b1f17] text-[11px]">Milestones & Budget Allocation</span>
              <span className="text-[#2f7a50] font-mono font-semibold">
                Total: ${(totalBudgetCents / 100).toFixed(2)} USD
              </span>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 items-center">
                <input
                  type="text"
                  value={m1Title}
                  onChange={(e) => setM1Title(e.target.value)}
                  className="col-span-2 px-3 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.1)] text-[#0b1f17]"
                />
                <div className="flex items-center gap-1 font-mono">
                  <span className="text-[#6b7f75]">$</span>
                  <input
                    type="number"
                    value={m1Amount}
                    onChange={(e) => setM1Amount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.1)] text-[#0b1f17]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <input
                  type="text"
                  value={m2Title}
                  onChange={(e) => setM2Title(e.target.value)}
                  className="col-span-2 px-3 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.1)] text-[#0b1f17]"
                />
                <div className="flex items-center gap-1 font-mono">
                  <span className="text-[#6b7f75]">$</span>
                  <input
                    type="number"
                    value={m2Amount}
                    onChange={(e) => setM2Amount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.1)] text-[#0b1f17]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] font-medium text-white text-xs shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Persisting to SQLite...' : 'Save & Create Project →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
