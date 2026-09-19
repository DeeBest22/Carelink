import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  auth_id: string | null;
  role: 'patient' | 'provider';
  full_name: string;
  first_name: string | null;
  email: string | null;
  specialty: string | null;
  hospital: string | null;
  insurance: string | null;
  primary_doctor: string | null;
  /** Optional — only present if you've added the avatar_url column to `profiles`. */
  avatar_url?: string | null;

  /* Provider onboarding fields. All optional: they only exist once the
     onboarding migration has been applied, and reading a key that is absent
     tells us the column isn't there yet (see `needsProviderOnboarding`). */
  title?: string | null;
  license_number?: string | null;
  years_experience?: number | null;
  phone?: string | null;
  practice_address?: string | null;
  bio?: string | null;
  languages?: string[] | null;
  consultation_modes?: string[] | null;
  working_days?: string[] | null;
  working_hours?: string | null;
  accepting_patients?: boolean | null;
  onboarding_completed?: boolean | null;
  onboarded_at?: string | null;
}

type Role = 'patient' | 'provider';

interface SignUpResult {
  error?: string;
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  /** Google (or other provider) picture for the signed-in user, if any. */
  avatarUrl: string | null;
  /** True when someone is authenticated (e.g. via Google) but hasn't picked a role yet. */
  needsRoleSelection: boolean;
  /** True when a provider still has to complete the onboarding questionnaire. */
  needsProviderOnboarding: boolean;
  signUp: (email: string, password: string, role: Role, fullName: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<{ error?: string; profile?: Profile | null }>;
  signInWithGoogle: (role?: Role) => Promise<{ error?: string }>;
  completeSocialSignup: (role: Role) => Promise<{ error?: string; profile?: Profile | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* --------------------------- OAuth helpers --------------------------- */

const PENDING_ROLE_KEY = 'carelink-pending-role';

function readPendingRole(): Role | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(PENDING_ROLE_KEY);
    return v === 'patient' || v === 'provider' ? v : null;
  } catch {
    return null;
  }
}

function writePendingRole(role: Role | null) {
  if (typeof window === 'undefined') return;
  try {
    if (role) window.localStorage.setItem(PENDING_ROLE_KEY, role);
    else window.localStorage.removeItem(PENDING_ROLE_KEY);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

type Meta = Record<string, unknown> | undefined;

/** Google returns the picture as `avatar_url` (Supabase-normalised) or `picture` (raw claim). */
function avatarFromUser(user: User | null): string | null {
  const m = user?.user_metadata as Meta;
  const url = (m?.['avatar_url'] ?? m?.['picture']) as string | undefined;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

/** Best-effort display name from provider metadata, falling back to the email handle. */
function nameFromUser(user: User): string {
  const m = user.user_metadata as Meta;
  const candidates = [
    m?.['full_name'],
    m?.['name'],
    [m?.['given_name'], m?.['family_name']].filter(Boolean).join(' ').trim() || undefined,
    user.email?.split('@')[0],
  ];
  const picked = candidates.find((c) => typeof c === 'string' && (c as string).trim().length > 0);
  return ((picked as string) ?? 'CareLink User').trim();
}

/* ---------------------------- Profile I/O ---------------------------- */

async function fetchProfile(userId: string): Promise<{ profile: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Failed to fetch profile:', error.message);
    return { profile: null, error: error.message };
  }
  return { profile: (data as Profile) ?? null, error: null };
}

// The avatar is always readable from auth metadata, so mirroring it into `profiles`
// is purely a convenience (it lets providers see patient pictures and vice versa).
// If the column doesn't exist we disable the sync after the first failure instead of
// letting it break sign-in.
let avatarColumnAvailable = true;

async function syncAvatar(profile: Profile, user: User) {
  if (!avatarColumnAvailable) return;
  const url = avatarFromUser(user);
  if (!url || profile.avatar_url === url) return;
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
  if (error) {
    avatarColumnAvailable = false;
    console.info('Skipping avatar sync — add an `avatar_url` column to `profiles` to enable it.');
  }
}

async function seedPatientData(patientId: string) {
  const { data: doctors } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'provider');
  const byName = (n: string) => doctors?.find((d) => d.full_name === n)?.id;
  const adeyemi = byName('Dr. Chinedu Adeyemi');
  const bello = byName('Dr. Folake Bello');
  const musa = byName('Dr. Ibrahim Musa');
  const records = [
    { title: 'Annual Physical Examination', category: 'Check-up', provider: 'Lakeshore Medical Centre', date: '2026-07-30', summary: 'Comprehensive exam completed. Overall health stable. Recommended lifestyle adjustments for borderline blood sugar.', icon: 'ri-stethoscope-line', grant: adeyemi },
    { title: 'Asthma Management Plan', category: 'Care Plan', provider: 'Dr. Ibrahim Musa', date: '2026-07-30', summary: 'Updated inhaler dosage and trigger-avoidance plan. Seasonal review recommended every 6 months.', icon: 'ri-lungs-line', grant: musa },
    { title: 'Hypertension Diagnosis', category: 'Diagnosis', provider: 'Dr. Folake Bello', date: '2026-06-15', summary: 'Confirmed stage 1 hypertension. Prescribed Amlodipine 5mg and advised low-sodium diet.', icon: 'ri-heart-line', grant: bello },
    { title: 'Vaccination Record', category: 'Immunization', provider: 'Primary Health Centre', date: '2026-02-02', summary: 'Seasonal flu vaccine administered. Booster recommended after 12 months.', icon: 'ri-syringe-line', grant: adeyemi },
  ];
  for (const r of records) {
    const { data: rec } = await supabase
      .from('medical_records')
      .insert({ patient_id: patientId, title: r.title, category: r.category, provider: r.provider, date: r.date, summary: r.summary, icon: r.icon })
      .select('id')
      .maybeSingle();
    if (rec && r.grant) {
      await supabase.from('record_access').insert({ record_id: rec.id, provider_id: r.grant });
    }
  }
  await supabase.from('appointments').insert([
    { patient_id: patientId, doctor_name: 'Dr. Chinedu Adeyemi', specialty: 'General Practitioner', clinic: 'Lakeshore Medical Centre, Lekki', type: 'In-person', date: '2026-09-08', time: '10:30 AM', status: 'upcoming', reason: 'Routine check-up & blood pressure review' },
    { patient_id: patientId, doctor_name: 'Dr. Folake Bello', specialty: 'Cardiologist', clinic: 'Heartbeat Specialist Clinic, Ikeja', type: 'Video', date: '2026-09-15', time: '2:00 PM', status: 'upcoming', reason: 'Hypertension follow-up consultation' },
    { patient_id: patientId, doctor_name: 'Dr. Ibrahim Musa', specialty: 'Pulmonologist', clinic: 'BreatheEasy Lung Centre, Yaba', type: 'In-person', date: '2026-08-21', time: '9:00 AM', status: 'completed', reason: 'Asthma management review' },
  ]);
  await supabase.from('prescriptions').insert([
    { patient_id: patientId, medication: 'Amlodipine', dosage: '5 mg', frequency: 'Once daily', prescribed_by: 'Dr. Folake Bello', start_date: '2026-08-15', end_date: '2026-11-15', status: 'active', refills_left: 2, instructions: 'Take in the morning with water. Avoid grapefruit.' },
    { patient_id: patientId, medication: 'Salbutamol Inhaler', dosage: '100 mcg', frequency: 'As needed', prescribed_by: 'Dr. Ibrahim Musa', start_date: '2026-07-30', end_date: '2027-07-30', status: 'active', refills_left: 5, instructions: '2 puffs when short of breath, max 8 puffs/day.' },
  ]);
}

async function createProfileForUser(userId: string, role: Role, fullName: string, email: string) {
  const firstName = fullName.trim().split(/\s+/)[0] ?? '';
  const normalizedEmail = email.trim().toLowerCase();
  if (role === 'provider') {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('role', 'provider')
      .is('auth_id', null)
      .maybeSingle();
    if (existing) {
      await supabase.from('profiles').update({ auth_id: userId }).eq('id', existing.id);
    } else {
      await supabase.from('profiles').insert({ auth_id: userId, role: 'provider', full_name: fullName.trim(), first_name: firstName, email: normalizedEmail });
    }
    return null;
  }
  const { data: prof, error: perr } = await supabase
    .from('profiles')
    .insert({ auth_id: userId, role: 'patient', full_name: fullName.trim(), first_name: firstName, email: normalizedEmail, insurance: 'AXA Mansard Health', primary_doctor: 'Dr. Chinedu Adeyemi' })
    .select('id')
    .maybeSingle();
  if (perr) return perr.message;
  if (prof) await seedPatientData(prof.id);
  return null;
}

// If a user has an auth account but no profiles row yet, create it now from whatever
// we know about them:
//   - email/password signup -> role + full_name were stored in auth metadata at signup
//   - Google signup         -> role comes from the choice stashed before the OAuth
//                              redirect, and the name comes from the Google profile
// When neither source gives us a role, we leave the profile null and the UI asks the
// person to pick one (see `needsRoleSelection`).
async function ensureProfile(user: User): Promise<{ profile: Profile | null; error: string | null }> {
  const existing = await fetchProfile(user.id);
  if (existing.profile) {
    void syncAvatar(existing.profile, user);
    return existing;
  }
  if (existing.error) return existing;

  const meta = user.user_metadata as { role?: Role; full_name?: string } | undefined;
  const role = meta?.role ?? readPendingRole();
  if (!role) return { profile: null, error: null };

  const fullName = meta?.full_name?.trim() || nameFromUser(user);
  const createErr = await createProfileForUser(user.id, role, fullName, user.email ?? '');
  writePendingRole(null);
  if (createErr) return { profile: null, error: createErr };

  const created = await fetchProfile(user.id);
  if (created.profile) void syncAvatar(created.profile, user);
  return created;
}

/* ------------------------------ Provider ------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      const session = data?.session ?? null;
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfile(session.user).then(({ profile: prof, error: profErr }) => {
          if (mounted) {
            setProfile(prof);
            setProfileError(profErr);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
      if (error) console.error('Failed to restore session:', error.message);
    });
    // Fires on the redirect back from Google too: detectSessionInUrl exchanges the
    // code in the URL for a session, which emits SIGNED_IN here.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      if (mounted) setUser(sessionUser);
      if (sessionUser) {
        ensureProfile(sessionUser).then(({ profile: prof, error: profErr }) => {
          if (mounted) {
            setProfile(prof);
            setProfileError(profErr);
            setLoading(false);
          }
        });
      } else if (mounted) {
        setProfile(null);
        setProfileError(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { profile: prof, error: profErr } = await ensureProfile(user);
    setProfile(prof);
    setProfileError(profErr);
  }, [user]);

  const signUp = useCallback(async (email: string, password: string, role: Role, fullName: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, full_name: fullName.trim() },
        // Without this, the confirmation-email link falls back to whatever Site URL
        // is set in the Supabase dashboard — wrong on every environment but one.
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined,
      },
    });
    if (error) return { error: error.message };
    const newUser = data.user;
    if (!newUser) return { error: 'Unable to complete sign up. Please try again.' };
    // Only create the profile immediately when a session exists (email confirmation disabled).
    // If confirmation is required, ensureProfile() creates it lazily on first sign-in,
    // using the role/full_name stored in user metadata above.
    if (data.session) {
      const createErr = await createProfileForUser(newUser.id, role, fullName, email);
      if (createErr) return { error: createErr };
      setUser(data.session.user);
      const { profile: prof, error: profErr } = await fetchProfile(newUser.id);
      setProfile(prof);
      setProfileError(profErr);
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    setUser(data.user);
    const { profile: prof, error: profErr } = await ensureProfile(data.user);
    setProfile(prof);
    setProfileError(profErr);
    return profErr ? { error: profErr, profile: prof } : { profile: prof };
  }, []);

  // Kicks off the Google redirect. `role` is stashed locally so that when Google sends
  // the person back we know which kind of profile to create for a brand-new account.
  // Returning users already have a profile, so the stash is ignored for them.
  const signInWithGoogle = useCallback(async (role?: Role) => {
    if (typeof window === 'undefined') return { error: 'Google sign-in is only available in the browser.' };
    writePendingRole(role ?? null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      writePendingRole(null);
      return { error: error.message };
    }
    return {};
  }, []);

  // Used by the "one more thing — are you a patient or a provider?" step that a new
  // Google user lands on when they signed in without choosing a role first.
  const completeSocialSignup = useCallback(async (role: Role) => {
    if (!user) return { error: 'You are not signed in.' };
    const createErr = await createProfileForUser(user.id, role, nameFromUser(user), user.email ?? '');
    if (createErr) return { error: createErr };
    writePendingRole(null);
    const { profile: prof, error: profErr } = await fetchProfile(user.id);
    if (prof) void syncAvatar(prof, user);
    setProfile(prof);
    setProfileError(profErr);
    return profErr ? { error: profErr, profile: prof } : { profile: prof };
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    writePendingRole(null);
    setUser(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  const avatarUrl = profile?.avatar_url ?? avatarFromUser(user);
  const needsRoleSelection = !loading && !!user && !profile && !profileError;

  // `select('*')` returns every existing column, so a NULL value still shows up
  // as a key. A missing key therefore means the onboarding migration hasn't been
  // applied — in which case we must not gate anyone, or providers would bounce
  // to an onboarding page that can't save.
  const onboardingTracked = !!profile && 'onboarding_completed' in profile;
  const needsProviderOnboarding =
    !loading && !!profile && profile.role === 'provider' && onboardingTracked && !profile.onboarding_completed;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        avatarUrl,
        needsRoleSelection,
        needsProviderOnboarding,
        signUp,
        signIn,
        signInWithGoogle,
        completeSocialSignup,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}