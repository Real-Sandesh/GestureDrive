@echo off
cd /d "%~dp0"
echo ===============================================
echo   GestureDrive - Python 3.14 Installer
echo ===============================================
py -3.14 -m pip install --upgrade pip
if errorlevel 1 goto fail
py -3.14 -m pip install -r requirements.txt
if errorlevel 1 goto fail
echo.
echo Installation complete.
echo Run run.bat to start GestureDrive.
pause
exit /b 0
:fail
echo.
echo Installation failed. Check the error above.
pause
exit /b 1
