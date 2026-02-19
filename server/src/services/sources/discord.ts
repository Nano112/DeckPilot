import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";
import type { DiscordPresenceData } from "shared";
import type { DataSourceProvider } from "./types";

// Discord IPC protocol constants
const OP_HANDSHAKE = 0;
const OP_FRAME = 1;

// Well-known Discord IPC socket paths
const SOCKET_PATHS = ["/tmp/discord-ipc-0", "/tmp/discord-ipc-1"];


interface PendingCommand {
  resolve: (value: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

function encodeIPCMessage(op: number, data: Record<string, unknown>): Buffer {
  const payload = JSON.stringify(data);
  const payloadBuf = Buffer.from(payload, "utf-8");
  const header = Buffer.alloc(8);
  header.writeUInt32LE(op, 0);
  header.writeUInt32LE(payloadBuf.length, 4);
  return Buffer.concat([header, payloadBuf]);
}

function findSocketPath(): string | null {
  const dirs = new Set<string>();

  // /tmp (Linux, some macOS)
  dirs.add("/tmp");

  // os.tmpdir()
  dirs.add(tmpdir());

  // $TMPDIR env
  if (process.env.TMPDIR) dirs.add(process.env.TMPDIR.replace(/\/$/, ""));

  // macOS: query the real per-user temp dir (often /var/folders/...)
  if (process.platform === "darwin") {
    try {
      const result = Bun.spawnSync(["getconf", "DARWIN_USER_TEMP_DIR"]);
      const darwinTmp = new TextDecoder().decode(result.stdout).trim().replace(/\/$/, "");
      if (darwinTmp) dirs.add(darwinTmp);
    } catch {}
  }

  // XDG runtime dir (Linux)
  if (process.env.XDG_RUNTIME_DIR) dirs.add(process.env.XDG_RUNTIME_DIR);

  for (const dir of dirs) {
    for (let i = 0; i < 10; i++) {
      const p = `${dir}/discord-ipc-${i}`;
      if (existsSync(p)) return p;
    }
  }

  return null;
}

function getConfigDir(): string {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", "deckpilot");
    case "win32":
      return join(
        process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
        "deckpilot",
      );
    default:
      return join(
        process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
        "deckpilot",
      );
  }
}

export class DiscordSource implements DataSourceProvider {
  readonly name = "discord";
  readonly intervalMs = 5000;

  // Connection state
  private connected = false;
  private socket: { write(d: Uint8Array): void } | null = null;
  private buffer = Buffer.alloc(0);
  private connecting = false;
  private lastConnectAttempt = 0;
  private pendingCommands = new Map<string, PendingCommand>();

  // Auth state
  private clientId: string;
  private clientSecret: string;
  private authenticated = false;
  private accessToken: string | null = null;
  private tokenPath: string;

  // Presence state
  private cachedPresence: DiscordPresenceData | null = null;
  private user: string | null = null;

  constructor() {
    this.clientId = process.env.DISCORD_CLIENT_ID ?? "";
    this.clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";
    this.tokenPath = join(getConfigDir(), "discord-token.json");
    this.loadToken();

    if (!this.clientId) {
      console.log(
        "[Discord] No DISCORD_CLIENT_ID set. Voice controls disabled.",
      );
      console.log(
        "[Discord] Create a Discord app at https://discord.com/developers/applications",
      );
      console.log(
        "[Discord] Then set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET env vars.",
      );
    }
  }

  /** Called by the web OAuth callback route to provide an access token */
  setAccessToken(token: string): void {
    this.saveToken(token);
    // If already connected, authenticate immediately
    if (this.connected && this.socket) {
      console.log("[Discord] Authenticating with new token...");
      this.writeIPC("AUTHENTICATE", { access_token: token });
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  private loadToken(): void {
    try {
      if (existsSync(this.tokenPath)) {
        const data = JSON.parse(readFileSync(this.tokenPath, "utf-8"));
        this.accessToken = data.access_token ?? null;
        if (this.accessToken) {
          console.log("[Discord] Loaded stored access token");
        }
      }
    } catch {
      this.accessToken = null;
    }
  }

  private saveToken(token: string): void {
    this.accessToken = token;
    try {
      mkdirSync(getConfigDir(), { recursive: true });
      writeFileSync(
        this.tokenPath,
        JSON.stringify({ access_token: token }),
        "utf-8",
      );
      console.log("[Discord] Saved access token");
    } catch (err) {
      console.error("[Discord] Failed to save token:", err);
    }
  }

  async fetch(): Promise<DiscordPresenceData | null> {
    if (!this.connected && !this.connecting) {
      const now = Date.now();
      if (now - this.lastConnectAttempt < 10000) {
        return this.cachedPresence;
      }
      this.lastConnectAttempt = now;
      await this.connect();
    }
    return this.cachedPresence;
  }

  async sendCommand(
    cmd: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!this.connected || !this.socket) {
      throw new Error("Discord IPC not connected");
    }
    if (!this.authenticated) {
      throw new Error("Discord IPC not authenticated");
    }

    const nonce = crypto.randomUUID();
    const msg = encodeIPCMessage(OP_FRAME, { cmd, args, nonce });

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(nonce);
        reject(new Error(`Discord command ${cmd} timed out`));
      }, 5000);

