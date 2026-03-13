import pandas as pd
import os

filepath = 'C:/Users/ricca/Desktop/RL TRADER ENGENHARIA/V4_VPS/Planilha de Pesos/Planilha de pesos.xlsx'

# 1. Configuração de Estratégias
estrategias = {
    "TrendFollowing": {
        "Habilitação": "ON",
        "Exigência (Score)": 65.0,
        "Peso (Multiplicador)": 1.0,
        "max_atr_distance_tops": 2.0,
        "pullback_precision_atr": 0.5,
        "stop_atr_mult": 2.5,
        "take_atr_mult": 4.0,
        "max_spread_ratio": 0.15,
        "spread_penalty_score": 15.0
    },
    "MeanReversion": {
        "Habilitação": "ON",
        "Exigência (Score)": 50.0,
        "Peso (Multiplicador)": 1.0,
        "rsi_bottom_percentile": 10.0,
        "rsi_top_percentile": 90.0,
        "max_squeeze_allowed": 40.0,
        "stop_atr_mult": 2.0,
        "take_atr_mult": 2.5,
        "max_spread_ratio": 0.15,
        "spread_penalty_score": 15.0
    },
    "VolatilityBreakout": {
        "Habilitação": "ON",
        "Exigência (Score)": 60.0,
        "Peso (Multiplicador)": 1.0,
        "squeeze_compression_pct": 30.0,
        "min_volume_ratio": 1.25,
        "stop_atr_mult": 2.0,
        "take_atr_mult": 4.0,
        "max_spread_ratio": 0.15,
        "spread_penalty_score": 15.0
    },
    "SmartMoney": {
        "Habilitação": "ON",
        "Exigência (Score)": 65.0,
        "Peso (Multiplicador)": 1.0,
        "min_rejection_wick_pct": 0.40,
        "stop_atr_mult": 1.5,
        "take_atr_mult": 3.0,
        "max_spread_ratio": 0.15,
        "spread_penalty_score": 20.0
    },
    "OrderFlowScalping": {
        "Habilitação": "ON",
        "Exigência (Score)": 55.0,
        "Peso (Multiplicador)": 1.0,
        "min_volume_spike_ratio": 1.50,
        "winner_close_pct": 0.70,
        "stop_atr_mult": 1.0,
        "take_atr_mult": 2.0,
        "max_spread_ratio": 0.10,
        "spread_penalty_score": 20.0
    }
}
df_est = []
for k, v in estrategias.items():
    df_est.append([k, ""])
    for pk, pv in v.items():
        df_est.append([pk, pv])
    df_est.append(["", ""])
df_estrategias = pd.DataFrame(df_est, columns=["Estratégia / Parâmetro", "Valor"])

# 2. Critérios do Scanner (Ativos)
# Weights and Max Spread ratio per asset class
scanner_ativos_data = [
    ["FOREX", 0.40, 0.30, 0.20, 0.10, 0.20],
    ["METALS", 0.35, 0.35, 0.15, 0.15, 0.25],
    ["CRYPTO", 0.45, 0.35, 0.10, 0.10, 0.30],
    ["INDICES_NY", 0.50, 0.20, 0.15, 0.15, 0.15],
    ["INDICES_EU", 0.50, 0.20, 0.15, 0.15, 0.15],
    ["INDICES_B3", 0.30, 0.40, 0.20, 0.10, 0.25],
    ["COMMODITIES_AGRI", 0.30, 0.30, 0.20, 0.20, 0.35],
    ["COMMODITIES_ENERGY", 0.35, 0.35, 0.15, 0.15, 0.30],
    ["STOCKS_US", 0.30, 0.30, 0.20, 0.20, 0.10],
    ["STOCKS_BR", 0.30, 0.30, 0.20, 0.20, 0.15],
    ["STOCKS_EU", 0.30, 0.30, 0.20, 0.20, 0.10]
]
df_scanner_ativos = pd.DataFrame(scanner_ativos_data, columns=[
    "Asset_Class", "w_liquidity", "w_volatility", "w_cost", "w_stability", "max_spread_atr_ratio"
])

