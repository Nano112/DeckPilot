import { Hono } from "hono";
import type { DiscordSource } from "../services/sources/discord";

const SCOPES = ["identify", "rpc", "rpc.voice.read", "rpc.voice.write"];

export function createDiscordRouter(discordSource: DiscordSource) {
  const router = new Hono();

  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

  // Step 1: Redirect user to Discord OAuth2
  router.get("/auth", (c) => {
    if (!clientId) {
      return c.text("DISCORD_CLIENT_ID not configured", 500);
    }

    const redirectUri = `http://localhost:${c.req.header("host")?.split(":")[1] ?? "9900"}/api/discord/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
    });

    return c.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  // Step 2: Handle callback, exchange code for token
  router.get("/callback", async (c) => {
    const code = c.req.query("code");
    const error = c.req.query("error");

    if (error) {
      return c.html(`<h2>Discord authorization failed</h2><p>${error}</p><p>You can close this tab.</p>`);
    }
    if (!code) {
      return c.html("<h2>Missing authorization code</h2><p>Try again.</p>");
    }

    const redirectUri = `http://localhost:${c.req.header("host")?.split(":")[1] ?? "9900"}/api/discord/callback`;

    const resp = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[Discord OAuth] Token exchange failed:", resp.status, text);
      return c.html(`<h2>Token exchange failed</h2><pre>${text}</pre>`);
    }

    const json = (await resp.json()) as { access_token?: string };
    if (!json.access_token) {
      return c.html("<h2>No access token returned</h2>");
    }

    // Store token and trigger IPC authentication
    discordSource.setAccessToken(json.access_token);
    console.log("[Discord OAuth] Token obtained successfully");

    return c.html(
      `<html><body style="background:#1a1a2e;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2 style="color:#5865F2">Discord Connected!</h2>
          <p>DeckPilot now has access to voice controls.</p>
          <p style="opacity:0.6">You can close this tab.</p>
        </div>
      </body></html>`,
    );
  });

  // Status endpoint
  router.get("/status", (c) => {
    return c.json({
      configured: !!clientId,
      authenticated: discordSource.isAuthenticated(),
      authUrl: clientId ? `/api/discord/auth` : null,
    });
  });

  return router;
}
