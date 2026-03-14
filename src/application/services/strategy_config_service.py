import json
import os
from typing import Dict, List, Any
from pydantic import BaseModel, Field
from src.infrastructure.logger import log
from src.application.services.engine_config_service import engine_config_service

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
                # SCS1 FIX: Merge parameter-a-parameter — adiciona novos parâmetros do default
                # sem sobrescrever os valores que o usuário já configurou no dashboard.
                # Antes: só fazia merge se parameters estava COMPLETAMENTE vazio.
                current_cfg = config.strategies[name]
                for param_key, param_default_val in default_cfg.parameters.items():
                    if param_key not in current_cfg.parameters:
                        current_cfg.parameters[param_key] = param_default_val
                        needs_save = True
                        log.info(f"StrategyConfig: Novo parâmetro '{param_key}' adicionado a '{name}' a partir do default.")
                
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

    async def walk_forward_optimize(self, min_trades: int = 20):
        """B1 — Walk-Forward Optimization: ajusta weight_multiplier baseado no Sharpe de cada estratégia.
        Parâmetros configurados em engine_config.json → walk_forward.
        """
        try:
            ecfg = engine_config_service.get().walk_forward
            if not ecfg.enabled:
                log.info("WalkForward: desabilitado pelo engine_config. Pulando.")
                return

            from src.infrastructure.event_store import event_store
            trades = await event_store.get_closed_trades(limit=500)
            if len(trades) < min_trades:
                log.info(f"WalkForward: poucos trades ({len(trades)} < {min_trades}). Pulando.")
                return

            needs_save = False
            for strategy_name, cfg in self.config.strategies.items():
                strat_trades = [t for t in trades if t.strategy_name == strategy_name]
                if len(strat_trades) < ecfg.min_trades_per_strategy:
                    continue

                profits = [t.profit for t in strat_trades]
                avg_p = sum(profits) / len(profits)
                std_p = (sum((p - avg_p) ** 2 for p in profits) / len(profits)) ** 0.5
                sharpe = (avg_p / std_p) if std_p > 0 else 0.0

                old_weight = cfg.weight_multiplier
                new_weight = old_weight

                if sharpe < ecfg.sharpe_low_threshold:
                    factor = 1.0 - (ecfg.weight_decrease_pct / 100.0)
                    new_weight = max(ecfg.weight_min, round(old_weight * factor, 2))
                    log.warning(f"WalkForward: [{strategy_name}] Sharpe={sharpe:.2f} < {ecfg.sharpe_low_threshold} → weight {old_weight} → {new_weight}")
                elif sharpe > ecfg.sharpe_high_threshold:
                    factor = 1.0 + (ecfg.weight_increase_pct / 100.0)
                    new_weight = min(ecfg.weight_max, round(old_weight * factor, 2))
                    log.info(f"WalkForward: [{strategy_name}] Sharpe={sharpe:.2f} > {ecfg.sharpe_high_threshold} → weight {old_weight} → {new_weight}")
                else:
                    log.debug(f"WalkForward: [{strategy_name}] Sharpe={sharpe:.2f} — peso mantido em {old_weight}")

                if new_weight != old_weight:
                    cfg.weight_multiplier = new_weight
                    needs_save = True

            if needs_save:
                self._save_config(self.config)
                log.info("WalkForward: strategy_config.json atualizado com novos pesos.")

        except Exception as e:
            log.error(f"WalkForward: Falha na otimização: {e}")


    def get_strategy_config(self, name: str) -> StrategyConfigItem:
        return self.config.strategies.get(name)

    def get_all(self) -> List[StrategyConfigItem]:
        return list(self.config.strategies.values())

strategy_config_service = StrategyConfigService()
