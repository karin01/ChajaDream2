@echo off
REM Open backend\.env in Notepad so you can paste TELEGRAM_BOT_TOKEN from BotFather.
cd /d "%~dp0backend"
if not exist ".env" (
    echo Copying .env.example to .env ...
    copy /y ".env.example" ".env"
)
notepad ".env"
echo.
echo After saving .env, run 서버실행.bat again.
pause
