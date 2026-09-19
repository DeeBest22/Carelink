import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface UserAvatarProps {
  /** Picture URL. When omitted, initials are shown. */
  src?: string | null;
  /** Fallback text shown when there's no picture (or it fails to load). */
  initials: string;
  /** Sizing + shape, e.g. "w-8 h-8 rounded-full". */
  className?: string;
  /** Colours for the initials fallback. */
  fallbackClassName?: string;
  alt?: string;
}

/**
 * Renders a profile picture with a graceful fallback to initials.
 * Google's lh3.googleusercontent.com URLs need `referrerPolicy="no-referrer"`,
 * otherwise they intermittently 403 once the app is deployed to a custom domain.
 */
export default function UserAvatar({
  src,
  initials,
  className = 'w-8 h-8 rounded-full',
  fallbackClassName = 'bg-primary-500 text-white',
  alt,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt ?? initials}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} object-cover shrink-0 bg-background-100 ring-1 ring-background-200/70`}
      />
    );
  }

  return (
    <div className={`${className} ${fallbackClassName} flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  );
}

/** Convenience wrapper for the currently signed-in user. */
export function CurrentUserAvatar(props: Omit<UserAvatarProps, 'src'>) {
  const { avatarUrl, profile } = useAuth();
  return <UserAvatar {...props} src={avatarUrl} alt={props.alt ?? profile?.full_name ?? 'Your profile picture'} />;
}