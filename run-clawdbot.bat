@echo off
chcp 65001 >nul
title ClawdBot - Claude Code Discord
cd /d "c:\Users\user\.gemini\antigravity\playground\charged-tyson"

REM Load Discord tokens from .env.discord file
REM Tokens removed from source control for security
echo [ClawdBot] Loading environment from .env.discord...
for /f "delims=" %%x in (.env.discord) do set "%%x"

set HOME=C:\Users\user
set USERPROFILE=C:\Users\user
set CLAUDE_CONFIG_DIR=C:\Users\user\.claude

echo [ClawdBot] Starting...
echo [ClawdBot] Working directory: %CD%
echo [ClawdBot] Category: charged-tyson
echo [ClawdBot] Gemini: Enabled
echo.

"C:\Users\user\.deno\bin\deno.exe" run --allow-all claude-code-discord/index.ts --category charged-tyson

echo.
echo [ClawdBot] Bot stopped.
pause
