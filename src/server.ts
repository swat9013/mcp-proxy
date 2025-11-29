import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config/schema.js";
import { UpstreamManager } from "./upstream/manager.js";
import { ToolRegistry } from "./registry/tool-registry.js";
import { logger } from "./utils/logger.js";

export class ProxyServer {
  private config: Config;
  private server: Server;
  private upstreamManager: UpstreamManager;
  private toolRegistry: ToolRegistry;

  constructor(config: Config) {
    this.config = config;
    this.upstreamManager = new UpstreamManager(config);
    this.toolRegistry = new ToolRegistry(config, this.upstreamManager);

    this.server = new Server(
      {
        name: "mcp-proxy-gateway",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // tools/list ハンドラー
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolRegistry.getTools();
      logger.debug(`Returning ${tools.length} tools`);
      return { tools };
    });

    // tools/call ハンドラー
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.debug(`Tool call: ${name}`, args);

      const resolved = this.toolRegistry.resolveToolName(name);
      if (!resolved) {
        logger.error(`Unknown tool: ${name}`);
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        } as CallToolResult;
      }

      const { upstreamName, originalName } = resolved;
      const client = this.upstreamManager.getClient(upstreamName);

      if (!client || !client.isConnected()) {
        logger.error(`Upstream ${upstreamName} is not connected`);
        return {
          content: [{ type: "text", text: `Upstream ${upstreamName} is not available` }],
          isError: true,
        } as CallToolResult;
      }

      try {
        logger.info(`Routing ${name} -> ${upstreamName}:${originalName}`);
        const result = await client.callTool(originalName, args ?? {});
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`Tool call failed: ${errorMessage}`);
        return {
          content: [{ type: "text", text: `Tool call failed: ${errorMessage}` }],
          isError: true,
        } as CallToolResult;
      }
    });
  }

  async start(): Promise<void> {
    logger.info("Starting MCP Proxy Gateway...");

    // 上流MCPに接続
    await this.upstreamManager.connectAll();

    // ツール一覧を取得・登録
    await this.toolRegistry.refreshTools();

    // stdio transportで接続
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info("MCP Proxy Gateway started");

    // シャットダウンハンドラー
    const shutdown = async () => {
      logger.info("Shutting down...");
      await this.upstreamManager.disconnectAll();
      await this.server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}
