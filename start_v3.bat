@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul

echo.
echo  RL Trader V4 — Reiniciando Sistema...
echo  =====================================================
echo.

:: ─────────────────────────────────────────────────────
:: STEP 1 — Fechar tudo que estiver aberto
:: ─────────────────────────────────────────────────────
echo [1/3] Encerrando processos anteriores...

:: Fecha janelas cmd abertas pelo start_v3 (por titulo)
taskkill /FI "WINDOWTITLE eq RL Trader*" /F > nul 2>&1

:: Mata processos pelo executavel
taskkill /F /IM python.exe   > nul 2>&1
taskkill /F /IM caddy.exe    > nul 2>&1

echo  [OK] Processos anteriores encerrados.
echo  Aguardando liberacao de portas (3 segundos)...
timeout /t 3 /nobreak > nul
echo.

:: ─────────────────────────────────────────────────────
:: STEP 2 — Backend (FastAPI :8001)
:: ─────────────────────────────────────────────────────
echo [2/3] Iniciando Backend (FastAPI porta 8001)...
start "RL Trader — Backend" cmd /k "cd /d %~dp0 && python -m src.main || (echo. && echo [ERRO] Backend falhou - veja o log acima && pause)"

echo  Aguardando backend inicializar (10 segundos)...
timeout /t 10 /nobreak > nul
echo  [OK] Backend no ar.
echo.

:: ─────────────────────────────────────────────────────
:: STEP 3 — Caddy (SEMPRE POR ÚLTIMO)
:: O frontend e servido pelo Hostinger (via GitHub Actions)
:: Caddy faz proxy reverso apenas para o backend local
:: ─────────────────────────────────────────────────────
echo [3/3] Iniciando Caddy (proxy reverso — SEMPRE O ULTIMO)...

where caddy > nul 2>&1
if %errorlevel% equ 0 (
    start "RL Trader — Caddy" cmd /k "cd /d %~dp0 && caddy run --config Caddyfile || (echo. && echo [ERRO] Caddy falhou && pause)"
    echo  [OK] Caddy no ar.
) else if exist "%~dp0caddy.exe" (
    start "RL Trader — Caddy" cmd /k "cd /d %~dp0 && caddy.exe run --config Caddyfile || (echo. && echo [ERRO] Caddy falhou && pause)"
    echo  [OK] Caddy no ar (local).
) else (
    echo  [AVISO] caddy.exe nao encontrado!
    echo  Verifique se o Caddy esta instalado no PATH do servidor.
)
echo.

:: ─────────────────────────────────────────────────────
:: RESUMO
:: ─────────────────────────────────────────────────────
echo  =====================================================
echo  SISTEMA NO AR
echo  =====================================================
echo.
echo  Backend API  : http://localhost:8001
echo  Dashboard    : https://clickandoffers.com  (Hostinger)
echo  WebSocket    : ws://localhost:8001/ws
echo.
echo  Frontend: servido pelo Hostinger (nao roda aqui)
echo  Para atualizar o front: push no GitHub Actions
echo.
echo  Para parar: rode este script de novo (mata tudo antes)
echo  Para atualizar: rode update_vps.bat
echo.
pause
