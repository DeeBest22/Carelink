import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

export interface BrandPanelHighlight {
  icon: string;
  label: string;
}

/**
 * The photo panel that sits to the left of the entry and auth screens.
 *
 * The scrim is a fixed navy (#0b1a2e) rather than a theme token: it has to stay
 * dark in both light and dark mode, since white type sits on top of it.
 *
 * The panel is `lg:h-screen` (a definite height), not `lg:min-h-screen`. The
 * content wrapper inside uses `h-full` to fill it, and percentage heights only
 * resolve against an ancestor with a *definite* height — a `min-height` alone
 * leaves child percentages at 'auto', which silently collapses the overlay and
 * spills the headline below the photo instead of over it. `lg:sticky lg:top-0`
 * then pins the photo in place while the (usually taller) form scrolls next to
 * it, the same pattern the dashboard sidebars use.
 */
export default function BrandPanel({
  image,
  imageAlt,
  headline,
  blurb,
  highlights,
  width = 'lg:w-[52%]',
  footer,
}: {
  image: string;
  imageAlt: string;
  headline: ReactNode;
  blurb: string;
  highlights?: BrandPanelHighlight[];
  /** Tailwind width class for the panel on large screens. */
  width?: string;
  footer?: ReactNode;
}) {
  return (
    <div className={`relative min-h-[15rem] overflow-hidden bg-[#0b1a2e] lg:sticky lg:top-0 lg:h-screen ${width}`}>
      <img
        src={image}
        alt={imageAlt}
        loading="eager"
        decoding="async"
        className="absolute inset-0 size-full object-cover object-[50%_28%]"
      />

      {/* Two scrims: one lifts the whole frame off the photo, one anchors the copy. */}
      <div className="absolute inset-0 bg-[#0b1a2e]/35" aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0b1a2e] via-[#0b1a2e]/70 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-full min-h-[15rem] flex-col justify-between overflow-y-auto p-8 lg:p-12">
        <Link to="/" className="flex w-fit items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <i className="ri-heart-pulse-line text-lg" aria-hidden="true"></i>
          </span>
          <span>
            <span className="block font-heading text-lg font-bold leading-none text-white">CareLink</span>
            <span className="mt-1 block text-xs text-white/70">Connecting healthcare. Improving lives.</span>
          </span>
        </Link>

        <div className="mt-auto hidden pt-12 lg:block">
          <h1 className="max-w-md font-heading text-4xl font-bold leading-[1.15] text-white">{headline}</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/80">{blurb}</p>

          {highlights && highlights.length > 0 && (
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/15 pt-6">
              {highlights.map((h) => (
                <li key={h.label} className="flex items-center gap-2 text-xs font-medium text-white/85">
                  <i className={`${h.icon} text-base text-white/60`} aria-hidden="true"></i>
                  {h.label}
                </li>
              ))}
            </ul>
          )}

          {footer}
        </div>
      </div>
    </div>
  );
}