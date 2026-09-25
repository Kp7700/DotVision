# DOTVISION

**See the world in dots.**
DOTVISION is a browser-based visual transformation tool that converts images, videos, and live camera footage into a monochrome dotted representation.
Instead of showing the source as a normal grayscale image, DOTVISION rebuilds the scene using **white dots on a pure black background**. Brighter regions produce denser and/or larger dots, while darker regions fade toward solid black. The goal is to preserve enough structure that the original subject remains recognizable.

## Features

- **Image mode** — drag and drop or upload an image and convert it to dotted artwork.
- **Video mode** — process an uploaded video frame-by-frame in real time.
- **Camera mode** — use the webcam or phone camera as a live dotted-vision camera.
- **Five dithering styles** — Halftone, Ordered, Floyd, Threshold, and Stipple.
- **Brightness-based dot rendering** — luminance controls dot size/density rather than simply applying a grayscale filter.
- **Temporal stabilization** — reduces visual sparkling in live camera and video input.
- **Spatial smoothing** — optional blur before dot generation for cleaner results.
- **Edge enhancement** — strengthens contours and silhouettes to improve recognizability.
- **Tone controls** — brightness, contrast, exposure, threshold, gamma, and invert.
- **Dot controls** — size, spacing, density, sharpness, minimum size, and maximum size.
- **Resolution controls** — Low, Medium, High, and Ultra processing resolutions.
- **Presets** — Classic Halftone, Fine Dots, Bold, High Contrast, Sketchy Dither, Live Camera, Stipple, and Newsprint.
- **Original / Dotted / Split views** — compare the source and processed result.
- **Contain / Cover fitting** — choose how the source is displayed without stretching it.
- **Mirror Camera** — mirror the camera feed while keeping processing coordinates aligned.
- **Original Preview** — show a small source preview while viewing the processed result.
- **Performance HUD** — show processing FPS, processing resolution, and current input mode.
- **Image capture** — export the current original or dotted frame as PNG.
- **Processed recording** — record the rendered dotted canvas using the browser's `MediaRecorder` and canvas capture APIs.
- **Camera switching** — switch between front-facing and environment cameras when multiple inputs are available.
- **Responsive interface** — desktop, tablet, and mobile layouts with a mobile controls sheet.
- **Drag and drop** — drop image/video files directly onto the main viewport.
- **Demo scene** — the app can render a procedural demo when no source is loaded, making presets easy to preview.

## How It Works

DOTVISION uses a custom canvas-based processing engine in `src/engine/processor.ts`.
For each image, video frame, or camera frame, the engine:

1. Draws the source into an offscreen canvas at a selected processing resolution.
2. Converts RGB pixels to **Rec.709 luminance**.
3. Applies optional temporal blending for video/camera stability.
4. Applies spatial smoothing when enabled.
5. Applies optional Laplacian-style edge enhancement.
6. Performs tone mapping using exposure, brightness, contrast, gamma, threshold, and optional inversion.
7. Samples the processed luminance on a stable grid.
8. Generates dots according to the selected dithering algorithm.
9. Composites the result onto a pure black canvas.
10. Fits the processed image into the visible viewport without distorting its aspect ratio.

The dot pattern is deterministic and position-based. The engine does not generate new random dot positions every frame, which helps keep video and camera output stable.

## Dithering Modes

### Halftone

Variable-size dots arranged on a hexagonal lattice. Dot area is mapped to brightness, producing the main classic halftone look.

### Ordered

Uses an ordered Bayer-style pattern with stable dot placement.

### Floyd

Uses Floyd-Steinberg error diffusion to create a print-like black-and-white dot pattern.

### Threshold

Uses a hard brightness cutoff. Areas above the threshold receive dots, with brightness affecting dot size.

### Stipple

Uses deterministic position-based density so brighter regions contain more dots while remaining visually stable across frames.

## Tone and Processing Controls

### Dots

- **Dot Size** — overall dot scaling.
- **Dot Spacing** — distance between sampled dot positions.
- **Dot Density** — remaps luminance to increase or decrease visible dot coverage.
- **Dot Sharpness** — changes how aggressively brightness affects dot size.
- **Minimum Dot Size** — smallest permitted dot.
- **Maximum Dot Size** — largest permitted dot.

### Image

