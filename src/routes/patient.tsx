import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { healthTips } from '@/mocks/data/patient';
import DashboardTopBar from '@/components/feature/DashboardTopBar';
import UserAvatar from '@/components/base/UserAvatar';
import AuthGuard from '@/components/base/AuthGuard';

export const Route = createFileRoute('/patient')({
  component: PatientRoute,
});

// See the matching comment in src/routes/provider.tsx — AuthGuard has to
// wrap the dashboard at the point the router renders it.
function PatientRoute() {
  return (
    <AuthGuard role="patient">
      <Patient />
    </AuthGuard>
  );
}

type Section = 'overview' | 'appointments' | 'records' | 'prescriptions';

const navItems: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
  { key: 'appointments', label: 'Appointments', icon: 'ri-calendar-check-line' },
  { key: 'records', label: 'Medical Records', icon: 'ri-folder-user-line' },
  { key: 'prescriptions', label: 'Prescriptions', icon: 'ri-capsule-line' },
];

const colors = ['bg-accent text-primary'];

const apptColors = ['bg-accent text-primary'];

const doctorColors = ['bg-accent text-primary'];

const resultStatusConfig: Record<string, { label: string; class: string }> = {
  normal: { label: 'In range', class: 'bg-success-soft text-success' },
  high: { label: 'High', class: 'bg-destructive-soft text-destructive' },
  low: { label: 'Low', class: 'bg-warning-soft text-warning' },
};

const rxStatusConfig: Record<string, { label: string; class: string }> = {
  active: { label: 'Active', class: 'bg-success-soft text-success' },
  completed: { label: 'Completed', class: 'bg-muted text-muted-foreground' },
  expired: { label: 'Expired', class: 'bg-muted text-muted-foreground' },
};

