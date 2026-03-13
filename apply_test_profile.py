import json
import pandas as pd
import os
import shutil

# --- 1. Update risk_config.json ---
risk_file = 'C:/Users/ricca/Desktop/RL TRADER ENGENHARIA/V4_VPS/risk_config.json'
with open(risk_file, 'r', encoding='utf-8') as f:
    risk_config = json.load(f)

# Balanced Test Profile
risk_config["hard_risk_cap_money"] = 100.0
risk_config["max_trades_open"] = 5
risk_config["max_daily_dd_pct"] = 0.08
risk_config["max_lot_size"] = 0.50

for profile_name in risk_config["profiles"]:
    prof = risk_config["profiles"][profile_name]
    prof["max_risk_per_trade_pct"] = 0.02 
    if profile_name in ["FOREX", "INDICES_NY", "CRYPTO", "STOCKS_US", "COMMODITIES_ENERGY"]:
        prof["active"] = True
    else:
        prof["active"] = False

with open(risk_file, 'w', encoding='utf-8') as f:
    json.dump(risk_config, f, indent=2)

# --- 2. Update universe_config.json ---
universe_file = 'C:/Users/ricca/Desktop/RL TRADER ENGENHARIA/V4_VPS/universe_config.json'
with open(universe_file, 'r', encoding='utf-8') as f:
    universe_config = json.load(f)

universe_config["scanner_enabled"] = True
universe_config["max_active_set_size"] = 8

for cls_name in universe_config["classes_enabled"]:
    if cls_name in ["FOREX", "INDICES_NY", "CRYPTO", "STOCKS_US", "COMMODITIES_ENERGY"]:
        universe_config["classes_enabled"][cls_name] = True
    else:
        universe_config["classes_enabled"][cls_name] = False

with open(universe_file, 'w', encoding='utf-8') as f:
    json.dump(universe_config, f, indent=2)

# --- 3. Update strategy_config.default.json ---
strategy_file = 'C:/Users/ricca/Desktop/RL TRADER ENGENHARIA/V4_VPS/strategy_config.default.json'
with open(strategy_file, 'r', encoding='utf-8') as f:
    strategy_config = json.load(f)

strategy_config["strategies"]["TrendFollowing"]["min_score_threshold"] = 55.0
strategy_config["strategies"]["SmartMoney"]["min_score_threshold"] = 55.0

with open(strategy_file, 'w', encoding='utf-8') as f:
    json.dump(strategy_config, f, indent=2)

print("SUCESSO: JSONs atualizados.")

# --- 4. Sync Excel Spreadsheet ---
try:
    excel_file = 'C:/Users/ricca/Desktop/RL TRADER ENGENHARIA/V4_VPS/Planilha de Pesos/Planilha de pesos.xlsx'
    
    # Check if we can write to it by trying to open in append mode temporarily
    with open(excel_file, 'a'):
        pass
        
    df_risco_global = pd.read_excel(excel_file, sheet_name="Risco (Global)")
    df_risco_global.loc[df_risco_global["Configuração de Risco"] == "Hard Risk Cap (Max Lote Mínimo Perca)", "Valor/Limite"] = 100.0
    df_risco_global.loc[df_risco_global["Configuração de Risco"] == "Max Daily Drawdown (Conta)", "Valor/Limite"] = 0.08
    df_risco_global.loc[df_risco_global["Configuração de Risco"] == "Max Lot Size Global", "Valor/Limite"] = 0.50
    df_risco_global.loc[df_risco_global["Configuração de Risco"] == "Circuit Breaker Diário Financeiro", "Valor/Limite"] = -80.0

    df_risco_ativos = pd.read_excel(excel_file, sheet_name="Risco (Ativos)")
    df_risco_ativos["Max_Risk_Per_Trade_Pct (0.01 = 1%)"] = 0.02

    with pd.ExcelWriter(excel_file, engine="openpyxl", mode='a', if_sheet_exists='replace') as writer:
        df_risco_global.to_excel(writer, sheet_name="Risco (Global)", index=False)
        df_risco_ativos.to_excel(writer, sheet_name="Risco (Ativos)", index=False)
    print("SUCESSO: Excel atualizado.")
except PermissionError:
    print("ERRO: A planilha Excel está aberta. Feche a planilha e rode o comando novamente.")
except Exception as e:
    print(f"ERRO: Não foi possivel atualizar o excel - {str(e)}")
