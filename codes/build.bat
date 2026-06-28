@echo off
REM ============================================================
REM  BUILD SCRIPT — Voice Processing System
REM  Requirements: NASM + MinGW (g++) both on PATH
REM ============================================================
REM
REM  Install NASM : https://www.nasm.us/pub/nasm/releasebuilds/
REM  Install MinGW: https://www.mingw-w64.org/  (use i686 — 32-bit)
REM
REM  After installing MinGW, make sure you pick:
REM    Architecture: i686   (NOT x86_64 — we need 32-bit for NASM win32)
REM ============================================================

echo [1/3] Assembling process_asm.asm with NASM...
nasm -f win32 process_asm.asm -o process_asm.obj
if errorlevel 1 (
    echo ERROR: NASM failed. Is NASM installed and on PATH?
    pause
    exit /b 1
)
echo       OK — process_asm.obj created

echo [2/3] Compiling main.cpp with g++ (32-bit)...
g++ -m32 -O2 -c main.cpp -o main.obj
if errorlevel 1 (
    echo ERROR: g++ compile failed.
    pause
    exit /b 1
)
echo       OK — main.obj created

echo [3/3] Linking into voice_processor.exe...
g++ -m32 main.obj process_asm.obj -o voice_processor.exe
if errorlevel 1 (
    echo ERROR: Linking failed.
    pause
    exit /b 1
)
echo       OK — voice_processor.exe created

echo.
echo ============================================================
echo  BUILD SUCCESSFUL
echo  Test with:
echo    voice_processor.exe input.wav output.wav 1.5 5
echo ============================================================
pause