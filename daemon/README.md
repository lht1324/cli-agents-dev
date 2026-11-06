# localagents

Sync OpenCode sessions across your computers. Start a session on one PC, continue it on another. Check in from your phone when you are away from the desk.

```bash
npx localagents@latest login
```

That connects this PC, registers background sync, and keeps running after you close the terminal.

## Requirements

- Node.js 22.13 or newer
- [OpenCode](https://opencode.ai) installed on the same machine
- A localagents account (created on first login)

## What it does

- Mirrors your current OpenCode sessions to your account, so a web inbox can show them.
- Lets you send instructions and answer permission prompts (Allow / Deny) from another device.
- Moves a session between PCs with `push` and `pull`: full history and context travel with it.

The daemon polls outbound. It does not open ports and does not accept inbound connections.

## Commands

| Command | Description |
| --- | --- |
| `localagents login` | Connect this PC. Opens the browser, then installs and starts background sync. |
| `localagents logout` | Revoke this device and stop background sync. |
| `localagents status` | Show device, OpenCode server state, last sync, pending commands and plan. |
| `localagents whoami` | Show the signed-in account. |
| `localagents push` | Pick sessions and upload them to your account. |
| `localagents pull` | Download sessions pushed from another PC. |
| `localagents uninstall` | Remove the background service, copied files, saved state and PATH entry. |
| `localagents service install` | Re-register the background service (recovery). |

`localagents --help` and `localagents --version` are also available.

## Files it creates

| Path | Purpose |
| --- | --- |
| `~/.config/localagents/device.json` | Device token (mode 600) |
| `~/.config/localagents/cursors.json` | Incremental sync cursors |
| `~/.config/localagents/env` | Optional environment overrides for the background service |
| `~/.local/share/localagents/app/` | Installed copy of the daemon |
| `~/.local/bin/localagents` | Command shim |

Background sync is registered as a systemd user unit on Linux and a LaunchAgent on macOS. Windows is not supported in this version.

## Uninstall

```bash
npx localagents@latest uninstall
```

This revokes the device token, stops and removes the service, deletes the copied files and saved state, and removes the PATH entry it added.
