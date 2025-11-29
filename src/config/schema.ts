import { z } from "zod";

export const StdioUpstreamSchema = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
});

export const HttpUpstreamSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  allowedTools: z.array(z.string()).optional(),
});

export const UpstreamSchema = z.discriminatedUnion("type", [
  StdioUpstreamSchema,
  HttpUpstreamSchema,
]);

export const ConfigSchema = z.object({
  upstreams: z.record(UpstreamSchema),
});

export type StdioUpstreamConfig = z.infer<typeof StdioUpstreamSchema>;
export type HttpUpstreamConfig = z.infer<typeof HttpUpstreamSchema>;
export type UpstreamConfig = z.infer<typeof UpstreamSchema>;
export type Config = z.infer<typeof ConfigSchema>;
