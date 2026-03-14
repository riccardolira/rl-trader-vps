@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul

echo.
echo  RL Trader V4 — Iniciando Sistema...
echo  =====================================================
echo.

:: ─────────────────────────────────────────────────────
:: STEP 1 — Backend (FastAPI)
:: Inicia primeiro: WebSocket, API e motor de trading
:: ─────────────────────────────────────────────────────
echo [1/3] Iniciando Backend (FastAPI porta 8001)...
start "RL Trader — Backend" cmd /k "cd /d %~dp0 && python -m src.main || (echo ERRO NO BACKEND - pressione tecla para ver log && pause)"

echo  Aguardando backend inicializar (8 segundos)...
timeout /t 8 /nobreak > nul
echo  [OK] Backend iniciado.
echo.

:: ─────────────────────────────────────────────────────
:: STEP 2 — Frontend (Vite Dev ou servir dist)
:: Serve o frontend React em localhost:5173
:: ─────────────────────────────────────────────────────
echo [2/3] Verificando modo do frontend...

:: Se houver pasta dist, serve estático; caso contrário, dev mode
if exist "%~dp0frontend\dist\index.php" (
    echo  Modo: Produção (servindo /dist via Caddy — frontend ja builded)
    echo  [OK] Frontend será servido pelo Caddy.
) else (
    echo  Modo: Desenvolvimento (npm run dev)
    start "RL Trader — Frontend Dev" cmd /k "cd /d %~dp0\frontend && npm run dev || pause"
    echo  Aguardando frontend dev server (5 segundos)...
    timeout /t 5 /nobreak > nul
    echo  [OK] Frontend Dev iniciado em http://localhost:5173
)
echo.

:: ─────────────────────────────────────────────────────
:: STEP 3 — Caddy (Sempre por último!)
:: Proxy reverso: :80 -> backend :8001 + frontend :5173
:: IMPORTANTE: Caddy DEVE ser o último a subir.
::             Se subir antes do backend, ele não consegue
::             resolver o upstream e falha silenciosamente.
:: ─────────────────────────────────────────────────────
echo [3/3] Iniciando Caddy (proxy reverso — ULTIMO a subir)...
echo  Aguardando mais 3 segundos para garantir upstreams prontos...
timeout /t 3 /nobreak > nul

:: Tenta parar instância anterior do Caddy (se houver)
taskkill /F /IM caddy.exe > nul 2>&1

:: Verifica se Caddy existe no PATH ou na pasta local
where caddy > nul 2>&1
if %errorlevel% equ 0 (
    start "RL Trader — Caddy" cmd /k "cd /d %~dp0 && caddy run --config Caddyfile || (echo ERRO NO CADDY && pause)"
    echo  [OK] Caddy iniciado.
) else if exist "%~dp0caddy.exe" (
    start "RL Trader — Caddy" cmd /k "cd /d %~dp0 && caddy.exe run --config Caddyfile || (echo ERRO NO CADDY && pause)"
    echo  [OK] Caddy iniciado (local).
) else (
    echo  [AVISO] caddy.exe nao encontrado no PATH nem na pasta.
    echo  O frontend so estara disponivel em http://localhost:5173
)
echo.

:: ─────────────────────────────────────────────────────
:: RESUMO
:: ─────────────────────────────────────────────────────
echo  =====================================================
echo  SISTEMA INICIADO
echo  =====================================================
echo.
echo  Backend API  : http://localhost:8001
echo  Frontend Dev : http://localhost:5173  (se modo dev)
echo  Dashboard    : https://clickandoffers.com  (via Caddy)
echo  WebSocket    : ws://localhost:8001/ws
echo.
echo  Para parar: feche as janelas do Backend, Frontend e Caddy.
echo  Para atualizar: rode update_vps.bat
echo.
pause