# 3. Risco (Global)
# Para uma banca de $1000
risco_global_data = [
    ["Limits Fixos", ""],
    ["Hard Risk Cap (Max Lote Mínimo Perca)", 50.0],  # $50 max risk absolute fallback
    ["Max Daily Drawdown (Conta)", 0.05], # 5% ao dia = $50 stop diário
    ["", ""],
    ["Exposure Limits", ""],
    ["Max Open Trades Simultâneas", 5],
    ["Max Trades Por Ativo", 1],
    ["Max Lot Size Global", 0.10], # Max de 0.10 lotes pra conta de $1000! (0.01 lot = $1 p/ pip no eurusd, 0.10 = $10. Stop de 20 pips = $200 de risco. Bastante.)
    ["", ""],
    ["Travas Globais de Segurança", ""],
    ["Proteção de Spread Máximo (Pontos)", 500],
    ["Circuit Breaker Diário Financeiro", -50.0]
]
df_risco_global = pd.DataFrame(risco_global_data, columns=["Configuração de Risco", "Valor/Limite"])

# 4. Risco (Ativos)
# Risco específico por tipo. Conta $1000 = risco ideal 1-2% por trade ($10 - $20).
risco_ativos_data = [
    ["FOREX", 100, 60.0, 0.01], # 1% = $10
    ["CRYPTO", 5000, 60.0, 0.01],
    ["INDICES_NY", 400, 60.0, 0.01],
    ["INDICES_B3", 20, 60.0, 0.01],
    ["INDICES_EU", 400, 60.0, 0.01],
    ["METALS", 500, 60.0, 0.01],
    ["COMMODITIES_AGRI", 5000, 60.0, 0.01],
    ["COMMODITIES_ENERGY", 5000, 60.0, 0.01],
    ["STOCKS_US", 25, 60.0, 0.01],
    ["STOCKS_BR", 20, 60.0, 0.01],
    ["STOCKS_EU", 25, 60.0, 0.01]
]
df_risco_ativos = pd.DataFrame(risco_ativos_data, columns=[
    "Asset_Class", "Spread_Max_Points", "Min Rank Score", "Max_Risk_Per_Trade_Pct (0.01 = 1%)"
])

# 5. Critérios do Scanner (Global)
scanner_global_data = [
    ["Rebalance Interval (Sec)", 3600],
    ["Anti-Colisão Correlation Enabled", "ON"],
    ["Correlation Max Threshold", 0.85],
    ["Min Score For Database", 20.0],
    ["Max Active Auto Assets", 5]
]
df_scanner_global = pd.DataFrame(scanner_global_data, columns=["Configuração", "Valor"])

# 6. HORÁRIOS
horarios_data = [
    ["FOREX", "AUTO", "00:00", "23:59", "UTC", "0,1,2,3,4"],
    ["CRYPTO", "AUTO", "00:00", "23:59", "UTC", "0,1,2,3,4,5,6"],
    ["INDICES_NY", "AUTO", "13:30", "20:00", "UTC", "0,1,2,3,4"],
    ["INDICES_B3", "AUTO", "12:00", "21:00", "UTC", "0,1,2,3,4"],
    ["INDICES_EU", "AUTO", "07:00", "15:30", "UTC", "0,1,2,3,4"],
    ["METALS", "AUTO", "00:00", "23:00", "UTC", "0,1,2,3,4"]
]
df_horarios = pd.DataFrame(horarios_data, columns=[
    "Asset_Class", "TimeMode", "Time_Start", "Time_End", "Timezone", "Trading_Days"
])

# Saving to Excel
with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
    df_estrategias.to_excel(writer, sheet_name="Configuração de Estratégias", index=False)
    df_risco_global.to_excel(writer, sheet_name="Risco (Global)", index=False)
    df_risco_ativos.to_excel(writer, sheet_name="Risco (Ativos)", index=False)
    df_scanner_global.to_excel(writer, sheet_name="Critérios do Scanner (Global)", index=False)
    df_scanner_ativos.to_excel(writer, sheet_name="Critérios do Scanner (Ativos)", index=False)
    df_horarios.to_excel(writer, sheet_name="HORÁRIOS", index=False)

print("Planilha atualizada com sucesso.")
