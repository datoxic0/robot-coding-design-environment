<div align="center">
# Robot Coding & Design Environment

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Status](https://img.shields.io/badge/status-active-success.svg)
> An in-browser robot design + code editor with build/run workflows and offline-first support.
## Live Demo • Open App • Source Code
[**🚀 Live Demo**](https://websim.ai/p/iz5d4b9o7zuvg_hpjtkw) • [**📱 Open App**](https://websim.ai/c/iz5d4b9o7zuvg_hpjtkw) • [**🛠️ Source Code**](https://whisperinggalaxyd.github.io/robot-coding---design-environment)

</div>
## 📋 Executive Summary
Robot Coding & Design Environment is a single-page web application that combines a code editor, project/file management, and robot design tooling. It supports platform/language selection (e.g., Arduino/C++ and MicroPython/Python/JavaScript) and provides actions to build, upload/flash, and run in simulation. It also uses a Service Worker with targeted caching strategies for reliable offline and fast repeat loads.
## ✨ Key Features
- Browser-based project workspace with file/project management
- Code editing with formatting controls (CodeMirror via import map)
- Robot design environment (dedicated designer module)
- Platform + language configuration (Arduino AVR, ESP32/ESP8266, Raspberry Pi Pico, Generic MCU; C/C++, MicroPython, Python 3 simulation, JavaScript/Node)
- Build, Upload / Flash, and Run (Sim) workflows
- Console output panel for feedback and runtime logs
- Offline-first behavior via `assets/js/sw.js`
  - Pre-caches core app assets
  - Network-first for navigation and CDN modules
  - Stale-while-revalidate style caching for same-origin resources
## 🛠️ Technical Architecture
- Frontend (single-page app)
  - `index.html` boots the app UI: left (project/files, board & language, console), center (editor), right (design/controls)
  - ES module loading via `<script type="importmap">`:
- CodeMirror from `https://esm.sh/codemirror@6/`
- `nipplejs` from `https://esm.sh/nipplejs@0.9.0` (for on-screen controls / gestures)
- Core JavaScript modules (in `assets/js/`)
  - `app.js`: application initialization, state wiring between UI panels and editor/designer
  - `editor.js`: editor behaviors (file type indicator, save/format integration, editor setup)
  - `runner.js`: simulation execution flow and run lifecycle
  - `robotDesigner.js`: robot design UI and data binding to code/runtime expectations
- Service Worker (offline + caching)
  - `assets/js/sw.js`
  - Implements:
- Cache names:
  - `robot-env-v2` for core assets
  - `cdn-modules-v1` for CDN module responses
- Install:
  - Pre-caches core assets (`/`, `/index.html`, `/styles.css`, `/app.js`, `/runner.js`)
- Activate:
  - Deletes older caches except current core/CDN caches
- Fetch strategies:
  - Navigation: network-first; fallback to cached `/index.html`
  - CDN (esm.sh): network-first; cache responses in `cdn-modules-v1`
  - Same-origin: cache-first with network update (stale-while-revalidate-ish)
- Styling
  - `assets/css/styles.css`
  - Dark theme layout with reserved bottom padding to avoid overlap with fixed footer (`body{padding-bottom:...env(safe-area-inset-bottom)}`)
## 🚀 Getting Started
1. Open the app
   - Use the WebSim link: https://websim.ai/c/iz5d4b9o7zuvg_hpjtkw
2. Configure your target
   - Select **Platform** (e.g., Arduino/ESP/Raspberry Pi Pico)
   - Select **Language** (C/C++, MicroPython, Python 3 simulation, JavaScript)
   - Select **Framework / Board** (e.g., Arduino Uno, ESP32 Dev, Pico)
3. Create or import a project
   - Use **New File** / **New Project**
   - Optionally **Import .zip**
4. Write code in the editor
   - Use **Save** and **Format**
5. Build and run
   - Click **Build**
   - Use **Upload / Flash** (when applicable)
   - Click **Run (Sim)** to execute in simulation
6. View logs
   - Check the **Console** panel for build/run output and errors