import { Hono } from "hono";
import { join } from "path";
import type { SoundboardManager } from "../services/soundboard";

const ALLOWED_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac", ".caf"]);

function sanitizeName(name: string | undefined): string | null {
  if (!name) return null;
  // Reject path traversal
  const clean = name.replace(/[/\\]/g, "");
  if (clean !== name || clean.startsWith(".") || !clean.includes(".")) return null;
  const ext = clean.substring(clean.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;
  return clean;
}

export function createSoundsRouter(soundboard: SoundboardManager) {
  const router = new Hono();

  // List sounds
  router.get("/", (c) => {
    return c.json(soundboard.listSounds());
  });

  // Upload sound (multipart)
  router.post("/", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const name = sanitizeName(file.name);
    if (!name) {
      return c.json({ error: "Invalid file name or extension" }, 400);
    }

    const dir = soundboard.getSoundsDir();
    const filePath = join(dir, name);
    const bytes = await file.arrayBuffer();
    await Bun.write(filePath, bytes);

    return c.json({ name, size: bytes.byteLength });
  });

  // Serve sound file (for client preview)
  router.get("/:name", (c) => {
    const name = sanitizeName(c.req.param("name"));
    if (!name) return c.json({ error: "Invalid name" }, 400);

    const filePath = soundboard.getSoundPath(name);
    if (!filePath) return c.json({ error: "Not found" }, 404);

    return new Response(Bun.file(filePath));
  });

  // Delete sound
  router.delete("/:name", (c) => {
    const name = sanitizeName(c.req.param("name"));
    if (!name) return c.json({ error: "Invalid name" }, 400);

    if (!soundboard.deleteSound(name)) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json({ deleted: name });
  });

  return router;
}
