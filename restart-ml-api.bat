@echo off
REM Restart ML API using the correct virtual environment
cd /d "%~dp0ml-model"
..\.venv\Scripts\python.exe app.py
