import sys
import os
from PIL import ImageGrab

def take_screenshot(filepath):
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Take screenshot
        screenshot = ImageGrab.grab()
        
        # Save to file
        screenshot.save(filepath, 'PNG')
        
        print(f"Screenshot saved to: {filepath}")
        return True
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python screenshot.py <output_path>", file=sys.stderr)
        sys.exit(1)
    
    filepath = sys.argv[1]
    success = take_screenshot(filepath)
    sys.exit(0 if success else 1)