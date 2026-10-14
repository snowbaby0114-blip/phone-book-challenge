@echo off
REM Packages your work for submission. Double-click friendly.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on your PATH.
  echo Node 18 or newer is a prerequisite of this project - install it and run this again.
  pause
  exit /b 1
)
node "%~dp0delivery.mjs" %*
REM Capture before pause: pause would otherwise overwrite the exit code with 0.
set "EXITCODE=%ERRORLEVEL%"
pause
exit /b %EXITCODE%
