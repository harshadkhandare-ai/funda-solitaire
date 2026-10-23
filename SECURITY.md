# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please do not file public issues for security vulnerabilities. Instead, report
them directly to the repository maintainer.

Include as much detail as you can:

- Steps to reproduce the issue
- Affected versions
- Potential impact
- Suggested fix (if you have one)

We will acknowledge your report within 7 business days and provide regular
updates until the issue is resolved.

## Security Notes for this Project

- No API keys, secrets, or credentials are stored in the repository.
- All game state is stored in `localStorage` on the client device only — nothing is sent to a server.
- Sound is synthesized via the Web Audio API; no external audio resources are loaded.
- The app makes no outbound network requests other than loading its own static assets.
- If you are embedding this game in an Android WebView, enable JavaScript and DOM storage, and restrict the WebView to your own origin.
