"""
Engine Config Service — Gerencia engine_config.json
Centraliza todos os parâmetros que antes estavam hardcoded no código:
- MTF bonus/penalty
- Ensemble bonus/penalty
- Tie-break delta
- Strategy scan interval
- Kelly Criterion params
- Walk-Forward thresholds
"""
import json
import os
from pydantic import BaseModel, Field
from src.infrastructure.logger import log


class MTFConfig(BaseModel):
    """Multi-Timeframe Confluency bonuses/penalties."""
    contra_penalty: float = -15.0    # Penalidade quando sinal vai contra o MTF diário
    aligned_bonus: float = 10.0      # Bônus quando sinal está alinhado com o MTF diário


class EnsembleConfig(BaseModel):
    """Ensemble multi-strategy score adjustments."""
    strong_bonus: float = 10.0       # Bônus quando ≥ min_agree_count estratégias concordam
    weak_penalty: float = -10.0      # Penalidade quando apenas 1 estratégia de 3+ concorda
    min_voting: int = 3              # Mínimo de candidatos para ativar o consenso
    min_agree_count: int = 3         # Mínimo concordando para "consenso forte"


class TieBreakConfig(BaseModel):
    """Tie-break between strategy winners."""
    delta_threshold: float = 5.0     # Diferença de score (pts) para considerar empate


class ScanConfig(BaseModel):
    """Strategy Engine scan settings."""
    interval_sec: float = 60           # Intervalo entre ciclos de análise (segundos)
    symbol_delay_sec: float = 0.5    # Delay entre análise de cada símbolo (throttle MT5)


class KellyConfig(BaseModel):
    """Kelly Criterion dynamic volume calculation."""
    enabled: bool = True             # Ativa/desativa Kelly (desativado = usa volume base)
    half_kelly_fraction: float = 0.5 # Fração do Kelly completo (0.5 = Half-Kelly conservador)
    max_kelly_pct: float = 5.0       # Cap máximo de risco Kelly por trade (% do equity)
    min_trades_to_activate: int = 20 # Mínimo de trades históricos para ativar
    cache_ttl_sec: int = 300         # TTL do cache de cálculo (segundos)


class WalkForwardConfig(BaseModel):
    """Walk-Forward Optimization automatic weight adjustment."""
    enabled: bool = True             # Ativa o ajuste automático de pesos
    sharpe_high_threshold: float = 1.0  # Sharpe > este valor → aumenta peso +10%
    sharpe_low_threshold: float = 0.0   # Sharpe < este valor → reduz peso -20%
    weight_min: float = 0.5          # Peso mínimo (floor)
    weight_max: float = 2.0          # Peso máximo (cap)
    weight_increase_pct: float = 10.0   # % de aumento quando Sharpe alto
    weight_decrease_pct: float = 20.0   # % de redução quando Sharpe baixo
    min_trades_per_strategy: int = 10   # Mínimo por estratégia para ajustar


class EngineConfig(BaseModel):
    mtf: MTFConfig = Field(default_factory=MTFConfig)
    ensemble: EnsembleConfig = Field(default_factory=EnsembleConfig)
    tie_break: TieBreakConfig = Field(default_factory=TieBreakConfig)
    scan: ScanConfig = Field(default_factory=ScanConfig)
    kelly: KellyConfig = Field(default_factory=KellyConfig)
    walk_forward: WalkForwardConfig = Field(default_factory=WalkForwardConfig)


class EngineConfigService:
    CONFIG_PATH = "engine_config.json"

    def __init__(self):
        self.config = self._load()

    def _load(self) -> EngineConfig:
        if os.path.exists(self.CONFIG_PATH):
            try:
                with open(self.CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                config = EngineConfig(**data)
                log.info(f"EngineConfigService: Carregado {self.CONFIG_PATH}")
                return config
            except Exception as e:
                log.error(f"EngineConfigService: Falha ao carregar config: {e} — usando defaults")
        else:
            log.info("EngineConfigService: engine_config.json não encontrado — criando com defaults")
        config = EngineConfig()
        self._save(config)
        return config

    def _save(self, config: EngineConfig):
        try:
            json_data = config.model_dump_json(indent=2) if hasattr(config, "model_dump_json") else config.json(indent=2)
            with open(self.CONFIG_PATH, "w", encoding="utf-8") as f:
                f.write(json_data)
            log.info(f"EngineConfigService: Salvo em {self.CONFIG_PATH}")
        except Exception as e:
            log.error(f"EngineConfigService: Falha ao salvar: {e}")

    def update(self, updates: dict) -> EngineConfig:
        """Merge recursivo dos campos recebidos no config atual."""
        current = self.config.model_dump()
        deep_merge(current, updates)
        self.config = EngineConfig(**current)
        self._save(self.config)
        return self.config

    def get(self) -> EngineConfig:
        return self.config


def deep_merge(base: dict, override: dict) -> dict:
    """Merge recursivo: override atualiza base sem apagar subkeys não enviadas."""
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            base[key] = value
    return base


# Singleton global
engine_config_service = EngineConfigService()
