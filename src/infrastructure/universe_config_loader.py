import json
import os
from typing import Optional
from src.domain.universe import UniverseConfig
from src.infrastructure.logger import log
from src.infrastructure.config import settings

class UniverseConfigLoader:
    def __init__(self, file_path: str = "universe_config.json"):
        # If relative, put in BASE_DIR
        if not os.path.isabs(file_path):
            self.file_path = os.path.join(settings.BASE_DIR, file_path)
        else:
            self.file_path = file_path

    def load(self) -> UniverseConfig:
        if not os.path.exists(self.file_path):
            log.info("UniverseConfigLoader: No custom config found. Checking for default.")
            default_path = self.file_path.replace("universe_config.json", "universe_config.default.json")
            if os.path.exists(default_path):
                import shutil
                shutil.copy2(default_path, self.file_path)
                log.info(f"UniverseConfigLoader: Copied {default_path} to {self.file_path}.")
            else:
                log.info("UniverseConfigLoader: No default config found. Creating hardcoded default.")
                default_config = UniverseConfig()
                self.save(default_config)
                return default_config
        
        try:
            with open(self.file_path, "r") as f:
                content = f.read().strip()
                if not content:
                    log.warning("UniverseConfigLoader: Config file is empty. Returning default.")
                    return UniverseConfig()
                data = json.loads(content)
                
            cfg = UniverseConfig(**data)
            
            # --- Safely pad missing keys that might have been dropped by older UI saves ---
            from src.domain.universe import ClassWeights, ScheduleConfig
            
            # 1. Pad Classes Enabled
            expected_classes = ["FOREX", "METALS", "CRYPTO", "INDICES_NY", "INDICES_B3", "INDICES_EU", "STOCKS_US", "STOCKS_BR", "STOCKS_EU", "COMMODITIES_AGRI", "COMMODITIES_ENERGY"]
            for c in expected_classes:
                if c not in cfg.classes_enabled:
                    cfg.classes_enabled[c] = False  # Default to false if missing
                if c not in cfg.weights:
                    cfg.weights[c] = ClassWeights()
                    
            # 2. Pad Regional Schedules
            for s in expected_classes:
                if s not in cfg.schedules:
                    cfg.schedules[s] = ScheduleConfig()
                    
            return cfg
            
        except json.JSONDecodeError as e:
            log.warning(f"UniverseConfigLoader: Malformed JSON ({e}). Returning default.")
            return UniverseConfig()
        except Exception as e:
            log.error(f"UniverseConfigLoader: Failed to load config ({e}). Returning default.")
            return UniverseConfig()

    def save(self, config: UniverseConfig):
        try:
            if hasattr(config, "model_dump_json"):
                json_data = config.model_dump_json(indent=2)
            else:
                json_data = config.json(indent=2)
                
            with open(self.file_path, "w") as f:
                f.write(json_data)
        except Exception as e:
            log.error(f"UniverseConfigLoader: Failed to save config: {e}")

# Global internal instance (service can own it, but good to have factory)
# universe_loader = UniverseConfigLoader()
