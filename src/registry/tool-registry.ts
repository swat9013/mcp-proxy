import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Config, UpstreamConfig } from "../config/schema.js";
import type { UpstreamManager } from "../upstream/manager.js";
import { logger } from "../utils/logger.js";

interface RegisteredTool {
  tool: Tool;
  upstreamName: string;
  originalName: string;
}

const NAMESPACE_SEPARATOR = "__";

export class ToolRegistry {
  private config: Config;
  private upstreamManager: UpstreamManager;
  private tools: Map<string, RegisteredTool> = new Map();

  constructor(config: Config, upstreamManager: UpstreamManager) {
    this.config = config;
    this.upstreamManager = upstreamManager;
  }

  async refreshTools(): Promise<void> {
    this.tools.clear();

    for (const [upstreamName, upstreamConfig] of Object.entries(this.config.upstreams)) {
      const client = this.upstreamManager.getClient(upstreamName);
      if (!client || !client.isConnected()) {
        logger.warn(`Upstream ${upstreamName} is not connected, skipping`);
        continue;
      }

      try {
        const upstreamTools = await client.listTools();
        const filteredTools = this.filterTools(upstreamTools, upstreamConfig);
        const processedTools = this.processTools(filteredTools, upstreamName);

        for (const { tool, originalName } of processedTools) {
          this.tools.set(tool.name, { tool, upstreamName, originalName });
        }

        logger.info(
          `Registered ${processedTools.length}/${upstreamTools.length} tools from ${upstreamName}`
        );
      } catch (err) {
        logger.error(`Failed to list tools from ${upstreamName}:`, err);
      }
    }

    logger.info(`Total registered tools: ${this.tools.size}`);
  }

  private filterTools(tools: Tool[], config: UpstreamConfig): Tool[] {
    if (!config.allowedTools || config.allowedTools.length === 0) {
      return tools;
    }

    const allowedSet = new Set(config.allowedTools);
    return tools.filter((tool) => allowedSet.has(tool.name));
  }

  private processTools(
    tools: Tool[],
    upstreamName: string
  ): { tool: Tool; originalName: string }[] {
    return tools.map((tool) => {
      const originalName = tool.name;
      const namespacedName = `${upstreamName}${NAMESPACE_SEPARATOR}${tool.name}`;
      const description = this.compressDescription(tool.description);
      const compressedSchema = this.compressInputSchema(tool.inputSchema);

      return {
        tool: {
          name: namespacedName,
          description,
          inputSchema: compressedSchema,
        },
        originalName,
      };
    });
  }

  private compressDescription(originalDescription: string | undefined): string {
    if (!originalDescription) {
      return "";
    }

    // 説明を圧縮: 最初の文のみを使用し、最大100文字に制限
    const firstSentence = originalDescription.split(/[.!?。！？]/)[0];
    if (firstSentence.length <= 100) {
      return firstSentence;
    }
    return firstSentence.slice(0, 97) + "...";
  }

  private compressInputSchema(schema: Tool["inputSchema"]): Tool["inputSchema"] {
    if (!schema || typeof schema !== "object") {
      return schema;
    }

    const compressed: Tool["inputSchema"] = {
      type: "object",
    };

    // propertiesをコピーし、各プロパティの説明を削除
    if ("properties" in schema && schema.properties) {
      compressed.properties = {};
      for (const [key, value] of Object.entries(
        schema.properties as Record<string, Record<string, unknown>>
      )) {
        const { description, title, ...rest } = value;
        compressed.properties[key] = rest;
      }
    }

    // requiredをコピー
    if ("required" in schema && schema.required) {
      compressed.required = schema.required as string[];
    }

    return compressed;
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values()).map((rt) => rt.tool);
  }

  resolveToolName(namespacedName: string): { upstreamName: string; originalName: string } | null {
    const registered = this.tools.get(namespacedName);
    if (registered) {
      return {
        upstreamName: registered.upstreamName,
        originalName: registered.originalName,
      };
    }
    return null;
  }
}
