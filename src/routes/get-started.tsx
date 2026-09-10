import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/get-started')({
  component: EntryPage,
});

const roles = [
  {
    to: '/auth',
    search: { mode: 'signup', role: 'patient' },
    icon: 'ri-user-heart-line',
    title: 'Patient Portal',
    description: 'Access your health profile, medical records, prescriptions, test results, and appointments in one place.',
    cta: 'Continue as Patient',
    accent: 'bg-primary-500',
    tag: 'For individuals',
  },
  {
    to: '/auth',
    search: { mode: 'signup', role: 'provider' },
    icon: 'ri-stethoscope-line',
    title: 'Provider Portal',
    description: 'Manage patients, issue prescriptions, upload lab results, schedule appointments, and run consultations.',
    cta: 'Continue as Provider',
    accent: 'bg-accent-500',
    tag: 'For healthcare workers',
  },
];

const features = [
  { icon: 'ri-shield-check-line', label: 'Secure & private' },
  { icon: 'ri-links-line', label: 'Connected records' },
  { icon: 'ri-heart-pulse-line', label: 'Better outcomes' },
];

function EntryPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background-50">
      {/* Left — Branding / Hero */}
      <div className="relative lg:w-[55%] min-h-[320px] lg:min-h-screen overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=Abstract%20medical%20and%20healthcare%20digital%20art%20illustration%20with%20flowing%20organic%20shapes%2C%20soft%20emerald%20green%20and%20teal%20gradient%20waves%20resembling%20a%20heartbeat%20pulse%20line%2C%20floating%20glowing%20particles%2C%20clean%20modern%20minimal%20aesthetic%2C%20calm%20trustworthy%20mood%2C%20high%20quality%20digital%20render%2C%20no%20text&width=1200&height=1600&seq=carelink-hero-1&orientation=portrait"
          alt="CareLink healthcare illustration"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/55"></div>

        <div className="relative z-10 flex flex-col justify-between h-full p-8 md:p-12">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white">
              <i className="ri-heart-pulse-line text-xl"></i>
            </div>
            <div>
              <p className="font-heading font-bold text-white text-xl leading-none">CareLink</p>
              <p className="text-white/70 text-xs mt-1">Connecting healthcare. Improving lives.</p>
            </div>
          </div>

          {/* Hero copy */}
          <div className="mt-auto pt-10">
            <h1 className="font-heading text-3xl md:text-5xl font-bold text-white leading-tight max-w-xl">
              One connected ecosystem for all your <span className="text-primary-300">healthcare</span>.
            </h1>
            <p className="text-white/85 mt-4 text-sm md:text-base max-w-lg leading-relaxed">
              CareLink unites patients, hospitals, clinics, labs, pharmacies, doctors, and insurers on one secure platform — so your health information is never scattered again.
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              {features.map((f) => (
                <div key={f.label} className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                  <i className={`${f.icon} text-primary-300 text-sm`}></i>
                  <span className="text-xs font-medium text-white">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right — Role selection */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <p className="text-xs font-semibold text-primary-600 uppercase tracking-widest mb-2">Welcome to CareLink</p>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground-900">How would you like to continue?</h2>
          <p className="text-sm text-foreground-500 mt-2 mb-8">Choose your portal to access the right dashboard.</p>

          <div className="space-y-4">
            {roles.map((role) => (
              <Link
                key={role.title}
                to={role.to}
                search={role.search}
                className="group block bg-white rounded-2xl border border-background-200/70 p-6 transition-all hover:border-primary-300 hover:-translate-y-0.5 cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className={`${role.accent} w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <i className={`${role.icon} text-xl`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading font-bold text-foreground-900 text-lg">{role.title}</h3>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">{role.tag}</span>
                    </div>
                    <p className="text-sm text-foreground-500 mt-1.5 leading-relaxed">{role.description}</p>
                    <div className="flex items-center gap-1.5 mt-4 text-sm font-semibold text-primary-600">
                      {role.cta}
                      <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1"></i>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs text-foreground-400 mt-8">
            By continuing you agree to CareLink's Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
