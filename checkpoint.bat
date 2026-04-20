@echo off
REM WP Template Editor - Checkpoint Script
REM Guarda estado actual del proyecto

echo Creando checkpoint...

set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

set CHECKPOINT_DIR=checkpoints\%TIMESTAMP%

mkdir %CHECKPOINT_DIR% 2>nul

REM Copiar archivos críticos
xcopy /s /i /y assets\js\*.js %CHECKPOINT_DIR%\assets\js\ >nul 2>&1
xcopy /s /i /y api\*.php %CHECKPOINT_DIR%\api\ >nul 2>&1
xcopy /s /i /y includes\*.php %CHECKPOINT_DIR%\includes\ >nul 2>&1
xcopy /s /i /y assets\css\*.css %CHECKPOINT_DIR%\assets\css\ >nul 2>&1

REM Guardar metadata
echo Checkpoint: %TIMESTAMP% > %CHECKPOINT_DIR%\checkpoint.txt
echo Versión: v3.3 >> %CHECKPOINT_DIR%\checkpoint.txt
echo Estado: Funcional >> %CHECKPOINT_DIR%\checkpoint.txt

echo Checkpoint creado en: %CHECKPOINT_DIR%
pause
