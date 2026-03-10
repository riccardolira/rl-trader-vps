import json
import os
from typing import Dict, List
from pydantic import BaseModel
from src.infrastructure.logger import log

class StrategyConfigItem(BaseModel):
    name: str
    enabled: bool
    weight_multiplier: float
    min_score_threshold: float

class StrategyConfig(BaseModel):
    strategies: Dict[str, StrategyConfigItem]

class StrategyConfigService:
    def __init__(self):
        self.config_path = "strategy_config.json"
        self.config = self._load_config()

    def _load_config(self) -> StrategyConfig:
        config = StrategyConfig(strategies={})
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    config = StrategyConfig(**data)
            except Exception as e:
                log.error(f"Failed to load strategy config: {e}")
                
        # Fill missing default profiles
        needs_save = False
        default_strategies = {
            "TrendFollowing": StrategyConfigItem(name="TrendFollowing", enabled=True, weight_multiplier=1.0, min_score_threshold=40.0),
            "MeanReversion": StrategyConfigItem(name="MeanReversion", enabled=True, weight_multiplier=1.0, min_score_threshold=40.0),
            "VolatilityBreakout": StrategyConfigItem(name="VolatilityBreakout", enabled=False, weight_multiplier=1.0, min_score_threshold=40.0),
            "SmartMoney": StrategyConfigItem(name="SmartMoney", enabled=True, weight_multiplier=1.0, min_score_threshold=40.0),
            "OrderFlowScalping": StrategyConfigItem(name="OrderFlowScalping", enabled=True, weight_multiplier=1.0, min_score_threshold=40.0)
        }
        
        for name, default_cfg in default_strategies.items():
            if name not in config.strategies:
                config.strategies[name] = default_cfg
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
