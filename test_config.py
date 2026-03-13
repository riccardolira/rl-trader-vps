import json
from src.application.services.strategy_config_service import strategy_config_service
print("Current config dict keys in memory:", strategy_config_service.config.strategies["TrendFollowing"].parameters)
