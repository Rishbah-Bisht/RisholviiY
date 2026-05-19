// File: src/app/components/DeveloperBadge.tsx
"use client";

/**
 * Floating badge that credits the developer.
 * - Shows a subtle tooltip on hover.
 * - Includes an animated sparkle dot.
 * - Uses the existing `badgeFloat` keyframe from globals.css.
 */
export const DeveloperBadge = () => (
  <div className="group fixed bottom-5 right-5 z-50 flex flex-col items-end gap-1.5">
    {/* Tooltip */}
    <div className="pointer-events-none opacity-0 transition-all duration-300 ease-out
                    group-hover:opacity-100 group-hover:translate-y-0 translate-y-1">
      <div className="rounded-lg bg-[#9B3060]/10 border border-[#9B3060]/20
                      px-3 py-1.5 text-[10px] font-medium text-[#9B3060]
                      whitespace-nowrap backdrop-blur-sm">
        Made with ❤️ in India
      </div>
    </div>

    {/* Badge */}
    <div className="
        flex items-center gap-2.5 rounded-full
        bg-white/80 backdrop-blur-md border border-[#9B3060]/15
        shadow-[0_4px_24px_rgba(155,48,96,0.12)] px-4 py-2
        cursor-default
        hover:shadow-[0_6px_32px_rgba(155,48,96,0.22)]
        hover:border-[#9B3060]/30 hover:scale-[1.03] active:scale-[0.98]
        transition-all duration-300 ease-out
        animate-[badgeFloat_3s_ease-in-out_infinite]
      ">
      {/* Sparkle */}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9B3060] opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#9B3060]" />
      </span>

      {/* Text */}
      <div className="flex flex-col leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#A06080]">
          Designed &amp; Developed By
        </span>
        <span className="text-[13px] font-bold text-[#7B2450] mt-0.5 tracking-tight">
          Rishabh Bisht ✨
        </span>
      </div>
    </div>
  </div>
);
