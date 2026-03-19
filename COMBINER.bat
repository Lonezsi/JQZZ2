@echo off
powershell -Command "Get-ChildItem -Recurse -Include *.tsx,*.css,*.java | Get-Content | Set-Content combined.txt"
pause