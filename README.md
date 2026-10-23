# SEMS Dashboard — React development project v0.2

Purdue ECE 49200 Senior Design — Smart Energy Management System. Three-load, 12 V UI in React + Vite. Hardware readings are **not** available without matching ESP32-S3 firmware.

## Requirements

- Node.js 20.19+ or 22.12+ (https://nodejs.org)
- Internet connection the first time to install JavaScript packages
- macOS or Windows and a current browser

## Start the dashboard

1. Extract the ZIP file.
2. Open Terminal (macOS) or PowerShell (Windows).
3. Change into the extracted `SEMS_React_Project` folder, e.g. `cd ~/Downloads/SEMS_React_Project` on Mac.
4. Run:

```bash
npm install
npm run dev
```

5. Open the `Local:` address printed by Vite, generally http://127.0.0.1:5173.
6. Stop the server with Ctrl+C.

Optional: `npm run build` produces a `dist` folder for hosting on a web server. Don't open `dist/index.html` directly using `file://`; serve it via Vite preview or HTTP.

## Project structure

- `src/App.jsx` — main dashboard pages, state, events, power limits, controls
- `src/components/PowerChart.jsx` — live SVG history chart
- `src/services/simulation.js` — random readings and priority load shedding (demo)
- `src/services/protocol.js` — sensor and WebSocket message structure/validation
- `src/styles.css` — dashboard styling
- `PROTOCOL.md` — proposed ESP32-S3 JSON interface (send this to embedded teammate)

## Next integration step

Ask the firmware teammate to implement a WebSocket server at `/ws` which streams readings matching `PROTOCOL.md`. Select **Settings → ESP32 WebSocket** and enter the URL, e.g. `ws://192.168.1.50/ws`. This only displays telemetry. Hardware switching and configuration are deliberately **disabled** in hardware mode pending agreed and validated commands.

## Caveats

- Priorities in simulation: 1 highest, 3 lowest, ties shed higher load ID first.
- This demo sheds loads when over budget. Automatic reconnection/restoration is still a separate engineering task.
- No historical database, login system, encryption, or persistent log yet.
- Replace simulated source before presenting measurements as real hardware data.
