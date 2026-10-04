$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$studioUrl = 'http://127.0.0.1:4178/'
$running = $false
try {
    $response = Invoke-WebRequest -Uri $studioUrl -UseBasicParsing -TimeoutSec 2
    $running = $response.StatusCode -eq 200 -and $response.Content.Contains('建筑建模工作台')
} catch {}
if (-not $running) {
    if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'dist\index.html'))) {
        throw '缺少 dist 构建文件，请先在项目目录运行 npm run build。'
    }
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $serverPath = Join-Path $PSScriptRoot 'serve.mjs'
    Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $studioRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $health = Invoke-RestMethod -Uri ($studioUrl + '__floor_studio_health') -TimeoutSec 1
            if ($health.app -eq 'floor-studio') { $running = $true; break }
        } catch {}
    }
}
if (-not $running) { throw '本地服务启动失败。请检查 4178 端口是否被其他程序占用。' }
Start-Process $studioUrl