- **Brightness** — shifts overall luminance.
- **Contrast** — expands or compresses the tonal range.
- **Exposure** — multiplies incoming luminance before tone mapping.
- **Threshold** — controls the black point / cutoff behavior.
- **Gamma** — changes midtone response.
- **Invert** — reverses the luminance relationship.

### Processing

- **Resolution** — controls internal processing width and therefore the detail/performance tradeoff.
- **Dithering Mode** — selects the dot-generation algorithm.
- **Smoothing** — combines spatial blur and temporal stabilization behavior.
- **Edge Enhancement** — boosts contours and silhouettes.

### Color

The default output uses **white dots on black**. Accent colors can be selected from the built-in palette or from the custom color picker. The background remains black.

## Controls and Viewing

The main toolbar provides access to the current input mode and source-specific actions.
In image mode, you can upload a new image and export the original or processed result.
In video mode, the built-in video bar provides play/pause, restart, seeking, and mute controls while the processing engine renders the video frames.
In camera mode, the application can start or stop the camera, switch the facing camera when supported, mirror the result, capture frames, and record the processed output.
The **Split** view has an interactive divider. Drag the divider across the viewport to change how much of the original and dotted image is visible.

## Project Structure

```
DOTVISION/
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    ├── presets.ts
    ├── types.ts
    ├── components/
    │   ├── Controls.tsx
    │   └── Icons.tsx
    ├── engine/
    │   └── processor.ts
    └── utils/
        └── cn.ts
```

## Tech Stack

- **React 19**
- **TypeScript 5**
- **Vite 7**
- **Tailwind CSS 4** via the Vite plugin
- **Canvas 2D API** for image processing and rendering
- **MediaDevices / getUserMedia** for live camera input
- **MediaRecorder** and `canvas.captureStream()` for processed-video recording
- **clsx** and **tailwind-merge** for class handling

No backend or database is required.

## Requirements

Use a current Node.js installation and a modern browser.
Camera mode requires browser camera permission and a secure context. In normal deployment, that means **HTTPS**. `localhost` is also suitable for local development.

## Installation

Clone or download the project, open a terminal in the project directory, and install the dependencies:

```
npm install
```

## Development

Start the Vite development server:

```
npm run dev
```

Open the local URL printed by Vite in your browser.

## Production Build

Create a production build with:

```
npm run build
```

Preview the production build locally with:

```
npm run preview
```

## Deployment

DOTVISION is a frontend-only Vite application and can be deployed to static hosting platforms such as Vercel, Netlify, or GitHub Pages.

### Vercel

Use the following typical settings:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

Camera access must be served over HTTPS in production.

## Camera Permissions

When Camera mode is selected, the browser requests access to the user's camera.
If permission is denied:

1. Open the browser site permissions for the deployed site.
2. Allow camera access.
3. Reload the page or start the camera again.

If another application is already using the camera, close that application and retry.

## Performance

DOTVISION intentionally separates the processing resolution from the display resolution. This allows the effect to remain visually detailed while limiting the number of pixels processed per frame.
For slower devices, use **Low** or **Medium** resolution and increase dot spacing. For stronger detail on capable hardware, use **High** or **Ultra** resolution with tighter spacing.
The built-in smoothing option is useful for noisy webcams because it combines spatial smoothing with temporal blending. Edge enhancement can then restore important contours.

## Privacy

The core processing is performed in the browser. No backend service is required for image, video, or camera processing.
Camera input is accessed through the browser's camera APIs and rendered locally by the application. The project does not include a server-side upload pipeline.

## Limitations

- Final camera/video performance depends on the device, browser, camera resolution, and selected processing resolution.
- Media recording format support varies by browser; the app selects a supported `MediaRecorder` MIME type when available.
- Very high resolutions combined with very small dot spacing can be computationally expensive.
- Some image/video formats depend on native browser decoding support.
- Camera availability and front/rear camera switching depend on the device and browser.

## Design Philosophy

DOTVISION is built around a simple visual rule:

> **Keep the scene recognizable, but rebuild it entirely from dots.**

The application intentionally avoids treating the effect as a normal black-and-white filter. The visual information is reconstructed through dot size, density, and dithering against a black field.

## License

No license file is currently included in the project. Add an explicit license before distributing the project publicly or granting reuse rights.
