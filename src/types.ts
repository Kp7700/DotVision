export type InputMode = "image" | "video" | "camera";
export type ViewMode = "processed" | "original" | "split";
export type FitMode = "contain" | "cover";
export type FacingMode = "user" | "environment";
export type ResolutionKey = "low" | "medium" | "high" | "ultra";
export type DitherMode = "halftone" | "ordered" | "floyd" | "threshold" | "stipple";
export type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unavailable"
  | "error";

export interface ProcessSettings {
  // Dot
  dotSize: number;
  dotSpacing: number;
  dotDensity: number;
  dotSharpness: number;
  minDotSize: number;
  maxDotSize: number;

  // Image / tone
  brightness: number;
  contrast: number;
  exposure: number;
  threshold: number;
  gamma: number;
  invert: boolean;

  // Processing
  resolution: ResolutionKey;
  ditherMode: DitherMode;
  smoothing: number;
  edgeEnhance: number;

  // Display extras
  dotColor: string;
}

export interface Preset {
  id: string;
  name: string;
  hint: string;
  settings: ProcessSettings;
}
