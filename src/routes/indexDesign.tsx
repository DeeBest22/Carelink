import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardPlus,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Upload,
} from "lucide-react";
import { useState, type ComponentType } from "react";

export const Route = createFileRoute("/indexDesign")({
  head: () => ({
    meta: [
      { title: "Patient Health Dashboard | CareLink" },
      { name: "description", content: "A secure overview of appointments, medical records, test results, and prescriptions." },
      { property: "og:title", content: "Patient Health Dashboard | CareLink" },
      { property: "og:description", content: "A secure overview of appointments, medical records, test results, and prescriptions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PatientDashboard,
});

type Section = "Overview" | "Appointments" | "Medical Records" | "Prescriptions";

const navigation: Array<{ label: Section; icon: ComponentType<{ className?: string }> }> = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarDays },
  { label: "Medical Records", icon: FileText },
  { label: "Prescriptions", icon: Pill },
];

const summary = [
  { label: "Upcoming visits", value: "2", note: "Next: Oct 28", icon: CalendarDays },
  { label: "Active medications", value: "4", note: "1 refill due", icon: Pill },
  { label: "Latest heart rate", value: "72", unit: "bpm", note: "Within range", icon: HeartPulse },
  { label: "Medical records", value: "18", note: "Updated Oct 15", icon: FileText },
];

const appointments = [
  { month: "OCT", day: "28", title: "Annual Physical Examination", doctor: "Dr. Marcus Chen", time: "09:30 AM" },
  { month: "NOV", day: "12", title: "Cardiology Follow-up", doctor: "Dr. Sarah Jenkins", time: "02:00 PM" },
];

const medications = [
  { name: "Lisinopril", detail: "10mg · Once daily", status: "12 refills remaining", progress: "w-3/4" },
  { name: "Atorvastatin", detail: "20mg · At bedtime", status: "Refill needed soon", progress: "w-1/4" },
];

const results = [
  { name: "Comprehensive Metabolic Panel", date: "Oct 15, 2026", status: "Normal" },
  { name: "Lipid Profile", date: "Oct 15, 2026", status: "Reviewed" },
  { name: "Vitamin D, 25-Hydroxy", date: "Jul 22, 2026", status: "Normal" },
];

function PatientDashboard() {
  const [section, setSection] = useState<Section>("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-body text-foreground lg:flex">
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-overlay lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform lg:sticky lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center gap-3 border-b border-border px-6">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><HeartPulse className="size-5" /></div>
          <div>
            <p className="font-heading text-lg font-bold">CareLink</p>
            <p className="text-xs text-muted-foreground">Patient portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-6" aria-label="Patient navigation">
          <p className="mb-3 px-3 text-xs font-semibold uppercase text-muted-foreground">Workspace</p>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => { setSection(label); setMobileOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${section === label ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Icon className="size-4" />{label}
            </button>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-md p-2">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-heading text-sm font-bold text-primary">JM</div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">Jonathan Miller</p><p className="truncate text-xs text-muted-foreground">Patient ID · 882-10</p></div>
          </div>
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-destructive"><LogOut className="size-4" />Sign out</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:px-8">
          <button aria-label="Open navigation" className="grid size-9 place-items-center rounded-md border border-border lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-4" /></button>
          <label className="hidden w-80 items-center gap-2 rounded-md bg-muted px-3 py-2 md:flex">
            <Search className="size-4 text-muted-foreground" />
            <input className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search records, medications..." />
          </label>
          <div className="flex items-center gap-2">
            <button title="Help" aria-label="Help" className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"><CircleHelp className="size-4" /></button>
            <button title="Notifications" aria-label="Notifications" className="relative grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"><Bell className="size-4" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" /></button>
            <button className="ml-1 inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" /><span className="hidden sm:inline">Book appointment</span></button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-7 md:px-8 md:py-9">
          {section === "Overview" ? <Overview onNavigate={setSection} /> : <SectionPreview section={section} />}
        </main>
      </div>
    </div>
  );
}

function Overview({ onNavigate }: { onNavigate: (section: Section) => void }) {
  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-sm font-medium text-muted-foreground">Friday, September 18</p><h1 className="font-heading text-3xl font-bold">Welcome back, Jonathan</h1><p className="mt-1 text-sm text-muted-foreground">Your health summary is current and ready to review.</p></div>
        <button className="inline-flex items-center gap-2 self-start rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold shadow-sm hover:bg-muted"><Upload className="size-4" />Upload record</button>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map(({ label, value, unit, note, icon: Icon }) => (
          <article key={label} className="rounded-lg border border-border bg-card p-4 md:p-5">
            <div className="mb-5 flex items-center justify-between"><span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span><Icon className="size-4 text-primary" /></div>
            <p className="font-heading text-3xl font-bold">{value} <span className="font-body text-xs font-medium text-muted-foreground">{unit}</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-heading font-bold">Upcoming appointments</h2><p className="text-xs text-muted-foreground">Your next scheduled visits</p></div><button onClick={() => onNavigate("Appointments")} className="text-xs font-semibold text-primary hover:underline">View all</button></div>
            <div className="divide-y divide-border">
              {appointments.map((appointment) => <div key={appointment.title} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-muted text-center"><span className="text-[10px] font-bold text-muted-foreground">{appointment.month}</span><span className="-mt-2 font-heading text-lg font-bold">{appointment.day}</span></div><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{appointment.title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{appointment.doctor} · {appointment.time}</p></div><button title="Open appointment" aria-label={`Open ${appointment.title}`} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><ChevronRight className="size-4" /></button></div>)}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <div className="mb-7 flex items-start justify-between"><div><h2 className="font-heading font-bold">Heart rate trend</h2><p className="text-xs text-muted-foreground">Average resting heart rate · Last 7 days</p></div><span className="rounded-sm bg-success-soft px-2 py-1 text-xs font-semibold text-success">Stable</span></div>
            <div className="relative h-56 overflow-hidden border-b border-l border-border">
              <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-border" /><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" /><div className="absolute inset-x-0 top-3/4 border-t border-dashed border-border" />
              <svg viewBox="0 0 700 220" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-label="Heart rate readings between 68 and 76 beats per minute"><path d="M0 152 C60 145,80 92,140 105 S220 166,280 128 S360 55,420 88 S500 155,560 110 S640 70,700 82 L700 220 L0 220 Z" fill="var(--chart-fill)"/><path d="M0 152 C60 145,80 92,140 105 S220 166,280 128 S360 55,420 88 S500 155,560 110 S640 70,700 82" fill="none" stroke="var(--primary)" strokeWidth="3"/></svg>
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-muted-foreground"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="font-heading font-bold">Current prescriptions</h2><Pill className="size-4 text-primary" /></div>
            <div className="space-y-5 p-5">{medications.map((medication) => <div key={medication.name}><div className="flex items-start gap-3"><div className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-primary"><Pill className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{medication.name}</p><p className="text-xs text-muted-foreground">{medication.detail}</p><div className="mt-3 h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full bg-primary ${medication.progress}`} /></div><p className="mt-1.5 text-[11px] text-muted-foreground">{medication.status}</p></div></div></div>)}</div>
            <button onClick={() => onNavigate("Prescriptions")} className="w-full border-t border-border bg-muted/60 py-3 text-xs font-semibold text-primary hover:bg-muted">Manage prescriptions</button>
          </section>

          <section className="rounded-lg border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-heading font-bold">Recent results</h2><Activity className="size-4 text-primary" /></div><div className="divide-y divide-border">{results.map((result) => <button key={result.name} onClick={() => onNavigate("Medical Records")} className="flex w-full items-center justify-between gap-3 py-3 text-left"><div><p className="text-xs font-semibold">{result.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{result.date}</p></div><span className="text-[11px] font-semibold text-success">{result.status}</span></button>)}</div></section>

          <section className="rounded-lg border border-primary/20 bg-accent/55 p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><h2 className="font-heading text-sm font-bold">Your records are private</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Only providers you approve can access your medical documents.</p></div></div></section>
        </div>
      </div>
    </div>
  );
}

function SectionPreview({ section }: { section: Section }) {
  const Icon = section === "Appointments" ? CalendarDays : section === "Medical Records" ? ClipboardPlus : Pill;
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Patient workspace</p><h1 className="font-heading text-3xl font-bold">{section}</h1></div><section className="rounded-lg border border-border bg-card"><div className="flex items-center gap-3 border-b border-border px-5 py-4"><Icon className="size-5 text-primary" /><h2 className="font-heading font-bold">{section} overview</h2></div><div className="grid min-h-80 place-items-center p-8 text-center"><div><div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-accent text-primary"><Stethoscope className="size-5" /></div><p className="text-sm font-semibold">Your {section.toLowerCase()} are organized here.</p><p className="mt-1 text-xs text-muted-foreground">Select Overview to return to your complete health summary.</p></div></div></section></div>;
}