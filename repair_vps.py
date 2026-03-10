import os
import json
import subprocess
from pathlib import Path

def repair():
    print("=== RL TRADER VPS REPAIR TOOL ===")
    
    # 1. Check Scanner
    univ_path = Path("universe_config.json")
    if univ_path.exists():
        with open(univ_path, "r") as f:
            univ = json.load(f)
        if not univ.get("scanner_enabled", False):
            print("[FIX] Enabling Scanner in universe_config.json...")
            univ["scanner_enabled"] = True
            with open(univ_path, "w") as f:
                json.dump(univ, f, indent=2)
        else:
            print("[OK] Scanner is already enabled.")
    
    # 2. Check .env for Defaults
    env_path = Path(".env")
    if env_path.exists():
        with open(env_path, "r") as f:
            content = f.read()
        if "MT5_LOGIN='12345'" in content or "MT5_LOGIN=0" in content:
            print("[WARNING] Your .env still has default MT5_LOGIN. Please edit it!")
        else:
            print("[OK] Credentials seem personalized.")

    # 3. DB Check
    print("[INFO] Database will now automatically fallback to SQLite if MySQL is down (New Feature).")

    print("\n[DONE] Repair finished. Please run update_vps.bat and then start_v3.bat.")

if __name__ == "__main__":
    repair()
