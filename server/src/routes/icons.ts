import { Hono } from "hono";
import { join } from "path";
import { mkdir } from "fs/promises";

const ICONS_DIR = join(
  process.env.HOME ?? "~",
  "Library/Application Support/deckpilot/icons"
);
const MAX_SIZE = 256 * 1024; // 256KB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/jpeg",
]);

// Ensure icons directory exists
await mkdir(ICONS_DIR, { recursive: true });

export const iconsRouter = new Hono();

// Serve icon files
iconsRouter.get("/:filename", async (c) => {
  const filename = c.req.param("filename");
  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return c.json({ error: "Invalid filename" }, 400);
  }
  const filePath = join(ICONS_DIR, filename);
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file);
  }
  return c.notFound();
});

// Upload icon
iconsRouter.post("/", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json(
      { error: "Invalid file type. Allowed: PNG, SVG, WEBP, JPEG" },
      400
    );
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: "File too large. Max 256KB" }, 400);
  }

  // Sanitize filename
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const safeName = `icon-${Date.now()}.${ext}`;
  const filePath = join(ICONS_DIR, safeName);

  await Bun.write(filePath, file);

  return c.json({ filename: safeName }, 201);
});
