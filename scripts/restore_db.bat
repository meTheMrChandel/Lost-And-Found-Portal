@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM IIT Ropar Lost & Found Portal — Windows Database Restore Script
REM ─────────────────────────────────────────────────────────────────────────────

if "%~1"=="" (
    echo Usage: scripts\restore_db.bat ^<path_to_backup_file.sql^>
    exit /b 1
)

set BACKUP_FILE=%~1
set CONTAINER_NAME=lostandfound_prod_db
set POSTGRES_USER=postgres
set POSTGRES_DB=lostandfound

if not exist "%BACKUP_FILE%" (
    echo Error: Backup file '%BACKUP_FILE%' not found!
    exit /b 1
)

echo ==> WARNING: This will overwrite data in database '%POSTGRES_DB%'.
set /p CONFIRM=Are you sure you want to proceed? (Y/N): 
if /i not "%CONFIRM%"=="Y" (
    echo Restore cancelled.
    exit /b 0
)

echo ==> Restoring database from %BACKUP_FILE%...
docker exec -i %CONTAINER_NAME% psql -U %POSTGRES_USER% -d %POSTGRES_DB% < "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo ==> Database restore completed successfully!
) else (
    echo [ERROR] Restore failed with exit code %ERRORLEVEL%
)
