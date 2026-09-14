import { useState, useEffect, type FormEvent } from 'react';
import { createFileRoute, useNavigate, Link, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});

type Mode = 'signin' | 'signup';
type Role = 'patient' | 'provider';

const roleOptions: { key: Role; label: string; sub: string; icon: string }[] = [
  { key: 'patient', label: 'Patient', sub: 'Manage your health records', icon: 'ri-user-heart-line' },
  { key: 'provider', label: 'Provider', sub: 'Doctors, clinics & care teams', icon: 'ri-stethoscope-line' },
];

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { mode?: string; role?: string };
  const { signIn, signUp, profile, user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>(search.mode === 'signup' ? 'signup' : 'signin');
  const [role, setRole] = useState<Role>(search.role === 'provider' ? 'provider' : 'patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Send them to their portal.
  useEffect(() => {
    if (!loading && user && profile) {
      navigate({ to: profile.role === 'provider' ? '/provider' : '/patient', replace: true });
    }
  }, [loading, user, profile, navigate]);

  const goToPortal = (roleValue: Role) => {
    navigate({ to: roleValue === 'patient' ? '/patient' : '/provider', replace: true });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        setSubmitting(false);
        return;
      }
      const res = await signUp(email, password, role, fullName);
      setSubmitting(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.needsConfirmation) {
        setNotice('Almost there! Check your inbox to confirm your email, then sign in.');
        setMode('signin');
        return;
      }
      goToPortal(role);
    } else {
      const res = await signIn(email, password);
      setSubmitting(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      goToPortal(profile?.role === 'provider' ? 'provider' : 'patient');
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background-50">
      {/* Left — brand hero */}
      <div className="relative lg:w-[52%] min-h-[240px] lg:min-h-screen overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=Abstract%20medical%20healthcare%20digital%20art%20with%20flowing%20emerald%20green%20and%20teal%20gradient%20waves%20forming%20a%20heartbeat%20pulse%20line%2C%20soft%20glowing%20particles%2C%20clean%20modern%20minimal%20aesthetic%2C%20calm%20trustworthy%20atmosphere%2C%20high%20quality%20digital%20render%2C%20no%20text&width=1200&height=1500&seq=carelink-auth-hero&orientation=portrait"
          alt="CareLink healthcare illustration"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/60"></div>

        <div className="relative z-10 flex flex-col justify-between h-full p-8 md:p-12">
          <Link to="/" className="flex items-center gap-3 w-fit">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white">
              <i className="ri-heart-pulse-line text-xl"></i>
            </div>
            <div>
              <p className="font-heading font-bold text-white text-xl leading-none">CareLink</p>
              <p className="text-white/70 text-xs mt-1">Connecting healthcare. Improving lives.</p>
            </div>
          </Link>

          <div className="mt-auto pt-10 hidden lg:block">
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-white leading-tight max-w-md">
              Your health, secure and connected.
            </h1>
            <p className="text-white/85 mt-4 text-sm md:text-base max-w-md leading-relaxed">
              One trusted platform uniting patients and providers — records, appointments, and prescriptions, all in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <p className="text-xs font-semibold text-primary-600 uppercase tracking-widest mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </p>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground-900">
            {mode === 'signin' ? 'Sign in to CareLink' : 'Join CareLink'}
          </h2>
          <p className="text-sm text-foreground-500 mt-2 mb-6">
            {mode === 'signin'
              ? 'Access your health dashboard securely.'
              : 'Pick your role and get started in seconds.'}
          </p>

          {/* Mode switch */}
          <div className="flex items-center gap-1 bg-background-100 rounded-xl p-1 mb-6">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  mode === m ? 'bg-white text-primary-600' : 'text-foreground-500 hover:text-foreground-700'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {notice && (
            <div className="mb-4 p-3.5 rounded-xl bg-secondary-50 border border-secondary-200/50 text-secondary-800 text-sm flex items-start gap-2.5">
              <i className="ri-information-line text-secondary-600 mt-0.5"></i>
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="text-xs font-medium text-foreground-600 mb-1.5 block">I am a…</label>
                  <div className="grid grid-cols-2 gap-3">
                    {roleOptions.map((r) => (
                      <button
                        type="button"
                        key={r.key}
                        onClick={() => setRole(r.key)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          role === r.key
                            ? 'border-primary-400 bg-primary-50'
                            : 'border-background-200 hover:border-primary-200'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          role === r.key ? 'bg-primary-500 text-white' : 'bg-background-100 text-foreground-500'
                        }`}>
                          <i className={`${r.icon} text-base`}></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground-900">{r.label}</p>
                          <p className="text-[10px] text-foreground-400 truncate">{r.sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground-600 mb-1.5 block">Full name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Amara Okafor"
                    className="w-full px-4 py-2.5 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-medium text-foreground-600 mb-1.5 block">Email address</label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground-600 mb-1.5 block">Password</label>
              <input
                type="password"
                name="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
              />
              {mode === 'signup' && (
                <p className="text-[11px] text-foreground-400 mt-1.5">At least 6 characters.</p>
              )}
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-accent-50 border border-accent-200/50 text-accent-800 text-sm flex items-start gap-2.5">
                <i className="ri-error-warning-line text-accent-600 mt-0.5"></i>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting
                ? 'Please wait…'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-foreground-400 mt-6">
            By continuing you agree to CareLink's Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}