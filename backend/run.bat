@echo off
REM Server launcher (ASCII-only). From backend folder type: run
title ChajaDream Web Server

cd /d "%~dp0"
REM If "Address already in use", change 8765 to a free port (e.g. 9775).
set "PORT=8765"
if not exist "app.py" (
    echo ERROR: app.py not found in this folder.
    pause
    exit /b 1
)

where py >nul 2>&1
if %errorlevel%==0 goto USE_PY

where python >nul 2>&1
if %errorlevel%==0 goto USE_PYTHON

echo ERROR: Python not found. Install Python and add it to PATH.
pause
exit /b 1

:USE_PY
echo pip install...
py -3 -m pip install -r requirements.txt -q
echo Telegram bot poller (new window)...
start "ChajaDream-Telegram" cmd /k cd /d "%~dp0" ^&^& py -3 poll_telegram_bot.py
echo Opening browser in ~3s: http://127.0.0.1:%PORT%
echo To stop the server, press Ctrl+C here.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:%PORT%/"
py -3 app.py
goto END

:USE_PYTHON
echo pip install...
python -m pip install -r requirements.txt -q
echo Telegram bot poller (new window)...
start "ChajaDream-Telegram" cmd /k cd /d "%~dp0" ^&^& python poll_telegram_bot.py
echo Opening browser in ~3s: http://127.0.0.1:%PORT%
echo To stop the server, press Ctrl+C here.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:%PORT%/"
python app.py

:END
echo.
pause
