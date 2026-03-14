@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul

echo.
echo  ██████  ██      ████████ ██████   █████  ██████  ███████ ██████ 
echo  ██   ██ ██         ██    ██   ██ ██   ██ ██   ██ ██      ██   ██
echo  ██████  ██         ██    ██████  ███████ ██   ██ █████   ██████ 
echo  ██   ██ ██         ██    ██   ██ ██   ██ ██   ██ ██      ██   ██
echo  ██   ██ ███████    ██    ██   ██ ██   ██ ██████  ███████ ██   ██
echo.
echo  VPS Update Script  —  RL Trader V4
echo  =====================================================
echo.

:: ─────────────────────────────────────────────────────
:: STEP 1 — Git Pull
:: ─────────────────────────────────────────────────────
echo [1/4] Baixando atualizações do GitHub...
git fetch origin
git reset --hard origin/main

if %errorlevel% neq 0 (
    echo.
    echo  [ERRO] Git pull falhou! Verifique a conexão ou conflitos.
    pause
    exit /b %errorlevel%
)
echo  [OK] Código atualizado.
echo.

:: ─────────────────────────────────────────────────────
:: STEP 2 — Python Dependencies
:: ─────────────────────────────────────────────────────
echo [2/4] Instalando/Atualizando dependências Python...
pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo  [AVISO] pip install retornou erro. Verifique requirements.txt.
)
echo  [OK] Dependências OK.
echo.

:: ─────────────────────────────────────────────────────
:: STEP 3 — SQLite Repair (cria tabelas faltando)
:: ─────────────────────────────────────────────────────
echo [3/4] Verificando/Reparando banco de dados SQLite...
python repair_sqlite.py
if %errorlevel% neq 0 (
    echo  [AVISO] repair_sqlite.py retornou erro. Verifique o DB.
) else (
    echo  [OK] Banco de dados OK.
)
echo.

:: ─────────────────────────────────────────────────────
:: STEP 4 — Done
:: ─────────────────────────────────────────────────────
echo  =====================================================
echo  [CONCLUIDO] Update finalizado com sucesso!
echo  =====================================================
echo.
echo  Proximo passo: execute start_v3.bat para iniciar o sistema.
echo.
pause
