from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from src.application.services.strategy_config_service import strategy_config_service, StrategyConfigItem

router = APIRouter(prefix="/api/engine/strategies", tags=["Strategies Engine"])

class StrategyUpdateRequest(BaseModel):
    enabled: bool = None
    weight_multiplier: float = None
    min_score_threshold: float = None
    parameters: dict = None

@router.get("/config", response_model=List[StrategyConfigItem])
async def get_strategies_config():
    """Returns the current dynamic configuration for all strategies."""
    return strategy_config_service.get_all()

@router.put("/config/{strategy_name}")
async def update_strategy_config(strategy_name: str, payload: StrategyUpdateRequest):
    """Updates the dynamic configuration of a specific strategy."""
    updates = payload.model_dump(exclude_unset=True)
    success = strategy_config_service.update_strategy(strategy_name, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return {"status": "success", "strategy": strategy_name, "updates": updates}
