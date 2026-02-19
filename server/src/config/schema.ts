import { z } from "zod/v4";

const actionSchema = z.object({
  type: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});

const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(["button", "slider", "now_playing", "spacer", "soundboard"]).default("button"),
  label: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  position: z.object({
    row: z.number(),
    col: z.number(),
    colspan: z.number().optional(),
    rowspan: z.number().optional(),
  }),
  // button-specific
  action: actionSchema.optional(),
  longPressAction: actionSchema.optional(),
  // slider-specific
  sliderAction: actionSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  // live data
  dataSource: z.string().optional(),
  // variant system
  variant: z.string().optional(),
  widgetProps: z.record(z.string(), z.unknown()).optional(),
});

const pageGridPositionSchema = z.object({
  row: z.number(),
  col: z.number(),
});

const pageSchema = z.object({
  id: z.string(),
  name: z.string(),
  gridPosition: pageGridPositionSchema.default({ row: 0, col: 0 }),
  widgets: z.array(widgetSchema),
  buttons: z.array(widgetSchema).optional(),
});

const gridSchema = z.object({
  columns: z.number().min(1).max(10),
  rows: z.number().min(1).max(10),
});

const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  grid: gridSchema,
  pages: z.array(pageSchema).min(1),
  pageGridSize: z.object({ rows: z.number(), cols: z.number() }).optional(),
});

const gamepadBindingSchema = z.object({
  button: z.number(),
  kind: z.enum(["client", "server"]),
  action: actionSchema.optional(),
  clientAction: z.string().optional(),
  label: z.string().optional(),
});

export const configSchema = z.object({
  version: z.number(),
  server: z.object({
    port: z.number(),
    host: z.string(),
  }),
  activeProfile: z.string(),
  profiles: z.array(profileSchema).min(1),
  gamepadBindings: z.array(gamepadBindingSchema).default([]),
});