      this.pendingCommands.set(nonce, { resolve, reject, timeout });
      this.socket!.write(msg);
    });
  }

  // ─── IPC message handler ───

  private handleMessage(msg: Record<string, unknown>): void {
    const cmd = msg.cmd as string | undefined;
    const evt = msg.evt as string | undefined;
    const data = msg.data as Record<string, unknown> | undefined;
    const nonce = msg.nonce as string | undefined;

    // Resolve pending commands by nonce
    if (nonce && this.pendingCommands.has(nonce)) {
      const pending = this.pendingCommands.get(nonce)!;
      this.pendingCommands.delete(nonce);
      clearTimeout(pending.timeout);
      if (evt === "ERROR") {
        pending.reject(
          new Error((data?.message as string) ?? "Discord IPC error"),
        );
      } else {
        pending.resolve(data ?? {});
      }
      // Don't return — still process the message for state updates
    }

    // ── READY ──
    if (cmd === "DISPATCH" && evt === "READY" && data) {
      const user = data.user as { username?: string } | undefined;
      this.user = user?.username ?? null;
      console.log("[Discord] Connected as:", this.user);
      this.ensurePresence();

      // Start auth flow if we have credentials
      if (this.clientId) {
        if (this.accessToken) {
          console.log("[Discord] Attempting auth with stored token...");
          this.writeIPC("AUTHENTICATE", {
            access_token: this.accessToken,
          });
        } else {
          console.log(
            "[Discord] No access token. Visit http://localhost:9900/api/discord/auth to authorize.",
          );
        }
      }
      return;
    }

    // ── AUTHENTICATE response ──
    if (cmd === "AUTHENTICATE") {
      if (evt === "ERROR") {
        console.log(
          "[Discord] Auth failed:",
          (data?.message as string) ?? "unknown error",
        );
        this.accessToken = null;
        console.log(
          "[Discord] Visit http://localhost:9900/api/discord/auth to re-authorize.",
        );
      } else {
        console.log("[Discord] Authenticated successfully!");
        this.authenticated = true;
        this.subscribeAndQuery();
      }
      return;
    }

    // ── SUBSCRIBE confirmations ──
    if (cmd === "SUBSCRIBE") {
      if (evt === "ERROR") {
        console.error(
          "[Discord] Subscribe failed:",
          (data?.message as string) ?? "unknown",
        );
      }
      return;
    }

    // Everything below requires auth
    if (!this.authenticated) return;

    // ── Voice settings ──
    if (
      (cmd === "GET_VOICE_SETTINGS" ||
        (cmd === "DISPATCH" && evt === "VOICE_SETTINGS_UPDATE")) &&
      data
    ) {
      const mute = data.mute as boolean | undefined;
      const deaf = data.deaf as boolean | undefined;
      if (mute !== undefined || deaf !== undefined) {
        this.ensurePresence();
        this.cachedPresence!.voiceSettings = {
          mute: mute ?? this.cachedPresence!.voiceSettings?.mute ?? false,
          deaf: deaf ?? this.cachedPresence!.voiceSettings?.deaf ?? false,
        };
        console.log(
          "[Discord] Voice settings:",
          this.cachedPresence!.voiceSettings,
        );
      }
      return;
    }

    // ── Voice channel response ──
    if (cmd === "GET_SELECTED_VOICE_CHANNEL") {
      this.ensurePresence();
      if (data) {
        const channelName = data.name as string | undefined;
        const guildId = data.guild_id as string | undefined;
        if (channelName) {
          this.cachedPresence!.voiceChannel = {
            name: channelName,
            guild: guildId ?? "",
          };
          // Extract voice members
          const voiceStates = data.voice_states as
            | Array<Record<string, unknown>>
            | undefined;
          if (voiceStates) {
            this.cachedPresence!.voiceMembers = voiceStates.map((vs) => {
              const user = vs.user as Record<string, unknown> | undefined;
              const nick = vs.nick as string | undefined;
              return {
                id: (user?.id as string) ?? "",
                username: nick ?? (user?.username as string) ?? "Unknown",
                mute: (vs.voice_state as Record<string, unknown>)?.mute as boolean ?? false,
                deaf: (vs.voice_state as Record<string, unknown>)?.deaf as boolean ?? false,
                selfMute: (vs.voice_state as Record<string, unknown>)?.self_mute as boolean ?? false,
                selfDeaf: (vs.voice_state as Record<string, unknown>)?.self_deaf as boolean ?? false,
              };
            });
            console.log(
              "[Discord] Voice members:",
              this.cachedPresence!.voiceMembers.map((m) => m.username),
            );
          }
        } else {
          this.cachedPresence!.voiceChannel = null;
          this.cachedPresence!.voiceMembers = [];
        }
      } else {
        this.cachedPresence!.voiceChannel = null;
        this.cachedPresence!.voiceMembers = [];
      }
      return;
    }

    // ── Voice channel select event ──
    if (cmd === "DISPATCH" && evt === "VOICE_CHANNEL_SELECT" && data) {
      this.ensurePresence();
      const channelId = data.channel_id as string | null;
      if (!channelId) {
        this.cachedPresence!.voiceChannel = null;
        this.cachedPresence!.voiceMembers = [];
        console.log("[Discord] Left voice channel");
      } else if (this.socket) {
        this.writeIPC("GET_SELECTED_VOICE_CHANNEL", {});
      }
      return;
    }

    // ── Generic activity ──
    if (data) {
      const activity = data.activity as Record<string, unknown> | undefined;
      if (activity) {
        this.ensurePresence();
        this.cachedPresence!.activity = {
          name: (activity.name as string) ?? "",
          details: activity.details as string | undefined,
          state: activity.state as string | undefined,
          largeImage: (() => {
            const assets = activity.assets as
              | Record<string, string>
              | undefined;
            return assets?.large_image;
          })(),
        };
      }
    }
  }

  // ─── Auth helpers ───

  // IPC AUTHORIZE and token exchange removed — using web OAuth flow instead
  // See routes/discord.ts for the web-based auth flow

  private subscribeAndQuery(): void {
    // Subscribe to live updates
    this.writeIPC("SUBSCRIBE", { evt: "VOICE_SETTINGS_UPDATE" });
    this.writeIPC("SUBSCRIBE", { evt: "VOICE_CHANNEL_SELECT" });

    // Query current state
    this.writeIPC("GET_VOICE_SETTINGS", {});
    this.writeIPC("GET_SELECTED_VOICE_CHANNEL", {});
  }

  // ─── Low-level IPC write ───

  private writeIPC(cmd: string, args: Record<string, unknown>): void {
    if (!this.socket) return;
    const nonce = crypto.randomUUID();
    // SUBSCRIBE uses "evt" field, not "args"
    const payload =
      cmd === "SUBSCRIBE"
        ? { cmd, evt: args.evt, nonce }
        : { cmd, args, nonce };
    this.socket.write(encodeIPCMessage(OP_FRAME, payload));
  }

  // ─── Presence helpers ───

  private ensurePresence(): void {
    if (!this.cachedPresence) {
      this.cachedPresence = {
        user: this.user ?? "Unknown",
        activity: null,
        voiceChannel: null,
        voiceSettings: null,
        voiceMembers: [],
      };
    }
    this.cachedPresence.user = this.user ?? "Unknown";
  }

  // ─── Connection ───

  private async connect(): Promise<void> {
    const socketPath = findSocketPath();
    if (!socketPath) return;

    this.connecting = true;

    try {
      const self = this;

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          self.connected = false;
          self.connecting = false;
          resolve();
        }, 5000);

        Bun.connect({
          unix: socketPath,
          socket: {
            open(socket) {
              self.socket = socket as unknown as {
                write(d: Uint8Array): void;
              };
              self.connected = true;
              console.log("[Discord] Socket connected, sending handshake...");
              const clientId = self.clientId || "207646673902501888";
              socket.write(
                encodeIPCMessage(OP_HANDSHAKE, { v: 1, client_id: clientId }),
              );
            },
            data(_socket, rawData) {
              self.buffer = Buffer.concat([self.buffer, Buffer.from(rawData)]);

              while (self.buffer.length >= 8) {
                const _op = self.buffer.readUInt32LE(0);
                const len = self.buffer.readUInt32LE(4);
                if (self.buffer.length < 8 + len) break;

                const payload = self.buffer
                  .subarray(8, 8 + len)
                  .toString("utf-8");
                self.buffer = self.buffer.subarray(8 + len);

                try {
                  self.handleMessage(JSON.parse(payload));
                } catch {
                  // Invalid JSON
                }
              }

              clearTimeout(timeout);
              resolve();
            },
            error(_socket, error) {
              console.error("[Discord] Socket error:", error.message);
              self.connected = false;
              self.socket = null;
              clearTimeout(timeout);
              resolve();
            },
            close() {
              console.log("[Discord] Socket closed");
              self.connected = false;
              self.socket = null;
              self.authenticated = false;
              for (const [, pending] of self.pendingCommands) {
                clearTimeout(pending.timeout);
                pending.reject(new Error("Discord IPC closed"));
              }
              self.pendingCommands.clear();
              clearTimeout(timeout);
              resolve();
            },
          },
        });
      });
    } catch {
      this.connected = false;
    } finally {
      this.connecting = false;
    }
  }
}
