import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createFileRoute, useNavigate, useSearch, Link } from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import UserAvatar from '@/components/base/UserAvatar';

export const Route = createFileRoute('/onboarding')({
  component: ProviderOnboarding,
});

/* ----------------------------- Option data ----------------------------- */

interface PractitionerGroup {
  group: string;
  icon: string;
  options: string[];
}

const practitionerGroups: PractitionerGroup[] = [
  {
    group: 'Primary & general care',
    icon: 'ri-stethoscope-line',
    options: ['General Practitioner', 'Family Physician', 'Internal Medicine Physician', 'Paediatrician', 'Community Health Officer'],
  },
  {
    group: 'Medical specialties',
    icon: 'ri-heart-pulse-line',
    options: [
      'Cardiologist',
      'Neurologist',
      'Pulmonologist',
      'Endocrinologist',
      'Gastroenterologist',
      'Nephrologist',
      'Oncologist',
      'Dermatologist',
      'Psychiatrist',
      'Rheumatologist',
      'Infectious Disease Specialist',
    ],
  },
  {
    group: 'Surgical specialties',
    icon: 'ri-scissors-cut-line',
    options: [
      'General Surgeon',
      'Neurosurgeon',
      'Orthopaedic Surgeon',
      'Cardiothoracic Surgeon',
      'Obstetrician & Gynaecologist',
      'Ophthalmologist',
      'ENT Surgeon',
      'Urologist',
      'Anaesthesiologist',
    ],
  },
  {
    group: 'Nursing & midwifery',
    icon: 'ri-nurse-line',
    options: ['Registered Nurse', 'Nurse Practitioner', 'Midwife', 'Public Health Nurse'],
  },
  {
    group: 'Allied health',
    icon: 'ri-mental-health-line',
    options: [
      'Dietician / Nutritionist',
      'Physiotherapist',
      'Pharmacist',
      'Dentist',
      'Clinical Psychologist',
      'Medical Laboratory Scientist',
      'Radiographer',
      'Optometrist',
      'Occupational Therapist',
      'Speech & Language Therapist',
    ],
  },
];

const titleOptions = ['Dr.', 'Prof.', 'Nurse', 'Mr.', 'Mrs.', 'Ms.', 'Pharm.'];

const consultationOptions = [
  { key: 'In-person', icon: 'ri-hospital-line', sub: 'At your clinic' },
  { key: 'Video', icon: 'ri-vidicon-line', sub: 'Remote consults' },
  { key: 'Home visit', icon: 'ri-home-heart-line', sub: 'At the patient' },
  { key: 'Phone', icon: 'ri-phone-line', sub: 'Voice only' },
];

const dayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const languageOptions = ['English', 'Hausa', 'Yoruba', 'Igbo', 'Pidgin', 'French', 'Arabic', 'Fulfulde', 'Kanuri'];

const experienceOptions = [
  { label: 'Under 2 years', value: 1 },
  { label: '2 – 5 years', value: 3 },
  { label: '6 – 10 years', value: 8 },
  { label: '11 – 20 years', value: 15 },
  { label: 'Over 20 years', value: 25 },
];

const steps = [
  { key: 'practice', label: 'Your practice', hint: 'What you do' },
  { key: 'credentials', label: 'Credentials', hint: 'Where you work' },
  { key: 'availability', label: 'How you work', hint: 'Visits and hours' },
  { key: 'profile', label: 'About you', hint: 'Bio and review' },
] as const;

