from fastapi import APIRouter
from typing import List, Optional
from pydantic import BaseModel

from src.infrastructure.logger import log
# In a real scenario, we would inject the AssetSelectionService or similar
# For now, we might need to mock or fetch from a global service if available
# We don't have a global AssetSelectionService instance easily accessible in this file structure 
# unless we import it from main or engine (circular imports).
# We will use valid mock data or try to access the engine state if possible.
# Ideally, services should be singletons or injected.

router = APIRouter(prefix="/api/universe", tags=["Universe"])

from datetime import datetime
from src.application.services.asset_selection_service import asset_selection_service
from src.infrastructure.news.news_worker import news_worker
from src.domain.universe import UniverseSnapshot, UniverseConfig, RankingRow, SelectionMode

class ModeUpdateParams(BaseModel):
    mode: str

class ManualBasketParams(BaseModel):
    symbols: List[str]

# Endpoints
# 1. Snapshot (Header)
@router.get("/snapshot", response_model=UniverseSnapshot)
async def get_snapshot():
    return asset_selection_service.get_snapshot()

# Diagnostics (Extended Snapshot with Health)
@router.get("/diagnostics")
async def get_diagnostics():
    from src.infra.mt5.mt5_worker_client import mt5_worker_client
    snap = asset_selection_service.get_snapshot().dict()
    
    # Enrich with MT5 status
    snap["mt5_connected"] = mt5_worker_client.is_healthy
    snap["mt5_latency_ms"] = mt5_worker_client.measure_latency()
    snap["last_mt5_error"] = "None" if mt5_worker_client.is_healthy else "Worker disconnected/restarting"
    
    # Determine source (simplified)
    if snap["universe"]["raw_count"] > 0 and mt5_worker_client.is_healthy:
        snap["universe_source"] = "mt5"
    elif snap["universe"]["raw_count"] > 0:
        snap["universe_source"] = "seed_file"
    else:
        snap["universe_source"] = "empty"
        
    return snap

# 2. Config (Load/Save)
@router.get("/config", response_model=UniverseConfig)
async def get_config():
    return asset_selection_service.get_config()

@router.post("/config/update")
async def update_config(updates: dict):
    asset_selection_service.update_config(updates)
    return {"status": "ok", "config": asset_selection_service.get_config()}

@router.post("/scanner/start")
async def start_scanner():
    asset_selection_service.update_config({"scanner_enabled": True})
    return {"status": "ok"}

@router.post("/scanner/stop")
async def stop_scanner():
    asset_selection_service.update_config({"scanner_enabled": False})
    return {"status": "ok"}

@router.post("/mode")
async def update_mode(params: ModeUpdateParams):
    try:
        m = SelectionMode(params.mode.upper())
        asset_selection_service.set_mode(m)
        return {"status": "ok", "mode": m}
    except ValueError:
        return {"status": "error", "message": "Invalid mode"}

@router.post("/manual/publish")
async def publish_manual_basket(params: ManualBasketParams):
    asset_selection_service.publish_manual_basket(params.symbols)
    return {"status": "ok"}

# 3. Ranking
@router.get("/ranking", response_model=List[RankingRow])
async def get_ranking():
    return asset_selection_service.get_ranking()

# 4. Filters (Classes & Blocklist)
# Helper endpoint to get generated view
@router.get("/generated-filters")
async def get_generated_filters():
    # Construct view for UI
    config = asset_selection_service.get_config()
    return {
        "classes_enabled": config.classes_enabled,
        "blocklist": config.blocklist
    }

@router.post("/class/toggle")
async def toggle_class(asset_class: str, enabled: bool):
    asset_selection_service.toggle_class(asset_class, enabled)
    return {"status": "ok"}

@router.post("/blocklist/add")
async def blocklist_add(symbol: str):
    asset_selection_service.add_to_blocklist(symbol)
    return {"status": "ok"}

@router.post("/blocklist/remove")
async def blocklist_remove(symbol: str):
    asset_selection_service.remove_from_blocklist(symbol)
    return {"status": "ok"}

# 5. Macroeconomic Events
@router.get("/news-threats")
async def get_news_threats():
    """Returns today's high-impact news and holidays from the active NewsWorker."""
    return {"status": "ok", "threats": news_worker.get_todays_threats()}

# 6. Anti-Cloner Correlation
@router.get("/correlation")
async def get_correlation():
    """Returns the live Pearson correlation matrix for the active/eligible set."""
    return await asset_selection_service.get_correlation_matrix()