interface TestResultRow {
  id: string;
  test_name: string;
  category: string | null;
  result: string | null;
  unit: string | null;
  normal_range: string | null;
  status: string;
  date: string;
  lab: string | null;
  // Present once a provider attaches the lab report through Upload Lab Result.
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

const vitalsMeta: Record<string, { label: string; icon: string }> = {
  heart_rate: { label: 'Heart Rate', icon: 'ri-heart-pulse-line' },
  blood_pressure: { label: 'Blood Pressure', icon: 'ri-drop-line' },
  temperature: { label: 'Temperature', icon: 'ri-temp-hot-line' },
  respiratory_rate: { label: 'Resp. Rate', icon: 'ri-wind-line' },
  oxygen_saturation: { label: 'SpO2', icon: 'ri-lungs-line' },
  blood_glucose: { label: 'Blood Glucose', icon: 'ri-water-flash-line' },
  weight: { label: 'Weight', icon: 'ri-scales-3-line' },
  height: { label: 'Height', icon: 'ri-ruler-line' },
  bmi: { label: 'BMI', icon: 'ri-calculator-line' },
};

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\.\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'DR';

/* ------------------------------ Sidebar ------------------------------ */

function SidebarBrand() {
  return (
    <div className="flex h-20 items-center gap-3 border-b border-border px-6">
      <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
        <i className="ri-heart-pulse-line text-lg"></i>
      </div>
      <div>
        <p className="font-heading text-lg font-bold leading-none text-foreground">CareLink</p>
        <p className="mt-1 text-xs text-muted-foreground">Patient portal</p>
      </div>
    </div>
  );
}

function Sidebar({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }) {
  const { signOut, profile, avatarUrl } = useAuth();
  const fullName = profile?.full_name ?? 'Patient';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';

  return (
    <aside className="sticky top-0 hidden min-h-screen w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <SidebarBrand />

      <nav className="flex-1 px-4 py-6 space-y-1" aria-label="Patient navigation">
        <p className="mb-3 px-3 text-xs font-semibold uppercase text-muted-foreground">Workspace</p>
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
              section === item.key
                ? 'bg-accent text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center gap-3 rounded-md p-2">
          <UserAvatar src={avatarUrl} initials={initials} alt={fullName} className="size-10 shrink-0 rounded-full bg-accent text-sm font-bold text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.primary_doctor ?? 'Patient'}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <i className="ri-logout-box-r-line w-5 text-base"></i>
          Sign out
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------ Overview ------------------------------ */

function OverviewSection({ onNavigate, onUploadRecord }: { onNavigate: (s: Section) => void; onUploadRecord: () => void }) {
  const { profile, avatarUrl } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [results, setResults] = useState<TestResultRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      setLoading(true);
      try {
        const patientId = profile.id;
        const [apptsRes, vitalsRes, resultsRes, rxRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, doctor_name, specialty, clinic, type, date, time, status, reason')
            .eq('patient_id', patientId)
            .order('date', { ascending: true }),
          supabase
            .from('vital_signs')
            .select('*')
            .eq('patient_id', patientId)
            .order('recorded_at', { ascending: false })
            .limit(20),
          supabase
            .from('test_results')
            .select('*')
            .eq('patient_id', patientId)
            .order('date', { ascending: false })
            .limit(10),
          supabase
            .from('prescriptions')
            .select('*')
            .eq('patient_id', patientId)
            .eq('status', 'active'),
        ]);

        if (apptsRes.error) console.error('appointments load error:', apptsRes.error);
        if (vitalsRes.error) console.error('vitals load error:', vitalsRes.error);
        if (resultsRes.error) console.error('test_results load error:', resultsRes.error);
        if (rxRes.error) console.error('prescriptions load error:', rxRes.error);

        setAppointments(apptsRes.data ?? []);
        setVitals(vitalsRes.data ?? []);
        setResults((resultsRes.data ?? []) as TestResultRow[]);
        setPrescriptions(rxRes.data ?? []);
      } catch (e) {
        console.error('Overview load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  const fullName = profile?.full_name ?? 'Patient';
  const firstName = fullName.split(' ')[0] || 'there';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';

  const upcomingAppts = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed');
  const nextAppt = upcomingAppts[0];

  const latestVitalsMap = new Map<string, any>();
  for (const v of vitals) {
    if (!latestVitalsMap.has(v.vital_type)) {
      latestVitalsMap.set(v.vital_type, v);
    }
  }
  const latestVitals = Array.from(latestVitalsMap.values()).slice(0, 4);

  const quickStats = [
    { icon: 'ri-calendar-check-line', label: 'Upcoming Visits', value: String(upcomingAppts.length), sub: nextAppt ? nextAppt.date : 'None', color: 'bg-accent text-primary' },
    { icon: 'ri-capsule-line', label: 'Active Meds', value: String(prescriptions.length), sub: 'Prescriptions', color: 'bg-warning-soft text-warning' },
    { icon: 'ri-heart-pulse-line', label: 'Last Vitals Log', value: vitals[0] ? new Date(vitals[0].recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', sub: 'Recent update', color: 'bg-destructive-soft text-destructive' },
    { icon: 'ri-file-chart-line', label: 'Test Results', value: String(results.length), sub: 'On record', color: 'bg-accent text-primary' },
  ];

  const recentResults = results.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            src={avatarUrl}
            initials={initials}
            alt={fullName}
            className="w-14 h-14 rounded-lg text-xl"
          />
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Good morning, {firstName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Here's your health at a glance{profile?.primary_doctor ? ` · ${profile.primary_doctor}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onUploadRecord} 
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-card border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors cursor-pointer whitespace-nowrap shadow-sm"
          >
            <i className="ri-upload-cloud-2-line text-primary"></i>
            Upload Record
          </button>
          <button onClick={() => onNavigate('appointments')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-add-line"></i>
            Book Appointment
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickStats.map((s) => (
          <article key={s.label} className="rounded-lg border border-border bg-card p-4 md:p-5">
            <div className="mb-5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">{s.label}</span>
              <i className={`${s.icon} shrink-0 text-base text-primary`}></i>
            </div>
            <p className="font-heading text-2xl font-bold text-foreground md:text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-1 grid grid-cols-2 gap-3">
          {latestVitals.length === 0 && (
            <div className="col-span-2 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No vitals logged yet.
            </div>
          )}
          {latestVitals.map((v) => {
            const meta = vitalsMeta[v.vital_type] ?? { label: v.vital_type, icon: 'ri-pulse-line' };
            return (
              <div key={v.id} className="rounded-lg border border-border bg-card p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-md bg-accent text-primary flex items-center justify-center">
                    <i className={`${meta.icon} text-sm`}></i>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-foreground leading-none">
                    {v.value} <span className="text-xs font-normal text-muted-foreground">{v.unit}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{meta.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-foreground text-base">Heart Rate Trend</h3>
              <p className="text-xs text-muted-foreground">Recent readings</p>
            </div>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={vitals
                  .filter((v) => v.vital_type === 'heart_rate')
                  .slice(0, 7)
                  .reverse()
                  .map((v) => ({
                    date: new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    bpm: Number(v.value) || 0,
                  }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--foreground)', borderRadius: '8px', border: 'none', color: 'var(--background)', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--background)' }}
                />
                <Area type="monotone" dataKey="bpm" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#hrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-foreground text-base">Upcoming Appointments</h3>
            <button onClick={() => onNavigate('appointments')} className="text-xs font-medium text-primary hover:text-primary cursor-pointer">View all</button>
          </div>
          <div className="space-y-3">
            {upcomingAppts.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No upcoming appointments scheduled.</p>
            )}
            {upcomingAppts.slice(0, 2).map((a, i) => {
              const provName = a.doctor_name || 'Doctor';
              return (
                <div key={a.id} className="p-4 rounded-md border border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`${apptColors[i % apptColors.length]} w-11 h-11 rounded-md flex items-center justify-center font-bold text-sm shrink-0`}>
                      {initialsOf(provName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{provName}</p>
                      <p className="text-xs text-muted-foreground">{a.specialty || a.type} · {a.reason || 'General Visit'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-foreground">{a.date}</p>
                    <p className="text-[11px] text-muted-foreground">{a.time || ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-foreground text-base">Recent Test Results</h3>
            <button onClick={() => onNavigate('records')} className="text-xs font-medium text-primary hover:text-primary cursor-pointer">View all</button>
          </div>
          <div className="space-y-2.5">
            {recentResults.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No recent test results found.</p>
            )}
            {recentResults.map((r) => (
              <div key={r.id} className="p-3.5 rounded-md border border-border flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.test_name}</p>
                  <p className="text-xs text-muted-foreground">{r.category ?? 'Diagnostic'} · {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{r.result ?? '—'} <span className="text-[11px] font-normal text-muted-foreground">{r.unit ?? ''}</span></p>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium mt-0.5 ${resultStatusConfig[r.status]?.class ?? 'bg-muted text-muted-foreground'}`}>
                    {resultStatusConfig[r.status]?.label ?? r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-accent/55 p-5">
        <div className="flex items-start gap-3">
          <i className="ri-lightbulb-line mt-0.5 shrink-0 text-lg text-primary"></i>
          <div>
            <h2 className="font-heading text-sm font-bold text-foreground">Today's health tip</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {healthTips[Math.floor(Math.random() * healthTips.length)]?.tip || 'Stay hydrated and aim for at least 30 minutes of physical activity today.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Appointments ------------------------------ */

interface DoctorProfile {
  id: string;
  full_name: string;
  specialty: string | null;
  hospital: string | null;
}

interface AppointmentRow {
  id: string;
  provider_id: string;
  doctor_name: string | null;
  specialty: string | null;
  clinic: string | null;
  date: string;
  time: string | null;
  type: string;
  status: string;
  reason: string | null;
}

const APPT_TYPES = [
  'In-Person Consultation',
  'Video Consultation',
  'Follow-Up',
  'Routine Checkup',
  'Specialist Review',
];

const TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
];

function AppointmentsSection() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedType, setSelectedType] = useState(APPT_TYPES[0]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [apptsRes, docsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, provider_id, doctor_name, specialty, clinic, date, time, type, status, reason')
          .eq('patient_id', profile.id)
          .order('date', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, specialty, hospital')
          .eq('role', 'provider')
          .order('full_name', { ascending: true }),
      ]);

      if (apptsRes.error) throw apptsRes.error;
      if (docsRes.error) throw docsRes.error;

      setAppointments((apptsRes.data ?? []) as AppointmentRow[]);
      const docList = (docsRes.data ?? []) as DoctorProfile[];
      setDoctors(docList);
      if (docList.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [profile, selectedDoctorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBook = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!selectedDoctorId) {
      setFormError('Please select a doctor.');
      return;
    }
    if (!selectedDate) {
      setFormError('Please choose a date.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const chosenDoctor = doctors.find((d) => d.id === selectedDoctorId);
      const combinedReason = [reason.trim(), notes.trim()].filter(Boolean).join(' — ') || null;

      const { error: insertErr } = await supabase.from('appointments').insert({
        patient_id: profile.id,
        provider_id: selectedDoctorId,
        doctor_name: chosenDoctor?.full_name ?? null,
        specialty: chosenDoctor?.specialty ?? null,
        clinic: chosenDoctor?.hospital ?? null,
        date: selectedDate,
        time: selectedTime || null,
        type: selectedType,
        status: 'upcoming',
        reason: combinedReason,
      });

      if (insertErr) throw insertErr;

      setBooking(false);
      setSelectedDate('');
      setSelectedTime('');
      setReason('');
      setNotes('');
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not schedule appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const { error: updErr } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (updErr) throw updErr;
      setCancelModalId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not cancel appointment.');
    } finally {
      setCancellingId(null);
    }
  };
const todayStr = new Date().toISOString().split('T')[0];
const upcoming = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed');
const past = appointments.filter((a) => a.status === 'cancelled' || a.status === 'completed');


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your upcoming visits and consultations.</p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setBooking(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <i className="ri-add-line"></i>
          Book Appointment
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-muted-foreground">Loading appointments…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-base font-bold text-foreground mb-3">Upcoming ({upcoming.length})</h2>
            <div className="space-y-3">
              {upcoming.length === 0 && (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  No upcoming appointments scheduled.
                </div>
              )}
              {upcoming.map((a, i) => {
                const provName = a.doctor_name ?? 'Doctor';

                return (
                  <div key={a.id} className="rounded-lg border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`${apptColors[i % apptColors.length]} w-12 h-12 rounded-md flex items-center justify-center font-bold text-sm shrink-0`}>
                        {initialsOf(provName)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground text-base">{provName}</h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-accent text-primary text-xs font-medium">{a.type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.specialty ?? 'General Practice'}{a.clinic ? ` · ${a.clinic}` : ''}</p>
                        {a.reason && <p className="text-xs text-muted-foreground mt-2"><strong>Reason:</strong> {a.reason}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-bold text-foreground">{a.appointment_date}</p>
                        <p className="text-xs text-muted-foreground">{a.start_time ?? 'Time TBD'}</p>
                      </div>
                      <button
                        onClick={() => setCancelModalId(a.id)}
                        className="text-xs text-destructive hover:text-destructive font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-heading text-base font-bold text-foreground mb-3">Past & Cancelled</h2>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {past.length === 0 && <p className="p-4 text-sm text-muted-foreground">No past visits on record.</p>}
              {past.map((a) => {
              const provName = a.doctor_name ?? 'Doctor';
                return (
                  <div key={a.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{provName} <span className="text-xs font-normal text-muted-foreground">({a.type})</span></p>
                      <p className="text-xs text-muted-foreground">{a.appointment_date} {a.start_time ? `· ${a.start_time}` : ''}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${a.status === 'cancelled' ? 'bg-destructive-soft text-destructive' : 'bg-muted text-muted-foreground'}`}>
                      {a.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setBooking(false)}></div>
          <div className="relative bg-card rounded-lg w-full max-w-lg overflow-hidden animate-scale-in shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="font-heading text-lg font-bold text-foreground">Book an Appointment</h2>
              <button onClick={() => setBooking(false)} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleBook} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-destructive-soft text-destructive text-xs rounded-md flex items-center gap-2">
                  <i className="ri-error-warning-line text-base shrink-0"></i>
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Select Doctor *</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary bg-card"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.specialty ?? 'General'}{d.hospital ? ` - ${d.hospital}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Appointment Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary bg-card"
                >
                  {APPT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Time Slot</label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary bg-card"
                  >
                    <option value="">Choose slot...</option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Reason for Visit</label>
                <input
                  type="text"
                  placeholder="e.g. Follow-up consultation or routine review"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  placeholder="Any symptoms, concerns, or previous history..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setBooking(false)}
                  className="w-1/2 py-2.5 rounded-md bg-muted text-muted-foreground text-sm font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Booking...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setCancelModalId(null)}></div>
          <div className="relative bg-card rounded-lg w-full max-w-sm p-6 space-y-4 animate-scale-in text-center shadow-xl">
            <div className="w-12 h-12 rounded-lg bg-destructive-soft text-destructive mx-auto flex items-center justify-center text-2xl">
              <i className="ri-calendar-close-line"></i>
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">Cancel Appointment?</h3>
              <p className="text-xs text-muted-foreground mt-1">Are you sure you want to cancel this appointment?</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCancelModalId(null)} className="flex-1 py-2 rounded-md bg-muted text-foreground text-xs font-semibold hover:bg-muted">
                Keep
              </button>
              <button
                disabled={cancellingId === cancelModalId}
                onClick={() => handleCancel(cancelModalId)}
                className="flex-1 py-2 rounded-md bg-destructive text-primary-foreground text-xs font-semibold hover:bg-destructive/90 disabled:opacity-50"
              >
                {cancellingId === cancelModalId ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Records & Access Control ------------------------------ */

type Tab = 'records' | 'results';

interface RecordFile {
  id: string;
  record_id: string;
  file_path: string;
  /** Legacy rows created before signed URLs; optional. */
  file_url?: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
}

interface AccessGrant {
  id: string;
  record_id: string;
  doctor_id: string;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  status: 'active' | 'expired' | 'revoked';
}

interface MedicalRecordItem {
  id: string;
  name: string;
  description: string;
  category: 'Lab Result' | 'Prescription' | 'Imaging' | 'Vaccination' | 'Other';
  record_date: string;
  created_at: string;
  files?: RecordFile[];
  grants?: AccessGrant[];
}

interface CareDoctor {
  id: string;
  name: string;
  role: string;
  clinic: string;
  initials: string;
  color: string;
}

const categoryIcons: Record<string, string> = {
  'Lab Result': 'ri-flask-line',
  'Prescription': 'ri-capsule-line',
  'Imaging': 'ri-scan-2-line',
  'Vaccination': 'ri-syringe-line',
  'Other': 'ri-file-text-line',
};

function RecordsSection({
  openUploadOnMount = false,
  onUploadClosed,
}: {
  openUploadOnMount?: boolean;
  onUploadClosed?: () => void;
}) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('records');

  const [records, setRecords] = useState<MedicalRecordItem[]>([]);
  const [doctors, setDoctors] = useState<CareDoctor[]>([]);
  const [results, setResults] = useState<TestResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(openUploadOnMount);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordItem | null>(null);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<MedicalRecordItem['category']>('Lab Result');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [accessDurationHours, setAccessDurationHours] = useState('24');
  const [granting, setGranting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const openFile = async (file: RecordFile) => {
    // Legacy rows may still carry a public URL instead of a storage path.
    if (!file.file_path && file.file_url) {
      window.open(file.file_url, '_blank', 'noopener');
      return;
    }
    const { data, error: signErr } = await supabase.storage
      .from('medical-records')
      .createSignedUrl(file.file_path, 60);

    if (signErr || !data) {
      console.error('Signed URL error:', signErr);
      showToast('Could not open file.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const openResultFile = async (result: TestResultRow) => {
    if (!result.file_path) return;
    const { data, error: signErr } = await supabase.storage
      .from('medical-records')
      .createSignedUrl(result.file_path, 60);

    if (signErr || !data) {
      console.error('Signed URL error:', signErr);
      showToast('Could not open the lab report.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const patientId = profile.id;

      const { data: recs, error: recErr } = await supabase
        .from('medical_records')
        .select('*, record_files(*), access_grants(*)')
        .eq('patient_id', patientId)
        .order('record_date', { ascending: false });

      const { data: docs, error: docErr } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, hospital')
        .eq('role', 'provider')
        .order('full_name', { ascending: true });

      const { data: resRows, error: resErr } = await supabase
        .from('test_results')
        .select('*')
        .eq('patient_id', patientId)
        .order('date', { ascending: false });

      if (recErr) throw recErr;
      if (docErr) throw docErr;
      if (resErr) throw resErr;

      setRecords(
        (recs ?? []).map((r: any) => ({
          ...r,
          files: r.record_files || [],
          grants: r.access_grants || [],
        }))
      );
      setResults((resRows ?? []) as TestResultRow[]);

      const doctorList = (docs ?? []).map((d: any, i: number) => ({
        id: d.id,
        name: d.full_name,
        role: d.specialty ?? 'Healthcare Provider',
        clinic: d.hospital ?? '',
        initials: initialsOf(d.full_name),
        color: doctorColors[i % doctorColors.length],
      }));
      setDoctors(doctorList);
      if (doctorList.length > 0) setSelectedDoctorId(doctorList[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading records.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const chosen = Array.from(e.target.files);
    if (formFiles.length + chosen.length > 3) {
      setUploadError('You can attach up to 3 files only.');
      return;
    }
    for (const f of chosen) {
      if (f.size > 10 * 1024 * 1024) {
        setUploadError(`File ${f.name} exceeds the 10MB limit.`);
        return;
      }
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) {
        setUploadError(`File ${f.name} format is not supported (PDF, JPG, PNG only).`);
        return;
      }
    }
    setUploadError(null);
    setFormFiles((prev) => [...prev, ...chosen].slice(0, 3));
  };

const handleCreateRecord = async (e: FormEvent) => {
  e.preventDefault();
  if (!profile) return;
  if (!formName.trim() || !formDesc.trim()) {
    setUploadError('Record Name and Description are required.');
    return;
  }
  setUploading(true);
  setUploadError(null);

  const uploadedPaths: string[] = [];

  try {
    // 1. Upload to storage FIRST — nothing is written to the DB if this fails
    const staged: Array<{ path: string; file: File }> = [];
    for (const file of formFiles) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${profile.id}/${crypto.randomUUID()}-${cleanName}`;

      const { error: storageErr } = await supabase.storage
        .from('medical-records')
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (storageErr) throw new Error(`Upload failed for ${file.name}: ${storageErr.message}`);
      uploadedPaths.push(filePath);
      staged.push({ path: filePath, file });
    }

    // 2. Create the record
    const { data: newRecord, error: recErr } = await supabase
      .from('medical_records')
      .insert({
        patient_id: profile.id,
        name: formName.trim(),
        description: formDesc.trim(),
        category: formCategory,
        record_date: formDate,
      })
      .select()
      .single();
    if (recErr) throw recErr;

    // 3. Insert file rows — .select() forces an RLS read check, so a missing
    //    SELECT policy throws here instead of silently returning [] later
    if (staged.length > 0) {
      const { data: inserted, error: fileErr } = await supabase
        .from('record_files')
        .insert(
          staged.map(({ path, file }) => ({
            record_id: newRecord.id,
            file_path: path,
            file_name: file.name,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size,
          }))
        )
        .select();

      if (fileErr) {
        await supabase.from('medical_records').delete().eq('id', newRecord.id);
        throw new Error(`Saved the upload but could not link it: ${fileErr.message}`);
      }
      if (!inserted || inserted.length !== staged.length) {
        throw new Error('Files were written but cannot be read back — check RLS SELECT policy on record_files.');
      }
    }

    setShowUploadModal(false);
    onUploadClosed?.();
    setFormName('');
    setFormDesc('');
    setFormFiles([]);
    showToast('Medical record uploaded successfully.');
    await loadData();
  } catch (err: any) {
    // clean up orphaned objects so retries don't pile up in the bucket
    if (uploadedPaths.length) {
      await supabase.storage.from('medical-records').remove(uploadedPaths);
    }
    console.error('Record upload failed:', err);
    setUploadError(err.message || 'Failed to upload record.');
  } finally {
    setUploading(false);
  }
};

  const handleGrantAccess = async () => {
    if (!selectedRecord || !selectedDoctorId) return;
    setGranting(true);
    try {
      const hours = parseInt(accessDurationHours, 10);
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      const { data, error: grantErr } = await supabase
        .from('access_grants')
        .insert({
          record_id: selectedRecord.id,
          doctor_id: selectedDoctorId,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (grantErr) throw grantErr;

      const doc = doctors.find((d) => d.id === selectedDoctorId);
      showToast(`Access granted to Dr. ${doc?.name || ''} for ${hours} hours.`);

      await loadData();
      setSelectedRecord((prev) =>
        prev ? { ...prev, grants: [...(prev.grants || []), data] } : null
      );
    } catch (e: any) {
      alert(e.message || 'Failed to grant access');
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeAccess = async (grantId: string) => {
    try {
      const { error: revErr } = await supabase
        .from('access_grants')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', grantId);

      if (revErr) throw revErr;

      showToast('Access revoked.');
      await loadData();
      setSelectedRecord((prev) =>
        prev
          ? {
              ...prev,
              grants: (prev.grants || []).map((g) =>
                g.id === grantId ? { ...g, revoked_at: new Date().toISOString(), status: 'revoked' } : g
              ),
            }
          : null
      );
    } catch (e: any) {
      alert(e.message || 'Failed to revoke access');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Medical Records</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your health history and grant time-limited doctor access.</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <i className="ri-upload-cloud-2-line"></i>
          Upload Record
        </button>
      </div>

      <div className="flex items-center gap-1 bg-muted rounded-md p-1 w-fit">
        <button
          onClick={() => setTab('records')}
          className={`px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'records' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="ri-folder-user-line"></i>
          Uploaded Records ({records.length})
        </button>
        <button
          onClick={() => setTab('results')}
          className={`px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'results' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="ri-flask-line"></i>
          Lab Test Results ({results.length})
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-muted-foreground">Loading records…</p>
        </div>
      ) : tab === 'records' ? (
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="text-center py-16 rounded-lg border border-border bg-card">
              <i className="ri-file-cloud-line text-4xl text-muted-foreground"></i>
              <p className="text-sm font-semibold text-foreground mt-2">No uploaded records yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click "Upload Record" above to store your medical files.</p>
            </div>
          ) : (
            records.map((r) => {
              const activeCount = (r.grants || []).filter(
                (g) => g.status === 'active' && !g.revoked_at && new Date(g.expires_at) > new Date()
              ).length;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRecord(r)}
                  className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-md bg-accent text-primary flex items-center justify-center text-xl shrink-0">
                      <i className={categoryIcons[r.category] || 'ri-file-text-line'}></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-base">{r.name}</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-warning-soft text-warning text-xs font-medium">{r.category}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Record Date: {new Date(r.record_date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    {(r.files?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs">
                        <i className="ri-attachment-2 text-primary"></i>
                        {r.files?.length} file{r.files?.length === 1 ? '' : 's'}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${activeCount > 0 ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <i className="ri-shield-keyhole-line"></i>
                      {activeCount > 0 ? `${activeCount} doctor(s) access` : 'Private'}
                    </span>
                    <i className="ri-arrow-right-s-line text-muted-foreground text-lg"></i>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Test</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Result</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Reference Range</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Date</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">No test results yet.</td>
                  </tr>
                )}
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-muted transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-foreground">{r.test_name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.category ?? ''}{r.lab ? ` · ${r.lab}` : ''}</p>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm font-bold text-foreground">{r.result ?? '—'} <span className="text-[11px] font-normal text-muted-foreground">{r.unit ?? ''}</span></span></td>
                    <td className="px-5 py-4"><span className="text-sm text-muted-foreground">{r.normal_range ?? '—'}</span></td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${resultStatusConfig[r.status]?.class ?? 'bg-muted text-muted-foreground'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {resultStatusConfig[r.status]?.label ?? r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm text-muted-foreground">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></td>
                    <td className="px-5 py-4">
                      {r.file_path ? (
                        <button
                          onClick={() => openResultFile(r)}
                          title={r.file_name ?? 'Lab report'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-primary text-xs font-medium hover:bg-accent transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-file-text-line"></i>
                          View
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL: Upload Record Form --- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => { setShowUploadModal(false); onUploadClosed?.(); }}></div>
          <div className="relative bg-card rounded-lg w-full max-w-lg overflow-hidden shadow-xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="font-heading text-lg font-bold text-foreground">Upload Medical Record</h2>
              <button onClick={() => { setShowUploadModal(false); onUploadClosed?.(); }} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {uploadError && (
                <div className="p-3 bg-destructive-soft text-destructive text-xs rounded-md flex items-center gap-2">
                  <i className="ri-error-warning-line text-base shrink-0"></i>
                  {uploadError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Record Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complete Blood Count / Chest X-Ray"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Notes, symptoms, or doctor summary..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary bg-card"
                  >
                    <option value="Lab Result">Lab Result</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Imaging">Imaging</option>
                    <option value="Vaccination">Vaccination</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Record Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Attach Files (Max 3: PDF, JPG, PNG)</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleFileChange}
                  className="w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-primary hover:file:bg-accent"
                />
                {formFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-muted px-3 py-1.5 rounded-md text-muted-foreground">
                        <span className="truncate max-w-[80%]">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); onUploadClosed?.(); }}
                  className="w-1/2 py-2.5 rounded-md bg-muted text-muted-foreground text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-1/2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Record Detail & Access Panel --- */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setSelectedRecord(null)}></div>
          <div className="relative bg-card rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{selectedRecord.category}</span>
                <h2 className="font-heading text-lg font-bold text-foreground">{selectedRecord.name}</h2>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="bg-muted p-4 rounded-md space-y-2">
                <p className="text-xs text-muted-foreground">
                  Record Date: <span className="font-medium text-foreground">{selectedRecord.record_date}</span> · Uploaded on: <span className="font-medium text-foreground">{new Date(selectedRecord.created_at).toLocaleDateString()}</span>
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedRecord.description}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Attached Documents ({(selectedRecord.files || []).length})</h4>
                {(selectedRecord.files || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No files attached to this record.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedRecord.files?.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => openFile(file)}
                        className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted transition-colors text-left w-full"
                      >
                        <i className={`text-xl text-primary ${file.file_type.includes('pdf') ? 'ri-file-pdf-line' : 'ri-image-line'}`}></i>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{file.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">{(file.file_size / 1024).toFixed(0)} KB</p>
                        </div>
                        <i className="ri-download-line text-muted-foreground hover:text-foreground"></i>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-5">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <i className="ri-shield-user-line text-primary"></i>
                  Doctor Access Control
                </h4>
                <p className="text-xs text-muted-foreground mb-4">Grant access for a specific duration. Access will automatically revoke once the timer expires.</p>

                <div className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-accent rounded-md border border-primary/25 mb-4">
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full sm:w-1/2 px-3 py-2 bg-card rounded-md border border-border text-xs"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.role})
                      </option>
                    ))}
                  </select>

                  <select
                    value={accessDurationHours}
                    onChange={(e) => setAccessDurationHours(e.target.value)}
                    className="w-full sm:w-1/3 px-3 py-2 bg-card rounded-md border border-border text-xs"
                  >
                    <option value="1">1 Hour</option>
                    <option value="24">24 Hours (1 Day)</option>
                    <option value="72">3 Days</option>
                    <option value="168">7 Days (1 Week)</option>
                    <option value="720">30 Days</option>
                  </select>

                  <button
                    onClick={handleGrantAccess}
                    disabled={granting || !selectedDoctorId}
                    className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {granting ? 'Granting...' : 'Grant Access'}
                  </button>
                </div>

                <div className="space-y-2">
                  <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Access History</h5>
                  {(selectedRecord.grants || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No doctor access granted yet.</p>
                  ) : (
                    selectedRecord.grants?.map((g) => {
                      const doc = doctors.find((d) => d.id === g.doctor_id);
                      const isExpired = new Date(g.expires_at) < new Date();
                      const isRevoked = Boolean(g.revoked_at);
                      const isActive = !isExpired && !isRevoked;

                      return (
                        <div key={g.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-accent text-primary flex items-center justify-center font-bold text-xs">
                              {doc?.initials || 'DR'}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{doc?.name || 'Healthcare Provider'}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {isActive && `Expires: ${new Date(g.expires_at).toLocaleString()}`}
                                {isExpired && !isRevoked && `Expired on ${new Date(g.expires_at).toLocaleDateString()}`}
                                {isRevoked && `Revoked early on ${new Date(g.revoked_at!).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isActive ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {isActive ? 'Active' : isRevoked ? 'Revoked' : 'Expired'}
                            </span>
                            {isActive && (
                              <button
                                onClick={() => handleRevokeAccess(g.id)}
                                className="px-2.5 py-1 text-[11px] font-medium text-destructive bg-destructive-soft hover:bg-destructive-soft/70 rounded-md transition-colors cursor-pointer"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted border-t border-border flex justify-end">
              <button onClick={() => setSelectedRecord(null)} className="px-5 py-2 rounded-md bg-foreground text-primary-foreground text-xs font-semibold hover:bg-foreground/90 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-primary-foreground px-5 py-2.5 rounded-md text-xs font-medium flex items-center gap-2 shadow-lg">
          <i className="ri-checkbox-circle-fill text-primary"></i>
          {toastMsg}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Prescriptions ------------------------------ */

interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  startDate: string;
  endDate: string;
  status: string;
  refillsLeft: number;
  instructions: string;
  color: string;
}

function PrescriptionsSection() {
  const { profile } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refillToast, setRefillToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('prescriptions')
        .select('id, medication, dosage, frequency, prescribed_by, start_date, end_date, status, refills_left, instructions')
        .eq('patient_id', profile.id)
        .order('start_date', { ascending: false });
      if (err) throw err;

      setPrescriptions(
        (data ?? []).map((p, i) => ({
          id: p.id,
          medication: p.medication,
          dosage: p.dosage,
          frequency: p.frequency,
          prescribedBy: p.prescribed_by ?? 'Healthcare Provider',
          startDate: p.start_date,
          endDate: p.end_date,
          status: p.status,
          refillsLeft: p.refills_left ?? 0,
          instructions: p.instructions ?? 'Take as prescribed by your doctor.',
          color: colors[i % colors.length],
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prescriptions.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const requestRefill = (medicationName: string) => {
    setRefillToast(medicationName);
    setTimeout(() => setRefillToast(null), 3000);
  };

  const active = prescriptions.filter((p) => p.status === 'active');
  const inactive = prescriptions.filter((p) => p.status !== 'active');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Prescriptions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track your active medications, dosage instructions, and refills.</p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-muted-foreground">Loading prescriptions…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h2 className="font-heading text-base font-bold text-foreground">Active Medications ({active.length})</h2>
            {active.length === 0 && (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No active medications.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-card p-5 flex flex-col justify-between space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`${p.color} w-11 h-11 rounded-md flex items-center justify-center shrink-0`}>
                        <i className="ri-capsule-line text-lg"></i>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-base">{p.medication}</h3>
                        <p className="text-xs text-muted-foreground">{p.dosage} · {p.frequency}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${rxStatusConfig[p.status]?.class ?? 'bg-muted text-muted-foreground'}`}>
                      {rxStatusConfig[p.status]?.label ?? p.status}
                    </span>
                  </div>

                  <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground leading-relaxed">
                    <p><strong>Instructions:</strong> {p.instructions}</p>
                    <p className="text-muted-foreground mt-1">Prescribed by {p.prescribedBy} · Refills left: {p.refillsLeft}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">Ends: {p.endDate}</span>
                    <button
                      onClick={() => requestRefill(p.medication)}
                      className="px-3.5 py-1.5 rounded-md bg-accent text-primary hover:bg-accent text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Request Refill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="font-heading text-base font-bold text-foreground">Past Medications</h2>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {inactive.length === 0 && <p className="p-4 text-sm text-muted-foreground">No past medications.</p>}
              {inactive.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`${p.color} w-9 h-9 rounded-md flex items-center justify-center shrink-0`}>
                      <i className="ri-capsule-line text-sm"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.medication}</p>
                      <p className="text-xs text-muted-foreground">{p.dosage} · {p.prescribedBy}</p>
                    </div>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-medium ${rxStatusConfig[p.status]?.class ?? 'bg-muted text-muted-foreground'}`}>
                    {rxStatusConfig[p.status]?.label ?? p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {refillToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-primary-foreground px-5 py-3 rounded-md text-sm font-medium flex items-center gap-2.5">
          <i className="ri-check-double-line text-primary"></i>
          Refill requested for {refillToast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Main ------------------------------ */

function Patient() {
  const { profile } = useAuth();
  const [section, setSection] = useState<Section>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openUploadModalOnRecords, setOpenUploadModalOnRecords] = useState(false);

  const handleUploadFromOverview = () => {
    setOpenUploadModalOnRecords(true);
    setSection('records');
  };

  const fullName = profile?.full_name ?? 'Patient';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';

  const go = (s: Section) => {
    setSection(s);
    setMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background font-body text-foreground">
      <Sidebar section={section} onNavigate={go} />

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-overlay" onClick={() => setMenuOpen(false)}></div>
          <div className="absolute bottom-0 left-0 top-0 flex w-64 flex-col bg-card shadow-2xl">
            <div className="relative">
              <SidebarBrand />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className="absolute right-4 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
            <nav className="flex-1 px-4 py-5 space-y-1" aria-label="Patient navigation">
              <p className="mb-3 px-3 text-xs font-semibold uppercase text-muted-foreground">Workspace</p>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => go(item.key)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
                    section === item.key ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <i className={`${item.icon} text-base w-5 h-5 flex items-center justify-center`}></i>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardTopBar name={fullName} roleLabel="Patient" initials={initials} onMenuClick={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 md:px-8 md:py-9">
          {section === 'overview' && <OverviewSection onNavigate={go} onUploadRecord={handleUploadFromOverview} />}
          {section === 'appointments' && <AppointmentsSection />}
          {section === 'records' && <RecordsSection openUploadOnMount={openUploadModalOnRecords} onUploadClosed={() => setOpenUploadModalOnRecords(false)} />}
          {section === 'prescriptions' && <PrescriptionsSection />}
        </main>
      </div>
    </div>
  );
}