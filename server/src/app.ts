import { resolve, join } from "path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { configRouter } from "./routes/config";
import { actionsRouter } from "./routes/actions";

const clientDist = resolve(import.meta.dir, "../../client/dist");

const app = new Hono();

app.use(cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/config", configRouter);
app.route("/api/actions", actionsRouter);

/** Register the static file catch-all AFTER all API routes */
export function registerStaticFallback(): void {
  app.get("/*", async (c) => {
    const path = c.req.path === "/" ? "/index.html" : c.req.path;
    const filePath = join(clientDist, path);

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback — serve index.html for non-file routes
    const index = Bun.file(join(clientDist, "index.html"));
    if (await index.exists()) {
      return new Response(index);
    }

    return c.notFound();
  });
}

export { app };
