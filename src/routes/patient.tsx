import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { vitalsData, testResults, healthTips } from '@/mocks/data/patient';
import DashboardTopBar from '@/components/feature/DashboardTopBar';
import AuthGuard from '@/components/base/AuthGuard';

export const Route = createFileRoute('/patient')({
  component: () => (
    <AuthGuard role="patient">
      <Patient />
    </AuthGuard>
  ),
});

type Section = 'overview' | 'appointments' | 'records' | 'prescriptions';

const navItems: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
  { key: 'appointments', label: 'Appointments', icon: 'ri-calendar-check-line' },
  { key: 'records', label: 'Medical Records', icon: 'ri-folder-user-line' },
  { key: 'prescriptions', label: 'Prescriptions', icon: 'ri-capsule-line' },
];

const colors = ['bg-primary-100 text-primary-700', 'bg-accent-100 text-accent-700', 'bg-secondary-100 text-secondary-700'];

const apptColors = [
  'bg-primary-100 text-primary-700',
  'bg-accent-100 text-accent-700',
  'bg-secondary-100 text-secondary-700',
  'bg-primary-50 text-primary-700',
];

const doctorColors = [
  'bg-primary-100 text-primary-700',
  'bg-accent-100 text-accent-700',
  'bg-secondary-100 text-secondary-700',
  'bg-primary-50 text-primary-700',
  'bg-accent-50 text-accent-700',
];

const resultStatusConfig: Record<string, { label: string; class: string }> = {
  normal: { label: 'Normal', class: 'bg-primary-50 text-primary-700' },
  high: { label: 'High', class: 'bg-accent-50 text-accent-700' },
  low: { label: 'Low', class: 'bg-secondary-50 text-secondary-700' },
};

const rxStatusConfig: Record<string, { label: string; class: string }> = {
  active: { label: 'Active', class: 'bg-primary-50 text-primary-700' },
  completed: { label: 'Completed', class: 'bg-secondary-50 text-secondary-700' },
  expired: { label: 'Expired', class: 'bg-foreground-100 text-foreground-500' },
};

const heartRateData = [
  { t: 'Mon', v: 68 },
  { t: 'Tue', v: 72 },
  { t: 'Wed', v: 70 },
  { t: 'Thu', v: 74 },
  { t: 'Fri', v: 71 },
  { t: 'Sat', v: 73 },
  { t: 'Sun', v: 72 },
];

