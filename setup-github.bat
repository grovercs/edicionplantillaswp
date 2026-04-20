@echo off
REM Script para configurar GitHub con token desde .env
REM Uso: setup-github.bat TU_TOKEN_DE_GITHUB

echo Configurando GitHub para WP Template Editor...

if "%~1"=="" (
    echo ERROR: Debes proporcionar tu token de GitHub
    echo Uso: setup-github.bat ghp_TU_TOKEN_AQUI
    pause
    exit /b 1
)

set TOKEN=%~1

REM Guardar token en .env
echo GITHUB_TOKEN=%TOKEN% > .env
echo PROJECT_NAME=wp-template-editor >> .env
echo PROJECT_VERSION=v3.3 >> .env

echo Token guardado en .env
echo.

REM Configurar git remote con el token
REM Nota: Esto es temporal, luego podemos usar credential helper mejor
git remote add origin https://%TOKEN%@github.com/grovercs/wp-template-editor.git 2>nul
if errorlevel 1 (
    git remote set-url origin https://%TOKEN%@github.com/grovercs/wp-template-editor.git
)

echo Remote configurado.
echo.
echo IMPORTANTE: Este archivo (.env) contiene tu token.
echo Esta carpeta esta en .gitignore para NO subirlo a GitHub.
echo.
pause
