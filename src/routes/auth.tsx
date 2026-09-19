import { useState, useEffect, type FormEvent } from 'react';
import { createFileRoute, useNavigate, Link, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import BrandPanel from '@/components/base/BrandPanel';

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});

/**
 * Photo by Vitaly Gariev on Unsplash (free to use under the Unsplash License).
 * Source: https://unsplash.com/photos/doctor-consulting-patient-via-video-call-on-laptop-c1ZGaJTOnJs
 *
 * Hotlinking works, but for a page this important download it once into
 * src/assets/ and import it like get-started.tsx does — then the panel can't be
 * broken by someone else's CDN.
 */
const AUTH_PANEL_IMAGE =
  'https://images.unsplash.com/photo-1758691462743-f9fc9e430d39?fm=jpg&q=70&w=1400&auto=format&fit=crop';

type Mode = 'signin' | 'signup';
type Role = 'patient' | 'provider';

const roleOptions: { key: Role; label: string; sub: string; icon: string }[] = [
  { key: 'patient', label: 'Patient', sub: 'Manage your health records', icon: 'ri-user-heart-line' },
  { key: 'provider', label: 'Provider', sub: 'Doctors, clinics & care teams', icon: 'ri-stethoscope-line' },
];

const inputClass =
  'w-full rounded-md border border-border bg-card px-3.5 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const labelClass = 'mb-1.5 block text-sm font-semibold text-foreground';

/* Official Google "G" mark — inline so it works offline and matches Google's branding rules. */
function GoogleIcon({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-md border border-border bg-card py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      <GoogleIcon />
      {label}
    </button>
  );
}

