import json
import os
from typing import Dict, List, Any
from pydantic import BaseModel, Field
from src.infrastructure.logger import log

class StrategyConfigItem(BaseModel):
    name: str
    enabled: bool
    weight_multiplier: float
    min_score_threshold: float
    parameters: Dict[str, Any] = Field(default_factory=dict)

class ControlHeader(BaseModel):
    auto_tuning_enabled: bool = False
    last_tuned_by: str = "human"
    tuning_frequency_hours: int = 24
    max_drift_pct: float = 20.0

class StrategyConfig(BaseModel):
    ai_control_header: ControlHeader = Field(default_factory=ControlHeader, alias="_ai_control_header")
    strategies: Dict[str, StrategyConfigItem]

class StrategyConfigService:
    def __init__(self):
        self.config_path = "strategy_config.json"
        self.config = self._load_config()

    def _load_config(self) -> StrategyConfig:
        config = StrategyConfig(strategies={})
        
        # Check if custom config exists, if not, copy default
        if not os.path.exists(self.config_path):
            log.info("StrategyConfigService: No custom config found. Checking for default.")
            default_path = self.config_path.replace("strategy_config.json", "strategy_config.default.json")
            if os.path.exists(default_path):
                import shutil
                shutil.copy2(default_path, self.config_path)
                log.info(f"StrategyConfigService: Copied {default_path} to {self.config_path}.")

        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    config = StrategyConfig(**data)
            except Exception as e:
                log.error(f"Failed to load strategy config: {e}")
                
        # Fill missing parameters from default config
        needs_save = False
        default_path = self.config_path.replace("strategy_config.json", "strategy_config.default.json")
        default_config = StrategyConfig(strategies={})
        if os.path.exists(default_path):
            try:
                with open(default_path, "r", encoding="utf-8") as f:
                    default_data = json.load(f)
                    default_config = StrategyConfig(**default_data)
            except Exception as e:
                pass

        for name, default_cfg in default_config.strategies.items():
            if name not in config.strategies:
                config.strategies[name] = default_cfg
                needs_save = True
            else:
                # Merge missing parameters into the user's existing strategy config
                current_cfg = config.strategies[name]
                if not current_cfg.parameters and default_cfg.parameters:
                    current_cfg.parameters = default_cfg.parameters
                    needs_save = True
                
        if needs_save:
            self._save_config(config)

        return config

    def _save_config(self, config: StrategyConfig):
        try:
            json_data = config.model_dump_json(indent=2) if hasattr(config, "model_dump_json") else config.json(indent=2)
            with open(self.config_path, "w", encoding="utf-8") as f:
                f.write(json_data)
        except Exception as e:
            log.error(f"Failed to save strategy config: {e}")

    def update_strategy(self, name: str, updates: dict):
        if name in self.config.strategies:
            current_cfg = self.config.strategies[name].dict()
            current_cfg.update(updates)
            self.config.strategies[name] = StrategyConfigItem(**current_cfg)
            self._save_config(self.config)
            log.info(f"StrategyConfig: Updated {name} -> {updates}")
            return True
        return False

    def get_strategy_config(self, name: str) -> StrategyConfigItem:
        return self.config.strategies.get(name)

    def get_all(self) -> List[StrategyConfigItem]:
        return list(self.config.strategies.values())

strategy_config_service = StrategyConfigService()
