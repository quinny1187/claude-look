# Claude Look

MCP server that provides visual capabilities to Claude Code through screenshot capture and image viewing.

## Features

- **look_at_screen**: Capture a screenshot of the current desktop
- **look_at_image**: View a specific image file by path or screenshot number
- Screenshots numbered from 001-999 (cycles back to 001)
- Automatic cleanup of screenshots older than 1 hour
- Saves screenshots to a `captures` folder with format: `XXX_screenshot_timestamp.png`

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your Claude Code configuration:

```json
{
  "mcpServers": {
    "claude-look": {
      "type": "stdio",
      "command": "cmd",
      "args": [
        "/c",
        "node C:/repos/claude-look/dist/index.js"
      ],
      "env": {}
    }
  }
}
```

## Usage

### Capture Screenshot
```
Use the look_at_screen tool to capture the current desktop
```

### View Specific Image
```
Use the look_at_image tool with:
- Full path: "C:/path/to/image.png"
- Screenshot number: "521" or "#521"
```

### Screenshot Numbering
- Each screenshot gets a unique number from 001 to 999
- Numbers cycle back to 001 after 999
- Reference screenshots by their number for easy access
- Example: "Look at screenshot 521" → uses `look_at_image` with "521"

## How It Works

1. Screenshots are saved as `XXX_screenshot_timestamp.png` (e.g., `001_screenshot_2025-07-19T12-34-56.png`)
2. Each screenshot shows its number in the response (e.g., "Screenshot #001 captured")
3. Old captures (>1 hour) are automatically deleted before each new capture
4. Images are analyzed via file path reference (NOT base64 encoding to preserve context window)
5. Counter persists between sessions via `.counter` file

## Architecture

- TypeScript MCP server following claude-speak patterns
- Uses Python script with Pillow (PIL) for screenshot capture
- Returns file path for Claude to analyze using Read tool
- Automatic file management to prevent disk space issues

## Dependencies

### Node.js
- `@modelcontextprotocol/sdk`: MCP server implementation

### Python
- `Pillow`: Screenshot capture functionality

Install Python dependencies:
```bash
pip install -r requirements.txt
```