import json
import pandas as pd

# Load configurations
with open('universe_config.json', 'r') as f:
    universe_config = json.load(f)

with open('risk_config.json', 'r') as f:
    risk_config = json.load(f)

# --- Sheet 1: Criteria Editor (Scanner Settings) ---
classes_enabled = universe_config.get('classes_enabled', {})
schedules = universe_config.get('schedules', {})

criteria_data = []
for asset, enabled in classes_enabled.items():
    schedule = schedules.get(asset, {})
    criteria_data.append({
        'Asset_Class': asset,
        'Enabled': enabled,
        'Time_Mode': schedule.get('time_mode', ''),
        'Time_Start': schedule.get('time_start', ''),
        'Time_End': schedule.get('time_end', ''),
        'Timezone': schedule.get('timezone', ''),
        'Trading_Days': str(schedule.get('trading_days', []))
    })
df_criteria = pd.DataFrame(criteria_data)

# --- Sheet 2: Engine Tuning (Weights and Correlation) ---
weights = universe_config.get('weights', {})
tuning_data = []
for asset, w in weights.items():
    tuning_data.append({
        'Asset_Class': asset,
        'w_liquidity': w.get('w_liquidity', ''),
        'w_volatility': w.get('w_volatility', ''),
        'w_cost': w.get('w_cost', ''),
        'w_stability': w.get('w_stability', ''),
        'max_spread_atr_ratio': w.get('max_spread_atr_ratio', '')
    })
df_tuning = pd.DataFrame(tuning_data)

# Global Correlation Settings
global_tuning = pd.DataFrame([{
    'Param': 'scanner_enabled', 'Value': universe_config.get('scanner_enabled', '')
}, {
    'Param': 'selection_mode', 'Value': universe_config.get('selection_mode', '')
}, {
    'Param': 'min_active_set_size', 'Value': universe_config.get('min_active_set_size', '')
}, {
    'Param': 'max_active_set_size', 'Value': universe_config.get('max_active_set_size', '')
}, {
    'Param': 'rebuild_interval_sec', 'Value': universe_config.get('rebuild_interval_sec', '')
}, {
    'Param': 'correlation_enabled', 'Value': universe_config.get('correlation_enabled', '')
}, {
    'Param': 'max_correlation_threshold', 'Value': universe_config.get('max_correlation_threshold', '')
}, {
    'Param': 'correlation_periods', 'Value': universe_config.get('correlation_periods', '')
}])

# --- Sheet 3: Risk (Risk Settings) ---
profiles = risk_config.get('profiles', {})
risk_data = []
for asset, p in profiles.items():
    risk_data.append({
        'Asset_Class': asset,
        'Active': p.get('active', ''),
        'Spread_Max_Points': p.get('spread_max_points', ''),
        'Slippage_Buffer_Points': p.get('slippage_buffer_points', ''),
        'Max_Risk_Per_Trade_Pct': p.get('max_risk_per_trade_pct', '')
    })
df_risk = pd.DataFrame(risk_data)

# Global Risk Settings
global_risk = pd.DataFrame([{
    'Param': 'max_daily_drawdown_pct', 'Value': risk_config.get('max_daily_drawdown_pct', '')
}, {
    'Param': 'max_trades_per_day', 'Value': risk_config.get('max_trades_per_day', '')
}, {
    'Param': 'max_trades_open', 'Value': risk_config.get('max_trades_open', '')
}, {
    'Param': 'max_lot_size', 'Value': risk_config.get('max_lot_size', '')
}, {
    'Param': 'news_filter_active', 'Value': risk_config.get('news_filter_active', '')
}, {
    'Param': 'news_blackout_minutes_before', 'Value': risk_config.get('news_blackout_minutes_before', '')
}, {
    'Param': 'news_blackout_minutes_after', 'Value': risk_config.get('news_blackout_minutes_after', '')
}])

# Write to Excel
excel_path = r"c:\Users\ricca\Desktop\Planilha_Parametros_RL_Trader.xlsx"
with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
    df_criteria.to_excel(writer, sheet_name='Criteria Editor', index=False)
    
    # Put Global Setup and Weights side by side or one after another
    global_tuning.to_excel(writer, sheet_name='Engine Tuning (Global)', index=False)
    df_tuning.to_excel(writer, sheet_name='Engine Tuning (Weights)', index=False)
    
    global_risk.to_excel(writer, sheet_name='Risk (Global)', index=False)
    df_risk.to_excel(writer, sheet_name='Risk (Profiles)', index=False)

print(f"Spreadsheet generated successfully at {excel_path}")
