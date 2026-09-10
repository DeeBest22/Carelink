import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'carelink-auth-token',
    lock: () => {
      if (typeof navigator === 'undefined' || !navigator.locks) {
        return Promise.resolve(() => {});
      }
      return new Promise<() => void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(() => {});
          }
        };
        const timer = setTimeout(finish, 10000);
        navigator.locks
          .request('carelink_auth_lock', { mode: 'exclusive' }, (lock) => {
            if (lock) finish();
          })
          .catch(finish);
      });
    },
  },
});