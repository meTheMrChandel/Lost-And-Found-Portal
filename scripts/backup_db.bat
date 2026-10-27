@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM IIT Ropar Lost & Found Portal — Windows Database Backup Script
REM ─────────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion
set BACKUP_DIR=.\backups\database
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

set BACKUP_FILE=%BACKUP_DIR%\lostandfound_backup_%TIMESTAMP%.sql
set CONTAINER_NAME=lostandfound_prod_db
set POSTGRES_USER=postgres
set POSTGRES_DB=lostandfound

echo ==> Starting database backup for '%POSTGRES_DB%'...
docker exec -t %CONTAINER_NAME% pg_dump -U %POSTGRES_USER% %POSTGRES_DB% > "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo ==> Database backup created successfully: %BACKUP_FILE%
) else (
    echo [ERROR] Backup failed with exit code %ERRORLEVEL%
)
endlocal
