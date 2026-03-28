@echo off
REM CMD breaks UTF-8 Korean lines. Keep this file ASCII-only.
title ChajaDream Web Server

cd /d "%~dp0backend"
REM If "Address already in use", change 8765 to a free port (e.g. 9775).
set "PORT=8765"
if not exist "app.py" (
    echo ERROR: backend\app.py not found.
    echo Put this BAT next to the backend folder and run again.
    pause
    exit /b 1
)

where py >nul 2>&1
if %errorlevel%==0 goto USE_PY

where python >nul 2>&1
if %errorlevel%==0 goto USE_PYTHON

echo ERROR: Python not found. Install Python and add it to PATH.
echo Try: py -3  or  python  in this window after install.
pause
exit /b 1

:USE_PY
echo pip install...
py -3 -m pip install -r requirements.txt -q
echo Telegram bot poller (opens new window if .env has TELEGRAM_BOT_TOKEN)...
start "ChajaDream-Telegram" cmd /k cd /d "%~dp0backend" ^&^& py -3 poll_telegram_bot.py
echo Opening browser in ~3s: http://127.0.0.1:%PORT%
echo To stop the server, press Ctrl+C here.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:%PORT%/"
py -3 app.py
goto END

:USE_PYTHON
echo pip install...
python -m pip install -r requirements.txt -q
echo Telegram bot poller (opens new window if .env has TELEGRAM_BOT_TOKEN)...
start "ChajaDream-Telegram" cmd /k cd /d "%~dp0backend" ^&^& python poll_telegram_bot.py
echo Opening browser in ~3s: http://127.0.0.1:%PORT%
echo To stop the server, press Ctrl+C here.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:%PORT%/"
python app.py

:END
echo.
pause
