#!/usr/bin/env node
import { resolve } from "path";
import { loadConfig } from "./config/loader.js";
import { ProxyServer } from "./server.js";
import { logger } from "./utils/logger.js";

function parseArgs(): { configPath: string } {
  const args = process.argv.slice(2);
  let configPath = "mcp-proxy.config.yaml";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") {
      configPath = args[i + 1];
      i++;
    }
  }

  return { configPath: resolve(configPath) };
}

async function main() {
  const { configPath } = parseArgs();

  logger.info(`Loading config from: ${configPath}`);

  try {
    const config = loadConfig(configPath);
    logger.info(`Loaded config with ${Object.keys(config.upstreams).length} upstreams`);

    const server = new ProxyServer(config);
    await server.start();
  } catch (err) {
    logger.error("Failed to start MCP Proxy Gateway:", err);
    process.exit(1);
  }
}

main();
