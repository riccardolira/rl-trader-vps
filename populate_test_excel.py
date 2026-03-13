import pandas as pd
import os

def update_excel_with_test_profile():
    excel_file = r'C:\Users\ricca\Desktop\RL TRADER ENGENHARIA\V4_VPS\Planilha de Pesos\Planilha de pesos.xlsx'
    
    if not os.path.exists(excel_file):
        print(f"ERRO: Arquivo não encontrado: {excel_file}")
        return

    try:
        # Check if file is locked
        with open(excel_file, 'a'):
            pass
            
        print("Planilha acessivel. Atualizando abas...")

        # 1. Update Risco (Global)
        df_risco_global = pd.read_excel(excel_file, sheet_name="Risco (Global)")
        
        # Mapping setting names to their target test values
        global_updates = {
            "Hard Risk Cap (Max Lote Mínimo Perca)": 100.0,
            "Max Daily Drawdown (Conta)": 0.08,
            "Max Open Trades": 5,
            "Max Trades Por Ativo": 1,
            "Max Lot Size Global": 0.50,
            "Proteção de Spread Máximo (Pontos)": 500.0,
            "Circuit Breaker Diário Financeiro": -80.0
        }
        
        for key, val in global_updates.items():
            df_risco_global.loc[df_risco_global["Configuração de Risco"] == key, "Valor/Limite"] = val

        # 2. Update Configuração de Estratégias
        df_estrategias = pd.read_excel(excel_file, sheet_name="Configuração de Estratégias")
        
        # We will iterate through and set the "Exigência (Score)" to 55.0 for all
        for idx in df_estrategias.index:
            col_name = df_estrategias.loc[idx, "Estratégia / Parâmetro"] # This is the config name column
            if pd.isna(col_name): continue
            
            if str(col_name).strip() == "Exigência (Score)":
                df_estrategias.loc[idx, "Valor"] = 55.0

        # Optional: Add new risk parameters to strategies if they exist in the sheet
        # Assuming they might not be there yet, we don't force append them here unless we know the structure perfectly.
        # But we can update known parameters.
        # Let's just do Exigencia for now as requested.

        # 3. Save changes
        with pd.ExcelWriter(excel_file, engine="openpyxl", mode='a', if_sheet_exists='replace') as writer:
            df_risco_global.to_excel(writer, sheet_name="Risco (Global)", index=False)
            df_estrategias.to_excel(writer, sheet_name="Configuração de Estratégias", index=False)
            
        print("SUCESSO: Valores de Teste aplicados na Planilha de Pesos.")

    except PermissionError:
        print("ERRO DE PERMISSÃO: O arquivo Excel está ABERTO no seu computador. Feche-o completamente e rode este script novamente.")
    except Exception as e:
        print(f"ERRO INESPERADO: {e}")

if __name__ == "__main__":
    update_excel_with_test_profile()
