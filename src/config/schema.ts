import { z } from "zod";

export const StdioUpstreamSchema = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
  toolDescriptionOverrides: z.record(z.string()).optional(),
});

export const HttpUpstreamSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  allowedTools: z.array(z.string()).optional(),
  toolDescriptionOverrides: z.record(z.string()).optional(),
});

export const UpstreamSchema = z.discriminatedUnion("type", [
  StdioUpstreamSchema,
  HttpUpstreamSchema,
]);

export const ProxyConfigSchema = z.object({
  name: z.string().default("mcp-proxy-gateway"),
  version: z.string().default("1.0.0"),
  namespacing: z
    .object({
      enabled: z.boolean().default(true),
      separator: z.string().default("__"),
    })
    .default({}),
});

export const ConfigSchema = z.object({
  proxy: ProxyConfigSchema.default({}),
  upstreams: z.record(UpstreamSchema),
  env: z.record(z.string()).optional(),
});

export type StdioUpstreamConfig = z.infer<typeof StdioUpstreamSchema>;
export type HttpUpstreamConfig = z.infer<typeof HttpUpstreamSchema>;
export type UpstreamConfig = z.infer<typeof UpstreamSchema>;
export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
