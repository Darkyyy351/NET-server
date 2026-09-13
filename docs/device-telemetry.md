# Device telemetry

Approved devices may include `telemetry` in their existing heartbeat:

```json
{"telemetry":{"rssi":-63,"uptimeSeconds":123,"freeHeapBytes":30000}}
```

All three fields are required when an object is supplied. Values must be integers:
RSSI -127..0 dBm, uptime 0..Number.MAX_SAFE_INTEGER seconds, free heap 0..1048576 bytes.
Unknown fields and malformed samples return HTTP 400 without updating last contact.
Missing/null telemetry supports older firmware and clears the previous sample.

The backend adds `receivedAt` and exposes the latest sample via device responses.
Samples are memory-only: no extra disk writes, and unavailable after backend restart
until the next heartbeat. Re-registration and deletion clear previous samples.
The frontend hides metrics when offline or when a sample is 35 seconds old.
Uptime is the reported value, not an extrapolated counter. Last contact remains visible.

ESP firmware 0.2.0-irl.5 sends one sample every 10 seconds. Deploy the backend/frontend
changes to display samples on CM5; older backends ignore the additional payload.
