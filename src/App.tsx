import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ControlsPanel } from "./components/Controls";
import {
  IconCamera,
  IconCapture,
  IconClose,
  IconDownload,
  IconDrop,
  IconExitFull,
  IconFlip,
  IconFullscreen,
  IconImage,
  IconMute,
  IconPause,
  IconPip,
  IconPlay,
  IconRecord,
  IconRestart,
  IconSliders,
  IconStop,
  IconSwitch,
  IconVideo,
  IconVolume,
  LogoMark,
} from "./components/Icons";
import {
  cameraErrorMessage,
  DotEngine,
  downloadBlob,
  formatTime,
  pickRecorderMime,
  renderDemoScene,
} from "./engine/processor";
import { DEFAULT_SETTINGS, PRESETS, RESOLUTION_WIDTH } from "./presets";
import type {
  CameraStatus,
  FacingMode,
  FitMode,
  InputMode,
  ProcessSettings,
  ViewMode,
} from "./types";
import { cn } from "./utils/cn";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif", "image/svg+xml"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/ogg", "video/x-m4v"];

function isImageFile(file: File) {
  return file.type.startsWith("image/") || IMAGE_TYPES.includes(file.type);
}
function isVideoFile(file: File) {
  return file.type.startsWith("video/") || VIDEO_TYPES.includes(file.type);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export default function App() {
  const [mode, setMode] = useState<InputMode>("camera");
  const [settings, setSettings] = useState<ProcessSettings>(DEFAULT_SETTINGS);
  const [activePreset, setActivePreset] = useState<string | null>("classic");
  const [viewMode, setViewMode] = useState<ViewMode>("processed");
  const [split, setSplit] = useState(0.5);
  const [fit, setFit] = useState<FitMode>("contain");
  const [mirror, setMirror] = useState(true);
  const [showFps, setShowFps] = useState(true);
  const [showPip, setShowPip] = useState(false);
  const [fps, setFps] = useState(0);
  const [processLabel, setProcessLabel] = useState("—");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>("user");
  const [hasMultiCam, setHasMultiCam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const displayRef = useRef<HTMLCanvasElement>(null);
  const pipRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const engineRef = useRef<DotEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const dragCount = useRef(0);

  const settingsRef = useRef(settings);
  const viewModeRef = useRef(viewMode);
  const splitRef = useRef(split);
  const fitRef = useRef(fit);
  const mirrorRef = useRef(mirror);
  const modeRef = useRef(mode);
  const hasImageRef = useRef(hasImage);
  const hasVideoRef = useRef(hasVideo);
  const cameraStatusRef = useRef(cameraStatus);

  settingsRef.current = settings;
  viewModeRef.current = viewMode;
  splitRef.current = split;
  fitRef.current = fit;
  mirrorRef.current = mirror;
  modeRef.current = mode;
  hasImageRef.current = hasImage;
  hasVideoRef.current = hasVideo;
  cameraStatusRef.current = cameraStatus;

  useEffect(() => {
    engineRef.current = new DotEngine();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setVideoTime(video.currentTime || 0);
    const onMeta = () => setVideoDuration(video.duration || 0);
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
    };
  }, []);

  const revokeUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = cameraVideoRef.current;
    if (video && video.srcObject) {
      video.srcObject = null;
    }
    setCameraStatus((s) => (s === "requesting" ? s : "idle"));
  }, []);

  const startCamera = useCallback(
    async (nextFacing: FacingMode = facing) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("unavailable");
        setCameraMessage("This browser does not support camera access.");
        return;
      }
      setCameraStatus("requesting");
      setCameraMessage(null);
      setError(null);
      stopCamera();

      const tryStart = async (constraints: MediaStreamConstraints) => {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        const video = cameraVideoRef.current;
        if (!video) throw new Error("Video element missing");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        await video.play();
        setCameraStatus("active");
        engineRef.current?.resetTemporal();
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setHasMultiCam(devices.filter((d) => d.kind === "videoinput").length > 1);
        } catch {
          setHasMultiCam(false);
        }
      };

      try {
        await tryStart({
          audio: false,
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (err) {
        try {
          await tryStart({ audio: false, video: true });
        } catch (err2) {
          const mapped = cameraErrorMessage(err2);
          setCameraStatus(mapped.status);
          setCameraMessage(mapped.message);
        }
      }
    },
    [facing, stopCamera],
  );

  const loadImageFile = useCallback((file: File) => {
    if (!isImageFile(file)) {
      setError("That file does not look like a supported image.");
      return;
    }
    setError(null);
    stopCamera();
    revokeUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setHasImage(true);
      setHasVideo(false);
      setMode("image");
      engineRef.current?.resetTemporal();
    };
    img.onerror = () => {
      setError("Could not decode this image. Try JPG, PNG, or WEBP.");
      revokeUrl();
    };
    img.src = url;
  }, [stopCamera]);

  const loadVideoFile = useCallback((file: File) => {
    if (!isVideoFile(file)) {
      setError("That file does not look like a supported video.");
      return;
    }
    setError(null);
    stopCamera();
    revokeUrl();
    imageRef.current = null;
    setHasImage(false);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = null;
    video.src = url;
    video.muted = true;
    setVideoMuted(true);
    video.loop = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration || 0);
      setHasVideo(true);
      setMode("video");
      video.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
      engineRef.current?.resetTemporal();
    };
    video.onerror = () => {
      setError("Could not decode this video. Try MP4 or WEBP/WebM.");
      setHasVideo(false);
    };
  }, [stopCamera]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const file = files[0];
      if (!file) return;
      if (isVideoFile(file)) loadVideoFile(file);
      else if (isImageFile(file)) loadImageFile(file);
      else setError("Please drop an image or video file.");
    },
    [loadImageFile, loadVideoFile],
  );

  const switchMode = useCallback(
    (next: InputMode) => {
      setError(null);
      setMode(next);
      if (next !== "video") {
        videoRef.current?.pause();
      } else if (hasVideoRef.current) {
        videoRef.current?.play().catch(() => undefined);
      }
      if (next === "camera") {
        if (cameraStatusRef.current !== "active") {
          void startCamera(facing);
        }
      } else {
        stopCamera();
      }
    },
    [facing, startCamera, stopCamera],
  );

  useEffect(() => {
    return () => {
      stopCamera();
      revokeUrl();
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, [stopCamera]);

  // Main render loop
  useEffect(() => {
    let raf = 0;
    let running = true;
    let frames = 0;
    let fpsStamp = performance.now();
    let lastLabel = "";
    const demo = document.createElement("canvas");
    const demoCtx = demo.getContext("2d", { alpha: false });

    const tick = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const canvas = displayRef.current;
      const wrap = viewportRef.current;
      const engine = engineRef.current;
      if (!canvas || !wrap || !engine) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = Math.max(1, wrap.clientWidth);
      const cssH = Math.max(1, wrap.clientHeight);
      const destW = Math.round(cssW * dpr);
      const destH = Math.round(cssH * dpr);
      if (canvas.width !== destW || canvas.height !== destH) {
        canvas.width = destW;
        canvas.height = destH;
      }
      const dest = canvas.getContext("2d", { alpha: false });
      if (!dest) return;

      const currentMode = modeRef.current;
      const fileVideo = videoRef.current;
      const camVideo = cameraVideoRef.current;
      let source: CanvasImageSource | null = null;
      let sw = 0;
      let sh = 0;
      let temporal = false;

      if (currentMode === "image" && hasImageRef.current && imageRef.current) {
        source = imageRef.current;
        sw = imageRef.current.naturalWidth;
        sh = imageRef.current.naturalHeight;
      } else if (currentMode === "video" && hasVideoRef.current && fileVideo && fileVideo.readyState >= 2) {
        source = fileVideo;
        sw = fileVideo.videoWidth;
        sh = fileVideo.videoHeight;
        temporal = true;
      } else if (
        currentMode === "camera" &&
        cameraStatusRef.current === "active" &&
        camVideo &&
        camVideo.readyState >= 2 &&
        camVideo.videoWidth > 0
      ) {
        source = camVideo;
        sw = camVideo.videoWidth;
        sh = camVideo.videoHeight;
        temporal = true;
      } else if (demoCtx) {
        const maxW = Math.min(480, RESOLUTION_WIDTH[settingsRef.current.resolution]);
        const dw = maxW;
        const dh = Math.round(maxW * 0.62);
        if (demo.width !== dw || demo.height !== dh) {
          demo.width = dw;
          demo.height = dh;
        }
        renderDemoScene(demoCtx, dw, dh, now / 1000);
        source = demo;
        sw = dw;
        sh = dh;
      }

      if (!source || sw < 2 || sh < 2) {
        dest.fillStyle = "#000";
        dest.fillRect(0, 0, destW, destH);
        return;
      }

      try {
        const info = engine.process(source, sw, sh, dest, destW, destH, settingsRef.current, {
          viewMode: viewModeRef.current,
          split: splitRef.current,
          fit: fitRef.current,
          mirror: currentMode === "camera" ? mirrorRef.current : false,
          temporal,
        });
        const label = `${info.processW}×${info.processH}`;
        if (label !== lastLabel) {
          lastLabel = label;
          setProcessLabel(label);
        }
        const pip = pipRef.current;
        if (pip) {
          const ow = engine.getOriginalCanvas();
          if (pip.width !== 240) {
            pip.width = 240;
            pip.height = Math.max(1, Math.round(240 * (ow.height / Math.max(1, ow.width))));
          }
          const pctx = pip.getContext("2d");
          if (pctx) pctx.drawImage(ow, 0, 0, pip.width, pip.height);
        }
      } catch {
        /* keep last frame */
      }

      frames += 1;
      if (now - fpsStamp >= 1000) {
        setFps(frames);
        frames = 0;
        fpsStamp = now;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const onSettings = (next: ProcessSettings) => {
    setSettings(next);
    setActivePreset(null);
  };

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setSettings(p.settings);
    setActivePreset(id);
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setActivePreset("classic");
  };

  const capturePng = (which: "dotted" | "original") => {
    const engine = engineRef.current;
    if (!engine) return;
    const src = which === "dotted" ? engine.getProcessedCanvas() : engine.getOriginalCanvas();
    src.toBlob((blob) => {
      if (!blob) {
        setError("Could not export this frame.");
        return;
      }
      downloadBlob(blob, `dotvision-${which}-${stamp()}.png`);
    }, "image/png");
  };

  const startRecording = () => {
    const engine = engineRef.current;
    const canvas = engine?.getProcessedCanvas() ?? displayRef.current;
    if (!canvas) return;
    if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
      setError("Recording is not supported in this browser.");
      return;
    }
    const mime = pickRecorderMime();
    let stream: MediaStream;
    try {
      stream = canvas.captureStream(30);
    } catch {
      setError("Could not capture the canvas stream.");
      return;
    }
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      setError("MediaRecorder could not start with this codec.");
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      if (blob.size > 0) downloadBlob(blob, `dotvision-${stamp()}.${ext}`);
      setIsRecording(false);
      setRecordSeconds(0);
    };
    recorder.onerror = () => {
      setError("Recording failed.");
      setIsRecording(false);
    };
    recorderRef.current = recorder;
    recorder.start(200);
    setIsRecording(true);
    setRecordSeconds(0);
    if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    const started = Date.now();
    recordTimerRef.current = window.setInterval(() => {
      setRecordSeconds(Math.floor((Date.now() - started) / 1000));
    }, 250);
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {
      setIsRecording(false);
    }
  };

  const toggleFullscreen = async () => {
    const el = viewportRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setBanner("Fullscreen is not available.");
      setTimeout(() => setBanner(null), 2200);
    }
  };

  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "1") switchMode("image");
      if (e.key === "2") switchMode("video");
      if (e.key === "3") switchMode("camera");
      if (e.key === "c" || e.key === "C") capturePng("dotted");
      if (e.key === "f" || e.key === "F") void toggleFullscreen();
      if (e.key === " ") {
        e.preventDefault();
        const video = videoRef.current;
        if (mode === "video" && video) {
          if (video.paused) video.play().then(() => setVideoPlaying(true)).catch(() => undefined);
          else {
            video.pause();
            setVideoPlaying(false);
          }
        } else if (mode === "camera") {
          if (cameraStatus === "active") stopCamera();
          else void startCamera();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, cameraStatus, startCamera, stopCamera, switchMode]);

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCount.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
  };
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCount.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const onSplitPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (viewMode !== "split") return;
    const canvas = displayRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setSplit(Math.min(0.92, Math.max(0.08, x)));
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  const hasLiveSource =
    (mode === "image" && hasImage) ||
    (mode === "video" && hasVideo) ||
    (mode === "camera" && cameraStatus === "active");

  const statusChip =
    mode === "camera"
      ? cameraStatus === "active"
        ? { label: "Active", tone: "live" as const }
        : cameraStatus === "requesting"
          ? { label: "Requesting", tone: "wait" as const }
          : cameraStatus === "denied"
            ? { label: "Permission Required", tone: "warn" as const }
            : cameraStatus === "error" || cameraStatus === "unavailable"
              ? { label: "Error", tone: "bad" as const }
              : { label: "Ready", tone: "idle" as const }
      : hasLiveSource
        ? { label: "Ready", tone: "live" as const }
        : { label: "Demo", tone: "idle" as const };

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/8 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <LogoMark size={28} />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-[15px] font-extrabold tracking-[0.18em]">DOTVISION</div>
            <div className="hidden text-[10px] tracking-[0.22em] text-neutral-500 uppercase sm:block">
              See the world in dots
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <ModeSwitch mode={mode} onChange={switchMode} />
        </div>

        <div className="flex items-center gap-2">
          <StatusPill status={statusChip} />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-200 lg:hidden"
            onClick={() => setControlsOpen(true)}
            aria-label="Open controls"
          >
            <IconSliders size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-white/8 px-3 py-2 md:hidden">
            <ModeSwitch mode={mode} onChange={switchMode} />
          </div>

          <div
            ref={viewportRef}
            className="relative min-h-0 flex-1 overflow-hidden bg-black"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <canvas
              ref={displayRef}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
              onPointerDown={onSplitPointer}
              onPointerMove={(e) => {
                if (e.buttons === 1) onSplitPointer(e);
              }}
            />

            <video
              ref={videoRef}
              className="dv-source-video"
              playsInline
              muted={videoMuted}
            />
            <video
              ref={cameraVideoRef}
              className="dv-source-video"
              playsInline
              muted
            />

            {showPip && hasLiveSource && (
              <div className="absolute bottom-20 left-3 overflow-hidden rounded-lg border border-white/15 bg-black/70 shadow-2xl sm:bottom-24 sm:left-4">
                <canvas ref={pipRef} className="block h-20 w-auto max-w-36 sm:h-24" />
                <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-300">
                  Original
                </div>
              </div>
            )}

            {showFps && (
              <div className="absolute left-3 top-3 font-mono text-[10px] leading-relaxed text-white/70 sm:left-4 sm:top-4">
                <div>FPS {fps}</div>
                <div>PROC {processLabel}</div>
                <div>MODE {mode.toUpperCase()}</div>
              </div>
            )}

            {isRecording && (
              <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-300 sm:right-4 sm:top-4">
                <span className="dv-rec-dot h-2 w-2 rounded-full bg-red-400" />
                Rec {formatTime(recordSeconds)}
              </div>
            )}

            {mode === "camera" && cameraStatus !== "active" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center p-6 sm:bottom-28">
                <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/10 bg-black/70 p-6 text-center backdrop-blur-md">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    <IconCamera size={22} />
                  </div>
                  <h2 className="font-display text-xl font-semibold">Live Camera</h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    {cameraMessage ||
                      (cameraStatus === "requesting"
                        ? "Waiting for camera permission…"
                        : "Turn your webcam into a dotted-vision camera. Nothing is uploaded.")}
                  </p>
                  <button
                    type="button"
                    disabled={cameraStatus === "requesting"}
                    onClick={() => void startCamera()}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    <IconCamera size={16} />
                    {cameraStatus === "requesting" ? "Starting…" : "Start Camera"}
                  </button>
                </div>
              </div>
            )}

            {mode === "image" && !hasImage && (
              <DropHint accept="image" onInput={onFileInput} />
            )}
            {mode === "video" && !hasVideo && (
              <DropHint accept="video" onInput={onFileInput} />
            )}

            {dragging && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="rounded-2xl border border-dashed border-white/40 px-10 py-8 text-center">
                  <IconDrop size={28} className="mx-auto mb-2" />
                  <div className="font-display text-xl font-semibold">Drop to load</div>
                  <div className="mt-1 text-sm text-neutral-400">Images and videos are both welcome</div>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-x-4 top-4 z-20 mx-auto max-w-md rounded-xl border border-red-500/30 bg-red-950/80 px-4 py-3 text-sm text-red-100 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <p>{error}</p>
                  <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                    <IconClose size={14} />
                  </button>
                </div>
              </div>
            )}

            {banner && (
              <div className="absolute inset-x-0 top-4 z-20 flex justify-center">
                <div className="rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-xs text-neutral-200 backdrop-blur">
                  {banner}
                </div>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
              {mode === "video" && hasVideo && (
                <VideoBar
                  playing={videoPlaying}
                  muted={videoMuted}
                  time={videoTime}
                  duration={videoDuration}
                  onToggle={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    if (v.paused) v.play().then(() => setVideoPlaying(true)).catch(() => undefined);
                    else {
                      v.pause();
                      setVideoPlaying(false);
                    }
                  }}
                  onRestart={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    v.currentTime = 0;
                    v.play().then(() => setVideoPlaying(true)).catch(() => undefined);
                  }}
                  onSeek={(t) => {
                    const v = videoRef.current;
                    if (!v) return;
                    v.currentTime = t;
                    setVideoTime(t);
                  }}
                  onMute={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    v.muted = !v.muted;
                    setVideoMuted(v.muted);
                  }}
                />
              )}

              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                {mode === "camera" && cameraStatus === "active" && (
                  <ToolButton
                    label="Stop"
                    onClick={stopCamera}
                    icon={<IconStop size={14} />}
                  />
                )}
                {mode === "camera" && hasMultiCam && (
                  <ToolButton
                    label={facing === "user" ? "Rear" : "Front"}
                    onClick={() => {
                      const next = facing === "user" ? "environment" : "user";
                      setFacing(next);
                      setMirror(next === "user");
                      void startCamera(next);
                    }}
                    icon={<IconSwitch size={14} />}
                  />
                )}
                {mode === "camera" && (
                  <ToolButton
                    label="Mirror"
                    active={mirror}
                    onClick={() => setMirror((v) => !v)}
                    icon={<IconFlip size={14} />}
                  />
                )}
                <ToolButton
                  label="Capture"
                  onClick={() => capturePng("dotted")}
                  icon={<IconCapture size={14} />}
                />
                <ToolButton
                  label="Save Original"
                  onClick={() => capturePng("original")}
                  icon={<IconDownload size={14} />}
                />
                {!isRecording ? (
                  <ToolButton
                    label="Record"
                    onClick={startRecording}
                    icon={<IconRecord size={14} />}
                  />
                ) : (
                  <ToolButton
                    label="Stop Rec"
                    danger
                    onClick={stopRecording}
                    icon={<IconStop size={14} />}
                  />
                )}
                <ToolButton
                  label="Preview"
                  active={showPip}
                  onClick={() => setShowPip((v) => !v)}
                  icon={<IconPip size={14} />}
                />
                <ToolButton
                  label={isFs ? "Exit" : "Full"}
                  onClick={() => void toggleFullscreen()}
                  icon={isFs ? <IconExitFull size={14} /> : <IconFullscreen size={14} />}
                />
                {(mode === "image" || mode === "video") && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-medium text-neutral-100 hover:bg-white/14">
                    {mode === "image" ? <IconImage size={14} /> : <IconVideo size={14} />}
                    Replace
                    <input
                      type="file"
                      accept={mode === "image" ? "image/*" : "video/*"}
                      className="hidden"
                      onChange={onFileInput}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden w-[320px] shrink-0 border-l border-white/8 lg:block">
          <ControlsPanel
            settings={settings}
            onChange={onSettings}
            activePreset={activePreset}
            onPreset={applyPreset}
            viewMode={viewMode}
            onViewMode={setViewMode}
            fit={fit}
            onFit={setFit}
            mirror={mirror}
            onMirror={setMirror}
            showFps={showFps}
            onShowFps={setShowFps}
            showPip={showPip}
            onShowPip={setShowPip}
            onReset={resetSettings}
          />
        </aside>
      </div>

      {controlsOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close controls"
            onClick={() => setControlsOpen(false)}
          />
          <div className="dv-sheet absolute inset-x-0 bottom-0 max-h-[78%] overflow-hidden rounded-t-2xl border-t border-white/10">
            <div className="flex items-center justify-between border-b border-white/8 bg-[#0a0a0a] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Controls
              </span>
              <button type="button" onClick={() => setControlsOpen(false)} aria-label="Close">
                <IconClose size={16} />
              </button>
            </div>
            <div className="h-[min(70vh,640px)]">
              <ControlsPanel
                settings={settings}
                onChange={onSettings}
                activePreset={activePreset}
                onPreset={applyPreset}
                viewMode={viewMode}
                onViewMode={setViewMode}
                fit={fit}
                onFit={setFit}
                mirror={mirror}
                onMirror={setMirror}
                showFps={showFps}
                onShowFps={setShowFps}
                showPip={showPip}
                onShowPip={setShowPip}
                onReset={resetSettings}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: InputMode;
  onChange: (m: InputMode) => void;
}) {
  const items: { id: InputMode; label: string; icon: ReactNode }[] = [
    { id: "image", label: "Image", icon: <IconImage size={14} /> },
    { id: "video", label: "Video", icon: <IconVideo size={14} /> },
    { id: "camera", label: "Camera", icon: <IconCamera size={14} /> },
  ];
  return (
    <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition sm:px-4",
            mode === it.id ? "bg-white text-black" : "text-neutral-400 hover:text-white",
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: { label: string; tone: "live" | "wait" | "warn" | "bad" | "idle" };
}) {
  const tone =
    status.tone === "live"
      ? "text-emerald-300"
      : status.tone === "wait"
        ? "text-amber-300"
        : status.tone === "warn" || status.tone === "bad"
          ? "text-red-300"
          : "text-neutral-400";
  const dot =
    status.tone === "live"
      ? "bg-emerald-400"
      : status.tone === "wait"
        ? "bg-amber-400"
        : status.tone === "warn" || status.tone === "bad"
          ? "bg-red-400"
          : "bg-neutral-500";
  return (
    <div className={cn("hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider sm:flex", tone)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot, status.tone === "live" && "dv-rec-dot")} />
      {status.label}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  icon,
  active,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
        danger
          ? "border-red-400/40 bg-red-500/20 text-red-100"
          : active
            ? "border-white/30 bg-white text-black"
            : "border-white/12 bg-white/8 text-neutral-100 hover:bg-white/14",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function DropHint({
  accept,
  onInput,
}: {
  accept: "image" | "video";
  onInput: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <label className="pointer-events-auto flex w-full max-w-md cursor-pointer flex-col items-center rounded-2xl border border-dashed border-white/18 bg-black/40 px-8 py-10 text-center backdrop-blur-sm hover:border-white/35 hover:bg-black/55">
        <IconDrop size={28} className="mb-3 text-neutral-300" />
        <div className="font-display text-lg font-semibold">
          Drop a {accept} or click to browse
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {accept === "image"
            ? "JPG, PNG, WEBP, GIF and other browser formats"
            : "MP4, WEBM, MOV — processed frame by frame"}
        </p>
        <input
          type="file"
          accept={accept === "image" ? "image/*" : "video/*"}
          className="hidden"
          onChange={onInput}
        />
      </label>
    </div>
  );
}

function VideoBar({
  playing,
  muted,
  time,
  duration,
  onToggle,
  onRestart,
  onSeek,
  onMute,
}: {
  playing: boolean;
  muted: boolean;
  time: number;
  duration: number;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (t: number) => void;
  onMute: () => void;
}) {
  const pct = duration > 0 ? (time / duration) * 100 : 0;
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/45 px-2 py-1.5 backdrop-blur-md">
      <button type="button" className="p-1.5 text-white" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
      </button>
      <button type="button" className="p-1.5 text-white" onClick={onRestart} aria-label="Restart">
        <IconRestart size={14} />
      </button>
      <span className="w-10 font-mono text-[10px] text-neutral-400">{formatTime(time)}</span>
      <input
        className="dv-range flex-1"
        type="range"
        min={0}
        max={duration || 0}
        step={0.05}
        value={Math.min(time, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ ["--dv-fill" as string]: `${pct}%` }}
        aria-label="Seek"
      />
      <span className="w-10 text-right font-mono text-[10px] text-neutral-400">{formatTime(duration)}</span>
      <button type="button" className="p-1.5 text-white" onClick={onMute} aria-label={muted ? "Unmute" : "Mute"}>
        {muted ? <IconMute size={14} /> : <IconVolume size={14} />}
      </button>
    </div>
  );
}
