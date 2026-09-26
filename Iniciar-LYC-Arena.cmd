@echo off
setlocal
if not exist "%~dp0release\win-unpacked\LYC Arena.exe" (
  echo Execute npm run dist na pasta do projeto primeiro.
  pause
  exit /b 1
)
start "" "%~dp0release\win-unpacked\LYC Arena.exe" "--user-data-dir=%~dp0.cache\user-data"
