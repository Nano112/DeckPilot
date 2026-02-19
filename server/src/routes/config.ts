import { Hono } from "hono";
import { getConfig, saveConfig } from "../config/store";
import { configSchema } from "../config/schema";
import { broadcast, notifyConfigChanged } from "../ws";

const configRouter = new Hono();

configRouter.get("/", (c) => {
  return c.json(getConfig());
});

configRouter.put("/", async (c) => {
  const body = await c.req.json();
  const parsed = configSchema.parse(body);
  saveConfig(parsed as import("shared").DeckPilotConfig);
  broadcast({ type: "config_updated", payload: getConfig() });
  notifyConfigChanged();
  return c.json({ success: true });
});

export { configRouter };
