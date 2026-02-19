# DeckPilot

A cross-platform remote macro pad that turns any touchscreen device (Steam Deck, phone, tablet) into a fully customizable control surface for your computer. Server runs on your machine, client is a web app you open in a browser.

## Concept

Your **MacBook** (or any computer) runs the DeckPilot server. Your **Steam Deck** (or any device with a browser) connects over WiFi and becomes a touchscreen control panel. The Steam Deck is ideal because it has both a **7" touchscreen** and **physical buttons** (ABXY, bumpers, triggers, d-pad, trackpads, joysticks) — all accessible from the browser via the Gamepad API.

## Architecture

```
  Steam Deck (client)                    MacBook (server)
┌─────────────────────┐     WiFi      ┌──────────────────────────┐
│                     │               │       Bun Process         │
│  Browser            │    HTTP/WS    │                          │
│  ┌───────────────┐  │◄────────────►│  ┌────────────────────┐  │
│  │ React App     │  │               │  │  Hono Web Server   │  │
│  │               │  │               │  │  :9900             │  │
│  │ Touch grid    │  │  WebSocket    │  └────────┬───────────┘  │
│  │ + Gamepad API │──│──────────────►│           │              │
│  │               │  │               │  ┌────────▼───────────┐  │
│  └───────────────┘  │               │  │   Action Engine    │  │
│                     │               │  │   (execute on host)│  │
│  Physical buttons:  │               │  └────────┬───────────┘  │
│  ABXY, bumpers,     │               │           │              │
│  triggers, d-pad,   │               │  ┌────────▼───────────┐  │
│  trackpads, sticks  │               │  │  Platform Layer    │  │
│                     │               │  │  macOS/Win/Linux   │  │
└─────────────────────┘               │  └────────────────────┘  │
                                      └──────────────────────────┘
```

### How It Works

1. **Server starts** on your MacBook — Hono serves the React app + API on `:9900`
2. **Steam Deck** opens `http://<macbook-ip>:9900` in a browser (desktop mode or Gaming Mode browser)
3. **Touchscreen** shows a customizable grid of buttons — tap to trigger actions
4. **Physical buttons** are captured via the [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) — the Steam Deck's controls register as a gamepad in the browser
5. **Button press / touch tap** sends a WebSocket message to the server
6. **Server executes** the mapped action on the host machine (run script, control audio, send keypress, etc.)
7. **Server pushes state** back to the client (e.g., current volume, now playing, system stats)

### Stack

