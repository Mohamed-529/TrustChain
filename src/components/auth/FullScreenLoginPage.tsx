import React, { useState } from 'react';
import type { User } from '../../types/domain.ts';
import { SiteFooter } from '../layout/SiteFooter.tsx';

interface FullScreenLoginPageProps {
  onAuthenticated: (token: string, user: User) => void;
  onDemoSwitch: (userId: string) => Promise<void>;
  initialMode?: 'CREATE_ACCOUNT' | 'SIGN_IN';
  initialEmail?: string;
  onBackToHome?: () => void;
}

interface StoredLocalAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'CLIENT' | 'DEVELOPER';
  country: string;
  emailUpdates: boolean;
  createdAt: string;
}

const LOCAL_ACCOUNTS_KEY = 'veridex_registered_accounts_v1';

const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'Singapore',
  'Australia',
  'France',
  'Netherlands',
  'Japan',
  'United Arab Emirates',
  'Other',
];

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`veridex-salt-2026:${input}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic digest if Web Crypto is unavailable in insecure context
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

function readLocalAccounts(): StoredLocalAccount[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredLocalAccount[]) : [];
  } catch {
    return [];
  }
}

function saveLocalAccounts(accounts: StoredLocalAccount[]): void {
  try {
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage quota errors
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string): boolean {
  return (
    password.length >= 15 ||
    (password.length >= 8 && /[a-z]/.test(password) && /\d/.test(password))
  );
}

export function FullScreenLoginPage({
  onAuthenticated,
  onDemoSwitch,
  initialMode = 'CREATE_ACCOUNT',
  initialEmail = '',
  onBackToHome,
}: FullScreenLoginPageProps) {
  const [authMode, setAuthMode] = useState<'CREATE_ACCOUNT' | 'SIGN_IN'>(initialMode);
  const [selectedRole, setSelectedRole] = useState<'CLIENT' | 'DEVELOPER'>('CLIENT');
  const [showFeatures, setShowFeatures] = useState(true);

  // Form fields
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('India');
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const switchMode = (nextMode: 'CREATE_ACCOUNT' | 'SIGN_IN') => {
    setAuthMode(nextMode);
    setErrorMsg(null);
    if (nextMode === 'CREATE_ACCOUNT') {
      setSuccessMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = username.trim();

    // Client-side validation
    if (!isValidEmail(normalizedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (authMode === 'CREATE_ACCOUNT') {
      if (!isValidPassword(password)) {
        setErrorMsg(
          'Password should be at least 15 characters OR at least 8 characters including a number and a lowercase letter.'
        );
        return;
      }
      if (trimmedName.length < 2) {
        setErrorMsg('Username must be at least 2 characters.');
        return;
      }
    } else if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'CREATE_ACCOUNT') {
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            email: normalizedEmail,
            password,
            role: selectedRole,
            country,
          }),
        });

        const contentType = res.headers.get('content-type') ?? '';
        const hasJson = contentType.includes('application/json');

        if (res.ok && hasJson) {
          // Real backend registration succeeded -> redirect user to Sign In (never auto-enter home)
          setPassword('');
          setAuthMode('SIGN_IN');
          setSuccessMsg(
            `Account created for ${normalizedEmail}! Please sign in with your new credentials to continue.`
          );
          return;
        }

        if (hasJson) {
          const errData = await res.json();
          setErrorMsg(errData.error?.message || 'Unable to create account. Please verify your details.');
          return;
        }

        // Static-host fallback (e.g., Embarko static preview returning 404 for /api/v1/*)
        const existingAccounts = readLocalAccounts();
        if (existingAccounts.some((acc) => acc.email === normalizedEmail)) {
          setErrorMsg('An account with this email address already exists. Please sign in instead.');
          return;
        }

        const passwordHash = await sha256Hex(password);
        const newAccount: StoredLocalAccount = {
          id: `${selectedRole.toLowerCase()}_${Date.now().toString(36)}`,
          name: trimmedName,
          email: normalizedEmail,
          passwordHash,
          role: selectedRole,
          country,
          emailUpdates,
          createdAt: new Date().toISOString(),
        };
        saveLocalAccounts([...existingAccounts, newAccount]);

        // Redirect cleanly to Sign In after registration
        setPassword('');
        setAuthMode('SIGN_IN');
        setSuccessMsg(
          `Account created for ${normalizedEmail}! Please sign in with your new credentials to continue.`
        );
        return;
      }

      // SIGN_IN flow
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const contentType = res.headers.get('content-type') ?? '';
      const hasJson = contentType.includes('application/json');

      if (res.ok && hasJson) {
        const data = await res.json();
        if (data.token && data.user) {
          onAuthenticated(data.token, data.user);
          return;
        }
      }

      if (hasJson) {
        const errData = await res.json();
        setErrorMsg(errData.error?.message || 'Invalid email or password.');
        return;
      }

      // Static-host credential verification against registered localStorage accounts
      const existingAccounts = readLocalAccounts();
      const matched = existingAccounts.find((acc) => acc.email === normalizedEmail);
      if (!matched) {
        setErrorMsg('No account found with that email. Please create an account first.');
        return;
      }

      const enteredHash = await sha256Hex(password);
      if (enteredHash !== matched.passwordHash) {
        setErrorMsg('Invalid email or password.');
        return;
      }

      const verifiedUser: User = {
        id: matched.id,
        name: matched.name,
        email: matched.email,
        role: matched.role,
        isActive: true,
        isDemoAccount: false,
        createdAt: matched.createdAt,
      };
      onAuthenticated(`veridex_session_${matched.id}_${Date.now().toString(36)}`, verifiedUser);
    } catch {
      setErrorMsg('Network error while connecting to Veridex authentication service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSandbox = async (userId: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await onDemoSwitch(userId);
    } catch {
      setErrorMsg('Failed to sign in with sandbox account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-white selection:bg-[#1f883d] selection:text-white">
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT PANEL: Dark Cosmic Showcase (GitHub-style split-screen; below form on mobile for instant mobile sign-up) */}
        <div className="order-2 lg:order-1 relative overflow-hidden bg-[#06090f] text-white flex flex-col justify-between px-6 sm:px-14 lg:px-16 py-10 lg:py-14">
        {/* Subtle starfield dots */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(1.5px 1.5px at 14% 22%, rgba(255,255,255,0.65) 50%, transparent 100%), radial-gradient(1px 1px at 78% 15%, rgba(255,255,255,0.5) 50%, transparent 100%), radial-gradient(1.5px 1.5px at 42% 58%, rgba(255,255,255,0.4) 50%, transparent 100%), radial-gradient(1px 1px at 88% 66%, rgba(255,255,255,0.6) 50%, transparent 100%), radial-gradient(1.5px 1.5px at 24% 82%, rgba(255,255,255,0.5) 50%, transparent 100%), radial-gradient(1px 1px at 64% 40%, rgba(255,255,255,0.45) 50%, transparent 100%)',
          }}
        />

        {/* Cosmic bottom glow matching reference */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 right-0 h-80 rounded-full blur-3xl opacity-55"
          style={{
            background:
              'radial-gradient(ellipse at 50% 85%, rgba(124, 58, 237, 0.75) 0%, rgba(79, 70, 229, 0.45) 40%, rgba(16, 185, 129, 0.18) 70%, transparent 100%)',
          }}
        />

        {/* Top Brand + Value Proposition */}
        <div className="relative z-10 max-w-md space-y-6">
          <button
            type="button"
            onClick={() => onBackToHome?.()}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="Back to Veridex Home"
          >
            <div className="w-9 h-9 rounded-xl bg-white text-[#06090f] flex items-center justify-center font-black text-base shadow-md group-hover:scale-105 transition">
              ◈
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">Veridex</span>
          </button>

          <div className="space-y-3 pt-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              {authMode === 'CREATE_ACCOUNT'
                ? 'Create your free account'
                : 'Sign in to Veridex'}
            </h1>
            <p className="text-sm sm:text-[15px] text-[#9ea7b3] leading-relaxed">
              Explore Veridex&apos;s autonomous software escrow &amp; tri-agent verification engine for clients and engineers.
            </p>
          </div>

          {/* Collapsible Feature Checklist */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowFeatures((prev) => !prev)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-[#c9d1d9] transition cursor-pointer"
            >
              <span>See what&apos;s included</span>
              <span
                className={`text-xs transition-transform duration-200 ${
                  showFeatures ? 'rotate-0' : 'rotate-180'
                }`}
              >
                ⌃
              </span>
            </button>

            {showFeatures && (
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <span className="text-[#3fb950] font-bold mt-0.5">✓</span>
                  <div>
                    <div className="font-semibold text-white">Tri-Agent AI Verification</div>
                    <p className="text-xs text-[#9ea7b3] mt-0.5 leading-relaxed">
                      Evidence, Risk, and Arbitrator agents inspect real GitHub commits, PRs, and test suites.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#3fb950] font-bold mt-0.5">✓</span>
                  <div>
                    <div className="font-semibold text-white">Non-Custodial PayPal Escrow</div>
                    <p className="text-xs text-[#9ea7b3] mt-0.5 leading-relaxed">
                      29-day authorization holds with deterministic settlement caps and human fiduciary gates.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#3fb950] font-bold mt-0.5">✓</span>
                  <div>
                    <div className="font-semibold text-white">Integrated Code &amp; Security Audits</div>
                    <p className="text-xs text-[#9ea7b3] mt-0.5 leading-relaxed">
                      Boost delivery confidence with automated vulnerability scans and acceptance criteria checks.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#3fb950] font-bold mt-0.5">✓</span>
                  <div>
                    <div className="font-semibold text-white">Cryptographic Audit Passports</div>
                    <p className="text-xs text-[#9ea7b3] mt-0.5 leading-relaxed">
                      Every milestone transition is sealed in a hash-chained SHA-256 tamper-evident ledger.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#3fb950] font-bold mt-0.5">✓</span>
                  <div>
                    <div className="font-semibold text-white">Role-Separated Workspaces</div>
                    <p className="text-xs text-[#9ea7b3] mt-0.5 leading-relaxed">
                      Dedicated Client contract controls and Developer delivery workspaces with strict separation of duties.
                    </p>
                  </div>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Bottom Floating Cosmic Badges (echoing reference 3D orbs) */}
        <div className="relative z-10 hidden lg:flex items-end justify-center gap-6 pt-12 pb-2">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#a855f7]/80 to-[#4f46e5]/80 border border-white/20 shadow-[0_12px_35px_rgba(139,92,246,0.45)] flex flex-col items-center justify-center backdrop-blur-md -rotate-6 translate-y-2">
            <span className="text-2xl">🤖</span>
            <span className="text-[10px] font-mono text-white/90 mt-1">Tri-Agent</span>
          </div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ec4899]/75 via-[#8b5cf6]/80 to-[#3b82f6]/80 border border-white/25 shadow-[0_14px_45px_rgba(168,85,247,0.5)] flex flex-col items-center justify-center backdrop-blur-md -translate-y-4">
            <span className="text-3xl">🛡️</span>
            <span className="text-[10px] font-mono text-white font-semibold mt-1">SHA-256</span>
          </div>
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#f59e0b]/85 to-[#ea580c]/80 border border-white/20 shadow-[0_12px_35px_rgba(245,158,11,0.4)] flex flex-col items-center justify-center backdrop-blur-md rotate-6 translate-y-1">
            <span className="text-2xl">💳</span>
            <span className="text-[10px] font-mono text-white/95 mt-1">PayPal</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Clean Crisp White Registration / Sign-In Form (Shown FIRST on mobile) */}
      <div className="order-1 lg:order-2 bg-white text-[#1f2328] flex flex-col justify-between px-5 sm:px-12 lg:px-16 py-5 sm:py-8 overflow-y-auto">
        {/* Top bar: mobile brand logo + top-right mode switcher */}
        <div className="flex justify-between lg:justify-end items-center gap-3 text-xs sm:text-sm text-[#59636e]">
          <button
            type="button"
            onClick={() => onBackToHome?.()}
            className="lg:hidden flex items-center gap-2 cursor-pointer"
            title="Back to Veridex Home"
          >
            <span className="w-7 h-7 rounded-lg bg-[#0d1117] text-white flex items-center justify-center font-black text-xs">
              ◈
            </span>
            <span className="font-bold text-sm text-[#1f2328]">Veridex</span>
          </button>

          {authMode === 'CREATE_ACCOUNT' ? (
            <span className="text-right">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('SIGN_IN')}
                className="text-[#1f2328] font-medium underline underline-offset-4 hover:text-[#1f883d] transition cursor-pointer"
              >
                Sign in →
              </button>
            </span>
          ) : (
            <span className="text-right">
              New to Veridex?{' '}
              <button
                type="button"
                onClick={() => switchMode('CREATE_ACCOUNT')}
                className="text-[#1f2328] font-medium underline underline-offset-4 hover:text-[#1f883d] transition cursor-pointer"
              >
                Create an account →
              </button>
            </span>
          )}
        </div>

        {/* Main Centered Form */}
        <div className="w-full max-w-[440px] mx-auto my-6 sm:my-8 space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">
              {authMode === 'CREATE_ACCOUNT' ? 'Sign up for Veridex' : 'Sign in to Veridex'}
            </h2>
            <p className="text-xs text-[#59636e] mt-1">
              {authMode === 'CREATE_ACCOUNT'
                ? 'Register your account first, then sign in with your credentials.'
                : 'Enter your registered email and password to access your workspace.'}
            </p>
          </div>

          {/* Success Banner (after registering) */}
          {successMsg && (
            <div className="p-3.5 rounded-md bg-[#dafbe1] border border-[#4ac26b]/50 text-[#116329] text-xs font-medium leading-relaxed flex items-start gap-2">
              <span className="font-bold">✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-md bg-[#ffebe9] border border-[#ff8182]/60 text-[#cf222e] text-xs font-medium leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Role Selection (only during Registration — server resolves role on Sign In) */}
          {authMode === 'CREATE_ACCOUNT' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#1f2328]">
                Account Role<span className="text-[#cf222e] ml-0.5">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedRole('CLIENT')}
                  className={`px-3 py-2.5 rounded-md border text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedRole === 'CLIENT'
                      ? 'border-[#1f883d] bg-[#dafbe1]/40 text-[#116329] ring-1 ring-[#1f883d]'
                      : 'border-[#d0d7de] bg-white text-[#59636e] hover:bg-[#f6f8fa]'
                  }`}
                >
                  <span>👔</span>
                  <span>Client (Hiring)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('DEVELOPER')}
                  className={`px-3 py-2.5 rounded-md border text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedRole === 'DEVELOPER'
                      ? 'border-[#1f883d] bg-[#dafbe1]/40 text-[#116329] ring-1 ring-[#1f883d]'
                      : 'border-[#d0d7de] bg-white text-[#59636e] hover:bg-[#f6f8fa]'
                  }`}
                >
                  <span>💻</span>
                  <span>Developer (Building)</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="veridex-email" className="block text-sm font-medium text-[#1f2328]">
                Email<span className="text-[#cf222e] ml-0.5">*</span>
              </label>
              <input
                id="veridex-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-3 py-2 text-sm rounded-md border border-[#d0d7de] bg-white text-[#1f2328] placeholder:text-[#8c959f] focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="veridex-password" className="block text-sm font-medium text-[#1f2328]">
                  Password<span className="text-[#cf222e] ml-0.5">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-xs font-medium text-[#0969da] hover:underline cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="veridex-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={authMode === 'CREATE_ACCOUNT' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3 py-2 text-sm rounded-md border border-[#d0d7de] bg-white text-[#1f2328] placeholder:text-[#8c959f] focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
              />
              {authMode === 'CREATE_ACCOUNT' && (
                <p className="text-[11px] text-[#59636e] leading-snug pt-0.5">
                  Password should be at least 15 characters OR at least 8 characters including a number and a lowercase letter.
                </p>
              )}
            </div>

            {/* Username / Full Name (Sign Up only) */}
            {authMode === 'CREATE_ACCOUNT' && (
              <div className="space-y-1">
                <label htmlFor="veridex-username" className="block text-sm font-medium text-[#1f2328]">
                  Username<span className="text-[#cf222e] ml-0.5">*</span>
                </label>
                <input
                  id="veridex-username"
                  type="text"
                  required
                  autoComplete="name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username or Full Name"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#d0d7de] bg-white text-[#1f2328] placeholder:text-[#8c959f] focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
                />
                <p className="text-[11px] text-[#59636e] leading-snug pt-0.5">
                  Username may contain alphanumeric characters, spaces, or single hyphens (min. 2 characters).
                </p>
              </div>
            )}

            {/* Country/Region (Sign Up only) */}
            {authMode === 'CREATE_ACCOUNT' && (
              <div className="space-y-1">
                <label htmlFor="veridex-country" className="block text-sm font-medium text-[#1f2328]">
                  Your Country/Region<span className="text-[#cf222e] ml-0.5">*</span>
                </label>
                <select
                  id="veridex-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#d0d7de] bg-white text-[#1f2328] focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#59636e] leading-snug pt-0.5">
                  For compliance reasons, we&apos;re required to collect country information for contract jurisdiction and PayPal settlement routing.
                </p>
              </div>
            )}

            {/* Email preferences checkbox (Sign Up only) */}
            {authMode === 'CREATE_ACCOUNT' && (
              <div className="space-y-1 pt-0.5">
                <span className="block text-sm font-medium text-[#1f2328]">Email preferences</span>
                <label className="flex items-center gap-2 text-xs text-[#1f2328] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={emailUpdates}
                    onChange={(e) => setEmailUpdates(e.target.checked)}
                    className="w-4 h-4 rounded border-[#d0d7de] text-[#1f883d] focus:ring-[#1f883d]"
                  />
                  <span>Receive occasional product updates and settlement notifications</span>
                </label>
              </div>
            )}

            {/* Primary Green CTA Button (matching GitHub's Create account >) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-md bg-[#1f883d] hover:bg-[#1a7f37] active:bg-[#187733] disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>{authMode === 'CREATE_ACCOUNT' ? 'Creating account...' : 'Signing in...'}</span>
                </>
              ) : authMode === 'CREATE_ACCOUNT' ? (
                <span>Create account &rsaquo;</span>
              ) : (
                <span>Sign in &rsaquo;</span>
              )}
            </button>

            {authMode === 'CREATE_ACCOUNT' && (
              <p className="text-[11px] text-[#59636e] leading-relaxed">
                By creating an account, you agree to the{' '}
                <span className="text-[#0969da] underline cursor-pointer">Terms of Service</span>. For
                more information about Veridex&apos;s fiduciary security practices, see the{' '}
                <span className="text-[#0969da] underline cursor-pointer">Privacy Statement</span>.
              </p>
            )}
          </form>

          {/* Divider + Instant 1-Click Sandbox Access */}
          <div className="pt-2 space-y-3">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-[#d0d7de]" />
              <span className="flex-shrink mx-3 text-xs text-[#59636e]">
                or Instant 1-Click Sandbox Access
              </span>
              <div className="flex-grow border-t border-[#d0d7de]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickSandbox('client_01')}
                className="w-full py-2 px-3 rounded-md border border-[#d0d7de] bg-[#f6f8fa] hover:bg-[#eef1f4] text-[#1f2328] text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                title="Elena Vance (Client)"
              >
                <span>👔</span>
                <span>Elena Vance (Client)</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickSandbox('dev_01')}
                className="w-full py-2 px-3 rounded-md border border-[#d0d7de] bg-[#f6f8fa] hover:bg-[#eef1f4] text-[#1f2328] text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                title="Marcus Chen (Developer)"
              >
                <span>💻</span>
                <span>Marcus Chen (Developer)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="h-4" />
      </div>
      </div>

      {/* Unified Site Footer on Auth Page */}
      <SiteFooter onNavigateAuth={(mode) => switchMode(mode)} variant="subtle" />
    </div>
  );
}
