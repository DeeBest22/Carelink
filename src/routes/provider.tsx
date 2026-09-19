import { useState, useEffect, useCallback, type FormEvent, type ComponentType } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  HeartPulse,
  LayoutGrid,
  UsersRound,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Calendar,
  Clock,
  FlaskConical,
  Video,
  MapPin,
  Stethoscope,
  Hospital,
  Award,
  Languages,
  Pencil,
  Loader2,
  CircleAlert,
  MoreHorizontal,
  X,
  ShieldCheck,
  Lock,
  Check,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download,
  UserPlus,
  UserSearch,
  UserMinus,
  History,
  ChevronRight,
  CloudUpload,
  Info,
  ListChecks,
  ArrowRight,
  ArrowUpRight,
  Pill,
  ScanLine,
  Syringe,
  Search,
  Activity,
  Menu,
  LogOut,
  type LucideProps,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { quickActions } from '@/mocks/data/provider';
import DashboardTopBar from '@/components/feature/DashboardTopBar';
import UserAvatar from '@/components/base/UserAvatar';
import AuthGuard from '@/components/base/AuthGuard';

export const Route = createFileRoute('/provider')({
  component: ProviderRoute,
});

// AuthGuard is what actually sends a new provider to /onboarding — see the
// redirect logic in src/components/base/AuthGuard.tsx. It has to wrap the
// dashboard here, at the point the router renders it, or that logic never runs.
function ProviderRoute() {
  return (
    <AuthGuard role="provider">
      <Provider />
    </AuthGuard>
  );
}

type Section = 'overview' | 'patients' | 'appointments';
type IconType = ComponentType<LucideProps>;

const navItems: { key: Section; label: string; icon: IconType }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'patients', label: 'Patients', icon: UsersRound },
  { key: 'appointments', label: 'Appointments', icon: CalendarCheck },
];

const colors = ['bg-accent text-primary'];

const scheduleStatus: Record<string, { class: string; dot: string }> = {
  completed: { class: 'bg-success-soft text-success', dot: 'bg-success' },
  upcoming: { class: 'bg-accent text-primary', dot: 'bg-primary' },
  cancelled: { class: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/50' },
};

const patientStatus: Record<string, { label: string; class: string }> = {
  stable: { label: 'Stable', class: 'bg-success-soft text-success' },
  review: { label: 'Needs review', class: 'bg-warning-soft text-warning' },
  critical: { label: 'Critical', class: 'bg-destructive-soft text-destructive' },
};

const appointmentStatus: Record<string, { label: string; class: string }> = {
  completed: { label: 'Completed', class: 'bg-success-soft text-success' },
  upcoming: { label: 'Confirmed', class: 'bg-accent text-primary' },
  cancelled: { label: 'Cancelled', class: 'bg-muted text-muted-foreground' },
};

const dayFilters: { key: string; label: string; icon: IconType }[] = [
  { key: 'today', label: 'Today', icon: Calendar },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarCheck },
  { key: 'all', label: 'All', icon: ListChecks },
];

const patientFilters: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'stable', label: 'Stable' },
  { key: 'review', label: 'Needs review' },
  { key: 'critical', label: 'Critical' },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ------------------------------ Design helpers (presentational only) ------------------------------ */

/** Quick-action labels come from mock data; map each to a Lucide glyph. */
function quickActionIcon(label: string): IconType {
  if (label === 'Write Prescription' || label === 'New Prescription') return Pill;
  if (label === 'Schedule Visit' || label === 'Schedule Appointment') return CalendarPlus;
  if (label === 'Upload Lab Result') return FlaskConical;
  if (label === 'New Patient' || label === 'Add Patient') return UserPlus;
  return ArrowRight;
}

/** Records store a legacy icon string; derive a Lucide glyph from the category instead. */
function recordIcon(category: string): IconType {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lab') || c.includes('test')) return FlaskConical;
  if (c.includes('prescription') || c.includes('medic')) return Pill;
  if (c.includes('imag') || c.includes('scan') || c.includes('x-ray') || c.includes('radiol')) return ScanLine;
  if (c.includes('vaccin') || c.includes('immun')) return Syringe;
  return FileText;
}

function greetingFor(date: Date) {
  const h = date.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function longDate(date: Date) {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  return `${weekday}, ${ordinal(date.getDate())} ${month}`;
}

/** Shared card frame used across the dashboard. */
const card = 'rounded-lg border border-border bg-card';
const cardHead = 'flex items-center justify-between gap-4 border-b border-border px-5 py-4';
const btnPrimary =
  'inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/85 cursor-pointer whitespace-nowrap';
const btnGhost =
  'inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted cursor-pointer whitespace-nowrap';
const btnSoft =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer whitespace-nowrap';
const iconBtn =
  'inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0';

function SectionTitle({ icon: Icon, children }: { icon: IconType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.75} />
      <h3 className="font-heading text-[17px] font-semibold text-foreground tracking-tight">{children}</h3>
    </div>
  );
}

function StatusPill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold leading-none ${className}`}>
      {children}
    </span>
  );
}

function Th({ icon: Icon, children, className = '' }: { icon: IconType; children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-5 py-3.5 text-[13px] font-semibold text-foreground ${className}`}>
      <span className="inline-flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
        {children}
      </span>
    </th>
  );
}

/* ------------------------------ Sidebar ------------------------------ */

function SidebarBrand() {
  return (
    <div className="flex h-20 items-center gap-3 border-b border-border px-6">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <HeartPulse className="size-5" strokeWidth={2} />
      </div>
      <div>
        <p className="font-heading text-lg font-bold leading-none text-foreground">CareLink</p>
        <p className="mt-1 text-xs text-muted-foreground">Provider portal</p>
      </div>
    </div>
  );
}

