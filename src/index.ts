#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
  ImageContent,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { takeScreenshot } from './windows-screenshot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track screenshot numbering
let screenshotCounter = 0;

// Load the last used number from a file
async function loadScreenshotCounter(): Promise<void> {
  const counterFile = path.join(__dirname, '..', 'captures', '.counter');
  try {
    const data = await fs.readFile(counterFile, 'utf-8');
    screenshotCounter = parseInt(data, 10) || 0;
  } catch {
    // File doesn't exist, start at 0
    screenshotCounter = 0;
  }
}

// Save the current counter
async function saveScreenshotCounter(): Promise<void> {
  const counterFile = path.join(__dirname, '..', 'captures', '.counter');
  await fs.writeFile(counterFile, screenshotCounter.toString());
}

// Get next screenshot number (001-999)
function getNextScreenshotNumber(): string {
  screenshotCounter = (screenshotCounter % 999) + 1;
  return screenshotCounter.toString().padStart(3, '0');
}

// Create server instance
const server = new Server(
  {
    name: "claude-look",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "look_at_screen",
    description: "Capture a screenshot of the current desktop (saves to captures folder, returns path for analysis)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "look_at_image",
    description: "Get the path to view a specific image file or screenshot by number (does not send image data)",
    inputSchema: {
      type: "object",
      properties: {
        image_path: {
          type: "string",
          description: "Path to the image file to view, or a screenshot number (e.g., '521' or '#521')"
        }
      },
      required: ["image_path"]
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Clean up old captures (older than 1 hour)
async function cleanupOldCaptures(): Promise<void> {
  const capturesDir = path.join(__dirname, '..', 'captures');
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  try {
    const files = await fs.readdir(capturesDir);
    
    for (const file of files) {
      if (file.endsWith('.png')) {
        const filePath = path.join(capturesDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtimeMs < oneHourAgo) {
          await fs.unlink(filePath);
          console.error(`Deleted old capture: ${file}`);
        }
      }
    }
  } catch (error) {
    // Captures directory might not exist yet
    console.error('Cleanup error:', error);
  }
}


// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "look_at_screen": {
        // Clean up old captures first
        await cleanupOldCaptures();
        
        // Create captures directory if it doesn't exist
        const capturesDir = path.join(__dirname, '..', 'captures');
        await fs.mkdir(capturesDir, { recursive: true });
        
        // Load counter if not already loaded
        await loadScreenshotCounter();
        
        // Get next number and generate filename
        const screenshotNum = getNextScreenshotNumber();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${screenshotNum}_screenshot_${timestamp}.png`;
        const filepath = path.join(capturesDir, filename);
        
        // Take screenshot
        await takeScreenshot(filepath);
        
        // Save the counter for next time
        await saveScreenshotCounter();
        
        return {
          content: [
            {
              type: "text",
              text: `Screenshot #${screenshotNum} captured and saved to: ${filepath}\n\nTo view this screenshot, I can analyze: ${filepath}`
            } as TextContent,
          ],
        };
      }

      case "look_at_image": {
        let imagePath = args?.image_path as string;
        
        if (!imagePath) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "image_path is required"
          );
        }
        
        // Check if it's a screenshot number
        const screenshotMatch = imagePath.match(/^#?(\d{1,3})$/);
        if (screenshotMatch) {
          const num = screenshotMatch[1].padStart(3, '0');
          const capturesDir = path.join(__dirname, '..', 'captures');
          
          // Find the screenshot with this number
          try {
            const files = await fs.readdir(capturesDir);
            const matchingFile = files.find(f => f.startsWith(`${num}_`) && f.endsWith('.png'));
            
            if (!matchingFile) {
              throw new McpError(
                ErrorCode.InvalidParams,
                `Screenshot #${num} not found`
              );
            }
            
            imagePath = path.join(capturesDir, matchingFile);
          } catch (error) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Could not find screenshot #${num}`
            );
          }
        }
        
        // Check if file exists
        try {
          await fs.access(imagePath);
        } catch {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Image file not found: ${imagePath}`
          );
        }
        
        // Extract screenshot number if it's from captures
        const filename = path.basename(imagePath);
        const screenshotNumMatch = filename.match(/^(\d{3})_/);
        const displayName = screenshotNumMatch 
          ? `Screenshot #${screenshotNumMatch[1]}` 
          : `Image: ${filename}`;
        
        return {
          content: [
            {
              type: "text",
              text: `${displayName} is ready for viewing at: ${imagePath}\n\nI can now analyze this image by referencing: ${imagePath}`
            } as TextContent,
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error}`
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Look MCP server running");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});