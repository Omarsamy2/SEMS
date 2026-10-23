# SEMS Dashboard v0.3 — Persistent Event and Reading History

Requirements: **Node.js 22.13+** (recommended Node.js 24 LTS), npm.

## Run locally (two terminals)

Terminal 1 (SQLite database backend):
```bash
npm run server
```
Terminal 2 (React dashboard):
```bash
npm install
npm run dev
```

Open the Vite URL (typically http://127.0.0.1:5173). Keep **both terminals running**.

The first backend launch creates **data/sems.db** automatically. Simulation now saves load events and all three load readings every ~2 seconds. The Events and History pages read from the database. Closing/reopening the browser does not delete history.

Test backend: http://127.0.0.1:3001/api/health or `curl http://127.0.0.1:3001/api/events`.

To inspect database use **DB Browser for SQLite** (https://sqlitebrowser.org/) on `data/sems.db` **after stopping the backend**. Back up the database before changing records. SQLite may also use `-wal` and `-shm` files while running.

## Notes
- SQLite persists on the **laptop running the backend**, not on the ESP32.
- The React site proxies `/api` to localhost:3001 in development. The API binds to loopback; it is **not accessible from other devices**.
- Settings and automatic restoration logic are not persisted/implemented yet.
- Hardware mode receives WebSocket measurements in browser and forwards them to the local backend; no firmware is included. Avoid publishing an unprotected backend on a network.
- This is a prototype, not an electrical protection or safety mechanism.
