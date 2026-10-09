# Goal
Add actionable production monitoring for uptime, cold-start latency, WebSocket failures, and room-creation failures.

# Scope
Instrument the gateway, expose a safe aggregate health snapshot, add structured logs, and schedule an external HTTP/WebSocket smoke check through GitHub Actions.

# Approach
Keep monitoring dependency-free except for the existing WebSocket client. Record counters without room codes, tokens, names, or card data. The external check measures wake latency, validates the current lobby protocol by creating and deleting a room, and fails above a configurable threshold.

# Risks
Leaking player data, monitors leaving rooms behind, false failures during deployments, using internal process timing as cold-start latency, and checks silently passing against an outdated gateway.

# Verification
Run the monitor against a local gateway, force a WebSocket/protocol failure to confirm counters, run the full test suite, validate workflow syntax, and inspect the health payload for safe fields.
