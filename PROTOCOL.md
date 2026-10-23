# Proposed ESP32-S3 ↔ Dashboard Protocol (DRAFT)

This is a software-side interface proposal, **not** a claim that current firmware implements it. Confirm with embedded teammate before using hardware mode. The browser connects to `ws://ESP32-IP/ws` on the same local network (or `wss://` where supported).

## ESP32 → browser: telemetry

Send JSON approximately every 2 seconds:

```json
{
  "type": "telemetry",
  "limitWatts": 35,
  "loads": [
    {"id": 1, "enabled": true, "priority": 1, "voltage": 12.0, "current": 0.80, "watts": 9.60},
    {"id": 2, "enabled": true, "priority": 2, "voltage": 12.0, "current": 1.20, "watts": 14.40},
    {"id": 3, "enabled": true, "priority": 3, "voltage": 12.0, "current": 0.50, "watts": 6.00}
  ]
}
```

Values must be numbers in volts (V), amperes (A), and watts (W). Each id should occur once. `enabled` reflects **actual MOSFET state**, not a pending request. Firmware owns the authoritative switching state and overload protection. Current dashboard validates message shape before display.

## ESP32 → browser: event

```json
{"type":"event","message":"Load 3 shed due to power limit"}
```

## Browser → ESP32: future configuration / load commands

**Not implemented in v0.2.** Agree on commands, request IDs, acknowledgements, validation, authorization, timeout, reconnect behavior, unique priority rules and safe load restoration first. Do not directly actuate power hardware from untrusted or unauthenticated web traffic. Firmware must remain capable of safe shedding even if this dashboard closes or loses Wi-Fi.

## Current limitations

- WebSocket telemetry is implemented in the UI; commands are simulation-only.
- No ESP32 firmware is included.
- No persistence of events or energy after refresh.
- Session energy estimates watts × elapsed time using a trapezoidal integral, not a metrology-grade energy meter.
- Simulation sheds loads but does not automatically re-enable them.
