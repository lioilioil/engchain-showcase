@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

rem ============================================================
rem  Engchain3.0 一键启动：本地回环静态服务器 + 自动打开演示页
rem  服务目录为 D:\ 根，同时暴露 /Engchain3.0/ 与
rem  /Engchain3.0-archive/onlyoffice-runtime/（ONLYOFFICE 引擎）
rem  端口自动在 8765~8780 中挑选空闲端口；Ctrl+C 停止服务
rem ============================================================

where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo [启动失败] 未检测到 Python。
    echo 请先安装 Python 3（安装时勾选 Add python to PATH），
    echo 安装完成后重新双击本脚本。
    echo.
    pause
    exit /b 1
)

python "%~dp0serve_demo.py"
if errorlevel 1 (
    echo.
    echo [启动失败] 服务未能启动，请查看上方错误提示（常见：端口被占用）。
    echo.
    pause
    exit /b 1
)

endlocal
