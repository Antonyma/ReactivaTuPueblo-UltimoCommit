import React from "react";

const baseProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export function IconClose({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconMenu({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export function IconMountain({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}

export function IconUser({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconCalendar({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function IconMap({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </svg>
  );
}

export function IconCheck({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconClock({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function IconMapPin({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function IconUsers({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconTrash({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export function IconMessage({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

export function IconStar({ className = "w-4 h-4", filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function IconPlus({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function IconStore({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
    </svg>
  );
}

export function IconShield({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

export function IconMegaphone({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

export function IconTextSize({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M4 7V5h12v2" />
      <path d="M10 5v14" />
      <path d="M7 19h6" />
      <path d="M16 14h5" />
      <path d="M18.5 11.5v5" />
    </svg>
  );
}

export function IconTarget({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function IconBell({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function IconArrowLeft({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

