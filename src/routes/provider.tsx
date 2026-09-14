import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { quickActions } from '@/mocks/data/provider';
import DashboardTopBar from '@/components/feature/DashboardTopBar';

export const Route = createFileRoute('/provider')({
  component: Provider,
});

type Section = 'overview' | 'patients' | 'appointments';

const navItems: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
  { key: 'patients', label: 'Patients', icon: 'ri-user-heart-line' },
  { key: 'appointments', label: 'Appointments', icon: 'ri-calendar-check-line' },
];

const colors = [
  'bg-primary-100 text-primary-700',
  'bg-accent-100 text-accent-700',
  'bg-secondary-100 text-secondary-700',
  'bg-primary-50 text-primary-700',
  'bg-accent-50 text-accent-700',
  'bg-secondary-50 text-secondary-700',
];

const scheduleStatus: Record<string, { class: string; dot: string }> = {
  completed: { class: 'bg-primary-50 text-primary-700', dot: 'bg-primary-500' },
  upcoming: { class: 'bg-secondary-50 text-secondary-700', dot: 'bg-secondary-500' },
  cancelled: { class: 'bg-foreground-100 text-foreground-500', dot: 'bg-foreground-300' },
};

const patientStatus: Record<string, { label: string; class: string }> = {
  stable: { label: 'Stable', class: 'bg-primary-50 text-primary-700' },
  review: { label: 'Needs Review', class: 'bg-accent-50 text-accent-700' },
  critical: { label: 'Critical', class: 'bg-red-50 text-red-700' },
};

const appointmentStatus: Record<string, { label: string; class: string }> = {
  completed: { label: 'Completed', class: 'bg-primary-50 text-primary-700' },
  upcoming: { label: 'Confirmed', class: 'bg-secondary-50 text-secondary-700' },
  cancelled: { label: 'Cancelled', class: 'bg-foreground-100 text-foreground-500' },
};

const dayFilters: { key: string; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: 'ri-calendar-line' },
  { key: 'upcoming', label: 'Upcoming', icon: 'ri-calendar-check-line' },
  { key: 'all', label: 'All', icon: 'ri-list-check-2' },
];

const patientFilters: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'stable', label: 'Stable' },
  { key: 'review', label: 'Needs Review' },
  { key: 'critical', label: 'Critical' },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ------------------------------ Sidebar ------------------------------ */

