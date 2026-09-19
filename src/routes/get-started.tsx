import { createFileRoute, Link } from '@tanstack/react-router';
import BrandPanel from '@/components/base/BrandPanel';
import entryImage from '@/assets/carelink-left-panel.jpg';

export const Route = createFileRoute('/get-started')({
  component: EntryPage,
});

const roles = [
  {
    to: '/auth',
    search: { mode: 'signup', role: 'patient' } as const,
    icon: 'ri-user-heart-line',
    title: 'Patient',
    tag: 'For individuals and families',
    description: 'Keep your records, prescriptions, test results and appointments in one place, and choose who sees them.',
    cta: 'Continue as a patient',
  },
  {
    to: '/auth',
    search: { mode: 'signup', role: 'provider' } as const,
    icon: 'ri-stethoscope-line',
    title: 'Provider',
    tag: 'For doctors, nurses and clinics',
    description: 'Manage your patients, issue prescriptions, upload lab results and run consultations from one dashboard.',
    cta: 'Continue as a provider',
  },
];

const highlights = [
  { icon: 'ri-shield-check-line', label: 'Encrypted and access-controlled' },
  { icon: 'ri-links-line', label: 'Records that follow the patient' },
  { icon: 'ri-time-line', label: 'Set up in under two minutes' },
];

function EntryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-body text-foreground lg:flex-row">
      <BrandPanel
        image={entryImage}
        imageAlt="A doctor and her patient reviewing results together on a tablet"
        headline="One place for everything your care depends on."
        blurb="CareLink connects patients, clinics, labs and pharmacies on a single secure platform, so nobody has to piece your history back together at the worst possible moment."
        highlights={highlights}
        width="lg:w-[55%]"
      />

      {/* Role selection */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">How will you be using CareLink?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This sets up the right dashboard for you. You can only pick one per account.
          </p>

          <div className="mt-8 space-y-3">
            {roles.map((role) => (
              <Link
                key={role.title}
                to={role.to}
                search={role.search}
                className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary hover:bg-accent/40"
              >
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <i className={`${role.icon} text-xl`} aria-hidden="true"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-lg font-bold leading-tight">{role.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{role.tag}</p>
                    <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{role.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      {role.cta}
                      <i
                        className="ri-arrow-right-line transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      ></i>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/auth" search={{ mode: 'signin' }} className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>

          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            By continuing you agree to CareLink's Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}