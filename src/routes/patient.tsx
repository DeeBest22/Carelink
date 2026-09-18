import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { healthTips } from '@/mocks/data/patient';
import DashboardTopBar from '@/components/feature/DashboardTopBar';

export const Route = createFileRoute('/patient')({
  component: Patient,
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

function Sidebar({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }) {
  const { signOut } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-background-200/60 flex-col shrink-0 min-h-screen sticky top-0 hidden lg:flex">
      <div className="flex items-center gap-3 px-6 h-20 border-b border-background-100">
        <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white shadow-md shadow-primary-500/20">
          <i className="ri-heart-pulse-line text-xl"></i>
        </div>
        <div>
          <p className="font-heading font-bold text-foreground-900 leading-none">CareLink</p>
          <p className="text-[11px] text-foreground-400 mt-1">Patient Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              section === item.key
                ? 'bg-primary-50 text-primary-700 shadow-sm shadow-primary-100 font-semibold'
                : 'text-foreground-500 hover:text-foreground-900 hover:bg-background-50'
            }`}
          >
            <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-background-100">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-foreground-500 hover:text-accent-600 hover:bg-accent-50 transition-colors cursor-pointer"
        >
          <i className="ri-logout-box-r-line text-lg w-5 h-5 flex items-center justify-center"></i>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------ Overview ------------------------------ */

function OverviewSection({ onNavigate, onUploadRecord }: { onNavigate: (s: Section) => void; onUploadRecord: () => void }) {
  const { profile } = useAuth();
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
    { icon: 'ri-calendar-check-line', label: 'Upcoming Visits', value: String(upcomingAppts.length), sub: nextAppt ? nextAppt.date : 'None', color: 'bg-primary-50 text-primary-600' },
    { icon: 'ri-capsule-line', label: 'Active Meds', value: String(prescriptions.length), sub: 'Prescriptions', color: 'bg-secondary-50 text-secondary-600' },
    { icon: 'ri-heart-pulse-line', label: 'Last Vitals Log', value: vitals[0] ? new Date(vitals[0].recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', sub: 'Recent update', color: 'bg-accent-50 text-accent-600' },
    { icon: 'ri-file-chart-line', label: 'Test Results', value: String(results.length), sub: 'On record', color: 'bg-primary-50 text-primary-600' },
  ];

  const recentResults = results.slice(0, 3);

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
        <div className="flex items-center gap-2">
          <button 
            onClick={onUploadRecord} 
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-background-200/80 text-foreground-700 text-sm font-semibold hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
          >
            <i className="ri-upload-cloud-2-line text-primary-600"></i>
            Upload Record
          </button>
          <button onClick={() => onNavigate('appointments')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-add-line"></i>
            Book Appointment
          </button>
        </div>
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
          {latestVitals.length === 0 && (
            <div className="col-span-2 bg-white rounded-2xl border border-background-200/60 p-6 text-center text-sm text-foreground-400">
              No vitals logged yet.
            </div>
          )}
          {latestVitals.map((v) => {
            const meta = vitalsMeta[v.vital_type] ?? { label: v.vital_type, icon: 'ri-pulse-line' };
            return (
              <div key={v.id} className="bg-white rounded-2xl border border-background-200/60 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                    <i className={`${meta.icon} text-sm`}></i>
                  </div>
                  <span className="text-[10px] text-foreground-400">{new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-foreground-900 leading-none">
                    {v.value} <span className="text-xs font-normal text-foreground-400">{v.unit}</span>
                  </p>
                  <p className="text-xs text-foreground-500 mt-1">{meta.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-background-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-foreground-900 text-base">Heart Rate Trend</h3>
              <p className="text-xs text-foreground-400">Recent readings</p>
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
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="bpm" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#hrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <div className="bg-white rounded-2xl border border-background-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-foreground-900 text-base">Upcoming Appointments</h3>
            <button onClick={() => onNavigate('appointments')} className="text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer">View all</button>
          </div>
          <div className="space-y-3">
            {upcomingAppts.length === 0 && (
              <p className="text-sm text-foreground-400 py-6 text-center">No upcoming appointments scheduled.</p>
            )}
            {upcomingAppts.slice(0, 2).map((a, i) => {
              const provName = a.doctor_name || 'Doctor';
              return (
                <div key={a.id} className="p-4 rounded-xl border border-background-200/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`${apptColors[i % apptColors.length]} w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0`}>
                      {initialsOf(provName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground-900">{provName}</p>
                      <p className="text-xs text-foreground-400">{a.specialty || a.type} · {a.reason || 'General Visit'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-foreground-900">{a.date}</p>
                    <p className="text-[11px] text-foreground-400">{a.time || ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-background-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-foreground-900 text-base">Recent Test Results</h3>
            <button onClick={() => onNavigate('records')} className="text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer">View all</button>
          </div>
          <div className="space-y-2.5">
            {recentResults.length === 0 && (
              <p className="text-sm text-foreground-400 py-6 text-center">No recent test results found.</p>
            )}
            {recentResults.map((r) => (
              <div key={r.id} className="p-3.5 rounded-xl border border-background-200/60 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground-900">{r.test_name}</p>
                  <p className="text-xs text-foreground-400">{r.category ?? 'Diagnostic'} · {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground-900">{r.result ?? '—'} <span className="text-[11px] font-normal text-foreground-400">{r.unit ?? ''}</span></p>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium mt-0.5 ${resultStatusConfig[r.status]?.class ?? 'bg-foreground-100 text-foreground-500'}`}>
                    {resultStatusConfig[r.status]?.label ?? r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-500/10 via-secondary-500/10 to-accent-500/10 rounded-2xl border border-primary-200/50 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center shrink-0">
            <i className="ri-lightbulb-line text-xl"></i>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary-700">Health Tip of the Day</p>
            <p className="text-sm text-foreground-700 mt-1 leading-relaxed">
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
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Appointments</h1>
          <p className="text-sm text-foreground-500 mt-0.5">Manage your upcoming visits and consultations.</p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setBooking(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <i className="ri-add-line"></i>
          Book Appointment
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-background-200/60 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-foreground-500">Loading appointments…</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-background-200/60 p-8 text-center">
          <p className="text-sm text-accent-600 font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 px-4 py-2 rounded-xl bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600">
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-900 mb-3">Upcoming ({upcoming.length})</h2>
            <div className="space-y-3">
              {upcoming.length === 0 && (
                <div className="bg-white rounded-2xl border border-background-200/60 p-8 text-center text-sm text-foreground-400">
                  No upcoming appointments scheduled.
                </div>
              )}
              {upcoming.map((a, i) => {
                const provName = a.doctor_name ?? 'Doctor';

                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-background-200/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`${apptColors[i % apptColors.length]} w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0`}>
                        {initialsOf(provName)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground-900 text-base">{provName}</h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">{a.type}</span>
                        </div>
                        <p className="text-xs text-foreground-400 mt-0.5">{a.specialty ?? 'General Practice'}{a.clinic ? ` · ${a.clinic}` : ''}</p>
                        {a.reason && <p className="text-xs text-foreground-600 mt-2"><strong>Reason:</strong> {a.reason}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-background-100">
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-bold text-foreground-900">{a.appointment_date}</p>
                        <p className="text-xs text-foreground-500">{a.start_time ?? 'Time TBD'}</p>
                      </div>
                      <button
                        onClick={() => setCancelModalId(a.id)}
                        className="text-xs text-accent-600 hover:text-accent-700 font-semibold cursor-pointer"
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
            <h2 className="font-heading text-base font-bold text-foreground-900 mb-3">Past & Cancelled</h2>
            <div className="bg-white rounded-2xl border border-background-200/60 divide-y divide-background-100">
              {past.length === 0 && <p className="p-4 text-sm text-foreground-400">No past visits on record.</p>}
              {past.map((a) => {
              const provName = a.doctor_name ?? 'Doctor';
                return (
                  <div key={a.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground-900">{provName} <span className="text-xs font-normal text-foreground-400">({a.type})</span></p>
                      <p className="text-xs text-foreground-400">{a.appointment_date} {a.start_time ? `· ${a.start_time}` : ''}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${a.status === 'cancelled' ? 'bg-accent-50 text-accent-700' : 'bg-background-100 text-foreground-600'}`}>
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBooking(false)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-lg overflow-hidden animate-scale-in shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-background-100">
              <h2 className="font-heading text-lg font-bold text-foreground-900">Book an Appointment</h2>
              <button onClick={() => setBooking(false)} className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-400">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleBook} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <i className="ri-error-warning-line text-base shrink-0"></i>
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-foreground-700 mb-1">Select Doctor *</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500 bg-white"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.specialty ?? 'General'}{d.hospital ? ` - ${d.hospital}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-700 mb-1">Appointment Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500 bg-white"
                >
                  {APPT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground-700 mb-1">Time Slot</label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500 bg-white"
                  >
                    <option value="">Choose slot...</option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-700 mb-1">Reason for Visit</label>
                <input
                  type="text"
                  placeholder="e.g. Follow-up consultation or routine review"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-700 mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  placeholder="Any symptoms, concerns, or previous history..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setBooking(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-background-100 text-foreground-600 text-sm font-semibold hover:bg-background-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50"
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelModalId(null)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 animate-scale-in text-center shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-accent-100 text-accent-600 mx-auto flex items-center justify-center text-2xl">
              <i className="ri-calendar-close-line"></i>
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground-900">Cancel Appointment?</h3>
              <p className="text-xs text-foreground-500 mt-1">Are you sure you want to cancel this appointment?</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCancelModalId(null)} className="flex-1 py-2 rounded-xl bg-background-100 text-foreground-700 text-xs font-semibold hover:bg-background-200">
                Keep
              </button>
              <button
                disabled={cancellingId === cancelModalId}
                onClick={() => handleCancel(cancelModalId)}
                className="flex-1 py-2 rounded-xl bg-accent-600 text-white text-xs font-semibold hover:bg-accent-700 disabled:opacity-50"
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
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Medical Records</h1>
          <p className="text-sm text-foreground-500 mt-0.5">Manage your health history and grant time-limited doctor access.</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <i className="ri-upload-cloud-2-line"></i>
          Upload Record
        </button>
      </div>

      <div className="flex items-center gap-1 bg-background-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('records')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'records' ? 'bg-white text-primary-600 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
          }`}
        >
          <i className="ri-folder-user-line"></i>
          Uploaded Records ({records.length})
        </button>
        <button
          onClick={() => setTab('results')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'results' ? 'bg-white text-primary-600 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
          }`}
        >
          <i className="ri-flask-line"></i>
          Lab Test Results ({results.length})
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-background-200/60 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-foreground-500">Loading records…</p>
        </div>
      ) : tab === 'records' ? (
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-background-200/60">
              <i className="ri-file-cloud-line text-4xl text-foreground-300"></i>
              <p className="text-sm font-semibold text-foreground-800 mt-2">No uploaded records yet</p>
              <p className="text-xs text-foreground-400 mt-0.5">Click "Upload Record" above to store your medical files.</p>
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
                  className="bg-white rounded-2xl border border-background-200/60 p-5 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center text-xl shrink-0">
                      <i className={categoryIcons[r.category] || 'ri-file-text-line'}></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground-900 text-base">{r.name}</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary-50 text-secondary-700 text-xs font-medium">{r.category}</span>
                      </div>
                      <p className="text-xs text-foreground-500 mt-1 line-clamp-1">{r.description}</p>
                      <p className="text-[11px] text-foreground-400 mt-1">Record Date: {new Date(r.record_date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    {(r.files?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background-100 text-foreground-600 text-xs">
                        <i className="ri-attachment-2 text-primary-500"></i>
                        {r.files?.length} file{r.files?.length === 1 ? '' : 's'}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${activeCount > 0 ? 'bg-primary-50 text-primary-700' : 'bg-background-100 text-foreground-400'}`}>
                      <i className="ri-shield-keyhole-line"></i>
                      {activeCount > 0 ? `${activeCount} doctor(s) access` : 'Private'}
                    </span>
                    <i className="ri-arrow-right-s-line text-foreground-400 text-lg"></i>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
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
                {results.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-foreground-400">No test results yet.</td>
                  </tr>
                )}
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-background-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-foreground-900">{r.test_name}</p>
                      <p className="text-[11px] text-foreground-400">{r.category ?? ''}{r.lab ? ` · ${r.lab}` : ''}</p>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm font-bold text-foreground-900">{r.result ?? '—'} <span className="text-[11px] font-normal text-foreground-400">{r.unit ?? ''}</span></span></td>
                    <td className="px-5 py-4"><span className="text-sm text-foreground-500">{r.normal_range ?? '—'}</span></td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${resultStatusConfig[r.status]?.class ?? 'bg-foreground-100 text-foreground-500'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {resultStatusConfig[r.status]?.label ?? r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm text-foreground-600">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></td>
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowUploadModal(false); onUploadClosed?.(); }}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-background-100">
              <h2 className="font-heading text-lg font-bold text-foreground-900">Upload Medical Record</h2>
              <button onClick={() => { setShowUploadModal(false); onUploadClosed?.(); }} className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-400">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {uploadError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <i className="ri-error-warning-line text-base shrink-0"></i>
                  {uploadError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-foreground-700 mb-1">Record Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complete Blood Count / Chest X-Ray"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Notes, symptoms, or doctor summary..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500 bg-white"
                  >
                    <option value="Lab Result">Lab Result</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Imaging">Imaging</option>
                    <option value="Vaccination">Vaccination</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground-700 mb-1">Record Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-700 mb-1">Attach Files (Max 3: PDF, JPG, PNG)</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleFileChange}
                  className="w-full text-xs text-foreground-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {formFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-background-50 px-3 py-1.5 rounded-lg text-foreground-600">
                        <span className="truncate max-w-[80%]">{f.name}</span>
                        <span className="text-[10px] text-foreground-400">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); onUploadClosed?.(); }}
                  className="w-1/2 py-2.5 rounded-xl bg-background-100 text-foreground-600 text-sm font-semibold hover:bg-background-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-1/2 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedRecord(null)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-background-100">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-600">{selectedRecord.category}</span>
                <h2 className="font-heading text-lg font-bold text-foreground-900">{selectedRecord.name}</h2>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-400">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="bg-background-50 p-4 rounded-xl space-y-2">
                <p className="text-xs text-foreground-400">
                  Record Date: <span className="font-medium text-foreground-700">{selectedRecord.record_date}</span> · Uploaded on: <span className="font-medium text-foreground-700">{new Date(selectedRecord.created_at).toLocaleDateString()}</span>
                </p>
                <p className="text-sm text-foreground-600 leading-relaxed">{selectedRecord.description}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-foreground-800 uppercase tracking-wider mb-2">Attached Documents ({(selectedRecord.files || []).length})</h4>
                {(selectedRecord.files || []).length === 0 ? (
                  <p className="text-xs text-foreground-400 italic">No files attached to this record.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedRecord.files?.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => openFile(file)}
                        className="flex items-center gap-3 p-3 rounded-xl border border-background-200/80 hover:bg-background-50 transition-colors text-left w-full"
                      >
                        <i className={`text-xl text-primary-600 ${file.file_type.includes('pdf') ? 'ri-file-pdf-line' : 'ri-image-line'}`}></i>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground-800 truncate">{file.file_name}</p>
                          <p className="text-[10px] text-foreground-400">{(file.file_size / 1024).toFixed(0)} KB</p>
                        </div>
                        <i className="ri-download-line text-foreground-400 hover:text-foreground-700"></i>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-background-100 pt-5">
                <h4 className="text-xs font-semibold text-foreground-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <i className="ri-shield-user-line text-primary-600"></i>
                  Doctor Access Control
                </h4>
                <p className="text-xs text-foreground-500 mb-4">Grant access for a specific duration. Access will automatically revoke once the timer expires.</p>

                <div className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-primary-50/50 rounded-xl border border-primary-100 mb-4">
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full sm:w-1/2 px-3 py-2 bg-white rounded-lg border border-background-200 text-xs"
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
                    className="w-full sm:w-1/3 px-3 py-2 bg-white rounded-lg border border-background-200 text-xs"
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
                    className="w-full sm:w-auto px-4 py-2 bg-primary-500 text-white rounded-lg text-xs font-semibold hover:bg-primary-600 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {granting ? 'Granting...' : 'Grant Access'}
                  </button>
                </div>

                <div className="space-y-2">
                  <h5 className="text-[11px] font-semibold text-foreground-400 uppercase tracking-wider">Access History</h5>
                  {(selectedRecord.grants || []).length === 0 ? (
                    <p className="text-xs text-foreground-400 italic">No doctor access granted yet.</p>
                  ) : (
                    selectedRecord.grants?.map((g) => {
                      const doc = doctors.find((d) => d.id === g.doctor_id);
                      const isExpired = new Date(g.expires_at) < new Date();
                      const isRevoked = Boolean(g.revoked_at);
                      const isActive = !isExpired && !isRevoked;

                      return (
                        <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-background-200/60 bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                              {doc?.initials || 'DR'}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground-900">{doc?.name || 'Healthcare Provider'}</p>
                              <p className="text-[10px] text-foreground-400">
                                {isActive && `Expires: ${new Date(g.expires_at).toLocaleString()}`}
                                {isExpired && !isRevoked && `Expired on ${new Date(g.expires_at).toLocaleDateString()}`}
                                {isRevoked && `Revoked early on ${new Date(g.revoked_at!).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isActive ? 'bg-primary-50 text-primary-700' : 'bg-background-100 text-foreground-400'}`}>
                              {isActive ? 'Active' : isRevoked ? 'Revoked' : 'Expired'}
                            </span>
                            {isActive && (
                              <button
                                onClick={() => handleRevokeAccess(g.id)}
                                className="px-2.5 py-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
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

            <div className="p-4 bg-background-50 border-t border-background-100 flex justify-end">
              <button onClick={() => setSelectedRecord(null)} className="px-5 py-2 rounded-xl bg-foreground-800 text-white text-xs font-semibold hover:bg-foreground-900 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-900 text-white px-5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg">
          <i className="ri-checkbox-circle-fill text-primary-400"></i>
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
        <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground-900">Prescriptions</h1>
        <p className="text-sm text-foreground-500 mt-0.5">Track your active medications, dosage instructions, and refills.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-background-200/60 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
            <i className="ri-loader-4-line text-xl animate-spin"></i>
          </div>
          <p className="text-sm text-foreground-500">Loading prescriptions…</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-background-200/60 p-8 text-center">
          <p className="text-sm text-accent-600 font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 px-4 py-2 rounded-xl bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h2 className="font-heading text-base font-bold text-foreground-900">Active Medications ({active.length})</h2>
            {active.length === 0 && (
              <div className="bg-white rounded-2xl border border-background-200/60 p-8 text-center text-sm text-foreground-400">
                No active medications.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-background-200/60 p-5 flex flex-col justify-between space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`${p.color} w-11 h-11 rounded-xl flex items-center justify-center shrink-0`}>
                        <i className="ri-capsule-line text-lg"></i>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground-900 text-base">{p.medication}</h3>
                        <p className="text-xs text-foreground-400">{p.dosage} · {p.frequency}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${rxStatusConfig[p.status]?.class ?? 'bg-foreground-100 text-foreground-500'}`}>
                      {rxStatusConfig[p.status]?.label ?? p.status}
                    </span>
                  </div>

                  <div className="bg-background-50 rounded-xl p-3 text-xs text-foreground-600 leading-relaxed">
                    <p><strong>Instructions:</strong> {p.instructions}</p>
                    <p className="text-foreground-400 mt-1">Prescribed by {p.prescribedBy} · Refills left: {p.refillsLeft}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-foreground-400">Ends: {p.endDate}</span>
                    <button
                      onClick={() => requestRefill(p.medication)}
                      className="px-3.5 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Request Refill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="font-heading text-base font-bold text-foreground-900">Past Medications</h2>
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
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium ${rxStatusConfig[p.status]?.class ?? 'bg-foreground-100 text-foreground-500'}`}>
                    {rxStatusConfig[p.status]?.label ?? p.status}
                  </span>
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
          {section === 'overview' && <OverviewSection onNavigate={go} onUploadRecord={handleUploadFromOverview} />}
          {section === 'appointments' && <AppointmentsSection />}
          {section === 'records' && <RecordsSection openUploadOnMount={openUploadModalOnRecords} onUploadClosed={() => setOpenUploadModalOnRecords(false)} />}
          {section === 'prescriptions' && <PrescriptionsSection />}
        </main>
      </div>
    </div>
  );
}