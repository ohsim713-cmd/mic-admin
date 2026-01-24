@echo off
echo Starting Claude Code Discord Bot (charged-tyson)...
cd /d "c:\Users\user\.gemini\antigravity\playground\charged-tyson"
REM Load Discord tokens from .env.discord file
for /f "delims=" %%x in (.env.discord) do set "%%x"

set HOME=C:\Users\user
set CLAUDE_CONFIG_DIR=C:\Users\user\.claude
"C:\Users\user\.deno\bin\deno.exe" run --allow-all claude-code-discord/index.ts --category charged-tyson
pause