function SidebarNav({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }) {
  return (
    <nav className="px-4 py-6 space-y-1" aria-label="Provider navigation">
      <p className="mb-3 px-3 text-xs font-semibold uppercase text-muted-foreground">Workspace</p>
      {navItems.map((item) => {
        const active = section === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? 'bg-accent text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" strokeWidth={active ? 2.2 : 1.75} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }) {
  const { profile, avatarUrl, signOut } = useAuth();
  const fullName = profile?.full_name ?? 'Provider';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';
  const sub = profile?.specialty ?? 'Provider Portal';

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <SidebarBrand />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav section={section} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center gap-3 rounded-md p-2">
          <UserAvatar src={avatarUrl} initials={initials} alt={fullName} className="size-10 shrink-0 rounded-full bg-accent text-sm font-bold text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
          Sign out
        </button>
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

/** Read-only summary of the answers given during provider onboarding. */
function PracticeProfileCard() {
  const { profile } = useAuth();
  if (!profile) return null;

  const rows: { icon: IconType; label: string; value: string }[] = [
    { icon: Stethoscope, label: 'Practitioner', value: [profile.title, profile.specialty].filter(Boolean).join(' ') || 'Not set' },
    { icon: Hospital, label: 'Practice', value: profile.hospital || 'Not set' },
    {
      icon: Award,
      label: 'Experience',
      value: profile.years_experience != null ? `${profile.years_experience}+ years` : 'Not set',
    },
    { icon: Video, label: 'Consultations', value: (profile.consultation_modes ?? []).join(', ') || 'Not set' },
    {
      icon: Clock,
      label: 'Availability',
      value: [(profile.working_days ?? []).join(', '), profile.working_hours].filter(Boolean).join(' · ') || 'Not set',
    },
    { icon: Languages, label: 'Languages', value: (profile.languages ?? []).join(', ') || 'Not set' },
  ];

  return (
    <div className={card}>
      <div className={cardHead}>
        <div className="min-w-0">
          <SectionTitle icon={Stethoscope}>Your practice profile</SectionTitle>
          <p className="text-xs text-muted-foreground mt-1 ml-7">What patients see before sharing their records with you.</p>
        </div>
        <Link to="/onboarding" search={{ edit: '1' }} className={btnSoft}>
          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
          Edit
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-border">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div
              key={r.label}
              className={`flex items-start gap-3 px-5 py-4 ${i % 3 !== 2 ? 'lg:border-r' : ''} ${i < 3 ? 'lg:border-b' : ''} ${
                i % 2 === 0 ? 'sm:border-r' : ''
              } ${i < 4 ? 'sm:border-b' : ''} border-border`}
            >
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">{r.label}</p>
                <p className="text-sm font-medium text-foreground mt-0.5 break-words">{r.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {profile.bio && (
        <p className="text-sm text-muted-foreground px-5 py-4 border-t border-border leading-relaxed">{profile.bio}</p>
      )}
    </div>
  );
}

function OverviewSection({ onNavigate, onOpenPatient }: { onNavigate: (s: Section) => void; onOpenPatient: (patientId: string) => void }) {
  const { profile, avatarUrl } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [pendingResults, setPendingResults] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [onlineConsults, setOnlineConsults] = useState(0);
  const [weeklyVisits, setWeeklyVisits] = useState<{ day: string; visits: number }[]>([]);
  const [rosterIds, setRosterIds] = useState<string[]>([]);
  const [activeModal, setActiveModal] = useState<'prescription' | 'appointment' | 'labResult' | 'patientSearch' | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      // Stats and lists are scoped to this provider's own caseload.
      const roster = await fetchRoster(profile.id);
      setRosterIds(roster.patientIds);

      const [apptsRes, patsRes, pendingRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, patient_id, type, date, time, status, reason')
          .eq('provider_id', profile.id)
          .order('date', { ascending: true }),
        roster.patientIds.length
          ? supabase
              .from('profiles')
              .select('id, full_name, age, gender, condition, last_visit, status')
              .eq('role', 'patient')
              .in('id', roster.patientIds)
              .order('full_name', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        roster.patientIds.length
          ? supabase
              .from('test_results')
              .select('id', { count: 'exact', head: true })
              .in('patient_id', roster.patientIds)
              .neq('status', 'normal')
          : Promise.resolve({ count: 0 }),
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
    if (label === 'Write Prescription' || label === 'New Prescription') setActiveModal('prescription');
    else if (label === 'Schedule Visit' || label === 'Schedule Appointment') setActiveModal('appointment');
    else if (label === 'Upload Lab Result') setActiveModal('labResult');
    else if (label === 'New Patient' || label === 'Add Patient') setActiveModal('patientSearch');
    else onNavigate('appointments');
  };

  const patientStats: { label: string; value: string; change: string; icon: IconType }[] = [
    { label: 'My Patients', value: String(totalPatients), change: 'Under your care', icon: UsersRound },
    { label: "Today's Appointments", value: String(todayCount), change: 'Scheduled', icon: CalendarCheck },
    { label: 'Pending Results', value: String(pendingResults), change: 'Awaiting review', icon: FlaskConical },
    { label: 'Online Consults', value: String(onlineConsults), change: 'Upcoming', icon: Video },
  ];

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <UserAvatar
            src={avatarUrl}
            initials={initialsOf(profile?.full_name ?? 'Dr')}
            alt={profile?.full_name ?? 'Provider'}
            className="w-12 h-12 rounded-full text-lg mt-1 hidden sm:flex"
          />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{longDate(now)}</p>
            <h1 className="font-heading text-[28px] md:text-[34px] font-semibold text-foreground tracking-tight leading-tight mt-1">
              {greetingFor(now)}, {profile?.title ? `${profile.title} ` : ''}{firstName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
              <p className="text-sm text-muted-foreground">{specialty}{hospital ? ` · ${hospital}` : ''}</p>
              {profile?.accepting_patients === false && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground whitespace-nowrap">
                  Books closed
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onNavigate('appointments')} className={btnGhost}>
            <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
            View Schedule
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className={`${card} inline-flex max-w-full overflow-x-auto rounded-full`}>
        <div className="flex items-stretch divide-x divide-border">
          {patientStats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-2.5 px-5 py-3 whitespace-nowrap">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                <span className="text-[17px] font-semibold text-foreground tabular-nums">{s.value}</span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a) => {
          const Icon = quickActionIcon(a.label);
          return (
            <button
              key={a.label}
              onClick={() => handleQuickAction(a.label)}
              className={`${card} group flex items-center gap-3 p-4 text-left hover:border-primary/40 hover:shadow-[0_4px_12px_rgba(16,24,40,0.06)] transition-all cursor-pointer`}
            >
              <div className={`${a.color} w-10 h-10 rounded-md flex items-center justify-center shrink-0`}>
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground whitespace-nowrap">{a.label}</span>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" strokeWidth={1.75} />
            </button>
          );
        })}
      </div>

      {/* Recent patients table */}
      <div className={`${card} overflow-hidden`}>
        <div className={cardHead}>
          <div className="flex items-center gap-3">
            <SectionTitle icon={ListChecks}>My Patients</SectionTitle>
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md border border-border text-xs font-medium text-foreground">
              Recent
            </span>
          </div>
          <button onClick={() => onNavigate('patients')} className={btnSoft}>
            See All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <Th icon={UsersRound}>Patient</Th>
                <Th icon={Stethoscope} className="border-l border-border">Condition</Th>
                <Th icon={History} className="border-l border-border">Last Visit</Th>
                <Th icon={Activity} className="border-l border-border">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {patients.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">No patients in your network yet.</td></tr>
              )}
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-muted transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`${p.color} w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`}>{p.initials}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.age} · {p.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 border-l border-border"><span className="text-sm text-foreground">{p.condition ?? '—'}</span></td>
                  <td className="px-5 py-3.5 border-l border-border"><span className="text-sm text-foreground">{p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span></td>
                  <td className="px-5 py-3.5 border-l border-border">
                    <StatusPill className={patientStatus[p.status ?? 'stable']?.class ?? 'bg-accent text-primary'}>
                      {patientStatus[p.status ?? 'stable']?.label ?? 'Stable'}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule + weekly chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className={`${card} lg:col-span-3 overflow-hidden`}>
          <div className={cardHead}>
            <div>
              <SectionTitle icon={CalendarDays}>Schedule</SectionTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-7">{slots.length} upcoming</p>
            </div>
            <button onClick={() => onNavigate('appointments')} className={iconBtn} title="Full schedule">
              <MoreHorizontal className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
          <div className="px-5 py-2">
            {slots.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">No appointments scheduled yet.</p>}
            <div className="divide-y divide-border">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-4 py-3.5">
                  <div className={`w-[3px] h-10 rounded-full shrink-0 ${scheduleStatus[slot.status]?.dot ?? 'bg-muted-foreground/50'}`} />
                  <div className={`${slot.color} w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`}>{slot.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {slot.type === 'Video' ? (
                        <Video className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      ) : (
                        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      )}
                      <p className="text-sm font-medium text-foreground truncate">{slot.patientName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {slot.time}{slot.reason ? ` · ${slot.reason}` : ''}
                    </p>
                  </div>
                  <StatusPill className={scheduleStatus[slot.status]?.class ?? 'bg-muted text-muted-foreground'}>
                    {slot.type}
                  </StatusPill>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${card} lg:col-span-2 overflow-hidden`}>
          <div className={cardHead}>
            <div>
              <SectionTitle icon={Activity}>Weekly Visits</SectionTitle>
              <p className="text-xs text-muted-foreground mt-1 ml-7">Patient visits this week</p>
            </div>
          </div>
          <div className="h-56 px-3 pt-4 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVisits} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--foreground)' }} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="visits" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <PracticeProfileCard />

      {activeModal === 'prescription' && (
        <PrescriptionModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); loadData(); }} />
      )}
      {activeModal === 'appointment' && (
        <AppointmentModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); loadData(); }} />
      )}
      {activeModal === 'labResult' && (
        <LabResultModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); loadData(); }} />
      )}
      {activeModal === 'patientSearch' && (
        <PatientSearchModal
          existingIds={rosterIds}
          onClose={() => setActiveModal(null)}
          onSelect={(patient) => {
            setActiveModal(null);
            onOpenPatient(patient.id);
          }}
        />
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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{longDate(new Date())}</p>
          <h1 className="font-heading text-[28px] md:text-[34px] font-semibold text-foreground tracking-tight leading-tight mt-1">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Manage your daily schedule and consultations.</p>
        </div>
        <button onClick={() => setApptModalOpen(true)} className={btnPrimary}>
          <CalendarPlus className="w-4 h-4" strokeWidth={2} />
          New Appointment
        </button>
      </div>

      <div className="inline-flex items-center gap-1 bg-muted rounded-md p-1">
        {dayFilters.map((f) => {
          const Icon = f.icon;
          const active = dayFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setDayFilter(f.key)}
              className={`px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className={`${card} flex flex-col items-center justify-center py-20 gap-3`}>
          <Loader2 className="w-6 h-6 text-primary animate-spin" strokeWidth={2} />
          <p className="text-sm text-muted-foreground">Loading schedule…</p>
        </div>
      ) : error ? (
        <div className={`${card} flex flex-col items-center justify-center py-16 gap-3`}>
          <div className="w-12 h-12 rounded-lg bg-destructive-soft flex items-center justify-center">
            <CircleAlert className="w-6 h-6 text-destructive" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-medium text-foreground">Couldn't load your schedule</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">{error}</p>
          <button onClick={loadData} className={`${btnPrimary} mt-1`}>Retry</button>
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className={cardHead}>
            <SectionTitle icon={CalendarDays}>
              {dayFilters.find((f) => f.key === dayFilter)?.label ?? 'Schedule'}
            </SectionTitle>
            <span className="text-xs text-muted-foreground">{filtered.length} appointment{filtered.length === 1 ? '' : 's'}</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((slot) => (
              <div key={slot.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors">
                <div className={`w-[3px] h-11 rounded-full shrink-0 ${scheduleStatus[slot.status]?.dot ?? 'bg-muted-foreground/50'}`} />
                <div className="w-20 shrink-0">
                  <p className="text-sm font-semibold text-foreground tabular-nums">{slot.time}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(slot.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
                <div className={`${slot.color} w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>{slot.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{slot.patientName}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      {slot.type === 'Video' ? <Video className="w-3.5 h-3.5" strokeWidth={1.75} /> : <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />}
                      {slot.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{slot.reason}</p>
                </div>
                <StatusPill className={appointmentStatus[slot.status]?.class ?? 'bg-muted text-muted-foreground'}>
                  {appointmentStatus[slot.status]?.label ?? slot.status}
                </StatusPill>
                <button className={iconBtn}>
                  <MoreHorizontal className="w-5 h-5" strokeWidth={1.75} />
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No appointments</p>
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

interface RecordFileItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
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
  grant_id: string;
  grant_expires_at: string;
  files: RecordFileItem[];
}

function PatientsSection({
  initialPatientId,
  onInitialPatientConsumed,
}: {
  initialPatientId?: string | null;
  onInitialPatientConsumed?: () => void;
}) {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activePatient, setActivePatient] = useState<PatientCard | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  const [patients, setPatients] = useState<PatientCard[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(initialPatientId ?? null);
  const [rosterWarning, setRosterWarning] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      // Scope the list to this provider's own caseload. Without this the
      // section listed every patient registered on CareLink.
      const roster = await fetchRoster(profile.id);
      setRosterWarning(
        roster.tableMissing
          ? 'Showing patients from your appointment book only — run the provider_patients migration to keep a saved patient list.'
          : null
      );

      const { data: pats, error: patErr } = roster.patientIds.length
        ? await supabase
            .from('profiles')
            .select('id, full_name, age, gender, blood_type, condition, last_visit, next_appointment, status')
            .eq('role', 'patient')
            .in('id', roster.patientIds)
            .order('full_name', { ascending: true })
        : { data: [], error: null };

      // Only pull records this provider currently has consent for — a row in
      // access_grants that isn't revoked and hasn't passed its expiry. This is
      // the client-side mirror of the RLS policy; the DB is the real gate,
      // this just avoids rendering something the query already excludes.
      const nowIso = new Date().toISOString();
      const { data: grantRows, error: recErr } = await supabase
        .from('access_grants')
        .select(
          `id, expires_at, revoked_at,
           medical_records (
             id, patient_id, title, category, provider, date, summary, icon,
             record_files ( id, file_name, file_type, file_size, file_path )
           )`
        )
        .eq('doctor_id', profile.id)
        .is('revoked_at', null)
        .gt('expires_at', nowIso);

      if (patErr) throw patErr;
      if (recErr) throw recErr;

      const mapped: RecordItem[] = (grantRows ?? [])
        .filter((g: any) => g.medical_records)
        .map((g: any) => ({
          id: g.medical_records.id,
          patient_id: g.medical_records.patient_id,
          title: g.medical_records.title,
          category: g.medical_records.category,
          provider: g.medical_records.provider,
          date: g.medical_records.date,
          summary: g.medical_records.summary,
          icon: g.medical_records.icon,
          grant_id: g.id,
          grant_expires_at: g.expires_at,
          files: g.medical_records.record_files ?? [],
        }));

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
      setRecords(mapped.sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading your patients.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // A patient chosen from the Overview quick action arrives as a prop.
  useEffect(() => {
    if (initialPatientId) setPendingSelectId(initialPatientId);
  }, [initialPatientId]);

  // Open the chosen patient's chart once the list has finished loading. Runs
  // after every load, so a patient who registered while this tab was open is
  // still found after the refresh triggered on selection.
  useEffect(() => {
    if (!pendingSelectId || loading) return;
    const match = patients.find((p) => p.id === pendingSelectId);
    if (match) {
      setActivePatient(match);
      setQuery('');
      setStatusFilter('all');
    }
    setPendingSelectId(null);
    onInitialPatientConsumed?.();
  }, [pendingSelectId, patients, loading, onInitialPatientConsumed]);

  const filtered = patients.filter((p) => {
    const matchesQuery = !query.trim() || p.full_name.toLowerCase().includes(query.toLowerCase()) || (p.condition ?? '').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (p.status ?? '') === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const handleRemove = async (patientId: string) => {
    if (!profile) return;
    setRemovingId(patientId);
    const err = await removePatientFromRoster(profile.id, patientId);
    setRemovingId(null);
    if (err) {
      setError(err);
      return;
    }
    if (activePatient?.id === patientId) setActivePatient(null);
    await loadData();
  };

  const recordsFor = (patientId: string) => records.filter((r) => r.patient_id === patientId);
  const activeRecords = activePatient ? recordsFor(activePatient.id) : [];

  const openFile = async (file: RecordFileItem) => {
    const { data, error: signErr } = await supabase.storage
      .from('medical-records')
      .createSignedUrl(file.file_path, 60);
    if (signErr || !data) {
      console.error('Signed URL error:', signErr);
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{longDate(new Date())}</p>
          <h1 className="font-heading text-[28px] md:text-[34px] font-semibold text-foreground tracking-tight leading-tight mt-1">My Patients</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {patients.length === 0
              ? 'No patients on your list yet.'
              : `${patients.length} patient${patients.length === 1 ? '' : 's'} under your care.`}
          </p>
        </div>
        <button onClick={() => setSearchOpen(true)} className={btnPrimary}>
          <UserPlus className="w-4 h-4" strokeWidth={2} />
          Add Patient
        </button>
      </div>

      {rosterWarning && (
        <div className="p-3.5 rounded-md bg-warning-soft border border-warning/25 text-warning text-sm flex items-start gap-2.5">
          <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" strokeWidth={1.75} />
          <span>{rosterWarning}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Search your patients by name or condition..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
          />
        </div>
        <div className="inline-flex items-center gap-1 bg-muted rounded-md p-1 w-fit">
          {patientFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3.5 py-2 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === f.key ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={`${card} flex flex-col items-center justify-center py-20 gap-3`}>
          <Loader2 className="w-6 h-6 text-primary animate-spin" strokeWidth={2} />
          <p className="text-sm text-muted-foreground">Loading patients…</p>
        </div>
      ) : error ? (
        <div className={`${card} flex flex-col items-center justify-center py-16 gap-3`}>
          <div className="w-12 h-12 rounded-lg bg-destructive-soft flex items-center justify-center">
            <CircleAlert className="w-6 h-6 text-destructive" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-medium text-foreground">Couldn't load patients</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">{error}</p>
          <button onClick={loadData} className={`${btnPrimary} mt-1`}>Retry</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const accessible = recordsFor(p.id).length;
            return (
              <div key={p.id} className={`${card} flex flex-col hover:border-primary/40 hover:shadow-[0_4px_12px_rgba(16,24,40,0.06)] transition-all`}>
                <div className="flex items-start justify-between gap-3 px-5 pt-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`${p.color} w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0`}>{p.initials}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">{p.age} yrs · {p.gender} · {p.blood_type}</p>
                    </div>
                  </div>
                  <StatusPill className={patientStatus[p.status ?? 'stable']?.class ?? 'bg-accent text-primary'}>
                    {patientStatus[p.status ?? 'stable']?.label ?? 'Stable'}
                  </StatusPill>
                </div>

                <div className="px-5 py-4 space-y-2.5 flex-1">
                  <div className="flex items-center gap-2.5 text-sm">
                    <Stethoscope className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    <span className="text-foreground font-medium truncate">{p.condition ?? 'No condition on file'}</span>
                  </div>
                  {p.last_visit && (
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <History className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      <span>Last visit: {new Date(p.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                  {p.next_appointment && (
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CalendarCheck className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      <span>Next: {new Date(p.next_appointment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    <span>{accessible} record{accessible === 1 ? '' : 's'} shared with you</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted rounded-b-lg">
                  <button
                    onClick={() => setActivePatient(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-card border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors cursor-pointer whitespace-nowrap"
                  >
                    View Records
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => handleRemove(p.id)}
                    disabled={removingId === p.id}
                    title="Remove from my patients"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-destructive-soft hover:text-destructive transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait shrink-0"
                  >
                    {removingId === p.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                    ) : (
                      <UserMinus className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className={`${card} text-center py-16`}>
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
            {patients.length === 0 ? (
              <UserPlus className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
            ) : (
              <UserSearch className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
            )}
          </div>
          {patients.length === 0 ? (
            <>
              <p className="text-sm font-medium text-foreground">Your patient list is empty</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Use Add Patient to search everyone registered on CareLink and bring them onto your list.
              </p>
              <button onClick={() => setSearchOpen(true)} className={`${btnPrimary} mt-4`}>
                <UserPlus className="w-4 h-4" strokeWidth={2} />
                Add your first patient
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">No patients found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter</p>
            </>
          )}
        </div>
      )}

      {activePatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setActivePatient(null)}></div>
          <div className="relative bg-card rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`${activePatient.color} w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0`}>{activePatient.initials}</div>
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-semibold text-foreground tracking-tight truncate">{activePatient.full_name}</h2>
                  <p className="text-xs text-muted-foreground">Medical records · consent-based access</p>
                </div>
              </div>
              <button onClick={() => setActivePatient(null)} className={iconBtn}>
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-6 py-4 bg-muted border-b border-border">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
                <span className="text-foreground">You have access to <strong className="font-semibold text-foreground">{activeRecords.length}</strong> record{activeRecords.length === 1 ? '' : 's'}.</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">Only records this patient has shared with you are shown here.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {activeRecords.length === 0 && (
                <div className="text-center py-12">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto" strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground mt-2">This patient hasn't shared any records with you yet.</p>
                </div>
              )}
              {activeRecords.map((r) => {
                const Icon = recordIcon(r.category);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRecord(r)}
                    className="w-full text-left rounded-md border border-border p-4 bg-card hover:bg-muted hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 bg-accent text-primary">
                        <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <h3 className="font-semibold text-sm text-foreground">{r.title}</h3>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-primary text-[10px] font-semibold">
                              <Check className="w-3 h-3" strokeWidth={2.5} /> Access granted
                            </span>
                            <span className="text-[11px] text-muted-foreground">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.category} · {r.provider}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-2">{r.summary}</p>
                        {r.files.length > 0 && (
                          <p className="text-[11px] text-primary mt-2 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" strokeWidth={2} /> {r.files.length} file{r.files.length === 1 ? '' : 's'} attached
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setSelectedRecord(null)}></div>
          <div className="relative bg-card rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-scale-in shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{selectedRecord.category}</span>
                <h2 className="font-heading text-lg font-semibold text-foreground tracking-tight">{selectedRecord.title}</h2>
              </div>
              <button onClick={() => setSelectedRecord(null)} className={iconBtn}>
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="bg-muted p-4 rounded-md space-y-2">
                <p className="text-xs text-muted-foreground">
                  {selectedRecord.provider && <>Provider: <span className="font-medium text-foreground">{selectedRecord.provider}</span> · </>}
                  Date: <span className="font-medium text-foreground">{new Date(selectedRecord.date).toLocaleDateString()}</span>
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedRecord.summary}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                  Attached Documents ({selectedRecord.files.length})
                </h4>
                {selectedRecord.files.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No files attached to this record.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedRecord.files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => openFile(file)}
                        className="group flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted hover:border-primary/40 transition-colors text-left w-full cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-md bg-accent text-primary flex items-center justify-center shrink-0">
                          {file.file_type.includes('pdf') ? (
                            <FileText className="w-[18px] h-[18px]" strokeWidth={1.75} />
                          ) : (
                            <ImageIcon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{file.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">{(file.file_size / 1024).toFixed(0)} KB</p>
                        </div>
                        <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" strokeWidth={1.75} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {searchOpen && (
        <PatientSearchModal
          existingIds={patients.map((p) => p.id)}
          onClose={() => setSearchOpen(false)}
          onSelect={(patient) => {
            setSearchOpen(false);
            setPendingSelectId(patient.id);
            loadData();
          }}
        />
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

interface PatientOption {
  id: string;
  full_name: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  condition: string | null;
  status: string | null;
}

/** True when PostgREST reports the table itself is absent (migration not run). */
function isMissingTableError(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  const code = err.code ?? '';
  const msg = (err.message ?? '').toLowerCase();
  if (code === '42P01' || code === 'PGRST205') return true;
  return msg.includes('relation') && msg.includes('does not exist');
}

interface Roster {
  patientIds: string[];
  tableMissing: boolean;
}

/**
 * The patients this provider is actually working with — never the whole
 * directory. Two sources are merged:
 *   1. explicit roster rows in `provider_patients` (added via Add Patient)
 *   2. anyone already on this provider's appointment book
 * (2) means an existing caseload still shows up before anybody presses Add.
 */
async function fetchRoster(providerId: string): Promise<Roster> {
  const ids = new Set<string>();
  let tableMissing = false;

  const rosterRes = await supabase.from('provider_patients').select('patient_id').eq('provider_id', providerId);
  if (rosterRes.error) {
    if (isMissingTableError(rosterRes.error)) tableMissing = true;
    else throw rosterRes.error;
  } else {
    for (const row of rosterRes.data ?? []) {
      const id = (row as { patient_id: string | null }).patient_id;
      if (id) ids.add(id);
    }
  }

  const apptRes = await supabase.from('appointments').select('patient_id').eq('provider_id', providerId);
  if (!apptRes.error) {
    for (const row of apptRes.data ?? []) {
      const id = (row as { patient_id: string | null }).patient_id;
      if (id) ids.add(id);
    }
  }

  return { patientIds: [...ids], tableMissing };
}

/** Returns an error message, or null on success (including "already added"). */
async function addPatientToRoster(providerId: string, patientId: string): Promise<string | null> {
  const { error } = await supabase
    .from('provider_patients')
    .insert({ provider_id: providerId, patient_id: patientId });
  if (!error) return null;
  if (error.code === '23505') return null; // unique violation — already on the roster
  if (isMissingTableError(error)) {
    return 'The provider_patients table is missing. Run the migration in supabase/migrations to save your patient list.';
  }
  return error.message;
}

async function removePatientFromRoster(providerId: string, patientId: string): Promise<string | null> {
  const { error } = await supabase
    .from('provider_patients')
    .delete()
    .eq('provider_id', providerId)
    .eq('patient_id', patientId);
  return error ? error.message : null;
}

/** Every registered patient in the database, regardless of who added them. */
async function fetchPatientOptions(): Promise<PatientOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, age, gender, condition, status')
    .eq('role', 'patient')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PatientOption[];
}

function usePatientOptions() {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPatientOptions()
      .then((rows) => {
        if (alive) setPatients(rows);
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof Error ? e.message : 'Could not load the patient directory.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { patients, loading, loadError };
}

function describePatient(p: PatientOption) {
  const bits = [
    p.age != null ? `${p.age} yrs` : null,
    p.gender || null,
    p.condition || null,
    p.email || null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(' \u00b7 ') : 'Registered patient';
}

function matchesPatientQuery(p: PatientOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    p.full_name.toLowerCase().includes(q) ||
    (p.email ?? '').toLowerCase().includes(q) ||
    (p.condition ?? '').toLowerCase().includes(q)
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const modalInputClass =
  'w-full px-3.5 py-2.5 text-sm bg-card border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all';
const modalSearchInputClass =
  'w-full pl-9 pr-3 py-2.5 text-sm bg-card border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all';
const modalLabelClass = 'text-xs font-medium text-foreground mb-1.5 block';
const modalShell =
  'relative bg-card rounded-lg w-full max-w-md shadow-2xl';

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h3 className="font-heading text-lg font-semibold text-foreground tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <button onClick={onClose} className={iconBtn}>
        <X className="w-5 h-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function PatientResultRow({
  patient,
  onSelect,
  badge,
  busy,
}: {
  patient: PatientOption;
  onSelect: () => void;
  badge?: string | undefined;
  busy?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={busy}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
    >
      <div className="w-9 h-9 rounded-full bg-accent text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
        {initialsOf(patient.full_name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{patient.full_name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{describePatient(patient)}</p>
      </div>
      {badge && !busy && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-accent text-primary shrink-0 whitespace-nowrap">
          {badge}
        </span>
      )}
      {busy ? (
        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" strokeWidth={2} />
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
      )}
    </button>
  );
}

/**
 * Type-ahead patient selector used by every provider modal. Searches the whole
 * patient directory by name, email or condition rather than showing a raw
 * dropdown, which stops being usable once there are more than a few patients.
 */
function PatientPicker({
  patients,
  loading,
  loadError,
  value,
  onChange,
}: {
  patients: PatientOption[];
  loading: boolean;
  loadError: string | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = patients.find((p) => p.id === value) ?? null;

  if (selected) {
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-md border border-primary/25 bg-accent">
        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0">
          {initialsOf(selected.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{selected.full_name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{describePatient(selected)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setQuery('');
          }}
          className="text-xs font-semibold text-primary hover:text-primary px-2 py-1 rounded-md hover:bg-card/70 cursor-pointer whitespace-nowrap"
        >
          Change
        </button>
      </div>
    );
  }

  const matches = patients.filter((p) => matchesPatientQuery(p, query));

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search registered patients by name…"
          className={modalSearchInputClass}
        />
      </div>
      <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border divide-y divide-border">
        {loading && <p className="px-3 py-3 text-xs text-muted-foreground">Loading the patient directory…</p>}
        {!loading && loadError && <p className="px-3 py-3 text-xs text-destructive">{loadError}</p>}
        {!loading && !loadError && matches.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            {query.trim() ? `No registered patient matches “${query.trim()}”.` : 'No registered patients yet.'}
          </p>
        )}
        {matches.slice(0, 50).map((p) => (
          <PatientResultRow key={p.id} patient={p} onSelect={() => onChange(p.id)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Full directory search. Backs both "Add Patient" (Patients tab) and
 * "New Patient" (Overview quick actions) — picking a result opens that
 * patient's chart.
 */
function PatientSearchModal({
  onClose,
  onSelect,
  existingIds = [],
}: {
  onClose: () => void;
  onSelect: (patient: PatientOption) => void;
  existingIds?: string[];
}) {
  const { profile } = useAuth();
  const { patients, loading, loadError } = usePatientOptions();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const matches = patients.filter((p) => matchesPatientQuery(p, query));

  // Selecting somebody adds them to this provider's roster, then opens them.
  const choose = async (patient: PatientOption) => {
    if (!profile) return;
    setAddError(null);
    if (!existingIds.includes(patient.id)) {
      setBusyId(patient.id);
      const err = await addPatientToRoster(profile.id, patient.id);
      setBusyId(null);
      if (err) {
        setAddError(err);
        return;
      }
    }
    onSelect(patient);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose}></div>
      <div className={`${modalShell} p-6 max-h-[90vh] flex flex-col`}>
        <ModalHeader
          title="Add Patient"
          subtitle="Search every registered patient on CareLink. Choosing one adds them to your patient list."
          onClose={onClose}
        />

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or condition…"
            className={modalSearchInputClass}
          />
        </div>

        <p className="text-[11px] text-muted-foreground mt-2 shrink-0">
          {loading ? 'Loading…' : `${matches.length} of ${patients.length} patients`}
        </p>

        <div className="mt-2 flex-1 overflow-y-auto rounded-md border border-border divide-y divide-border min-h-[120px]">
          {loading && <p className="px-3 py-4 text-xs text-muted-foreground">Loading the patient directory…</p>}
          {!loading && loadError && <p className="px-3 py-4 text-xs text-destructive">{loadError}</p>}
          {!loading && !loadError && matches.length === 0 && (
            <div className="px-4 py-10 text-center">
              <UserSearch className="w-7 h-7 text-muted-foreground mx-auto" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground mt-2">
                {query.trim() ? `No registered patient matches “${query.trim()}”.` : 'No registered patients yet.'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Patients appear here as soon as they create a CareLink account.
              </p>
            </div>
          )}
          {matches.map((p) => (
            <PatientResultRow
              key={p.id}
              patient={p}
              onSelect={() => choose(p)}
              badge={existingIds.includes(p.id) ? 'Already yours' : undefined}
              busy={busyId === p.id}
            />
          ))}
        </div>

        {addError && (
          <p className="mt-3 text-xs text-destructive bg-destructive-soft border border-destructive/25 rounded-md px-3 py-2 shrink-0">
            {addError}
          </p>
        )}
      </div>
    </div>
  );
}

function PrescriptionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const { patients, loading: patientsLoading, loadError: patientsError } = usePatientOptions();
  const [form, setForm] = useState({
    patientId: '',
    medication: '',
    dosage: '',
    frequency: '',
    instructions: '',
    refills: '0',
    // Default to today so the prescription sorts to the top of the patient's list.
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!form.patientId) {
      setError('Search for and select the patient this prescription is for.');
      return;
    }
    if (!form.medication.trim()) {
      setError('Enter a medication name.');
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
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose}></div>
      <div className={`${modalShell} p-6 max-h-[90vh] overflow-y-auto`}>
        <ModalHeader title="Write Prescription" onClose={onClose} />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={modalLabelClass}>Prescribe to</label>
            <PatientPicker
              patients={patients}
              loading={patientsLoading}
              loadError={patientsError}
              value={form.patientId}
              onChange={(id) => setForm((f) => ({ ...f, patientId: id }))}
            />
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
          {error && <p className="text-xs text-destructive bg-destructive-soft border border-destructive/25 rounded-md px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed`}>
            {submitting ? 'Saving…' : 'Issue Prescription'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AppointmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const { patients, loading: patientsLoading, loadError: patientsError } = usePatientOptions();
  const [form, setForm] = useState({ patientId: '', date: '', time: '', type: 'In-person', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose}></div>
      <div className={`${modalShell} p-6`}>
        <ModalHeader title="New Appointment" onClose={onClose} />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={modalLabelClass}>Patient</label>
            <PatientPicker
              patients={patients}
              loading={patientsLoading}
              loadError={patientsError}
              value={form.patientId}
              onChange={(id) => setForm((f) => ({ ...f, patientId: id }))}
            />
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
          {error && <p className="text-xs text-destructive bg-destructive-soft border border-destructive/25 rounded-md px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed`}>
            {submitting ? 'Scheduling…' : 'Schedule Appointment'}
          </button>
        </form>
      </div>
    </div>
  );
}

const LAB_FILE_BUCKET = 'medical-records';
const MAX_LAB_FILE_BYTES = 10 * 1024 * 1024;

/**
 * True when PostgREST rejects the insert because the attachment columns
 * haven't been added to `test_results` yet. Lets us still save the reading
 * itself instead of failing the whole upload.
 */
function isMissingColumnError(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  const code = err.code ?? '';
  const msg = (err.message ?? '').toLowerCase();
  if (code === 'PGRST204' || code === '42703') return true;
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
}

function LabResultModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { patients, loading: patientsLoading, loadError: patientsError } = usePatientOptions();
  const [form, setForm] = useState({ patientId: '', testName: '', category: '', result: '', unit: '', normalRange: '', status: 'normal', lab: '' });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pickFile = (picked: File) => {
    if (picked.size > MAX_LAB_FILE_BYTES) {
      setError(`${picked.name} is larger than 10 MB.`);
      return;
    }
    setError(null);
    setFile(picked);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.patientId) {
      setError('Search for and select the patient this result belongs to.');
      return;
    }
    if (!form.testName.trim() || !form.result.trim()) {
      setError('Enter a test name and a result.');
      return;
    }
    setSubmitting(true);

    // 1. Upload the report first — nothing is written to the database if the
    //    file fails, so we never leave a result pointing at a missing object.
    let uploadedPath: string | null = null;
    if (file) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `lab-results/${form.patientId}/${crypto.randomUUID()}-${cleanName}`;
      const { error: upErr } = await supabase.storage
        .from(LAB_FILE_BUCKET)
        .upload(filePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (upErr) {
        setSubmitting(false);
        setError(`Could not upload ${file.name}: ${upErr.message}`);
        return;
      }
      uploadedPath = filePath;
    }

    const base = {
      patient_id: form.patientId,
      test_name: form.testName.trim(),
      category: form.category.trim() || null,
      result: form.result.trim(),
      unit: form.unit.trim() || null,
      normal_range: form.normalRange.trim() || null,
      status: form.status,
      date: new Date().toISOString().slice(0, 10),
      lab: form.lab.trim() || null,
    };

    const payload: Record<string, unknown> = { ...base };
    if (uploadedPath && file) {
      payload['file_path'] = uploadedPath;
      payload['file_name'] = file.name;
      payload['file_type'] = file.type || 'application/octet-stream';
      payload['file_size'] = file.size;
    }

    let insErr = (await supabase.from('test_results').insert(payload)).error;

    // 2. If the attachment columns aren't migrated yet, keep the reading and
    //    drop the file rather than losing the provider's whole entry.
    let attachmentSkipped = false;
    if (insErr && uploadedPath && isMissingColumnError(insErr)) {
      insErr = (await supabase.from('test_results').insert(base)).error;
      if (!insErr) {
        await supabase.storage.from(LAB_FILE_BUCKET).remove([uploadedPath]);
        uploadedPath = null;
        attachmentSkipped = true;
      }
    }

    if (insErr) {
      if (uploadedPath) await supabase.storage.from(LAB_FILE_BUCKET).remove([uploadedPath]);
      setSubmitting(false);
      setError(insErr.message);
      return;
    }

    setSubmitting(false);
    if (attachmentSkipped) {
      setFile(null);
      setNotice(
        'Result saved, but the file could not be attached \u2014 add the attachment columns to test_results (see GOOGLE-AUTH-SETUP / PROVIDER-FIXES notes).'
      );
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose}></div>
      <div className={`${modalShell} p-6 max-h-[90vh] overflow-y-auto`}>
        <ModalHeader title="Upload Lab Result" onClose={onClose} />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={modalLabelClass}>Patient</label>
            <PatientPicker
              patients={patients}
              loading={patientsLoading}
              loadError={patientsError}
              value={form.patientId}
              onChange={(id) => setForm((f) => ({ ...f, patientId: id }))}
            />
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

          <div>
            <label className={modalLabelClass}>
              Lab report file <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted">
                <div className="w-9 h-9 rounded-md bg-accent text-primary flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => setFile(null)} className={iconBtn}>
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 py-6 px-4 rounded-md border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/60 transition-colors cursor-pointer text-center">
                <CloudUpload className="w-6 h-6 text-primary" strokeWidth={1.75} />
                <span className="text-sm font-medium text-foreground">Click to attach the lab report</span>
                <span className="text-[11px] text-muted-foreground">PDF or image \u00b7 up to 10 MB</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) pickFile(picked);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5">
              The patient can open this from Records → Lab Test Results.
            </p>
          </div>

          {notice && <p className="text-xs text-warning bg-warning-soft border border-warning/25 rounded-md px-3 py-2">{notice}</p>}
          {error && <p className="text-xs text-destructive bg-destructive-soft border border-destructive/25 rounded-md px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed`}>
            {submitting ? (file ? 'Uploading file…' : 'Saving…') : 'Upload Result'}
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
  const [pendingPatientId, setPendingPatientId] = useState<string | null>(null);

  const fullName = profile?.full_name ?? 'Provider';
  const initials = (fullName || 'P').split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'P';
  const roleLabel = profile?.specialty ?? 'Healthcare Provider';

  const go = (s: Section) => {
    setSection(s);
    setMenuOpen(false);
  };

  const openPatient = useCallback((patientId: string) => {
    setPendingPatientId(patientId);
    setSection('patients');
    setMenuOpen(false);
  }, []);

  const clearPendingPatient = useCallback(() => setPendingPatientId(null), []);

  return (
    <div className="flex min-h-screen bg-background font-body text-foreground">
      <Sidebar section={section} onNavigate={go} />

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setMenuOpen(false)}></div>
          <div className="absolute bottom-0 left-0 top-0 flex w-64 flex-col bg-card shadow-2xl">
            <div className="relative">
              <SidebarBrand />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className={`absolute right-4 top-1/2 -translate-y-1/2 ${iconBtn}`}
              >
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            <SidebarNav section={section} onNavigate={go} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardTopBar name={fullName} roleLabel={roleLabel} initials={initials} onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 py-7 md:px-8 md:py-9">
          <div className="mx-auto w-full max-w-7xl">
            {section === 'overview' && <OverviewSection onNavigate={go} onOpenPatient={openPatient} />}
            {section === 'appointments' && <AppointmentsSection />}
            {section === 'patients' && (
              <PatientsSection initialPatientId={pendingPatientId} onInitialPatientConsumed={clearPendingPatient} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}