| Layer | Tech | Why |
|-------|------|-----|
| Runtime | [Bun](https://bun.sh) | Fast, built-in TS, good child_process for system commands |
| Server | [Hono](https://hono.dev) | Lightweight, fast, WebSocket support via `hono/ws` |
| Frontend | React + Vite | bhvr stack — hot reload, fast builds |
| Real-time | WebSocket | Low-latency bidirectional communication |
| Client input | Gamepad API | Captures Steam Deck hardware buttons in the browser |

---

## Client — The Deck UI

### Touchscreen Grid

- Configurable grid layout (e.g., 5x3, 4x4, or freeform)
- Each cell is a **button** with an icon, label, and background color
- Tap a button -> sends its action ID to the server over WebSocket
- **Long press** triggers a secondary action (configurable)
- **Swipe** between pages
- Grid size adapts to screen — Steam Deck is 1280x800, phones/tablets also work
- **Edit mode** toggle — rearrange, resize, add/remove buttons without accidentally triggering actions

### Physical Button Mapping (Gamepad API)

The Steam Deck registers as a standard gamepad in browsers. All controls are mappable:

| Control | Gamepad API | Default Suggestion |
|---------|-------------|-------------------|
| A / B / X / Y | `buttons[0-3]` | Configurable per profile |
| L1 / R1 (bumpers) | `buttons[4-5]` | Page previous / next |
| L2 / R2 (triggers) | `axes` or `buttons[6-7]` | Volume down / up |
| D-pad | `buttons[12-15]` | Arrow key navigation |
| Left stick | `axes[0-1]` | Scroll through button grid |
| Right stick | `axes[2-3]` | Mouse control (optional) |
| Left/Right trackpad | Touch events | Additional touch zones |
| Menu / Options | `buttons[8-9]` | Toggle edit mode / settings |
| Steam button | Captured by OS | Not mappable (reserved by SteamOS) |

Users can remap every physical button to any action (same action types as touch buttons).

### Client Modes

- **Deck mode** — the full button grid with physical button support (primary use)
- **Config mode** — edit layout, assign actions, manage profiles (also accessible from any browser)
- **Minimal mode** — small floating overlay (for when you're gaming on the Steam Deck itself and want quick access to a few controls)

---

## Server — Action Engine

### Action Types

Every action is a simple `{ type, params }` object. The server maintains a registry of all available action types.

### Actions — Shell / Script Execution

The core of customizability. Everything else is built on top of this.

| Action | Description |
|--------|-------------|
| `exec.shell` | Run any shell command on the host |
| `exec.script` | Run a script file (sh, py, js, etc.) |
| `exec.javascript` | Execute inline JavaScript in the Bun runtime |
| `exec.applescript` | Run AppleScript (macOS only) |

### Actions — Media Controls

| Action | Description |
|--------|-------------|
| `media.play_pause` | Toggle media playback (simulates media key) |
| `media.next` | Next track |
| `media.previous` | Previous track |
| `media.stop` | Stop playback |

### Actions — System Audio

| Action | Description |
|--------|-------------|
| `audio.volume.up` | Increase system volume by N% |
| `audio.volume.down` | Decrease by N% |
| `audio.volume.set` | Set to exact % |
| `audio.mute` | Toggle mute |
| `audio.output.set` | Switch output device (speakers/headphones) |
| `audio.input.set` | Switch input device (microphone) |
| `audio.output.list` | List available output devices |
| `audio.input.list` | List available input devices |

### Actions — System Commands

| Action | Description |
|--------|-------------|
| `system.lock` | Lock screen |
| `system.sleep` | Sleep |
| `system.shutdown` | Shutdown |
| `system.restart` | Restart |
| `system.open.url` | Open URL in default browser |
| `system.open.file` | Open file with default app |
| `system.open.folder` | Open folder in file manager |
| `system.launch` | Launch application by name |
| `system.screenshot` | Take a screenshot |
| `system.notification` | Show a desktop notification |

### Actions — Keyboard & Input

| Action | Description |
|--------|-------------|
| `input.hotkey` | Simulate a hotkey (e.g., `Cmd+Shift+4`) |
| `input.type` | Type a text string |
| `input.type_enter` | Type text and press Enter |
| `input.key` | Press a single key |
| `clipboard.copy` | Copy custom text to clipboard |
| `clipboard.paste` | Trigger paste |

### Actions — Window Management

| Action | Description |
|--------|-------------|
| `window.focus` | Bring window to front by app/title |
| `window.close` | Close a window |
| `window.minimize` | Minimize a window |
| `window.list` | List open windows |

### Actions — OBS Studio

Via [obs-websocket-js](https://github.com/obs-websocket-community-projects/obs-websocket-js):

| Action | Description |
|--------|-------------|
| `obs.scene.switch` | Change active scene |
| `obs.recording.toggle` | Toggle recording |
| `obs.recording.start` | Start recording |
| `obs.recording.stop` | Stop recording |
| `obs.streaming.toggle` | Toggle streaming |
| `obs.streaming.start` | Start streaming |
| `obs.streaming.stop` | Stop streaming |
| `obs.virtualcam.toggle` | Toggle virtual camera |
| `obs.source.toggle` | Toggle source visibility |
| `obs.hotkey` | Trigger OBS hotkey |

### Actions — Spotify

Via Spotify Web API (OAuth):

| Action | Description |
|--------|-------------|
| `spotify.play_pause` | Toggle playback |
| `spotify.next` | Next track |
| `spotify.previous` | Previous track |
| `spotify.play.song` | Search and play a song |
| `spotify.play.playlist` | Play a playlist |
| `spotify.volume.up` | Increase volume (Premium) |
| `spotify.volume.down` | Decrease volume (Premium) |
| `spotify.volume.set` | Set volume (Premium) |
| `spotify.like` | Save current track |
| `spotify.follow` | Toggle follow artist |

### Actions — Soundboard

| Action | Description |
|--------|-------------|
| `sound.play` | Play an audio file at configurable volume |
| `sound.stop` | Stop all playback |

### Actions — Display / Monitoring

These are buttons that show **live data** pushed from the server:

| Action | Description |
|--------|-------------|
| `display.cpu` | Show CPU usage % |
| `display.memory` | Show RAM usage |
| `display.disk` | Show disk usage |
| `display.network` | Show upload/download speed |
| `display.now_playing` | Show current track info |
| `display.clock` | Show current time |

### Actions — Navigation

| Action | Description |
|--------|-------------|
| `nav.page` | Go to a specific page |
| `nav.page.next` | Next page |
| `nav.page.previous` | Previous page |
| `nav.folder` | Open a folder of buttons |
| `nav.back` | Go back from folder |

### Actions — Utility

| Action | Description |
|--------|-------------|
| `util.timer` | Start/stop a timer displayed on the button |
| `util.counter` | Increment/decrement a counter |
| `util.color_picker` | Pick color at cursor position |
| `util.delay` | Wait N ms (for use in multi-action sequences) |

### Multi-Action Sequences

A button can trigger a list of actions in order:

```jsonc
{
  "type": "multi",
  "actions": [
    { "type": "window.focus", "params": { "app": "OBS" } },
    { "type": "util.delay", "params": { "ms": 200 } },
    { "type": "obs.recording.start" },
    { "type": "system.notification", "params": { "title": "Recording", "body": "Started!" } }
  ]
}
```

### Toggle Buttons

Two-state buttons with per-state icon and action:

```jsonc
{
  "toggle": true,
  "states": {
    "off": {
      "icon": "mic-off.png",
      "label": "Muted",
      "action": { "type": "audio.mute", "params": { "muted": false } }
    },
    "on": {
      "icon": "mic-on.png",
      "label": "Live",
      "action": { "type": "audio.mute", "params": { "muted": true } }
    }
  }
}
```

---

## Configuration

### Storage

Config stored as JSON on the **server** (the MacBook):
- macOS: `~/Library/Application Support/deckpilot/`
- Linux: `~/.config/deckpilot/`
- Windows: `%APPDATA%/deckpilot/`

Contents:
- `config.json` — main configuration
- `profiles/` — saved profiles
- `icons/` — user-uploaded icons
- `sounds/` — soundboard audio files
- `scripts/` — user scripts

### Config Structure

```jsonc
{
  "version": 1,
  "server": {
    "port": 9900,
    "host": "0.0.0.0"
  },
  "grid": {
    "columns": 5,
    "rows": 3
  },
  "activeProfile": "default",
  "profiles": {
    "default": {
      "pages": {
        "main": {
          "label": "Home",
          "buttons": {
            "0": {
              "icon": "volume-up.png",
              "label": "Vol+",
              "labelColor": "#ffffff",
              "backgroundColor": "#1a1a2e",
              "action": {
                "type": "audio.volume.up",
                "params": { "amount": 5 }
              },
              "longPressAction": {
                "type": "audio.volume.set",
                "params": { "value": 100 }
              }
            },
            "1": {
              "icon": "obs.png",
              "label": "Record",
              "toggle": true,
              "states": {
                "off": { "icon": "record-off.png", "action": { "type": "obs.recording.start" } },
                "on": { "icon": "record-on.png", "action": { "type": "obs.recording.stop" } }
              }
            }
          }
        }
      },
      "gamepadBindings": {
        "button_4": { "type": "nav.page.previous" },
        "button_5": { "type": "nav.page.next" },
        "button_6": { "type": "audio.volume.down", "params": { "amount": 5 } },
        "button_7": { "type": "audio.volume.up", "params": { "amount": 5 } },
        "button_0": { "type": "media.play_pause" },
        "button_1": { "type": "media.next" },
        "button_2": { "type": "media.previous" },
        "button_9": { "type": "nav.folder", "params": { "folder": "settings" } }
      }
    }
  },
  "integrations": {
    "obs": {
      "enabled": false,
      "host": "localhost",
      "port": 4455,
      "password": ""
    },
    "spotify": {
      "enabled": false,
      "clientId": "",
      "clientSecret": ""
    }
  }
}
```

---

## Platform Abstraction

Each platform implements the same interface. Selected at startup via `process.platform`.

```typescript
interface PlatformActions {
  // Audio
  getVolume(): Promise<number>
  setVolume(percent: number): Promise<void>
  getMuted(): Promise<boolean>
  setMuted(muted: boolean): Promise<void>
  getAudioOutputDevices(): Promise<AudioDevice[]>
  setAudioOutputDevice(id: string): Promise<void>
  getAudioInputDevices(): Promise<AudioDevice[]>
  setAudioInputDevice(id: string): Promise<void>

  // System
  lock(): Promise<void>
  sleep(): Promise<void>
  shutdown(): Promise<void>
  restart(): Promise<void>
  openUrl(url: string): Promise<void>
  openFile(path: string): Promise<void>
  launchApp(name: string): Promise<void>
  screenshot(path?: string): Promise<string>
  notify(title: string, body: string): Promise<void>

  // Window management
  focusWindow(name: string): Promise<void>
  closeWindow(name: string): Promise<void>
  listWindows(): Promise<WindowInfo[]>

  // Input simulation
  pressKey(key: string, modifiers?: string[]): Promise<void>
  typeText(text: string): Promise<void>
  getClipboard(): Promise<string>
  setClipboard(text: string): Promise<void>

  // System info
  getCpuUsage(): Promise<number>
  getMemoryUsage(): Promise<MemoryInfo>
  getDiskUsage(): Promise<DiskInfo[]>
  getNetworkUsage(): Promise<NetworkInfo>
}
```

macOS implementation approach:
- Audio: `osascript` for volume, `SwitchAudioSource` CLI for device switching
- System: `pmset`, `osascript`, `open`, `screencapture`
- Windows: `osascript` with AppleScript to talk to System Events
- Input: `osascript` key events or `cliclick` / `nut.js`
- System info: `systeminformation` npm package (cross-platform)

---

## Project Structure

```
deckpilot/
├── package.json
├── bunfig.toml
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── index.ts                 # Entry — start Hono server
│   ├── server/
│   │   ├── app.ts               # Hono app setup, static file serving
│   │   ├── routes/
│   │   │   ├── config.ts        # CRUD config/profiles
│   │   │   ├── actions.ts       # List available action types
│   │   │   └── assets.ts        # Icon/sound upload
│   │   └── ws.ts                # WebSocket — receive button presses, push state
│   ├── actions/
│   │   ├── registry.ts          # Action type registry + dispatch
│   │   ├── engine.ts            # Execute actions, multi-action, toggle state
│   │   ├── media.ts             # Media key actions
│   │   ├── audio.ts             # Volume/device actions
│   │   ├── system.ts            # Power, launch, open, notify
│   │   ├── input.ts             # Keyboard/clipboard
│   │   ├── window.ts            # Window management
│   │   ├── obs.ts               # OBS integration
│   │   ├── spotify.ts           # Spotify integration
│   │   ├── soundboard.ts        # Audio playback
│   │   ├── exec.ts              # Shell/script/JS execution
│   │   ├── display.ts           # System monitoring data
│   │   └── nav.ts               # Page/folder navigation
│   ├── platform/
│   │   ├── types.ts             # PlatformActions interface
│   │   ├── detect.ts            # Auto-detect OS, load correct impl
│   │   ├── macos.ts             # macOS implementation
│   │   ├── windows.ts           # Windows implementation
│   │   └── linux.ts             # Linux implementation
│   └── config/
│       ├── store.ts             # Load/save/watch config files
│       ├── schema.ts            # Zod validation
│       └── defaults.ts          # Default config + first-run setup
├── ui/                          # React frontend (Vite)
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ButtonGrid.tsx   # The main touch grid
│   │   │   ├── Button.tsx       # Single button (icon + label + press handling)
│   │   │   ├── ButtonEditor.tsx # Configure a button (config mode)
│   │   │   ├── ActionPicker.tsx # Browse/search actions
│   │   │   ├── IconPicker.tsx   # Choose/upload icons
│   │   │   ├── GamepadIndicator.tsx  # Show which physical buttons are active
│   │   │   ├── ProfileBar.tsx   # Switch profiles
│   │   │   ├── PageIndicator.tsx # Dots showing current page
│   │   │   └── StatusBar.tsx    # Connection status, server info
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts  # WS connection + reconnect logic
│   │   │   ├── useGamepad.ts    # Gamepad API polling + button events
│   │   │   └── useConfig.ts     # Config state + API calls
│   │   └── lib/
│   │       ├── gamepad.ts       # Gamepad button mapping + deadzone handling
│   │       └── actions.ts       # Action type definitions for the UI
│   └── public/
│       └── icons/               # Built-in icon set
├── assets/
│   └── icons/                   # Default icon pack
└── scripts/
    └── dev.ts                   # Dev server (vite + bun --watch)
```

---

## Steam Deck Specifics

### Browser Access

- **Desktop Mode**: Open Firefox/Chrome, navigate to `http://<macbook-ip>:9900`
- **Gaming Mode**: Add the URL as a non-Steam game using `--kiosk` flag for fullscreen browser, or use the built-in Steam browser overlay
- The UI should detect if it's running on a Steam Deck (user agent or screen size) and optimize layout accordingly

### Gamepad API Notes

- The Steam Deck's controls are available via standard Gamepad API when in a browser
- Polling loop at ~60fps via `requestAnimationFrame` + `navigator.getGamepads()`
- Need deadzone handling for analog sticks/triggers
- The **Steam button** is NOT accessible (reserved by SteamOS)
- Trackpads may report as mouse input rather than gamepad axes depending on Steam Input config
- The user may need to configure Steam Input to pass controls through to the browser as gamepad inputs rather than keyboard/mouse

### Screen Optimization

- Steam Deck screen: 1280x800, 7" — design for touch-friendly button sizes
- Minimum button size ~80x80px for comfortable touch targets
- Default grid of 5x3 fits well (256x266px per button area)
- Support landscape orientation (how Steam Deck is held)

---

## MVP Scope

Phase 1 — get it working:

1. **Hono server** serves React app, handles WebSocket connections
2. **Button grid** renders from config, touch/click sends action to server
3. **Action engine** executes `exec.shell` actions (this alone makes it useful)
4. **Config file** — load from JSON, editable by hand initially
5. **macOS platform basics** — volume control, open URL, media keys
6. **Gamepad input** — detect Steam Deck controls, send mapped actions

Phase 2 — make it nice:

7. **Config UI** — visual editor in the browser (edit mode toggle)
8. **Pages & folders** — navigate between button sets
9. **Toggle buttons** — stateful buttons with visual feedback
10. **More actions** — keyboard simulation, window management, screenshots
11. **Live display buttons** — CPU, memory, now playing

Phase 3 — integrations:

12. **OBS integration**
13. **Spotify integration**
14. **Soundboard**
15. **Multi-action sequences**
16. **Profile system**
17. **Import/Export**

---

## Open Questions

- **Discovery** — should the Steam Deck auto-discover the server (mDNS/Bonjour)? Or just enter IP manually?
- **Auth** — should there be a PIN/password to prevent unauthorized control? (probably yes if exposed on LAN)
- **Electron wrapper** — worth it for menu bar tray icon on the server side? Or just run as a CLI process?
- **Steam Deck as server too?** — since the Deck runs Linux, it could also BE the server controlling itself. Worth considering?
- **Haptic feedback** — the Steam Deck has haptic motors. The Gamepad API has `vibrationActuator` — use it for button press feedback?
