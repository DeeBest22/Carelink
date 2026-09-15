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
  signUp: (email: string, password: string, role: Role, fullName: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Failed to fetch profile:', error.message);
    return null;
  }
  return (data as Profile) ?? null;
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
// If a user has an auth account but no profiles row yet (e.g. they signed up while
// email confirmation was required, so signUp's immediate profile creation was skipped),
// create it now from the role/full_name stored in their auth metadata at signup time.
async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await fetchProfile(user.id);
  if (existing) return existing;
  const meta = user.user_metadata as { role?: Role; full_name?: string } | undefined;
  if (!meta?.role || !meta?.full_name) return null;
  await createProfileForUser(user.id, meta.role, meta.full_name, user.email ?? '');
  return fetchProfile(user.id);
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      const session = data?.session ?? null;
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfile(session.user).then((prof) => {
          if (mounted) {
            setProfile(prof);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
      if (error) console.error('Failed to restore session:', error.message);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      if (mounted) setUser(sessionUser);
      if (sessionUser) {
        ensureProfile(sessionUser).then((prof) => {
          if (mounted) setProfile(prof);
        });
      } else if (mounted) {
        setProfile(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const signUp = useCallback(async (email: string, password: string, role: Role, fullName: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, full_name: fullName.trim() } },
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
      const prof = await fetchProfile(newUser.id);
      setProfile(prof);
    }
    return { needsConfirmation: !data.session };
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    setUser(data.user);
    const prof = await ensureProfile(data.user);
    setProfile(prof);
    return {};
  }, []);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);
  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
} 