/* ------------------------------- Helpers ------------------------------- */

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** PostgREST rejects the write when the onboarding columns haven't been added yet. */
function isMissingColumnError(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  const code = err.code ?? '';
  const msg = (err.message ?? '').toLowerCase();
  if (code === 'PGRST204' || code === '42703') return true;
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-3.5 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const labelClass = 'mb-1.5 block text-sm font-semibold text-foreground';
const hintClass = 'mt-1.5 text-xs text-muted-foreground';

/* ------------------------------ Primitives ----------------------------- */

function Chip({
  label,
  active,
  onClick,
  showCheck = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  showCheck?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-primary bg-accent text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {showCheck && active && <i className="ri-check-line text-sm" aria-hidden="true"></i>}
      {label}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

/** A row in the live preview, dimmed until the answer exists. */
function PreviewRow({ icon, value, placeholder }: { icon: string; value: string; placeholder: string }) {
  const filled = value.trim().length > 0;
  return (
    <div className="flex items-start gap-2.5">
      <i className={`${icon} mt-0.5 shrink-0 text-sm opacity-70`} aria-hidden="true"></i>
      <span className={`text-xs leading-5 ${filled ? 'opacity-95' : 'opacity-45'}`}>{filled ? value : placeholder}</span>
    </div>
  );
}

/* ------------------------------ Component ------------------------------ */

function ProviderOnboarding() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { edit?: string };
  const isEditing = search.edit === '1';
  const { user, profile, loading, avatarUrl, refreshProfile, signOut } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practitionerQuery, setPractitionerQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    title: '',
    specialty: '',
    customSpecialty: '',
    licenseNumber: '',
    yearsExperience: null as number | null,
    hospital: '',
    practiceAddress: '',
    phone: '',
    consultationModes: [] as string[],
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
    workingHours: '9:00 AM – 5:00 PM',
    languages: ['English'] as string[],
    acceptingPatients: true,
    bio: '',
  });

  // Prefill from whatever the profile already holds, so re-running the flow
  // from the dashboard edits rather than blanks the existing answers.
  useEffect(() => {
    if (!profile) return;
    const known = practitionerGroups.some((g) => g.options.includes(profile.specialty ?? ''));
    setForm((f) => ({
      ...f,
      title: profile.title ?? f.title,
      specialty: known ? (profile.specialty ?? '') : f.specialty,
      customSpecialty: !known && profile.specialty ? profile.specialty : f.customSpecialty,
      licenseNumber: profile.license_number ?? f.licenseNumber,
      yearsExperience: profile.years_experience ?? f.yearsExperience,
      hospital: profile.hospital ?? f.hospital,
      practiceAddress: profile.practice_address ?? f.practiceAddress,
      phone: profile.phone ?? f.phone,
      consultationModes: profile.consultation_modes ?? f.consultationModes,
      workingDays: profile.working_days ?? f.workingDays,
      workingHours: profile.working_hours ?? f.workingHours,
      languages: profile.languages ?? f.languages,
      acceptingPatients: profile.accepting_patients ?? f.acceptingPatients,
      bio: profile.bio ?? f.bio,
    }));
  }, [profile]);

  // Route guards: this page is for signed-in providers only.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: '/auth', replace: true });
      return;
    }
    if (!profile) {
      navigate({ to: '/auth', replace: true });
      return;
    }
    if (profile.role !== 'provider') {
      navigate({ to: '/patient', replace: true });
      return;
    }
    if (profile.onboarding_completed && !isEditing) {
      navigate({ to: '/provider', replace: true });
    }
  }, [loading, user, profile, isEditing, navigate]);

  // Moving between steps swaps the whole panel; send focus back to the top of it
  // so screen readers and keyboard users don't stay parked on the old content.
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [step]);

  const resolvedSpecialty = (form.specialty === 'Other' ? form.customSpecialty : form.specialty).trim();

  const filteredGroups = useMemo(() => {
    const q = practitionerQuery.trim().toLowerCase();
    if (!q) return practitionerGroups;
    return practitionerGroups
      .map((g) => ({ ...g, options: g.options.filter((o) => o.toLowerCase().includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [practitionerQuery]);

  const stepValid = (index: number) => {
    if (index === 0) return resolvedSpecialty.length > 0;
    if (index === 1) return form.hospital.trim().length > 0;
    if (index === 2) return form.consultationModes.length > 0 && form.workingDays.length > 0;
    return true;
  };

  const goNext = () => {
    if (!stepValid(step)) {
      setError(
        step === 0
          ? 'Pick the kind of practitioner you are.'
          : step === 1
            ? 'Tell us where you practise.'
            : 'Choose at least one consultation type and one working day.'
      );
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleFinish = async () => {
    if (!profile) return;
    if (!stepValid(0) || !stepValid(1) || !stepValid(2)) {
      setError('Some earlier answers are still missing. Step back and complete them.');
      return;
    }
    setSaving(true);
    setError(null);

    const firstName = profile.first_name ?? profile.full_name.trim().split(/\s+/)[0] ?? '';
    const payload: Record<string, unknown> = {
      title: form.title || null,
      specialty: resolvedSpecialty,
      license_number: form.licenseNumber.trim() || null,
      years_experience: form.yearsExperience,
      hospital: form.hospital.trim(),
      practice_address: form.practiceAddress.trim() || null,
      phone: form.phone.trim() || null,
      consultation_modes: form.consultationModes,
      working_days: form.workingDays,
      working_hours: form.workingHours.trim() || null,
      languages: form.languages,
      accepting_patients: form.acceptingPatients,
      bio: form.bio.trim() || null,
      onboarding_completed: true,
      onboarded_at: new Date().toISOString(),
      first_name: firstName,
    };

    const { error: updErr } = await supabase.from('profiles').update(payload).eq('id', profile.id);

    if (updErr) {
      setSaving(false);
      setError(
        isMissingColumnError(updErr)
          ? 'Your database is missing the onboarding columns. Run the migration in supabase/migrations, then try again.'
          : updErr.message
      );
      return;
    }

    await refreshProfile();
    setSaving(false);
    navigate({ to: '/provider', replace: true });
  };

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background font-body">
        <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
          <i className="ri-heart-pulse-line animate-pulse text-lg" aria-hidden="true"></i>
        </div>
        <p className="text-sm text-muted-foreground">Preparing your setup…</p>
      </div>
    );
  }

  /* ---- the card patients will see, built live from the answers ---- */

  const displayName = [form.title, profile.full_name].filter(Boolean).join(' ');
  const availability =
    form.workingDays.length > 0
      ? `${form.workingDays.join(' · ')}${form.workingHours.trim() ? `, ${form.workingHours.trim()}` : ''}`
      : '';

  const previewCard = (
    <div className="rounded-lg bg-primary p-5 text-primary-foreground">
      <div className="mb-4 flex items-center gap-3">
        <UserAvatar
          src={avatarUrl}
          initials={(profile.full_name || 'P').charAt(0).toUpperCase()}
          alt={profile.full_name}
          className="size-11 shrink-0 rounded-full text-sm font-bold"
          fallbackClassName="bg-primary-foreground/20 text-primary-foreground"
        />
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-bold leading-tight">{displayName}</p>
          <p className={`truncate text-xs ${resolvedSpecialty ? 'opacity-90' : 'opacity-50'}`}>
            {resolvedSpecialty || 'Your role appears here'}
          </p>
        </div>
      </div>

      <div className="space-y-2.5 border-t border-primary-foreground/20 pt-4">
        <PreviewRow icon="ri-hospital-line" value={form.hospital.trim()} placeholder="Where you practise" />
        <PreviewRow icon="ri-map-pin-line" value={form.practiceAddress.trim()} placeholder="Practice address" />
        <PreviewRow icon="ri-calendar-check-line" value={availability} placeholder="Days and hours" />
        <PreviewRow icon="ri-video-chat-line" value={form.consultationModes.join(', ')} placeholder="How you consult" />
        <PreviewRow icon="ri-translate-2" value={form.languages.join(', ')} placeholder="Languages" />
      </div>

      {form.bio.trim() && (
        <p className="mt-4 border-t border-primary-foreground/20 pt-4 text-xs leading-5 opacity-90">{form.bio.trim()}</p>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs font-semibold">
        <span
          className={`size-2 rounded-full ${form.acceptingPatients ? 'bg-primary-foreground' : 'bg-primary-foreground/40'}`}
          aria-hidden="true"
        />
        {form.acceptingPatients ? 'Accepting new patients' : 'Not accepting new patients'}
      </div>
    </div>
  );

  /* ------------------------------- Render ------------------------------- */

  return (
    <div className="min-h-screen bg-background font-body text-foreground lg:flex">
      {/* Setup rail — steps on top, live preview underneath */}
      <aside className="border-b border-border bg-card lg:sticky lg:top-0 lg:h-screen lg:w-[22rem] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-20 items-center justify-between gap-3 border-b border-border px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <i className="ri-heart-pulse-line text-lg" aria-hidden="true"></i>
            </div>
            <div>
              <p className="font-heading text-lg font-bold leading-none">CareLink</p>
              <p className="mt-1 text-xs text-muted-foreground">{isEditing ? 'Edit profile' : 'Provider setup'}</p>
            </div>
          </Link>
          <p className="text-xs font-semibold text-muted-foreground lg:hidden">
            {step + 1} / {steps.length}
          </p>
        </div>

        <div className="px-6 py-6">
          <h1 className="font-heading text-xl font-bold leading-snug">
            {isEditing ? 'Update your practice profile' : `Set up your practice, ${profile.first_name ?? 'Doctor'}`}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Patients read this before they share their records with you. It takes about two minutes.
          </p>

          {/* Steps: a real ordered list, since this genuinely is a sequence */}
          <ol className="mt-6 hidden space-y-1 lg:block">
            {steps.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => done && setStep(i)}
                    disabled={!done && !current}
                    aria-current={current ? 'step' : undefined}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                      current
                        ? 'bg-accent text-primary'
                        : done
                          ? 'cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground'
                          : 'text-muted-foreground/60'
                    }`}
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                        current
                          ? 'bg-primary text-primary-foreground'
                          : done
                            ? 'bg-success-soft text-success'
                            : 'bg-muted text-muted-foreground'
                      }`}
                      aria-hidden="true"
                    >
                      {done ? <i className="ri-check-line text-xs"></i> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{s.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Mobile keeps a slim progress bar instead of the full list */}
          <div className="mt-5 lg:hidden">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">{steps[step].label}</p>
          </div>

          <div className="mt-8 hidden lg:block">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">What patients will see</p>
            {previewCard}
          </div>
        </div>
      </aside>

      {/* Form */}
      <main className="min-w-0 flex-1">
        <div
          ref={panelRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-3xl px-5 py-8 outline-none md:px-10 md:py-12"
          onKeyDown={(e) => {
            const el = e.target as HTMLElement;
            if (e.key === 'Enter' && el.tagName !== 'TEXTAREA' && el.tagName !== 'BUTTON') {
              e.preventDefault();
              if (step < steps.length - 1) goNext();
            }
          }}
        >
          {step === 0 && (
            <section>
              <h2 className="font-heading text-2xl font-bold md:text-3xl">What kind of practitioner are you?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Patients search and filter by this, and it appears on every prescription and lab result you issue.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_9rem]">
                <div className="relative">
                  <i
                    className="ri-search-line pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                    aria-hidden="true"
                  ></i>
                  <input
                    type="text"
                    value={practitionerQuery}
                    onChange={(e) => setPractitionerQuery(e.target.value)}
                    placeholder="Search roles — nurse, dietician, neurosurgeon…"
                    aria-label="Search practitioner roles"
                    className={`${inputClass} pl-10`}
                  />
                </div>
                <select
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  aria-label="Title"
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Title…</option>
                  {titleOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 space-y-6">
                {filteredGroups.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center">
                    <p className="text-sm font-semibold">No role matches “{practitionerQuery.trim()}”</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Clear the search and pick <strong className="font-semibold text-foreground">Other</strong> at the
                      bottom to type it in yourself.
                    </p>
                  </div>
                )}
                {filteredGroups.map((g) => (
                  <fieldset key={g.group}>
                    <legend className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                      <i className={`${g.icon} text-primary`} aria-hidden="true"></i>
                      {g.group}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {g.options.map((o) => (
                        <Chip
                          key={o}
                          label={o}
                          showCheck
                          active={form.specialty === o}
                          onClick={() => setForm((f) => ({ ...f, specialty: o }))}
                        />
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="mt-6 border-t border-border pt-6">
                <Chip
                  label="Other — not listed"
                  showCheck
                  active={form.specialty === 'Other'}
                  onClick={() => setForm((f) => ({ ...f, specialty: 'Other' }))}
                />
                {form.specialty === 'Other' && (
                  <input
                    type="text"
                    autoFocus
                    value={form.customSpecialty}
                    onChange={(e) => setForm((f) => ({ ...f, customSpecialty: e.target.value }))}
                    placeholder="Type your specialty"
                    aria-label="Your specialty"
                    className={`${inputClass} mt-3`}
                  />
                )}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h2 className="font-heading text-2xl font-bold md:text-3xl">Where do you practise?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your licence number stays private — it is there so your clinic can verify you.
              </p>

              <div className="mt-7 space-y-5">
                <Field label="Hospital, clinic or practice" hint="Shown on your dashboard and on appointments you schedule.">
                  <input
                    type="text"
                    value={form.hospital}
                    onChange={(e) => setForm((f) => ({ ...f, hospital: e.target.value }))}
                    placeholder="Lakeshore Medical Centre"
                    className={inputClass}
                  />
                </Field>

                <Field label="Practice address">
                  <input
                    type="text"
                    value={form.practiceAddress}
                    onChange={(e) => setForm((f) => ({ ...f, practiceAddress: e.target.value }))}
                    placeholder="14 Admiralty Way, Lekki Phase 1, Lagos"
                    className={inputClass}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Medical licence number">
                    <input
                      type="text"
                      value={form.licenseNumber}
                      onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                      placeholder="MDCN/R/45219"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Work phone">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+234 802 000 0000"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <fieldset>
                  <legend className={labelClass}>Years in practice</legend>
                  <div className="flex flex-wrap gap-2">
                    {experienceOptions.map((o) => (
                      <Chip
                        key={o.label}
                        label={o.label}
                        active={form.yearsExperience === o.value}
                        onClick={() =>
                          setForm((f) => ({ ...f, yearsExperience: f.yearsExperience === o.value ? null : o.value }))
                        }
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h2 className="font-heading text-2xl font-bold md:text-3xl">When and how do you see patients?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This drives the appointment types patients can request and the hours they can pick.
              </p>

              <div className="mt-7 space-y-7">
                <fieldset>
                  <legend className={labelClass}>Consultation types</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {consultationOptions.map((c) => {
                      const active = form.consultationModes.includes(c.key);
                      return (
                        <button
                          key={c.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setForm((f) => ({ ...f, consultationModes: toggle(f.consultationModes, c.key) }))}
                          className={`cursor-pointer rounded-lg border p-4 text-left transition-colors ${
                            active ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <div
                            className={`mb-3 grid size-9 place-items-center rounded-md ${
                              active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <i className={`${c.icon} text-base`} aria-hidden="true"></i>
                          </div>
                          <p className="text-sm font-semibold">{c.key}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className={labelClass}>Working days</legend>
                  <div className="flex flex-wrap gap-2">
                    {dayOptions.map((d) => (
                      <Chip
                        key={d}
                        label={d}
                        active={form.workingDays.includes(d)}
                        onClick={() => setForm((f) => ({ ...f, workingDays: toggle(f.workingDays, d) }))}
                      />
                    ))}
                  </div>
                </fieldset>

                <Field label="Consulting hours">
                  <input
                    type="text"
                    value={form.workingHours}
                    onChange={(e) => setForm((f) => ({ ...f, workingHours: e.target.value }))}
                    placeholder="9:00 AM – 5:00 PM"
                    className={`${inputClass} sm:max-w-xs`}
                  />
                </Field>

                <fieldset>
                  <legend className={labelClass}>Languages you consult in</legend>
                  <div className="flex flex-wrap gap-2">
                    {languageOptions.map((l) => (
                      <Chip
                        key={l}
                        label={l}
                        active={form.languages.includes(l)}
                        onClick={() => setForm((f) => ({ ...f, languages: toggle(f.languages, l) }))}
                      />
                    ))}
                  </div>
                </fieldset>

                <button
                  type="button"
                  role="switch"
                  aria-checked={form.acceptingPatients}
                  onClick={() => setForm((f) => ({ ...f, acceptingPatients: !f.acceptingPatients }))}
                  className="flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
                >
                  <span
                    className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      form.acceptingPatients ? 'bg-primary' : 'bg-muted-foreground/40'
                    }`}
                  >
                    <span
                      className={`size-5 rounded-full bg-card transition-transform ${
                        form.acceptingPatients ? 'translate-x-5' : ''
                      }`}
                    />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Accepting new patients</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Turn this off when your books are full — you keep your existing patients either way.
                    </span>
                  </span>
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h2 className="font-heading text-2xl font-bold md:text-3xl">Introduce yourself to patients</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A short note in plain English. Patients read this before sharing their medical records with you.
              </p>

              <div className="mt-7">
                <Field label="Short bio">
                  <textarea
                    rows={5}
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    maxLength={400}
                    placeholder="I have looked after families in Lekki for eleven years, with a particular interest in managing hypertension and type 2 diabetes."
                    className={`${inputClass} resize-none`}
                  />
                </Field>
                <p className={hintClass}>
                  Optional · <span className="tabular">{form.bio.length}</span>/400 characters
                </p>
              </div>

              {/* The rail is hidden on small screens, so the card comes inline here */}
              <div className="mt-7 lg:hidden">
                <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">What patients will see</p>
                {previewCard}
              </div>

              <div className="mt-7 overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <h3 className="font-heading text-sm font-bold">Everything you entered</h3>
                  <span className="text-xs text-muted-foreground">Tap a row to edit</span>
                </div>
                <dl className="divide-y divide-border">
                  {(
                    [
                      ['Practitioner', [form.title, resolvedSpecialty].filter(Boolean).join(' '), 0],
                      ['Practice', form.hospital.trim(), 1],
                      ['Address', form.practiceAddress.trim(), 1],
                      ['Licence', form.licenseNumber.trim(), 1],
                      ['Experience', experienceOptions.find((o) => o.value === form.yearsExperience)?.label ?? '', 1],
                      ['Consultations', form.consultationModes.join(', '), 2],
                      ['Availability', availability, 2],
                      ['Languages', form.languages.join(', '), 2],
                      ['New patients', form.acceptingPatients ? 'Accepting' : 'Not accepting', 2],
                    ] as [string, string, number][]
                  ).map(([k, v, target]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setStep(target)}
                      className="group flex w-full cursor-pointer items-start gap-4 px-5 py-3 text-left transition-colors hover:bg-muted"
                    >
                      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{k}</dt>
                      <dd className={`min-w-0 flex-1 text-sm ${v ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {v || 'Not set'}
                      </dd>
                      <i
                        className="ri-pencil-line mt-0.5 shrink-0 text-sm text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      ></i>
                    </button>
                  ))}
                </dl>
              </div>
            </section>
          )}

          {error && (
            <div
              role="alert"
              className="mt-7 flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive-soft p-3.5 text-sm text-destructive"
            >
              <i className="ri-error-warning-line mt-0.5 shrink-0" aria-hidden="true"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Controls */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={step === 0 ? () => signOut() : goBack}
              className="cursor-pointer whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {step === 0 ? 'Sign out' : 'Back'}
            </button>

            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-muted-foreground sm:block">
                Step <span className="tabular">{step + 1}</span> of <span className="tabular">{steps.length}</span>
              </p>
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/85"
                >
                  Continue
                  <i className="ri-arrow-right-line text-base" aria-hidden="true"></i>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <i className="ri-loader-4-line animate-spin text-base" aria-hidden="true"></i>}
                  {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Finish setup'}
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            You can change any of this later from your dashboard.
          </p>
        </div>
      </main>
    </div>
  );
}