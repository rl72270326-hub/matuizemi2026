param(
  [int]$Port = 8787
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $Root "server.log"
$State = @{
  sequence = 0
  phone = "idle"
  updatedAt = (Get-Date).ToString("s")
}

function Write-ServerLog([string]$Text) {
  $line = "$(Get-Date -Format s) $Text"
  Add-Content -LiteralPath $LogFile -Encoding UTF8 -Value $line
  try {
    Write-Host $Text
  } catch {
  }
}

function Get-ContentType($Path) {
  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  switch ($extension) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".webp" { "image/webp" }
    default { "application/octet-stream" }
  }
}

function Send-Response($Stream, [int]$StatusCode, [string]$ContentType, [byte[]]$Body) {
  $reason = switch ($StatusCode) {
    200 { "OK" }
    400 { "Bad Request" }
    404 { "Not Found" }
    500 { "Server Error" }
    default { "OK" }
  }
  $header = "HTTP/1.1 $StatusCode $reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
  $Stream.Flush()
}

function Send-Text($Stream, [int]$StatusCode, [string]$Text, [string]$ContentType = "text/plain; charset=utf-8") {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Send-Response $Stream $StatusCode $ContentType $bytes
}

function Get-SafeFilePath([string]$UrlPath) {
  $cleanPath = $UrlPath.Split("?")[0]
  if ($cleanPath -eq "/" -or $cleanPath -eq "") {
    $cleanPath = "/index.html"
  }
  if ($cleanPath -eq "/phone") {
    $cleanPath = "/phone.html"
  }
  $decoded = [System.Uri]::UnescapeDataString($cleanPath).TrimStart("/")
  $decoded = $decoded -replace "/", [System.IO.Path]::DirectorySeparatorChar
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $decoded))
  $rootPath = [System.IO.Path]::GetFullPath($Root)
  if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  return $fullPath
}

try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
  $listener.Start()
} catch {
  Write-ServerLog "Failed to start server: $($_.Exception.Message)"
  throw
}

$localIpAddress = ([System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName()).AddressList |
  Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and $_.ToString() -notlike "127.*" } |
  Select-Object -First 1)
$localIp = $null
if ($localIpAddress) {
  $localIp = $localIpAddress.ToString()
}

Write-ServerLog "PC:     http://localhost:$Port/"
if ($localIp) {
  Write-ServerLog "Phone:  http://$localIp`:$Port/phone"
}
Write-ServerLog "Stop:   Ctrl + C"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      $client.Close()
      continue
    }

    $parts = $requestLine.Split(" ")
    $method = $parts[0]
    $urlPath = $parts[1]
    $headers = @{}

    while ($true) {
      $line = $reader.ReadLine()
      if ([string]::IsNullOrEmpty($line)) { break }
      $index = $line.IndexOf(":")
      if ($index -gt 0) {
        $name = $line.Substring(0, $index).Trim().ToLowerInvariant()
        $value = $line.Substring($index + 1).Trim()
        $headers[$name] = $value
      }
    }

    if ($method -eq "GET" -and $urlPath.StartsWith("/api/state")) {
      $json = $State | ConvertTo-Json -Compress
      Send-Text $stream 200 $json "application/json; charset=utf-8"
      continue
    }

    if ($method -eq "POST" -and $urlPath.StartsWith("/api/event")) {
      $length = 0
      if ($headers.ContainsKey("content-length")) {
        [int]::TryParse($headers["content-length"], [ref]$length) | Out-Null
      }

      $body = ""
      if ($length -gt 0) {
        $buffer = New-Object char[] $length
        $read = $reader.ReadBlock($buffer, 0, $length)
        if ($read -gt 0) {
          $body = -join $buffer[0..($read - 1)]
        }
      }

      try {
        $payload = $body | ConvertFrom-Json
        $phone = [string]$payload.phone
      } catch {
        $phone = ""
      }

      if ($phone -notin @("down", "scroll", "back")) {
        Send-Text $stream 400 '{"error":"bad phone signal"}' "application/json; charset=utf-8"
        continue
      }

      $State.sequence = [int]$State.sequence + 1
      $State.phone = $phone
      $State.updatedAt = (Get-Date).ToString("s")
      $json = $State | ConvertTo-Json -Compress
      Send-Text $stream 200 $json "application/json; charset=utf-8"
      continue
    }

    if ($method -eq "GET") {
      $filePath = Get-SafeFilePath $urlPath
      if ($filePath -and (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        Send-Response $stream 200 (Get-ContentType $filePath) $bytes
      } else {
        Send-Text $stream 404 "Not Found"
      }
      continue
    }

    Send-Text $stream 404 "Not Found"
  } catch {
    try {
      Send-Text $stream 500 "Server Error"
    } catch {
    }
  } finally {
    $client.Close()
  }
}