function initialsOf(name: string) {
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ------------------------------ Sidebar ------------------------------ */

function Sidebar({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }) {
  const { profile } = useAuth();
  const fullName = profile?.full_name ?? 'Patient';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';
  const sub = profile?.insurance ?? 'Patient Portal';

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-background-200/70">
      <div className="flex items-center gap-2.5 px-6 h-20 border-b border-background-100">
        <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center text-white">
          <i className="ri-heart-pulse-line text-lg"></i>
        </div>
        <div>
          <p className="font-heading font-bold text-foreground-900 leading-none">CareLink</p>
          <p className="text-[10px] text-foreground-400 mt-1">Patient Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="px-3 text-[10px] font-semibold text-foreground-400 uppercase tracking-widest mb-2">Menu</p>
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              section === item.key ? 'bg-primary-50 text-primary-700' : 'text-foreground-500 hover:bg-background-50 hover:text-foreground-800'
            }`}
          >
            <i className={`${item.icon} text-base w-5 h-5 flex items-center justify-center`}></i>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-background-100">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-background-50">
          <div className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-900 truncate">{fullName}</p>
            <p className="text-[11px] text-foreground-400 truncate">{sub}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------ Overview ------------------------------ */

interface Appt {
  id: string;
  doctor: string;
  specialty: string;
  type: string;
  date: string;
  time: string;
  doctorInitials: string;
  doctorColor: string;
}

interface Rx {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  color: string;
}

function OverviewSection({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [prescriptions, setPrescriptions] = useState<Rx[]>([]);

  useEffect(() => {
    if (!profile) return;
    let mounted = true;

    const load = async () => {
      try {
        const { data: appts } = await supabase
          .from('appointments')
          .select('id, doctor_name, specialty, type, date, time, status')
          .eq('patient_id', profile.id)
          .eq('status', 'upcoming')
          .order('date', { ascending: true })
          .limit(3);

        const { data: rx } = await supabase
          .from('prescriptions')
          .select('id, medication, dosage, frequency, status')
          .eq('patient_id', profile.id)
          .eq('status', 'active');

        if (!mounted) return;
        setAppointments(
          (appts ?? []).map((a, i) => ({
            id: a.id,
            doctor: a.doctor_name ?? 'Unknown',
            specialty: a.specialty ?? '',
            type: a.type === 'Video' ? 'Video' : 'In-person',
            date: a.date,
            time: a.time ?? '',
            doctorInitials: initialsOf(a.doctor_name ?? 'Dr'),
            doctorColor: colors[i % colors.length],
          }))
        );
        setPrescriptions(
          (rx ?? []).map((p, i) => ({
            id: p.id,
            medication: p.medication,
            dosage: p.dosage ?? '',
            frequency: p.frequency ?? '',
            color: colors[i % colors.length],
          }))
        );
      } catch {
        // non-blocking: leave lists empty on failure
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [profile]);

  const nextAppointment = appointments[0];
  const firstName = profile?.first_name ?? 'there';
  const initials = (profile?.full_name ?? 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';

  const quickStats = [
    {
      icon: 'ri-calendar-check-line',
      label: 'Next Appointment',
      value: nextAppointment ? new Date(nextAppointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
      sub: nextAppointment ? `${nextAppointment.time} · ${nextAppointment.type}` : 'Nothing scheduled',
      color: 'bg-primary-100 text-primary-600',
    },
    { icon: 'ri-capsule-line', label: 'Active Prescriptions', value: String(prescriptions.length), sub: 'Currently taking', color: 'bg-accent-100 text-accent-600' },
    { icon: 'ri-flask-line', label: 'Pending Results', value: '1', sub: 'Awaiting review', color: 'bg-secondary-100 text-secondary-600' },
    { icon: 'ri-file-chart-line', label: 'Upcoming Tests', value: '1', sub: 'Blood work due', color: 'bg-primary-50 text-primary-600' },
  ];

  const recentResults = testResults.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-500 text-white flex items-center justify-center text-xl font-bold shrink-0">{initials}</div>
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Good morning, {firstName} 👋</h1>
            <p className="text-sm text-foreground-500 mt-0.5">Here's your health at a glance{profile?.primary_doctor ? ` · ${profile.primary_doctor}` : ''}</p>
          </div>
        </div>
        <button onClick={() => onNavigate('appointments')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
          <i className="ri-add-line"></i>
          Book Appointment
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {quickStats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-background-200/60 p-4 md:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`${s.color} w-9 h-9 rounded-xl flex items-center justify-center`}>
                <i className={`${s.icon} text-base`}></i>
              </div>
            </div>
            <p className="text-xs text-foreground-400 font-medium">{s.label}</p>
            <p className="text-lg md:text-xl font-bold text-foreground-900 mt-0.5">{s.value}</p>
            <p className="text-[11px] text-foreground-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-1 grid grid-cols-2 gap-3">
          {vitalsData.map((v) => (
            <div key={v.label} className="bg-white rounded-2xl border border-background-200/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-background-50 flex items-center justify-center">
                  <i className={`${v.icon} text-primary-600 text-sm`}></i>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
              </div>
              <p className="text-[11px] text-foreground-400 font-medium">{v.label}</p>
              <p className="text-lg font-bold text-foreground-900 mt-0.5">
                {v.value} <span className="text-[11px] font-normal text-foreground-400">{v.unit}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-background-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-semibold text-foreground-900">Heart Rate Trend</h3>
              <p className="text-xs text-foreground-400 mt-0.5">Last 7 days · resting average</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium">
              <i className="ri-arrow-up-line text-[10px]"></i>
              Stable
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={heartRateData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(var(--primary-500))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(var(--primary-500))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 80]} tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid oklch(var(--background-200))', fontSize: 12 }} />
                <Area type="monotone" dataKey="v" stroke="oklch(var(--primary-500))" strokeWidth={2.5} fill="url(#hrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="bg-white rounded-2xl border border-background-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-foreground-900">Upcoming Appointments</h3>
            <button onClick={() => onNavigate('appointments')} className="text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer">View all</button>
          </div>
          <div className="space-y-3">
            {appointments.length === 0 && <p className="text-sm text-foreground-400 py-4 text-center">No upcoming appointments.</p>}
            {appointments.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-background-50">
                <div className={`${a.doctorColor} w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0`}>{a.doctorInitials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground-900 truncate">{a.doctor}</p>
                  <p className="text-xs text-foreground-400">{a.specialty}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-foreground-500">
                    <i className="ri-calendar-line text-primary-500"></i>
                    <span>{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {a.time}</span>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${a.type === 'Video' ? 'bg-secondary-50 text-secondary-700' : 'bg-primary-50 text-primary-700'}`}>
                  <i className={a.type === 'Video' ? 'ri-vidicon-line' : 'ri-map-pin-line'}></i>
                  {a.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-background-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-foreground-900">Recent Test Results</h3>
            <button onClick={() => onNavigate('records')} className="text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer">View all</button>
          </div>
          <div className="space-y-3">
            {recentResults.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-background-50">
                <div>
                  <p className="text-sm font-semibold text-foreground-900">{r.testName}</p>
                  <p className="text-[11px] text-foreground-400">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {r.lab}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground-900">{r.result} <span className="text-[10px] font-normal text-foreground-400">{r.unit}</span></p>
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium ${resultStatusConfig[r.status].class}`}>{resultStatusConfig[r.status].label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-background-200/60 p-5">
            <h3 className="font-heading font-semibold text-foreground-900 mb-3">Active Medications</h3>
            <div className="space-y-2.5">
              {prescriptions.length === 0 && <p className="text-sm text-foreground-400">No active medications.</p>}
              {prescriptions.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className={`${p.color} w-8 h-8 rounded-lg flex items-center justify-center shrink-0`}>
                    <i className="ri-capsule-line text-sm"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-900 truncate">{p.medication}</p>
                    <p className="text-[11px] text-foreground-400">{p.dosage} · {p.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white">
            <h3 className="font-heading font-semibold mb-3">Daily Wellness</h3>
            <div className="space-y-3">
              {healthTips.map((tip) => (
                <div key={tip.title} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <i className={`${tip.icon} text-sm`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{tip.title}</p>
                    <p className="text-xs text-white/80">{tip.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Appointments ------------------------------ */

type Filter = 'upcoming' | 'past' | 'cancelled';

const filters: { key: Filter; label: string; icon: string }[] = [
  { key: 'upcoming', label: 'Upcoming', icon: 'ri-calendar-check-line' },
  { key: 'past', label: 'Past', icon: 'ri-history-line' },
  { key: 'cancelled', label: 'Cancelled', icon: 'ri-close-circle-line' },
];

interface Appointment {
  id: string;
  doctor: string;
  specialty: string;
  clinic: string;
  type: 'In-person' | 'Video';
  date: string;
  time: string;
  status: string;
  reason: string;
  doctorInitials: string;
  doctorColor: string;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  clinic: string;
}

function AppointmentsSection() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booked, setBooked] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ doctorId: '', date: '', time: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('id, doctor_name, specialty, clinic, type, date, time, status, reason')
        .eq('patient_id', profile.id)
        .order('date', { ascending: true });

      const { data: docs, error: docErr } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, hospital')
        .eq('role', 'provider')
        .order('full_name', { ascending: true });

      if (apptErr) throw apptErr;
      if (docErr) throw docErr;

      const list = (appts ?? []).map((a, i) => ({
        id: a.id,
        doctor: a.doctor_name ?? 'Unknown',
        specialty: a.specialty ?? '',
        clinic: a.clinic ?? '',
        type: a.type === 'Video' ? 'Video' : 'In-person',
        date: a.date,
        time: a.time ?? '',
        status: a.status ?? 'upcoming',
        reason: a.reason ?? '',
        doctorInitials: initialsOf(a.doctor_name ?? 'Dr'),
        doctorColor: apptColors[i % apptColors.length],
      }));
      setAppointments(list);

      setDoctors(
        (docs ?? []).map((d) => ({
          id: d.id,
          name: d.full_name,
          specialty: d.specialty ?? '',
          clinic: d.hospital ?? '',
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading your appointments.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = appointments.filter((a) => {
    if (filter === 'upcoming') return a.status === 'upcoming';
    if (filter === 'past') return a.status === 'completed';
    return a.status === 'cancelled';
  });

  const openBooking = () => {
    setForm({ doctorId: doctors[0]?.id ?? '', date: '', time: '', reason: '' });
    setSubmitError(null);
    setBooked(false);
    setBookingOpen(true);
  };

  const submitBooking = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    if (!profile) return;
    if (!form.doctorId || !form.date || !form.time) {
      setSubmitError('Please choose a doctor, date, and time.');
      return;
    }
    setSubmitting(true);
    try {
      const doctor = doctors.find((d) => d.id === form.doctorId);
      const { error: insErr } = await supabase.from('appointments').insert({
        patient_id: profile.id,
        provider_id: form.doctorId,
        doctor_name: doctor?.name ?? '',
        specialty: doctor?.specialty ?? '',
        clinic: doctor?.clinic ?? '',
        type: 'In-person',
        date: form.date,
        time: form.time,
        status: 'upcoming',
        reason: form.reason,
      });
      if (insErr) throw insErr;
      setBooked(true);
      await loadData();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not book the appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Appointments</h1>
          <p className="text-sm text-foreground-500 mt-0.5">Manage your visits and consultations.</p>
        </div>
        <button onClick={openBooking} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
          <i className="ri-add-line"></i>
          Book Appointment
        </button>
      </div>

      <div className="flex items-center gap-1 bg-background-100 rounded-xl p-1 w-fit">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filter === f.key ? 'bg-white text-primary-600' : 'text-foreground-500 hover:text-foreground-700'
            }`}
          >
            <i className={f.icon}></i>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-foreground-500">Loading appointments…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-100 flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-accent-600"></i>
          </div>
          <p className="text-sm font-medium text-foreground-600">Couldn't load appointments</p>
          <p className="text-xs text-foreground-400 max-w-sm text-center">{error}</p>
          <button onClick={loadData} className="mt-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-background-200/60 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-background-50 flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] font-medium text-foreground-400 uppercase">{new Date(a.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                <span className="text-xl font-bold text-foreground-900">{new Date(a.date).getDate()}</span>
              </div>

              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`${a.doctorColor} w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0`}>{a.doctorInitials}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground-900">{a.doctor}</p>
                  <p className="text-xs text-foreground-400">{a.specialty} · {a.clinic}</p>
                  <p className="text-xs text-foreground-500 mt-1">{a.reason}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <div className="flex items-center gap-1.5 text-sm text-foreground-600">
                  <i className="ri-time-line text-foreground-400"></i>
                  <span>{a.time}</span>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${a.type === 'Video' ? 'bg-secondary-50 text-secondary-700' : 'bg-primary-50 text-primary-700'}`}>
                  <i className={a.type === 'Video' ? 'ri-vidicon-line' : 'ri-map-pin-line'}></i>
                  {a.type}
                </span>
              </div>

              {a.status === 'upcoming' && (
                <div className="flex items-center gap-2 sm:pl-2">
                  {a.type === 'Video' && (
                    <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap">
                      <i className="ri-vidicon-line"></i>
                      Join
                    </button>
                  )}
                  <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-background-200 text-foreground-500 hover:bg-background-50 cursor-pointer">
                    <i className="ri-more-2-fill"></i>
                  </button>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-background-200/60">
              <div className="w-14 h-14 rounded-2xl bg-background-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-calendar-line text-2xl text-foreground-300"></i>
              </div>
              <p className="text-sm font-medium text-foreground-500">No {filter} appointments</p>
            </div>
          )}
        </div>
      )}

      {bookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBookingOpen(false)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6">
            {!booked ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-heading font-bold text-foreground-900 text-lg">Book an Appointment</h3>
                  <button onClick={() => setBookingOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-50 cursor-pointer">
                    <i className="ri-close-line"></i>
                  </button>
                </div>
                <form onSubmit={submitBooking} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground-600 mb-1.5 block">Doctor</label>
                    <select value={form.doctorId} onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))} className="w-full px-3 py-2.5 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 cursor-pointer">
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground-600 mb-1.5 block">Date</label>
                      <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground-600 mb-1.5 block">Time</label>
                      <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground-600 mb-1.5 block">Reason</label>
                    <textarea rows={3} placeholder="Briefly describe your concern..." value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="w-full px-3 py-2.5 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"></textarea>
                  </div>
                  {submitError && <p className="text-xs text-accent-700 bg-accent-50 border border-accent-200/50 rounded-lg px-3 py-2">{submitError}</p>}
                  <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting ? 'Booking…' : 'Request Appointment'}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-check-double-line text-3xl text-primary-600"></i>
                </div>
                <h3 className="font-heading font-bold text-foreground-900 text-lg">Request Submitted</h3>
                <p className="text-sm text-foreground-500 mt-2">Your appointment request has been sent. You'll be notified once confirmed.</p>
                <button onClick={() => setBookingOpen(false)} className="mt-5 px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Records ------------------------------ */

type Tab = 'results' | 'history';

interface RecordItem {
  id: string;
  title: string;
  category: string;
  provider: string;
  date: string;
  summary: string;
  icon: string;
}

interface CareDoctor {
  id: string;
  name: string;
  role: string;
  clinic: string;
  initials: string;
  color: string;
}

function RecordsSection() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('results');

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [doctors, setDoctors] = useState<CareDoctor[]>([]);
  const [grants, setGrants] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState<RecordItem | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const patientId = profile.id;

      const { data: recs, error: recErr } = await supabase
        .from('medical_records')
        .select('id, title, category, provider, date, summary, icon')
        .eq('patient_id', patientId)
        .order('date', { ascending: false });

      const { data: docs, error: docErr } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, hospital')
        .eq('role', 'provider')
        .order('full_name', { ascending: true });

      if (recErr) throw recErr;
      if (docErr) throw docErr;

      const recordList = (recs ?? []) as RecordItem[];
      setRecords(recordList);

      const doctorList = (docs ?? []).map((d, i) => ({
        id: d.id,
        name: d.full_name,
        role: d.specialty ?? 'Healthcare Provider',
        clinic: d.hospital ?? '',
        initials: initialsOf(d.full_name),
        color: doctorColors[i % doctorColors.length],
      }));
      setDoctors(doctorList);

      if (recordList.length > 0) {
        const recordIds = recordList.map((r) => r.id);
        const { data: accessRows, error: accErr } = await supabase
          .from('record_access')
          .select('record_id, provider_id')
          .in('record_id', recordIds);
        if (accErr) throw accErr;

        const map: Record<string, string[]> = {};
        for (const row of (accessRows ?? [])) {
          (map[row.record_id] ??= []).push(row.provider_id);
        }
        setGrants(map);
      } else {
        setGrants({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading your records.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleGrant = async (recordId: string, providerId: string) => {
    const current = grants[recordId] ?? [];
    const hasAccess = current.includes(providerId);

    setGrants((prev) => {
      const cur = prev[recordId] ?? [];
      return { ...prev, [recordId]: hasAccess ? cur.filter((id) => id !== providerId) : [...cur, providerId] };
    });

    try {
      if (hasAccess) {
        await supabase.from('record_access').delete().eq('record_id', recordId).eq('provider_id', providerId);
      } else {
        await supabase.from('record_access').insert({ record_id: recordId, provider_id: providerId });
      }
    } catch {
      setGrants((prev) => {
        const cur = prev[recordId] ?? [];
        return { ...prev, [recordId]: hasAccess ? [...cur, providerId] : cur.filter((id) => id !== providerId) };
      });
    }
  };

  const sharedNames = (record: RecordItem) => {
    const ids = grants[record.id] ?? [];
    if (ids.length === 0) return null;
    return doctors.filter((p) => ids.includes(p.id)).map((p) => p.name);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Medical Records</h1>
        <p className="text-sm text-foreground-500 mt-0.5">Your complete health history in one secure place.</p>
      </div>

      <div className="flex items-center gap-1 bg-background-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('results')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${tab === 'results' ? 'bg-white text-primary-600' : 'text-foreground-500 hover:text-foreground-700'}`}>
          <i className="ri-flask-line"></i>
          Test Results
        </button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${tab === 'history' ? 'bg-white text-primary-600' : 'text-foreground-500 hover:text-foreground-700'}`}>
          <i className="ri-file-list-3-line"></i>
          Medical History
        </button>
      </div>

      {tab === 'results' ? (
        <div className="bg-white rounded-2xl border border-background-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background-50/80">
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Test</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Result</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Reference Range</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Status</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-100">
                {testResults.map((r) => (
                  <tr key={r.id} className="hover:bg-background-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-foreground-900">{r.testName}</p>
                      <p className="text-[11px] text-foreground-400">{r.category} · {r.lab}</p>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm font-bold text-foreground-900">{r.result} <span className="text-[11px] font-normal text-foreground-400">{r.unit}</span></span></td>
                    <td className="px-5 py-4"><span className="text-sm text-foreground-500">{r.normalRange}</span></td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${resultStatusConfig[r.status].class}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {resultStatusConfig[r.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm text-foreground-600">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-foreground-500">Loading your records…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-100 flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-accent-600"></i>
          </div>
          <p className="text-sm font-medium text-foreground-600">Couldn't load your records</p>
          <p className="text-xs text-foreground-400 max-w-sm text-center">{error}</p>
          <button onClick={loadData} className="mt-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-2 bottom-2 w-px bg-background-200"></div>
          <div className="space-y-4">
            {records.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-background-200/60">
                <i className="ri-file-list-3-line text-3xl text-foreground-300"></i>
                <p className="text-sm text-foreground-500 mt-2">No medical records yet.</p>
              </div>
            )}
            {records.map((r) => {
              const names = sharedNames(r);
              return (
                <div key={r.id} className="relative flex gap-4 pl-0">
                  <div className="relative z-10 w-10 h-10 rounded-full bg-white border-2 border-primary-500 flex items-center justify-center shrink-0">
                    <i className={`${r.icon} text-primary-600`}></i>
                  </div>
                  <div className="flex-1 bg-white rounded-2xl border border-background-200/60 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground-900 text-sm md:text-base">{r.title}</h3>
                        <p className="text-xs text-foreground-400">{r.provider}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary-50 text-secondary-700 text-[11px] font-medium">{r.category}</span>
                        <span className="text-xs text-foreground-400">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground-500 leading-relaxed">{r.summary}</p>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-background-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <i className="ri-shield-check-line text-foreground-300 text-sm"></i>
                        {names ? (
                          <span className="text-xs text-foreground-500">Shared with <strong className="text-foreground-700">{names.join(', ')}</strong></span>
                        ) : (
                          <span className="text-xs text-foreground-400 italic">Not shared with anyone</span>
                        )}
                      </div>
                      <button onClick={() => setManaging(r)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-settings-3-line"></i>
                        Manage access
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {managing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setManaging(null)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-background-100">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground-900">Manage access</h2>
                <p className="text-xs text-foreground-400 mt-0.5">{managing.title}</p>
              </div>
              <button onClick={() => setManaging(null)} className="w-9 h-9 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-500 cursor-pointer transition-colors">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-foreground-500 mb-4">Grant access to this record. Only the people you authorise here can view it.</p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {doctors.map((p) => {
                  const granted = (grants[managing.id] ?? []).includes(p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-background-200/60 hover:border-primary-300 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`${p.color} w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shrink-0`}>{p.initials}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground-900 truncate">{p.name}</p>
                          <p className="text-xs text-foreground-400 truncate">{p.role}{p.clinic ? ` · ${p.clinic}` : ''}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleGrant(managing.id, p.id)} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${granted ? 'bg-primary-500' : 'bg-background-200'}`} aria-label={`Toggle access for ${p.name}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${granted ? 'left-[22px]' : 'left-0.5'}`}></span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-background-50 border-t border-background-100">
              <button onClick={() => setManaging(null)} className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer">Done</button>
            </div>
          </div>
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
          dosage: p.dosage ?? '',
          frequency: p.frequency ?? '',
          prescribedBy: p.prescribed_by ?? '',
          startDate: p.start_date,
          endDate: p.end_date,
          status: p.status ?? 'active',
          refillsLeft: p.refills_left ?? 0,
          instructions: p.instructions ?? '',
          color: colors[i % colors.length],
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading your prescriptions.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const requestRefill = async (p: Prescription) => {
    if (p.refillsLeft <= 0) {
      setRefillToast(`${p.medication} · no refills remaining`);
      setTimeout(() => setRefillToast(null), 2500);
      return;
    }
    const next = Math.max(0, p.refillsLeft - 1);
    setPrescriptions((prev) => prev.map((x) => (x.id === p.id ? { ...x, refillsLeft: next } : x)));
    setRefillToast(p.medication);
    setTimeout(() => setRefillToast(null), 2500);
    try {
      await supabase.from('prescriptions').update({ refills_left: next }).eq('id', p.id);
    } catch {
      setPrescriptions((prev) => prev.map((x) => (x.id === p.id ? { ...x, refillsLeft: p.refillsLeft } : x)));
    }
  };

  const active = prescriptions.filter((p) => p.status === 'active');
  const inactive = prescriptions.filter((p) => p.status !== 'active');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Prescriptions</h1>
          <p className="text-sm text-foreground-500 mt-0.5">Track your medications and refills.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-foreground-500">Loading prescriptions…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-100 flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-accent-600"></i>
          </div>
          <p className="text-sm font-medium text-foreground-600">Couldn't load prescriptions</p>
          <p className="text-xs text-foreground-400 max-w-sm text-center">{error}</p>
          <button onClick={loadData} className="mt-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold text-foreground-600 mb-3 flex items-center gap-2">
              <i className="ri-capsule-line text-primary-600"></i>
              Active Medications ({active.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.length === 0 && <p className="text-sm text-foreground-400 md:col-span-2">No active medications.</p>}
              {active.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-background-200/60 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`${p.color} w-11 h-11 rounded-xl flex items-center justify-center shrink-0`}>
                        <i className="ri-capsule-line text-lg"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground-900">{p.medication}</p>
                        <p className="text-xs text-foreground-400">{p.dosage} · {p.frequency}</p>
                      </div>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium ${rxStatusConfig[p.status]?.class ?? 'bg-foreground-100 text-foreground-500'}`}>{rxStatusConfig[p.status]?.label ?? p.status}</span>
                  </div>

                  <div className="space-y-2 text-xs text-foreground-500">
                    <div className="flex items-center gap-2">
                      <i className="ri-user-line text-foreground-300"></i>
                      <span>Prescribed by {p.prescribedBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className="ri-calendar-line text-foreground-300"></i>
                      <span>{new Date(p.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} → {new Date(p.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {p.instructions && <p className="pt-1 text-foreground-400 italic">{p.instructions}</p>}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-background-100">
                    <span className="text-xs font-medium text-foreground-500">{p.refillsLeft} refills left</span>
                    <button onClick={() => requestRefill(p)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap">
                      <i className="ri-refresh-line"></i>
                      Request Refill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground-600 mb-3 flex items-center gap-2">
              <i className="ri-history-line text-foreground-400"></i>
              Past Medications
            </h2>
            <div className="bg-white rounded-2xl border border-background-200/60 divide-y divide-background-100">
              {inactive.length === 0 && <p className="p-4 text-sm text-foreground-400">No past medications.</p>}
              {inactive.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`${p.color} w-9 h-9 rounded-lg flex items-center justify-center shrink-0`}>
                      <i className="ri-capsule-line text-sm"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground-900">{p.medication}</p>
                      <p className="text-xs text-foreground-400">{p.dosage} · {p.prescribedBy}</p>
                    </div>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium ${rxStatusConfig[p.status]?.class ?? 'bg-foreground-100 text-foreground-500'}`}>{rxStatusConfig[p.status]?.label ?? p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {refillToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-900 text-white px-5 py-3 rounded-xl text-sm font-medium flex items-center gap-2.5">
          <i className="ri-check-double-line text-primary-400"></i>
          Refill requested for {refillToast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Main ------------------------------ */

export default function Patient() {
  const { profile } = useAuth();
  const [section, setSection] = useState<Section>('overview');
  const [menuOpen, setMenuOpen] = useState(false);

  const fullName = profile?.full_name ?? 'Patient';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';

  const go = (s: Section) => {
    setSection(s);
    setMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background-50">
      <Sidebar section={section} onNavigate={go} />

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col">
            <div className="flex items-center justify-between px-6 h-20 border-b border-background-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center text-white">
                  <i className="ri-heart-pulse-line text-lg"></i>
                </div>
                <div>
                  <p className="font-heading font-bold text-foreground-900 leading-none">CareLink</p>
                  <p className="text-[10px] text-foreground-400 mt-1">Patient Portal</p>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-50 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <nav className="flex-1 px-3 py-5 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => go(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    section === item.key ? 'bg-primary-50 text-primary-700' : 'text-foreground-500 hover:bg-background-50'
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
        <main className="flex-1 px-4 md:px-6 py-6">
          {section === 'overview' && <OverviewSection onNavigate={go} />}
          {section === 'appointments' && <AppointmentsSection />}
          {section === 'records' && <RecordsSection />}
          {section === 'prescriptions' && <PrescriptionsSection />}
        </main>
      </div>
    </div>
  );
}