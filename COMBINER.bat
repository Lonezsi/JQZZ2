@echo off
powershell -NoProfile -Command ^
"$files = Get-ChildItem -Recurse -Include *.tsx,*.css,*.java; ^
$out = 'combined.txt'; ^
Remove-Item $out -ErrorAction SilentlyContinue; ^
foreach ($file in $files) { ^
    Add-Content $out ('===================='); ^
    Add-Content $out $file.FullName; ^
    Add-Content $out ('===================='); ^
    $content = Get-Content $file.FullName -Raw; ^
    if ([string]::IsNullOrWhiteSpace($content)) { ^
        Add-Content $out 'EMPTY!!!'; ^
    } else { ^
        Add-Content $out $content; ^
    } ^
    Add-Content $out ''; ^
}"
pause