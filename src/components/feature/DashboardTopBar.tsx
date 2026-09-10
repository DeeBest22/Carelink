import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface DashboardTopBarProps {
  name: string;
  roleLabel: string;
  initials: string;
  onMenuClick: () => void;
}

export default function DashboardTopBar({ name, roleLabel, initials, onMenuClick }: DashboardTopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-background-50/80 backdrop-blur-md border-b border-background-200/60">
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-16">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden w-9 h-9 rounded-lg bg-white border border-background-200 flex items-center justify-center text-foreground-600 hover:bg-background-50 cursor-pointer"
          >
            <i className="ri-menu-line"></i>
          </button>
          <div className="relative hidden sm:block">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-300 text-sm"></i>
            <input
              type="text"
              placeholder="Search..."
              className="w-64 pl-9 pr-4 py-2 text-sm bg-white border border-background-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative w-9 h-9 rounded-lg bg-white border border-background-200 flex items-center justify-center text-foreground-600 hover:bg-background-50 cursor-pointer"
            >
              <i className="ri-notification-3-line"></i>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white"></span>
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-background-200 shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-background-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground-900">Notifications</p>
                  <span className="text-[11px] font-medium text-primary-600">3 new</span>
                </div>
                <div className="divide-y divide-background-100">
                  {[
                    { icon: 'ri-calendar-check-line', text: 'Appointment confirmed for Sep 8', time: '2h ago', color: 'text-primary-600' },
                    { icon: 'ri-flask-line', text: 'New lab result available', time: '5h ago', color: 'text-accent-600' },
                    { icon: 'ri-capsule-line', text: 'Prescription refill approved', time: '1d ago', color: 'text-secondary-600' },
                  ].map((n, i) => (
                    <div key={i} className="px-4 py-3 flex gap-3 hover:bg-background-50 cursor-pointer">
                      <i className={`${n.icon} ${n.color} mt-0.5`}></i>
                      <div>
                        <p className="text-xs text-foreground-800">{n.text}</p>
                        <p className="text-[10px] text-foreground-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative pl-1 md:pl-3 md:border-l md:border-background-200">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="hidden md:block leading-tight text-left">
                <p className="text-sm font-semibold text-foreground-900">{name}</p>
                <p className="text-[11px] text-foreground-400">{roleLabel}</p>
              </div>
              <i className="ri-arrow-down-s-line hidden md:block text-foreground-400 text-sm"></i>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-background-200 shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-background-100">
                  <p className="text-sm font-semibold text-foreground-900">{name}</p>
                  <p className="text-[11px] text-foreground-400">{roleLabel}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-foreground-600 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-logout-box-r-line text-accent-600"></i>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}