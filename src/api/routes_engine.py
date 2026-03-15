"""
Engine Config API Routes — GET/POST /api/engine/config
Expõe o engine_config.json para edição via dashboard.
"""
from fastapi import APIRouter
from src.application.services.engine_config_service import engine_config_service
from src.infrastructure.logger import log

router = APIRouter(prefix="/api/engine", tags=["Engine"])


@router.get("/config")
async def get_engine_config():
    """Retorna a configuração atual do motor (engine_config.json)."""
    return engine_config_service.get().model_dump()


@router.post("/config")
async def update_engine_config(updates: dict):
    """Atualiza parcialmente o engine_config.json com deep-merge.
    Exemplo de payload: {"mtf": {"contra_penalty": -10.0}, "scan": {"interval_sec": 90}}
    Só os campos enviados são alterados — o resto permanece inalterado.
    """
    try:
        updated = engine_config_service.update(updates)
        log.info(f"EngineConfig atualizado via API: {list(updates.keys())}")
        return {"status": "ok", "config": updated.model_dump()}
    except Exception as e:
        log.error(f"EngineConfig: Erro ao atualizar: {e}")
        return {"status": "error", "message": str(e)}
