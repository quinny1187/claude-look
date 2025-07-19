import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function takeScreenshot(filepath: string): Promise<void> {
  try {
    // Ensure the captures directory exists
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });
    
    // Get the Python script path
    const scriptPath = path.join(path.dirname(__dirname), 'screenshot.py');
    
    // Run Python script to take screenshot
    const command = `python "${scriptPath}" "${filepath}"`;
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('Screenshot saved to:')) {
      throw new Error(stderr);
    }
    
    // Verify file was created
    await fs.access(filepath);
    
    console.log(stdout.trim());
  } catch (error) {
    throw new Error(`Screenshot failed: ${error}`);
  }
}