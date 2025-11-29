import type { Config, UpstreamConfig } from "../config/schema.js";
import type { UpstreamClient } from "./types.js";
import { StdioUpstreamClient } from "./stdio-client.js";
import { HttpUpstreamClient } from "./http-client.js";
import { logger } from "../utils/logger.js";

export class UpstreamManager {
  private clients: Map<string, UpstreamClient> = new Map();
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private createClient(name: string, upstreamConfig: UpstreamConfig): UpstreamClient {
    switch (upstreamConfig.type) {
      case "stdio":
        return new StdioUpstreamClient(name, upstreamConfig);
      case "http":
        return new HttpUpstreamClient(name, upstreamConfig);
      default:
        throw new Error(`Unknown upstream type: ${(upstreamConfig as { type: string }).type}`);
    }
  }

  async connectAll(): Promise<void> {
    const connectPromises: Promise<{ name: string; success: boolean }>[] = [];

    for (const [name, upstreamConfig] of Object.entries(this.config.upstreams)) {
      const client = this.createClient(name, upstreamConfig);
      this.clients.set(name, client);
      connectPromises.push(
        client.connect()
          .then(() => ({ name, success: true }))
          .catch((err) => {
            logger.error(`Failed to connect to upstream ${name}:`, err);
            return { name, success: false };
          })
      );
    }

    const results = await Promise.all(connectPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).map(r => r.name);

    if (failed.length > 0) {
      logger.warn(`Failed to connect to upstreams: ${failed.join(", ")}`);
    }

    logger.info(`Connected to ${successful}/${this.clients.size} upstreams`);
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const client of this.clients.values()) {
      disconnectPromises.push(client.disconnect());
    }

    await Promise.all(disconnectPromises);
    this.clients.clear();
    logger.info("Disconnected from all upstreams");
  }

  getClient(name: string): UpstreamClient | undefined {
    return this.clients.get(name);
  }

  getAllClients(): Map<string, UpstreamClient> {
    return this.clients;
  }

  getUpstreamConfig(name: string): UpstreamConfig | undefined {
    return this.config.upstreams[name];
  }
}