function Sidebar({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }) {
  const { profile } = useAuth();
  const fullName = profile?.full_name ?? 'Provider';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';
  const sub = profile?.specialty ?? 'Provider Portal';

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-background-200/70">
      <div className="flex items-center gap-2.5 px-6 h-20 border-b border-background-100">
        <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center text-white">
          <i className="ri-heart-pulse-line text-lg"></i>
        </div>
        <div>
          <p className="font-heading font-bold text-foreground-900 leading-none">CareLink</p>
          <p className="text-[10px] text-foreground-400 mt-1">Provider Portal</p>
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

interface Slot {
  id: string;
  time: string;
  patientName: string;
  initials: string;
  reason: string;
  type: string;
  status: string;
  color: string;
}

interface PatientRow {
  id: string;
  full_name: string;
  initials: string;
  color: string;
  age: number | null;
  gender: string | null;
  condition: string | null;
  last_visit: string | null;
  status: string | null;
}

function OverviewSection({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { profile } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [pendingResults, setPendingResults] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [onlineConsults, setOnlineConsults] = useState(0);
  const [weeklyVisits, setWeeklyVisits] = useState<{ day: string; visits: number }[]>([]);
  const [activeModal, setActiveModal] = useState<'prescription' | 'appointment' | 'labResult' | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [apptsRes, patsRes, pendingRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, patient_id, type, date, time, status, reason')
          .eq('provider_id', profile.id)
          .order('date', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, age, gender, condition, last_visit, status')
          .eq('role', 'patient')
          .order('full_name', { ascending: true }),
        supabase.from('test_results').select('id', { count: 'exact', head: true }).neq('status', 'normal'),
      ]);

      const allAppts = (apptsRes.data ?? []) as { id: string; patient_id: string | null; type: string | null; date: string; time: string | null; status: string | null; reason: string | null }[];
      const pats = (patsRes.data ?? []) as { id: string; full_name: string; age: number | null; gender: string | null; condition: string | null; last_visit: string | null; status: string | null }[];

      const nameMap: Record<string, string> = {};
      for (const p of pats) nameMap[p.id] = p.full_name;

      setSlots(
        allAppts
          .filter((a) => a.status === 'upcoming')
          .slice(0, 6)
          .map((a, i) => {
            const patientName = a.patient_id ? nameMap[a.patient_id] ?? 'Patient' : 'Patient';
            return {
              id: a.id,
              time: a.time ?? '',
              patientName,
              initials: initialsOf(patientName),
              reason: a.reason ?? '',
              type: a.type === 'Video' ? 'Video' : 'In-person',
              status: a.status ?? 'upcoming',
              color: colors[i % colors.length],
            };
          })
      );

      setPatients(
        pats.slice(0, 5).map((p, i) => ({
          id: p.id,
          full_name: p.full_name,
          initials: initialsOf(p.full_name),
          color: colors[i % colors.length],
          age: p.age,
          gender: p.gender,
          condition: p.condition,
          last_visit: p.last_visit,
          status: p.status,
        }))
      );

      setTotalPatients(pats.length);
      setTodayCount(allAppts.filter((a) => a.date === todayStr).length);
      setOnlineConsults(allAppts.filter((a) => a.type === 'Video' && a.status === 'upcoming').length);
      setPendingResults(pendingRes.count ?? 0);
      setWeeklyVisits(weeklyVisitsFrom(allAppts));
    } catch {
      // non-blocking: leave empty on failure
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const firstName = profile?.first_name ?? 'Doctor';
  const specialty = profile?.specialty ?? 'Healthcare Provider';
  const hospital = profile?.hospital ?? '';

  const handleQuickAction = (label: string) => {
    if (label === 'New Prescription') setActiveModal('prescription');
    else if (label === 'Schedule Appointment') setActiveModal('appointment');
    else if (label === 'Upload Lab Result') setActiveModal('labResult');
    else onNavigate('appointments');
  };

  const patientStats = [
    { label: 'Total Patients', value: String(totalPatients), change: 'In your network', icon: 'ri-user-heart-line', color: 'bg-primary-100 text-primary-600' },
    { label: "Today's Appointments", value: String(todayCount), change: 'Scheduled', icon: 'ri-calendar-check-line', color: 'bg-accent-100 text-accent-600' },
    { label: 'Pending Results', value: String(pendingResults), change: 'Awaiting review', icon: 'ri-flask-line', color: 'bg-secondary-100 text-secondary-600' },
    { label: 'Online Consults', value: String(onlineConsults), change: 'Upcoming', icon: 'ri-vidicon-line', color: 'bg-primary-50 text-primary-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-500 text-white flex items-center justify-center text-xl font-bold shrink-0">
            {initialsOf(profile?.full_name ?? 'Dr')}
          </div>
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Welcome back, {firstName} 👋</h1>
            <p className="text-sm text-foreground-500 mt-0.5">{specialty}{hospital ? ` · ${hospital}` : ''}</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('appointments')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-calendar-event-line"></i>
          View Schedule
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {patientStats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-background-200/60 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`${s.color} w-9 h-9 rounded-xl flex items-center justify-center`}>
                <i className={`${s.icon} text-base`}></i>
              </div>
            </div>
            <p className="text-xs text-foreground-400 font-medium">{s.label}</p>
            <p className="text-xl md:text-2xl font-bold text-foreground-900 mt-0.5">{s.value}</p>
            <p className="text-[11px] text-foreground-400 mt-0.5">{s.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={() => handleQuickAction(a.label)}
            className="flex items-center gap-3 bg-white rounded-2xl border border-background-200/60 p-4 hover:border-primary-300 hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <div className={`${a.color} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}>
              <i className={`${a.icon} text-lg`}></i>
            </div>
            <span className="text-sm font-semibold text-foreground-800 text-left whitespace-nowrap">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-background-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-semibold text-foreground-900">Upcoming Appointments</h3>
              <p className="text-xs text-foreground-400 mt-0.5">{slots.length} scheduled</p>
            </div>
            <button onClick={() => onNavigate('appointments')} className="text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer">Full schedule</button>
          </div>
          <div className="space-y-2.5">
            {slots.length === 0 && <p className="text-sm text-foreground-400 py-6 text-center">No appointments scheduled yet.</p>}
            {slots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-3 p-3 rounded-xl bg-background-50 hover:bg-background-100/60 transition-colors">
                <div className="w-16 shrink-0"><p className="text-xs font-semibold text-foreground-800">{slot.time}</p></div>
                <div className={`${slot.color} w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`}>{slot.initials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground-900 truncate">{slot.patientName}</p>
                  <p className="text-[11px] text-foreground-400 truncate">{slot.reason}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${scheduleStatus[slot.status]?.class ?? 'bg-foreground-100 text-foreground-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${scheduleStatus[slot.status]?.dot ?? 'bg-foreground-300'}`}></span>
                  {slot.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-background-200/60 p-5">
          <h3 className="font-heading font-semibold text-foreground-900 mb-1">Weekly Visits</h3>
          <p className="text-xs text-foreground-400 mb-4">Patient visits this week</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVisits} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'oklch(var(--foreground-400))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid oklch(var(--background-200))', fontSize: 12 }} cursor={{ fill: 'oklch(var(--background-100))' }} />
                <Bar dataKey="visits" fill="oklch(var(--primary-500))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-background-200/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-foreground-900">Recent Patients</h3>
          <button onClick={() => onNavigate('patients')} className="text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer">View all patients</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-background-50/80">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Patient</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Condition</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Last Visit</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-foreground-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-background-100">
              {patients.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-foreground-400">No patients in your network yet.</td></tr>
              )}
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-background-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`${p.color} w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`}>{p.initials}</div>
                      <div>
                        <p className="text-sm font-semibold text-foreground-900">{p.full_name}</p>
                        <p className="text-[11px] text-foreground-400">{p.age} · {p.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-foreground-600">{p.condition ?? '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-foreground-600">{p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium ${patientStatus[p.status ?? 'stable']?.class ?? 'bg-primary-50 text-primary-700'}`}>
                      {patientStatus[p.status ?? 'stable']?.label ?? 'Stable'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeModal === 'prescription' && (
        <PrescriptionModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); loadData(); }} />
      )}
      {activeModal === 'appointment' && (
        <AppointmentModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); loadData(); }} />
      )}
      {activeModal === 'labResult' && (
        <LabResultModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); loadData(); }} />
      )}
    </div>
  );
}

/* ------------------------------ Appointments ------------------------------ */

interface ScheduleSlot {
  id: string;
  time: string;
  patientName: string;
  initials: string;
  reason: string;
  type: string;
  status: string;
  date: string;
  color: string;
}

function AppointmentsSection() {
  const { profile } = useAuth();
  const [dayFilter, setDayFilter] = useState('today');
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apptModalOpen, setApptModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data: appts, error: err } = await supabase
        .from('appointments')
        .select('id, patient_id, doctor_name, type, date, time, status, reason')
        .eq('provider_id', profile.id)
        .order('date', { ascending: true });
      if (err) throw err;

      const rows = (appts ?? []) as { id: string; patient_id: string | null; doctor_name: string | null; type: string | null; date: string; time: string | null; status: string | null; reason: string | null }[];

      const patientIds = Array.from(new Set(rows.map((r) => r.patient_id).filter(Boolean))) as string[];
      let nameMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', patientIds);
        for (const p of (profs ?? [])) nameMap[p.id] = p.full_name;
      }

      setSlots(
        rows.map((a, i) => {
          const patientName = a.patient_id ? nameMap[a.patient_id] ?? 'Patient' : 'Patient';
          return {
            id: a.id,
            time: a.time ?? '',
            patientName,
            initials: initialsOf(patientName),
            reason: a.reason ?? '',
            type: a.type === 'Video' ? 'Video' : 'In-person',
            status: a.status ?? 'upcoming',
            date: a.date,
            color: colors[i % colors.length],
          };
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading your schedule.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = slots.filter((s) => {
    if (dayFilter === 'upcoming') return s.status === 'upcoming';
    if (dayFilter === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      return s.date === today;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Appointments</h1>
          <p className="text-sm text-foreground-500 mt-0.5">Manage your daily schedule and consultations.</p>
        </div>
        <button onClick={() => setApptModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
          <i className="ri-calendar-event-line"></i>
          New Appointment
        </button>
      </div>

      <div className="flex items-center gap-1 bg-background-100 rounded-xl p-1 w-fit">
        {dayFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setDayFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              dayFilter === f.key ? 'bg-white text-primary-600' : 'text-foreground-500 hover:text-foreground-700'
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
          <p className="text-sm text-foreground-500">Loading schedule…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-100 flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-accent-600"></i>
          </div>
          <p className="text-sm font-medium text-foreground-600">Couldn't load your schedule</p>
          <p className="text-xs text-foreground-400 max-w-sm text-center">{error}</p>
          <button onClick={loadData} className="mt-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-background-200/60 p-5">
          <div className="space-y-3">
            {filtered.map((slot) => (
              <div key={slot.id} className="flex items-center gap-4 p-4 rounded-xl bg-background-50 hover:bg-background-100/60 transition-colors">
                <div className="w-20 shrink-0 text-center"><p className="text-sm font-bold text-foreground-900">{slot.time}</p></div>
                <div className="hidden sm:block w-px h-10 bg-background-200"></div>
                <div className={`${slot.color} w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0`}>{slot.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground-900 truncate">{slot.patientName}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${slot.type === 'Video' ? 'bg-secondary-50 text-secondary-700' : 'bg-primary-50 text-primary-700'}`}>
                      <i className={slot.type === 'Video' ? 'ri-vidicon-line' : 'ri-map-pin-line'}></i>
                      {slot.type}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-400 truncate">{slot.reason}</p>
                </div>
                <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium ${appointmentStatus[slot.status]?.class ?? 'bg-foreground-100 text-foreground-500'}`}>
                  {appointmentStatus[slot.status]?.label ?? slot.status}
                </span>
                <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-background-200 text-foreground-500 hover:bg-white cursor-pointer shrink-0">
                  <i className="ri-more-2-fill"></i>
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-background-100 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-calendar-line text-2xl text-foreground-300"></i>
                </div>
                <p className="text-sm font-medium text-foreground-500">No appointments</p>
              </div>
            )}
          </div>
        </div>
      )}

      {apptModalOpen && (
        <AppointmentModal onClose={() => setApptModalOpen(false)} onSaved={() => { setApptModalOpen(false); loadData(); }} />
      )}
    </div>
  );
}

/* ------------------------------ Patients ------------------------------ */

interface PatientCard {
  id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  blood_type: string | null;
  condition: string | null;
  last_visit: string | null;
  next_appointment: string | null;
  status: string | null;
  initials: string;
  color: string;
}

interface RecordItem {
  id: string;
  patient_id: string;
  title: string;
  category: string;
  provider: string;
  date: string;
  summary: string;
  icon: string;
}

function PatientsSection() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activePatient, setActivePatient] = useState<PatientCard | null>(null);

  const [patients, setPatients] = useState<PatientCard[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data: pats, error: patErr } = await supabase
        .from('profiles')
        .select('id, full_name, age, gender, blood_type, condition, last_visit, next_appointment, status')
        .eq('role', 'patient')
        .order('full_name', { ascending: true });

      const { data: recs, error: recErr } = await supabase
        .from('medical_records')
        .select('id, patient_id, title, category, provider, date, summary, icon')
        .order('date', { ascending: false });

      if (patErr) throw patErr;
      if (recErr) throw recErr;

      setPatients(
        (pats ?? []).map((p, i) => ({
          id: p.id,
          full_name: p.full_name,
          age: p.age,
          gender: p.gender,
          blood_type: p.blood_type,
          condition: p.condition,
          last_visit: p.last_visit,
          next_appointment: p.next_appointment,
          status: p.status,
          initials: initialsOf(p.full_name),
          color: colors[i % colors.length],
        }))
      );
      setRecords((recs ?? []) as RecordItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading your patients.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = patients.filter((p) => {
    const matchesQuery = !query.trim() || p.full_name.toLowerCase().includes(query.toLowerCase()) || (p.condition ?? '').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (p.status ?? '') === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const recordsFor = (patientId: string) => records.filter((r) => r.patient_id === patientId);
  const activeRecords = activePatient ? recordsFor(activePatient.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Patients</h1>
          <p className="text-sm text-foreground-500 mt-0.5">{patients.length} patients in your network.</p>
        </div>
        <button onClick={() => setAddPatientOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
          <i className="ri-user-add-line"></i>
          Add Patient
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            type="text"
            placeholder="Search by name or condition..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-background-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
          />
        </div>
        <div className="flex items-center gap-1 bg-background-100 rounded-xl p-1 w-fit">
          {patientFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === f.key ? 'bg-white text-primary-600' : 'text-foreground-500 hover:text-foreground-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-foreground-500">Loading patients…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-background-200/60 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-100 flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-accent-600"></i>
          </div>
          <p className="text-sm font-medium text-foreground-600">Couldn't load patients</p>
          <p className="text-xs text-foreground-400 max-w-sm text-center">{error}</p>
          <button onClick={loadData} className="mt-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const accessible = recordsFor(p.id).length;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-background-200/60 p-5 hover:border-primary-300 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`${p.color} w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0`}>{p.initials}</div>
                    <div>
                      <p className="font-semibold text-foreground-900">{p.full_name}</p>
                      <p className="text-xs text-foreground-400">{p.age} yrs · {p.gender} · {p.blood_type}</p>
                    </div>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium ${patientStatus[p.status ?? 'stable']?.class ?? 'bg-primary-50 text-primary-700'}`}>
                    {patientStatus[p.status ?? 'stable']?.label ?? 'Stable'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <i className="ri-stethoscope-line text-foreground-300"></i>
                    <span className="text-foreground-700 font-medium">{p.condition ?? 'No condition on file'}</span>
                  </div>
                  {p.last_visit && (
                    <div className="flex items-center gap-2 text-xs text-foreground-500">
                      <i className="ri-history-line text-foreground-300"></i>
                      <span>Last visit: {new Date(p.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                  {p.next_appointment && (
                    <div className="flex items-center gap-2 text-xs text-foreground-500">
                      <i className="ri-calendar-check-line text-foreground-300"></i>
                      <span>Next: {new Date(p.next_appointment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-foreground-500">
                    <i className="ri-shield-check-line text-foreground-300"></i>
                    <span>{accessible} record{accessible === 1 ? '' : 's'} shared with you</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-background-100">
                  <button onClick={() => setActivePatient(p)} className="flex-1 py-2 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 cursor-pointer whitespace-nowrap">View Records</button>
                  <button className="flex-1 py-2 rounded-lg bg-background-50 text-foreground-600 text-xs font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Message</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-background-200/60">
          <div className="w-14 h-14 rounded-2xl bg-background-100 flex items-center justify-center mx-auto mb-3">
            <i className="ri-user-search-line text-2xl text-foreground-300"></i>
          </div>
          <p className="text-sm font-medium text-foreground-500">No patients found</p>
          <p className="text-xs text-foreground-400 mt-1">Try adjusting your search or filter</p>
        </div>
      )}

      {activePatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActivePatient(null)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-background-100">
              <div className="flex items-center gap-3">
                <div className={`${activePatient.color} w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0`}>{activePatient.initials}</div>
                <div>
                  <h2 className="font-heading text-lg font-bold text-foreground-900">{activePatient.full_name}</h2>
                  <p className="text-xs text-foreground-400">Medical records · consent-based access</p>
                </div>
              </div>
              <button onClick={() => setActivePatient(null)} className="w-9 h-9 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-500 cursor-pointer transition-colors">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="px-6 py-4 bg-background-50 border-b border-background-100">
              <div className="flex items-center gap-2 text-sm">
                <i className="ri-shield-check-line text-primary-600"></i>
                <span className="text-foreground-700">You have access to <strong>{activeRecords.length}</strong> record{activeRecords.length === 1 ? '' : 's'}.</span>
              </div>
              <p className="text-xs text-foreground-400 mt-1 ml-6">Only records this patient has shared with you are shown here.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {activeRecords.length === 0 && (
                <div className="text-center py-12">
                  <i className="ri-lock-line text-3xl text-foreground-300"></i>
                  <p className="text-sm text-foreground-500 mt-2">This patient hasn't shared any records with you yet.</p>
                </div>
              )}
              {activeRecords.map((r) => (
                <div key={r.id} className="rounded-xl border border-background-200/60 p-4 bg-white">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary-50 text-primary-600">
                      <i className={r.icon}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <h3 className="font-semibold text-sm text-foreground-900">{r.title}</h3>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[10px] font-medium">
                            <i className="ri-check-line"></i> Access granted
                          </span>
                          <span className="text-[11px] text-foreground-400">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <p className="text-xs text-foreground-400 mt-0.5">{r.category} · {r.provider}</p>
                      <p className="text-sm text-foreground-600 leading-relaxed mt-2">{r.summary}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {addPatientOpen && (
        <AddPatientModal onClose={() => setAddPatientOpen(false)} onSaved={() => { setAddPatientOpen(false); loadData(); }} />
      )}
    </div>
  );
}

/* ------------------------------ Provider Modals ------------------------------ */

function weeklyVisitsFrom(appts: { date: string }[]) {
  const today = new Date();
  const day = (today.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - day);
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const counts = new Array(7).fill(0);
  for (const a of appts) {
    const d = new Date(a.date);
    const diff = Math.floor((d.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff < 7) counts[diff] += 1;
  }
  return labels.map((label, i) => ({ day: label, visits: counts[i] }));
}

async function fetchPatientOptions(): Promise<{ id: string; full_name: string }[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'patient')
    .order('full_name', { ascending: true });
  return (data ?? []) as { id: string; full_name: string }[];
}

const modalInputClass =
  'w-full px-3 py-2.5 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all';
const modalLabelClass = 'text-xs font-medium text-foreground-600 mb-1.5 block';

function PrescriptionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({ patientId: '', medication: '', dosage: '', frequency: '', instructions: '', refills: '0', startDate: '', endDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatientOptions().then(setPatients).catch(() => setPatients([]));
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!form.patientId || !form.medication.trim()) {
      setError('Select a patient and enter a medication name.');
      return;
    }
    setSubmitting(true);
    const { error: insErr } = await supabase.from('prescriptions').insert({
      patient_id: form.patientId,
      medication: form.medication.trim(),
      dosage: form.dosage.trim() || null,
      frequency: form.frequency.trim() || null,
      prescribed_by: profile?.full_name ?? 'Provider',
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      status: 'active',
      refills_left: parseInt(form.refills, 10) || 0,
      instructions: form.instructions.trim() || null,
    });
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-bold text-foreground-900 text-lg">New Prescription</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-50 cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={modalLabelClass}>Patient</label>
            <select value={form.patientId} onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))} className={`${modalInputClass} cursor-pointer`}>
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={modalLabelClass}>Medication</label>
            <input type="text" value={form.medication} onChange={(e) => setForm((f) => ({ ...f, medication: e.target.value }))} placeholder="e.g. Amlodipine" className={modalInputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalLabelClass}>Dosage</label>
              <input type="text" value={form.dosage} onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))} placeholder="e.g. 5 mg" className={modalInputClass} />
            </div>
            <div>
              <label className={modalLabelClass}>Frequency</label>
              <input type="text" value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} placeholder="e.g. Once daily" className={modalInputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalLabelClass}>Start date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={modalInputClass} />
            </div>
            <div>
              <label className={modalLabelClass}>End date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={modalInputClass} />
            </div>
          </div>
          <div>
            <label className={modalLabelClass}>Refills</label>
            <input type="number" min="0" value={form.refills} onChange={(e) => setForm((f) => ({ ...f, refills: e.target.value }))} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>Instructions</label>
            <textarea rows={2} placeholder="e.g. Take with food" value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} className={`${modalInputClass} resize-none`}></textarea>
          </div>
          {error && <p className="text-xs text-accent-700 bg-accent-50 border border-accent-200/50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? 'Saving…' : 'Issue Prescription'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AppointmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({ patientId: '', date: '', time: '', type: 'In-person', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatientOptions().then(setPatients).catch(() => setPatients([]));
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!form.patientId || !form.date || !form.time) {
      setError('Select a patient, date, and time.');
      return;
    }
    setSubmitting(true);
    const { error: insErr } = await supabase.from('appointments').insert({
      patient_id: form.patientId,
      provider_id: profile?.id ?? null,
      doctor_name: profile?.full_name ?? '',
      specialty: profile?.specialty ?? '',
      clinic: profile?.hospital ?? '',
      type: form.type,
      date: form.date,
      time: form.time,
      status: 'upcoming',
      reason: form.reason.trim() || null,
    });
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-bold text-foreground-900 text-lg">New Appointment</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-50 cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={modalLabelClass}>Patient</label>
            <select value={form.patientId} onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))} className={`${modalInputClass} cursor-pointer`}>
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalLabelClass}>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={modalInputClass} />
            </div>
            <div>
              <label className={modalLabelClass}>Time</label>
              <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className={modalInputClass} />
            </div>
          </div>
          <div>
            <label className={modalLabelClass}>Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={`${modalInputClass} cursor-pointer`}>
              <option value="In-person">In-person</option>
              <option value="Video">Video</option>
            </select>
          </div>
          <div>
            <label className={modalLabelClass}>Reason</label>
            <textarea rows={2} placeholder="Reason for visit…" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className={`${modalInputClass} resize-none`}></textarea>
          </div>
          {error && <p className="text-xs text-accent-700 bg-accent-50 border border-accent-200/50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? 'Scheduling…' : 'Schedule Appointment'}
          </button>
        </form>
      </div>
    </div>
  );
}

function LabResultModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({ patientId: '', testName: '', category: '', result: '', unit: '', normalRange: '', status: 'normal', lab: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatientOptions().then(setPatients).catch(() => setPatients([]));
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!form.patientId || !form.testName.trim() || !form.result.trim()) {
      setError('Select a patient and enter a test name and result.');
      return;
    }
    setSubmitting(true);
    const { error: insErr } = await supabase.from('test_results').insert({
      patient_id: form.patientId,
      test_name: form.testName.trim(),
      category: form.category.trim() || null,
      result: form.result.trim(),
      unit: form.unit.trim() || null,
      normal_range: form.normalRange.trim() || null,
      status: form.status,
      date: new Date().toISOString().slice(0, 10),
      lab: form.lab.trim() || null,
    });
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-bold text-foreground-900 text-lg">Upload Lab Result</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-50 cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={modalLabelClass}>Patient</label>
            <select value={form.patientId} onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))} className={`${modalInputClass} cursor-pointer`}>
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={modalLabelClass}>Test name</label>
            <input type="text" value={form.testName} onChange={(e) => setForm((f) => ({ ...f, testName: e.target.value }))} placeholder="e.g. Haemoglobin (Hb)" className={modalInputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalLabelClass}>Result</label>
              <input type="text" value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))} placeholder="e.g. 12.8" className={modalInputClass} />
            </div>
            <div>
              <label className={modalLabelClass}>Unit</label>
              <input type="text" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. g/dL" className={modalInputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalLabelClass}>Category</label>
              <input type="text" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Full Blood Count" className={modalInputClass} />
            </div>
            <div>
              <label className={modalLabelClass}>Reference range</label>
              <input type="text" value={form.normalRange} onChange={(e) => setForm((f) => ({ ...f, normalRange: e.target.value }))} placeholder="e.g. 12.0 – 15.5" className={modalInputClass} />
            </div>
          </div>
          <div>
            <label className={modalLabelClass}>Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={`${modalInputClass} cursor-pointer`}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className={modalLabelClass}>Lab</label>
            <input type="text" value={form.lab} onChange={(e) => setForm((f) => ({ ...f, lab: e.target.value }))} placeholder="e.g. Lakeshore Diagnostics" className={modalInputClass} />
          </div>
          {error && <p className="text-xs text-accent-700 bg-accent-50 border border-accent-200/50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? 'Uploading…' : 'Upload Result'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AddPatientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ fullName: '', age: '', gender: '', bloodType: '', condition: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim()) {
      setError('Enter the patient\u2019s full name.');
      return;
    }
    setSubmitting(true);
    const ageNum = parseInt(form.age, 10);
    const { error: insErr } = await supabase.from('profiles').insert({
      role: 'patient',
      full_name: form.fullName.trim(),
      age: Number.isNaN(ageNum) ? null : ageNum,
      gender: form.gender.trim() || null,
      blood_type: form.bloodType.trim() || null,
      condition: form.condition.trim() || null,
      status: 'stable',
    });
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-bold text-foreground-900 text-lg">Add Patient</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-50 cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={modalLabelClass}>Full name</label>
            <input type="text" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="e.g. Amara Okafor" className={modalInputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalLabelClass}>Age</label>
              <input type="number" min="0" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} placeholder="e.g. 34" className={modalInputClass} />
            </div>
            <div>
              <label className={modalLabelClass}>Gender</label>
              <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className={`${modalInputClass} cursor-pointer`}>
                <option value="">Select…</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalLabelClass}>Blood type</label>
              <input type="text" value={form.bloodType} onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))} placeholder="e.g. O+" className={modalInputClass} />
            </div>
            <div>
              <label className={modalLabelClass}>Condition</label>
              <input type="text" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} placeholder="e.g. Hypertension" className={modalInputClass} />
            </div>
          </div>
          {error && <p className="text-xs text-accent-700 bg-accent-50 border border-accent-200/50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? 'Adding…' : 'Add Patient'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------ Main ------------------------------ */

function Provider() {
  const { profile } = useAuth();
  const [section, setSection] = useState<Section>('overview');
  const [menuOpen, setMenuOpen] = useState(false);

  const fullName = profile?.full_name ?? 'Provider';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';
  const roleLabel = profile?.specialty ?? 'Healthcare Provider';

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
                  <p className="text-[10px] text-foreground-400 mt-1">Provider Portal</p>
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
        <DashboardTopBar name={fullName} roleLabel={roleLabel} initials={initials} onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 md:px-6 py-6">
          {section === 'overview' && <OverviewSection onNavigate={go} />}
          {section === 'appointments' && <AppointmentsSection />}
          {section === 'patients' && <PatientsSection />}
        </main>
      </div>
    </div>
  );
}