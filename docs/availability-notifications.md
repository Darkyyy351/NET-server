# Device availability notifications

The backend starts one monitor when server.js begins listening. Every five seconds it
reads approved device status using the existing heartbeat expiry (default 35 seconds).
No extra requests are sent to ESP devices. Offline detection therefore normally takes
35-40 seconds without a heartbeat, not five seconds from disconnecting a cable.

Only online-to-offline and offline-to-online transitions produce notifications.
First snapshots, newly added devices, deletion, unknown states, and failed storage
reads do not produce an offline event. Restarting the backend establishes a new
baseline; outages entirely inside backend downtime cannot be reconstructed.

The latest 100 notifications are persisted in data/notifications.json, independent
of noisy heartbeat logs. Each transition is also appended to the normal event log.
GET /api/v1/notifications requires the existing Bearer token. No public endpoint or
email/Telegram delivery is introduced. The file is included in the existing data backup.

The browser polls every five seconds while visible, across all views. Initial history
loads do not trigger a flood of toasts. Subsequent new events display one grouped toast
for eight seconds. API failure is marked unavailable, never converted into device
offline events. Read markers are browser-local, scoped by API URL; users can mark all
read or mute toasts while retaining history. Alerts generated while the browser is
closed remain in the bounded server history, but no OS/browser push service is used.
