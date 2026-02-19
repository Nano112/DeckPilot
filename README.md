# DeckPilot

A cross-platform remote macro pad that turns any touchscreen device into a customizable control surface. Built for the Steam Deck but works on any device with a browser.

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐
│   Steam Deck    │  WiFi   │    Mac / Desktop      │
│  (Tauri app)    │◄───────►│   (Bun server :9900)  │
│                 │         │                        │
│  SDL2 gamepad   │         │  macOS actions         │
│  Haptic rumble  │         │  Spotify / Discord     │
│  Auto-updates   │         │  Soundboard            │
└─────────────────┘         │  System stats          │
                            │  Claude Code sessions  │
┌─────────────────┐         │                        │
│  Phone / Tablet │◄───────►│  Static client serving │
│   (Browser)     │         └──────────────────────┘
└─────────────────┘
```

**Monorepo structure:**
- `server/` — Hono + Bun server (actions, WebSocket, live data sources)
- `client/` — React 19 + Vite + Tailwind CSS v4 frontend
- `client/src-tauri/` — Tauri v2 native shell (Rust, SDL2 gamepad, haptics)
- `shared/` — TypeScript types for the WebSocket protocol and config

## Quick Start (Development)

```bash
# Install dependencies
bun install

# Start everything (server + client with hot reload)
bun run dev

# Open in browser
open http://localhost:5180
```

The Vite dev server on `:5180` proxies `/api` and `/ws` to the Bun server on `:9900`.

## Building the Tauri App

### Prerequisites

- [Rust](https://rustup.rs/) (stable, 1.88+)
- [Bun](https://bun.sh/)
- CMake (`brew install cmake` on macOS, `apt install cmake` on Linux)

### Local build

```bash
# Build the client frontend first
bun run build:client

# Build the Tauri app (debug)
cd client
CMAKE_POLICY_VERSION_MINIMUM=3.5 npx @tauri-apps/cli build --debug

# Binary output:
# client/src-tauri/target/debug/deckpilot
```

For a release build (smaller, optimized):

```bash
cd client
CMAKE_POLICY_VERSION_MINIMUM=3.5 npx @tauri-apps/cli build

# Binary output:
# client/src-tauri/target/release/deckpilot
# AppImage (Linux): client/src-tauri/target/release/bundle/appimage/
```

### Dev mode (Tauri + hot reload)

Run these in separate terminals:

```bash
# Terminal 1: Start the Vite dev server + Bun server
bun run dev

# Terminal 2: Start Tauri in dev mode (opens native window)
cd client
CMAKE_POLICY_VERSION_MINIMUM=3.5 npx @tauri-apps/cli dev
```

## Deploying to Steam Deck

### Option 1: Download from GitHub Releases

Push a version tag to trigger the CI build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions will build the AppImage and publish it to [Releases](https://github.com/Nano112/DeckPilot/releases). Download the `.AppImage` file on your Steam Deck.

### Option 2: Build locally and transfer

```bash
# On a Linux machine or in a container:
bun run build:client
cd client && npx @tauri-apps/cli build
# Copy the AppImage to Steam Deck via SSH/USB
```

### Installing on Steam Deck

1. Switch to **Desktop Mode**
2. Download or transfer the `DeckPilot_x.x.x_amd64.AppImage`
3. Make it executable:
   ```bash
   chmod +x DeckPilot_*.AppImage
   ```
4. Run it:
   ```bash
   ./DeckPilot_*.AppImage
   ```
5. On first launch, enter your Mac's server URL (e.g., `http://192.168.1.100:9900`)
6. The URL is saved — you won't need to enter it again

### Adding to Steam (Gaming Mode)

1. In Desktop Mode, open Steam
2. **Games → Add a Non-Steam Game**
3. Browse to the AppImage location
4. Add it, then switch back to Gaming Mode
5. Launch from your library

### Auto-Updates

After the initial install, DeckPilot checks for updates on launch. When a new release is published on GitHub, you'll be prompted to update in-app — no manual download needed.

## Running the Server

The Bun server runs on your Mac/desktop and handles all the heavy lifting:

```bash
# Start the server only
bun run dev:server

# Or start everything
bun run dev
```

The server runs on port `9900` by default. Make sure your Steam Deck can reach this port over your local network.

### What the server does

- Executes macOS actions (media controls, app launching, hotkeys, AppleScript)
- Streams live data (Spotify now playing, system stats, Discord status, audio FFT)
- Manages the soundboard (audio playback via BlackHole for Discord routing)
- Tracks Claude Code sessions
- Serves the web client for browser access
- Stores config at `~/Library/Application Support/deckpilot/config.json`

## Configuration

DeckPilot is fully configurable through the built-in edit mode:

1. Tap the gear icon in the status bar
2. Add/edit/remove widgets, pages, and profiles
3. Configure gamepad button bindings
4. Save changes

Config is stored on the server and synced to all connected clients via WebSocket.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Server | Bun + Hono |
| Client | React 19 + Vite + Tailwind CSS v4 |
| Native shell | Tauri v2 (Rust) |
| Gamepad | SDL2 (Tauri) / Gamepad API (browser) |
| Haptics | SDL2 rumble via mpsc channel |
| Animations | anime.js v4 |
| Build | Turbo monorepo + Bun workspaces |
| CI/CD | GitHub Actions → AppImage |
| Auto-update | tauri-plugin-updater + GitHub Releases |

## License

MIT
