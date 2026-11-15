import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from '../../router/Router.tsx';

interface SearchResult {
  contracts: Array<{
    id: string;
    title: string;
    description: string;
    totalBudgetCents: number;
    status: string;
  }>;
  milestones: Array<{
    id: string;
    contractId: string;
    title: string;
    description: string;
    agreedAmountCents: number;
    status: string;
    paymentStatus: string;
  }>;
  evidence: Array<{
    id: string;
    milestoneId: string;
    attemptNumber: number;
    commitSha: string;
    prUrl: string;
    submittedAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    timestamp: string;
    actorId: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    entryHash: string;
  }>;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSelectMilestone?: (milestoneId: string) => void;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  token,
  onSelectMilestone,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
        }
      } catch {
        // Ignore network search errors
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, token]);

  if (!isOpen) return null;

  const handleSelectMilestone = (milestoneId: string) => {
    if (onSelectMilestone) {
      onSelectMilestone(milestoneId);
    }
    navigate('/reviews');
    onClose();
  };

  const hasAnyResults =
    results &&
    (results.contracts.length > 0 ||
      results.milestones.length > 0 ||
      results.evidence.length > 0 ||
      results.auditLogs.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-[#0b1f17]/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="px-6 py-4 border-b border-[rgba(11,31,23,0.08)] bg-white flex items-center gap-3">
          <span className="text-[#2f7a50] text-base">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, milestones, commits, PRs, or audit hashes..."
            className="w-full bg-transparent border-0 outline-none text-[#0b1f17] text-sm placeholder:text-[#6b7f75] font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-[#6b7f75] hover:text-[#0b1f17] font-mono px-2 py-1 rounded-md"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#3d5248] hover:text-[#0b1f17] flex items-center justify-center border border-[rgba(11,31,23,0.1)] text-xs transition"
          >
            ✕
          </button>
        </div>

        {/* Results Body */}
        <div className="p-6 overflow-y-auto space-y-4 font-sans text-xs">
          {loading && (
            <div className="py-8 text-center text-[#6b7f75] font-mono">
              Searching authoritative database...
            </div>
          )}

          {!loading && !query && (
            <div className="py-8 text-center text-[#6b7f75] space-y-2">
              <p>Type to search across contracts, milestones, evidence, and audit logs.</p>
              <div className="flex justify-center gap-2 text-[11px] font-mono">
                <span className="px-3 py-1 rounded-full bg-white border border-[rgba(11,31,23,0.1)] text-[#3d5248]">oauth</span>
                <span className="px-3 py-1 rounded-full bg-white border border-[rgba(11,31,23,0.1)] text-[#3d5248]">openapi</span>
                <span className="px-3 py-1 rounded-full bg-white border border-[rgba(11,31,23,0.1)] text-[#3d5248]">ms_seed_01</span>
              </div>
            </div>
          )}

          {!loading && query && !hasAnyResults && (
            <div className="py-8 text-center text-[#6b7f75] font-mono">
              No matching records found for &quot;{query}&quot;.
            </div>
          )}

          {!loading && results && (
            <div className="space-y-4">
              {/* Contracts */}
              {results.contracts.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#6b7f75]">
                    Projects & Contracts ({results.contracts.length})
                  </div>
                  {results.contracts.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        navigate('/dashboard');
                        onClose();
                      }}
                      className="p-3.5 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] hover:border-[#2f7a50] cursor-pointer transition flex items-center justify-between shadow-sm"
                    >
                      <div>
                        <div className="text-[#0b1f17] font-semibold text-xs">{c.title}</div>
                        <div className="text-[#6b7f75] text-[11px] truncate max-w-md">
                          {c.description}
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-semibold">
                        ${(c.totalBudgetCents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Milestones */}
              {results.milestones.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#6b7f75]">
                    Milestones ({results.milestones.length})
                  </div>
                  {results.milestones.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMilestone(m.id)}
                      className="p-3.5 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] hover:border-[#2f7a50] cursor-pointer transition flex items-center justify-between shadow-sm"
                    >
                      <div>
                        <div className="text-[#0b1f17] font-semibold text-xs">{m.title}</div>
                        <div className="text-[#6b7f75] text-[11px]">{m.id} • {m.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#2f7a50] font-mono font-semibold text-xs">
                          ${(m.agreedAmountCents / 100).toFixed(2)}
                        </div>
                        <span className="text-[10px] text-[#6b7f75] font-mono">{m.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Evidence Submissions */}
              {results.evidence.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#6b7f75]">
                    Evidence Submissions ({results.evidence.length})
                  </div>
                  {results.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => handleSelectMilestone(ev.milestoneId)}
                      className="p-3.5 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] hover:border-[#2f7a50] cursor-pointer transition flex items-center justify-between shadow-sm"
                    >
                      <div>
                        <div className="text-[#0b1f17] font-mono text-xs font-semibold">
                          Commit: {ev.commitSha.slice(0, 10)}... (Attempt #{ev.attemptNumber})
                        </div>
                        <div className="text-[#6b7f75] text-[11px] truncate max-w-md">{ev.prUrl}</div>
                      </div>
                      <span className="text-[10px] text-[#6b7f75] font-mono">{ev.milestoneId}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Audit Logs */}
              {results.auditLogs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#6b7f75]">
                    Audit Records ({results.auditLogs.length})
                  </div>
                  {results.auditLogs.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => {
                        navigate('/trust');
                        onClose();
                      }}
                      className="p-3.5 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] hover:border-[#2f7a50] cursor-pointer transition flex items-center justify-between shadow-sm"
                    >
                      <div>
                        <div className="text-[#0b1f17] font-mono text-xs font-semibold">{a.action}</div>
                        <div className="text-[#6b7f75] text-[10px] font-mono">
                          Hash: {a.entryHash.slice(0, 16)}...
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#8a681c] font-medium">{a.actorRole}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
