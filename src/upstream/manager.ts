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
    const connectPromises: Promise<void>[] = [];

    for (const [name, upstreamConfig] of Object.entries(this.config.upstreams)) {
      const client = this.createClient(name, upstreamConfig);
      this.clients.set(name, client);
      connectPromises.push(
        client.connect().catch((err) => {
          logger.error(`Failed to connect to upstream ${name}:`, err);
          throw err;
        })
      );
    }

    await Promise.all(connectPromises);
    logger.info(`Connected to ${this.clients.size} upstreams`);
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
