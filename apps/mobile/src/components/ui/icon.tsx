import type { SVGProps } from "react";

// Stroke icons from the prototype's sprite (24×24 grid, currentColor).
const paths = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  package: <path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  user: <path d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21a8 8 0 0 1 16 0" />,
  search: <path d="M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0m2 9-3.5-3.5" />,
  "chev-l": <path d="m15 18-6-6 6-6" />,
  "chev-r": <path d="m9 18 6-6-6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  pass: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-13 0 2.5 2.5L16 9" />,
  fail: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-6-3-6 6m0-6 6 6" />,
  unknown: (
    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
  ),
  na: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M8 12h8" />,
  info: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9 4v-4m0-4h.01" />,
  clock: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-5v5l3 2" />,
  alert: (
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4m0 4h.01" />
  ),
  lock: (
    <path d="M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m2 0V7a4 4 0 0 1 8 0v4" />
  ),
  eye: (
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
  ),
  refresh: (
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16m0-4a9 9 0 0 1 15.5-6.3L21 8m0-5v5h-5M3 21v-5h5" />
  ),
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3" />,
  file: (
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm0 0v6h6M8 13h8m-8 4h5" />
  ),
  monitor: (
    <path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m4 18h8m-4-4v4" />
  ),
  shield: <path d="M12 3 4 6v6c0 5 3.4 8.6 8 9.9 4.6-1.3 8-4.9 8-9.9V6zm-3.5 9 2.5 2.5 4.5-5" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />,
  globe: (
    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.4 11h11L21 7H6.2" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </>
  ),
  link: (
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  ),
  "wifi-off": (
    <path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5a15 15 0 0 1 11.3 3.8M16.9 11.3a10 10 0 0 1 2.2 1.7M2 2l20 20" />
  ),
  share: (
    <path d="M12 3v12M8 7l4-4 4 4M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
  ),
  "plus-square": (
    <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m7 5v8m-4-4h8" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  sparkle: <path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6" />,
} as const;

export type IconName = keyof typeof paths;

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & { name: IconName; size?: number };

export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
