import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  );
}

export function IconImage(p: IconProps) {
  return (
    <I {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="M21 16.5 16 12l-4.5 4.5L9 14l-6 5" />
    </I>
  );
}

export function IconVideo(p: IconProps) {
  return (
    <I {...p}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10.5 21 8v8l-5-2.5z" />
    </I>
  );
}

export function IconCamera(p: IconProps) {
  return (
    <I {...p}>
      <path d="M4 8.5h3l1.6-2.4h6.8L17 8.5h3A1.5 1.5 0 0 1 21.5 10v7.5A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 4 8.5z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </I>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconPause(p: IconProps) {
  return (
    <I {...p}>
      <rect x="6.5" y="5" width="3.5" height="14" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="3.5" height="14" rx="0.6" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconRestart(p: IconProps) {
  return (
    <I {...p}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.1-5.3" />
      <path d="M4.5 5v5h5" />
    </I>
  );
}

export function IconVolume(p: IconProps) {
  return (
    <I {...p}>
      <path d="M4 10h3.2L12 6v12l-4.8-4H4z" />
      <path d="M16 9.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M18.4 7a5.8 5.8 0 0 1 0 10" />
    </I>
  );
}

export function IconMute(p: IconProps) {
  return (
    <I {...p}>
      <path d="M4 10h3.2L12 6v12l-4.8-4H4z" />
      <path d="M16 10l5 5M21 10l-5 5" />
    </I>
  );
}

export function IconCapture(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconRecord(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconStop(p: IconProps) {
  return (
    <I {...p}>
      <rect x="7" y="7" width="10" height="10" rx="1.4" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconFullscreen(p: IconProps) {
  return (
    <I {...p}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </I>
  );
}

export function IconExitFull(p: IconProps) {
  return (
    <I {...p}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </I>
  );
}

export function IconFlip(p: IconProps) {
  return (
    <I {...p}>
      <path d="M12 4v16" />
      <path d="M7 8 3 12l4 4" />
      <path d="M17 8l4 4-4 4" />
    </I>
  );
}

export function IconSwitch(p: IconProps) {
  return (
    <I {...p}>
      <path d="M7 7h11l-3-3" />
      <path d="M17 17H6l3 3" />
    </I>
  );
}

export function IconSliders(p: IconProps) {
  return (
    <I {...p}>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="2.2" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconClose(p: IconProps) {
  return (
    <I {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </I>
  );
}

export function IconChevron(p: IconProps) {
  return (
    <I {...p}>
      <path d="M6 9l6 6 6-6" />
    </I>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <I {...p}>
      <path d="M12 4v11" />
      <path d="M7.5 11.5 12 16l4.5-4.5" />
      <path d="M5 19h14" />
    </I>
  );
}

export function IconDrop(p: IconProps) {
  return (
    <I {...p}>
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 18h14" />
    </I>
  );
}

export function IconPip(p: IconProps) {
  return (
    <I {...p}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <rect x="12" y="12" width="6.5" height="5" rx="1" fill="currentColor" stroke="none" />
    </I>
  );
}

export function IconInvert(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </I>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#111" stroke="rgba(255,255,255,0.12)" />
      <circle cx="16" cy="16" r="3.1" fill="#fff" />
      <circle cx="16" cy="6.6" r="1.45" fill="#fff" />
      <circle cx="16" cy="25.4" r="1.45" fill="#fff" />
      <circle cx="6.6" cy="16" r="1.45" fill="#fff" />
      <circle cx="25.4" cy="16" r="1.45" fill="#fff" />
      <circle cx="9.3" cy="9.3" r="1.15" fill="#fff" />
      <circle cx="22.7" cy="9.3" r="1.15" fill="#fff" />
      <circle cx="9.3" cy="22.7" r="1.15" fill="#fff" />
      <circle cx="22.7" cy="22.7" r="1.15" fill="#fff" />
    </svg>
  );
}
