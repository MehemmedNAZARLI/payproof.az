import { HOLD_PX } from "./pull-model";

const TICKS = 8;

// UIActivityIndicatorView: ticks appear one by one as the pull grows, then the wheel turns.
export function PullSpinner({ spinning }: { spinning: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-0 hidden justify-center in-data-pulling:flex"
      style={{
        top: `calc(var(--pull-top, 0px) + (min(var(--pull, 0px), ${HOLD_PX}px) - 28px) / 2)`,
      }}
    >
      <svg
        viewBox="0 0 28 28"
        className={
          spinning
            ? "text-text-3 size-7 animate-[spin_0.8s_steps(8)_infinite]"
            : "text-text-3 size-7"
        }
        style={spinning ? undefined : { rotate: "calc(var(--pull-progress, 0) * 135deg)" }}
      >
        {Array.from({ length: TICKS }, (_, i) => (
          <line
            key={i}
            x1="14"
            y1="3"
            x2="14"
            y2="8.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            transform={`rotate(${i * 45} 14 14)`}
            style={{
              opacity: spinning
                ? 1 - i / TICKS
                : `clamp(0, calc(var(--pull-progress, 0) * ${TICKS} - ${i}), 1)`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