function Alert({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  const error = tone === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-md border p-3.5 text-sm ${
        error
          ? 'border-destructive/25 bg-destructive-soft text-destructive'
          : 'border-primary/20 bg-accent text-primary'
      }`}
    >
      <i className={`${error ? 'ri-error-warning-line' : 'ri-information-line'} mt-0.5 shrink-0`} aria-hidden="true"></i>
      <span>{children}</span>
    </div>
  );
}

/** Radio-style role picker, shared by the signup form and the Google completion step. */
function RolePicker({
  value,
  onChange,
  layout = 'grid',
}: {
  value: Role;
  onChange: (r: Role) => void;
  layout?: 'grid' | 'stack';
}) {
  return (
    <div className={layout === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
      {roleOptions.map((r) => {
        const active = value === r.key;
        return (
          <button
            type="button"
            key={r.key}
            onClick={() => onChange(r.key)}
            aria-pressed={active}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 text-left transition-colors ${
              active ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-md ${
                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              <i className={`${r.icon} text-base`} aria-hidden="true"></i>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{r.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
            </span>
            {active && layout === 'stack' && (
              <i className="ri-check-line ml-auto shrink-0 text-primary" aria-hidden="true"></i>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------- Role step for new Google users --------------------- */

function RoleCompletionPanel() {
  const navigate = useNavigate();
  const { user, avatarUrl, completeSocialSignup, signOut } = useAuth();
  const [role, setRole] = useState<Role>('patient');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const displayName = meta.full_name || meta.name || user?.email || 'there';

  const handleContinue = async () => {
    setError(null);
    setSubmitting(true);
    const res = await completeSocialSignup(role);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    navigate({ to: role === 'patient' ? '/patient' : '/provider', replace: true });
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="font-heading text-2xl font-bold md:text-3xl">Welcome, {String(displayName).split(' ')[0]}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        One last thing — tell us how you'll be using CareLink so we can set up the right dashboard.
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-muted p-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground">
            {String(displayName).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="mt-5">
        <RolePicker value={role} onChange={setRole} layout="stack" />
      </div>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={submitting}
        className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting && <i className="ri-loader-4-line animate-spin text-base" aria-hidden="true"></i>}
        {submitting ? 'Setting up your account…' : 'Continue to CareLink'}
      </button>

      <button
        type="button"
        onClick={() => signOut()}
        className="mt-3 w-full cursor-pointer py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Use a different account
      </button>
    </div>
  );
}

/* ------------------------------- Auth page ------------------------------- */

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    mode?: string;
    role?: string;
    error?: string;
    error_description?: string;
  };
  const { signIn, signUp, signInWithGoogle, profile, user, loading, needsRoleSelection } = useAuth();

  const [mode, setMode] = useState<Mode>(search.mode === 'signup' ? 'signup' : 'signin');
  const [role, setRole] = useState<Role>(search.role === 'provider' ? 'provider' : 'patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Surface errors Google/Supabase hand back on the redirect (e.g. access denied).
  useEffect(() => {
    if (search.error_description || search.error) {
      setError(String(search.error_description ?? search.error).replace(/\+/g, ' '));
    }
  }, [search.error, search.error_description]);

  // Already signed in? Send them to their portal.
  useEffect(() => {
    if (!loading && user && profile) {
      navigate({ to: profile.role === 'provider' ? '/provider' : '/patient', replace: true });
    }
  }, [loading, user, profile, navigate]);

  const goToPortal = (roleValue: Role) => {
    navigate({ to: roleValue === 'patient' ? '/patient' : '/provider', replace: true });
  };

  const handleGoogle = async () => {
    setError(null);
    setNotice(null);
    setGoogleLoading(true);
    // On the signup tab the chosen role is carried through the redirect; on the signin
    // tab we don't assume one — a brand-new account is asked to pick after it returns.
    const res = await signInWithGoogle(mode === 'signup' ? role : undefined);
    if (res.error) {
      setGoogleLoading(false);
      setError(res.error);
    }
    // On success the browser navigates away to Google, so leave the spinner running.
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
        setNotice('Almost there — check your inbox to confirm your email, then sign in.');
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
      goToPortal(res.profile?.role === 'provider' ? 'provider' : 'patient');
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-body text-foreground lg:flex-row">
      <BrandPanel
        image={AUTH_PANEL_IMAGE}
        imageAlt="A clinician consulting with a patient over a video call"
        headline="Your health, secure and connected."
        blurb="Records, appointments and prescriptions in one trusted place — shared only with the people you choose, for as long as you choose."
        highlights={[
          { icon: 'ri-lock-2-line', label: 'You control every share' },
          { icon: 'ri-history-line', label: 'Full access history' },
        ]}
      />

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 md:px-12">
        {needsRoleSelection ? (
          <RoleCompletionPanel />
        ) : (
          <div className="w-full max-w-md">
            <h2 className="font-heading text-2xl font-bold md:text-3xl">
              {mode === 'signin' ? 'Sign in to CareLink' : 'Create your CareLink account'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mode === 'signin'
                ? 'Pick up where you left off.'
                : 'Choose your role and you will be in within a minute.'}
            </p>

            {/* Mode switch */}
            <div
              role="tablist"
              aria-label="Sign in or create an account"
              className="mt-6 flex items-center gap-1 rounded-md border border-border bg-muted p-1"
            >
              {(['signin', 'signup'] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 cursor-pointer whitespace-nowrap rounded-sm py-2 text-sm font-semibold transition-colors ${
                    mode === m ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            {notice && (
              <div className="mt-4">
                <Alert tone="info">{notice}</Alert>
              </div>
            )}

            <div className="mt-5">
              <GoogleButton
                label={
                  googleLoading
                    ? 'Redirecting to Google…'
                    : mode === 'signin'
                      ? 'Sign in with Google'
                      : 'Sign up with Google'
                }
                onClick={handleGoogle}
                disabled={googleLoading || submitting}
              />
            </div>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or use email</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <fieldset>
                    <legend className={labelClass}>I am a…</legend>
                    <RolePicker value={role} onChange={setRole} />
                    <p className="mt-2 text-xs text-muted-foreground">This applies to Google sign-up too.</p>
                  </fieldset>

                  <div>
                    <label htmlFor="full_name" className={labelClass}>
                      Full name
                    </label>
                    <input
                      id="full_name"
                      type="text"
                      name="full_name"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Amara Okafor"
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="email" className={labelClass}>
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true"></i>
                  </button>
                </div>
                {mode === 'signup' && <p className="mt-1.5 text-xs text-muted-foreground">At least 6 characters.</p>}
              </div>

              {error && <Alert tone="error">{error}</Alert>}

              <button
                type="submit"
                disabled={submitting || googleLoading}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <i className="ri-loader-4-line animate-spin text-base" aria-hidden="true"></i>}
                {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-sm text-muted-foreground">
              {mode === 'signin' ? (
                <>
                  New to CareLink?{' '}
                  <Link to="/get-started" className="font-semibold text-primary hover:underline">
                    See which portal fits you
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="cursor-pointer font-semibold text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              By continuing you agree to CareLink's Terms and Privacy Policy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}