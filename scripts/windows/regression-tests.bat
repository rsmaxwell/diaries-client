@echo off
setlocal EnableExtensions
rem Diaries client regression: all Angular unit tests and build.
rem Run from CMD, or invoke using cmd.exe /c from Cygwin.

pushd "%~dp0..\.." || (
  echo FAIL: Cannot open diaries-client directory.
  exit /b 1
)

echo.
echo Diaries client regression checks
echo Working directory: %CD%
echo.

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo FAIL: npm.cmd was not found on PATH.
  popd
  exit /b 1
)
if not exist "node_modules\" (
  echo FAIL: node_modules missing. Run npm ci in diaries-client first.
  popd
  exit /b 1
)

echo === Angular unit tests - ChromeHeadless, single run ===
call npm.cmd test -- --watch=false --browsers=ChromeHeadless
if errorlevel 1 (
  echo.
  echo FAIL: Angular unit tests.
  popd
  exit /b 1
)
echo PASS: Angular unit tests

echo.
echo === Angular build ===
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo FAIL: Angular build.
  popd
  exit /b 1
)
echo PASS: Angular build

echo.
echo PASS: All Diaries client regression checks
popd
exit /b 0
