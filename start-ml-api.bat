@echo off
REM Activate the Python virtual environment and start the Flask ML model API
cd /d "%~dp0ml-model"
call ..\.venv\Scripts\activate.bat
python app.py
