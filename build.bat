@echo off
REM ============================================================
REM  BUILD SCRIPT — Voice Processing System (64-BIT)
REM  Requirements: NASM + MinGW-w64 (g++) both on PATH
REM ============================================================

echo [1/3] Assembling proces_Asm.asm with NASM (64-bit)...
nasm -f win64 proces_Asm.asm -o proces_Asm.obj
if errorlevel 1 (
    echo ERROR: NASM failed. Is NASM installed and on PATH?
    pause
    exit /b 1
)
echo       OK - proces_Asm.obj created

echo [2/3] Compiling main.cpp with g++ (64-bit)...
g++ -m64 -O2 -c main.cpp -o main.obj
if errorlevel 1 (
    echo ERROR: g++ compile failed.
    pause
    exit /b 1
)
echo       OK - main.obj created

echo [3/3] Linking into voice_processor.exe (64-bit)...
g++ -m64 main.obj proces_Asm.obj -o voice_processor.exe
if errorlevel 1 (
    echo ERROR: Linking failed.
    pause
    exit /b 1
)
echo       OK - voice_processor.exe created

echo.
echo ============================================================
echo  BUILD SUCCESSFUL (64-BIT)
echo  Test with:
echo    voice_processor.exe test.wav output.wav 1.5 5 0 500 0 0 0 0 0
echo ============================================================
pause