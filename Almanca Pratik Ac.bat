@echo off
title Almanca Pratik
cd /d "%~dp0"
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 goto open
start "Almanca Pratik sunucusu (kapatma)" /min python -m http.server 5173
timeout /t 2 /nobreak >nul
:open
start "" "http://localhost:5173/#/"
