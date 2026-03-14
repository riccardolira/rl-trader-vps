import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.interface.routers import router as core_router
from src.api.routes_health import router as health_router
from src.api.routes_universe import router as universe_router
from src.api.routes_strategies import router as strategies_router
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.application.engine import Engine

# Initialize Engine
engine = Engine()

def create_app() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False, # Must be False if allow_origins is ["*"] for WS to work on some browsers
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include all routers
    app.include_router(core_router)
    app.include_router(health_router)
    app.include_router(universe_router)
    app.include_router(strategies_router)
    
    @app.on_event("startup")
    async def startup_event():
        log.info("FastAPI Starting up...")
        asyncio.create_task(engine.boot())

        # B1: Walk-Forward — roda 1x/dia para auto-calibrar pesos das estratégias
        async def _walk_forward_loop():
            await asyncio.sleep(300)  # espera 5 min após boot
            while True:
                try:
                    from src.application.services.strategy_config_service import strategy_config_service
                    await strategy_config_service.walk_forward_optimize()
                except Exception as wf_err:
                    log.warning(f"WalkForward agendado: {wf_err}")
                await asyncio.sleep(86400)  # 1x/dia
        asyncio.create_task(_walk_forward_loop())

        
    @app.on_event("shutdown")
    async def shutdown_event():
        log.info("FastAPI Shutting down...")
        await engine.shutdown()
        
    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.API_PORT, reload=False)
