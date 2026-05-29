@echo off
title Bot WhatsApp — Grupo Elis Formaio

echo.
echo  ================================================
echo   Bot WhatsApp — Gerenciador de Tarefas
echo  ================================================
echo.

:: Inicia o bot em segundo plano
start "Bot WhatsApp" cmd /k "cd /d %~dp0 && node server.js"

:: Aguarda o bot subir
timeout /t 3 /nobreak > nul

:: Inicia o tunel Cloudflare
echo  Iniciando tunel Cloudflare...
echo  Aguarde a URL aparecer abaixo e cole em:
echo  Admin ^> Configuracoes ^> URL do Bot WhatsApp
echo.
cloudflared.exe tunnel --url http://localhost:3000
