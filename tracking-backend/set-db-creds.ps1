<#
set-db-creds.ps1

Prompts for MySQL connection details and updates
src/main/resources/application.properties with the provided values.

Usage (PowerShell):
  .\set-db-creds.ps1

This script stores the password in plaintext in application.properties so Spring Boot can read it.
Do not commit the updated properties file to source control if it contains secrets.
#>

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $propPath = Join-Path $scriptDir 'src\main\resources\application.properties'

    if (-not (Test-Path $propPath)) {
        Write-Error "application.properties not found at $propPath"
        exit 1
    }

    # Backup
    Copy-Item -Path $propPath -Destination ($propPath + '.bak') -Force

    Write-Host "Enter MySQL connection details. Press Enter to accept defaults in [brackets]."
    $host = Read-Host "MySQL host" -Default 'localhost'
    $port = Read-Host "MySQL port" -Default '3306'
    $db   = Read-Host "Database name" -Default 'campus_tracking'
    $user = Read-Host "DB username" -Default 'campus_user'
    $securePwd = Read-Host "DB password (input is hidden)" -AsSecureString
    $pwdPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
    $pwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto($pwdPtr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pwdPtr)

    $url = "jdbc:mysql://$host:$port/$db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"

    $content = Get-Content -Path $propPath -Raw

    if ($content -match 'spring.datasource.url=') {
        $content = [Regex]::Replace($content, 'spring.datasource.url=.*', "spring.datasource.url=$url")
    } else { $content += "`n# MySQL datasource URL`nspring.datasource.url=$url`n" }

    if ($content -match 'spring.datasource.username=') {
        $content = [Regex]::Replace($content, 'spring.datasource.username=.*', "spring.datasource.username=$user")
    } else { $content += "spring.datasource.username=$user`n" }

    if ($content -match 'spring.datasource.password=') {
        $content = [Regex]::Replace($content, 'spring.datasource.password=.*', "spring.datasource.password=$pwd")
    } else { $content += "spring.datasource.password=$pwd`n" }

    Set-Content -Path $propPath -Value $content -Force

    Write-Host "Updated application.properties (backup at application.properties.bak)."
    Write-Host "Now run: .\mvnw spring-boot:run  (from project root)"
} catch {
    Write-Error "Error: $_"
    exit 1
}
