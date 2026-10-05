<#
Starts the backend using PostgreSQL connection details without writing credentials
to application.properties.

Usage (PowerShell): .\set-db-creds.ps1
#>

$dbHost = Read-Host 'PostgreSQL host [localhost]'
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = 'localhost' }

$dbPort = Read-Host 'PostgreSQL port [5432]'
if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = '5432' }

$dbName = Read-Host 'Database name [campus_tracking]'
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = 'campus_tracking' }

$dbUser = Read-Host 'Database username [campus_user]'
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = 'campus_user' }

$securePassword = Read-Host 'Database password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $env:DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

$env:DB_URL = "jdbc:postgresql://$($dbHost):$($dbPort)/$($dbName)"
$env:DB_USERNAME = $dbUser

Write-Host 'Starting Spring Boot with the supplied PostgreSQL settings...'
Push-Location $PSScriptRoot
& .\mvnw.cmd spring-boot:run
Pop-Location
