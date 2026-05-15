# ---------------------------------------------------------------------------
# Zovu backend smoke-test script for Windows PowerShell.
#
# Usage:
#   .\test-api.ps1                          # runs every check in order
#   .\test-api.ps1 -Section pulse           # runs only the pulse-signals check
#   .\test-api.ps1 -BaseUrl http://...      # point at a different host
#   .\test-api.ps1 -Email me@x.co -Password pw
#
# Sections (case-insensitive):
#   all health login me complaint-verify pulse pulse-history matches
#   notifications mark-read services-create services-list credit-status
#   envelope ajo-admin-create ajo-list ajo-join ajo-contribute ajo-tx
#   squad-health
# ---------------------------------------------------------------------------

[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:4000",
    [string]$Email = "techinfoorg327@gmail.com",
    [string]$Password = "ZovuAdmin2026!",
    [string]$Section = "all",
    [string]$ComplaintId = "",
    [string]$AjoId = ""
)

$ErrorActionPreference = "Continue"
$Api = "$BaseUrl/api/v1"

# -- helpers ---------------------------------------------------------------

function Write-Section($name) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor DarkGray
    Write-Host "  $name" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor DarkGray
}

function Should-Run([string]$name) {
    return ($Section -eq "all" -or $Section.ToLower() -eq $name.ToLower())
}

function Get-AuthHeaders() {
    if (-not $script:Token) {
        throw "No access token. Login section did not run. Use -Section all or include login."
    }
    return @{ Authorization = "Bearer $script:Token" }
}

function Format-Json($raw) {
    # Pretty-print a JSON string. If it doesn't parse, return as-is.
    try {
        return ($raw | ConvertFrom-Json | ConvertTo-Json -Depth 20)
    } catch {
        return $raw
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        $Body = $null,
        [switch]$Anonymous
    )
    $url = "$Api$Path"
    $headers = if ($Anonymous) { @{} } else { Get-AuthHeaders }
    $params = @{
        Method          = $Method
        Uri             = $url
        Headers         = $headers
        UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }

    $resp = $null
    $status = $null
    $rawBody = $null

    try {
        $r = Invoke-WebRequest @params
        $status = [int]$r.StatusCode
        $rawBody = $r.Content
    } catch {
        # PS 5.1 path: response body lives on the WebException.
        if ($_.Exception.Response) {
            try { $status = [int]$_.Exception.Response.StatusCode } catch {}
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    if ($stream.CanSeek) { $stream.Position = 0 }
                    $reader = New-Object System.IO.StreamReader($stream)
                    $rawBody = $reader.ReadToEnd()
                    $reader.Close()
                }
            } catch {}
        }
        # PS 6+ path: body may already be pre-extracted here.
        if (-not $rawBody -and $_.ErrorDetails -and $_.ErrorDetails.Message) {
            $rawBody = $_.ErrorDetails.Message
        }
        if (-not $rawBody) {
            $rawBody = $_.Exception.Message
        }
    }

    # Print to host (not pipeline) so callers can pipe to Out-Null safely.
    $colour = if ($status -ge 200 -and $status -lt 300) { "Green" } else { "Yellow" }
    Write-Host "HTTP $status" -ForegroundColor $colour
    if ($rawBody) {
        Write-Host (Format-Json $rawBody) -ForegroundColor $colour
    }

    # Return parsed object for callers (ajo-admin-create captures the id).
    if ($rawBody) {
        try { $resp = $rawBody | ConvertFrom-Json } catch { $resp = $null }
    }
    return $resp
}

# -- 1. health -------------------------------------------------------------

if (Should-Run "health") {
    Write-Section "1. Health check"
    try {
        Invoke-RestMethod -Method Get -Uri "$BaseUrl/health" | ConvertTo-Json
    } catch {
        Write-Host "Backend is not reachable at $BaseUrl" -ForegroundColor Red
        exit 1
    }
}

# -- 2. login --------------------------------------------------------------

$needsAuth = ($Section -ne "health")
if ($needsAuth) {
    Write-Section "2. Login as $Email"
    try {
        $login = Invoke-RestMethod `
            -Method Post `
            -Uri "$Api/auth/login" `
            -ContentType "application/json" `
            -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
        $script:Token = $login.data.access_token
        $preview = $script:Token.Substring(0, [Math]::Min(40, $script:Token.Length))
        Write-Host "Got access token: $preview..." -ForegroundColor Green
        Write-Host "User role: $($login.data.user.role)" -ForegroundColor Green
    } catch {
        Write-Host "Login failed. Check ADMIN_EMAIL/ADMIN_PASSWORD." -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
}

# -- 3. /auth/me sanity ----------------------------------------------------

if (Should-Run "me") {
    Write-Section "3. /auth/me"
    Invoke-Api -Method Get -Path "/auth/me" | Out-Null
}

# -- 3b. Squad health (admin-only, confirms live Squad keys) ---------------

if (Should-Run "squad-health") {
    Write-Section "3b. Squad live integration health"
    Invoke-Api -Method Get -Path "/admin/squad/health" | Out-Null
}

# -- 4. Squad complaint verification ---------------------------------------

if (Should-Run "complaint-verify") {
    Write-Section "4. Squad complaint verification"
    if (-not $ComplaintId) {
        Write-Host "Skipped. Pass -ComplaintId <uuid> to test this endpoint." -ForegroundColor Yellow
    } else {
        Invoke-Api -Method Post -Path "/admin/complaints/$ComplaintId/verify-squad" | Out-Null
    }
}

# -- 5. Pulse signals (real DB-driven) -------------------------------------

if (Should-Run "pulse") {
    Write-Section "5. Pulse signals (live from DB)"
    Invoke-Api -Method Get -Path "/credit/pulse-signals" | Out-Null
}

if (Should-Run "pulse-history") {
    Write-Section "5b. Pulse history"
    Invoke-Api -Method Get -Path "/credit/pulse-history" | Out-Null
}

# -- 6. Job-seeker matches (uses new 6-signal synergy) ---------------------

if (Should-Run "matches") {
    Write-Section "6. Job-seeker matches (improved synergy algorithm)"
    Invoke-Api -Method Get -Path "/job-seekers/matches" | Out-Null
}

# -- 7. Notifications + mark-read ------------------------------------------

if (Should-Run "notifications") {
    Write-Section "7a. Job-seeker notifications"
    Invoke-Api -Method Get -Path "/job-seekers/notifications" | Out-Null
}

if (Should-Run "mark-read") {
    Write-Section "7b. Mark notifications read"
    Invoke-Api -Method Post -Path "/job-seekers/mark-notifications-read" -Body @{} | Out-Null
}

# -- 8. Lender services ----------------------------------------------------

if (Should-Run "services-create") {
    Write-Section "8a. Create lender service offering"
    Invoke-Api -Method Post -Path "/lenders/services/offer" -Body @{
        name             = "30-day micro loan"
        type             = "loan"
        description      = "Short-term emergency credit for verified traders"
        min_pulse_score  = 400
        max_amount       = 5000000
        interest_rate    = 0.15
        repayment_days   = 30
    } | Out-Null
}

if (Should-Run "services-list") {
    Write-Section "8b. List my lender services"
    Invoke-Api -Method Get -Path "/lenders/services" | Out-Null
}

# -- 9. Credit status ------------------------------------------------------

if (Should-Run "credit-status") {
    Write-Section "9. Credit status"
    Invoke-Api -Method Get -Path "/credit/status" | Out-Null
}

# -- 10. Error envelope (force a 404) --------------------------------------

if (Should-Run "envelope") {
    Write-Section "10. Standard error envelope (expecting AJO_NOT_FOUND)"
    Invoke-Api -Method Get -Path "/ajo/does-not-exist" | Out-Null
}

# -- 11. Ajo admin create --------------------------------------------------

if (Should-Run "ajo-admin-create") {
    Write-Section "11. Admin: create Ajo group"
    $endDate = (Get-Date).AddMonths(6).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $created = Invoke-Api -Method Post -Path "/admin/ajo/groups" -Body @{
        name             = "Test Savers June"
        description      = "Smoke-test group from .ps1"
        minimum_deposit  = 500000
        end_date         = $endDate
        max_members      = 50
    }
    if ($created -and $created.data -and $created.data.id) {
        $script:AjoIdAuto = $created.data.id
        Write-Host "Created ajo id: $($script:AjoIdAuto)" -ForegroundColor Green
    }
}

# -- 12. Ajo list (user-facing) --------------------------------------------

if (Should-Run "ajo-list") {
    Write-Section "12. List Ajo groups (user view)"
    Invoke-Api -Method Get -Path "/ajo/groups" | Out-Null
}

# -- 13. Join + contribute -------------------------------------------------

$ajoTarget = if ($AjoId) { $AjoId } elseif ($script:AjoIdAuto) { $script:AjoIdAuto } else { $null }

if (Should-Run "ajo-join") {
    Write-Section "13a. Join Ajo group"
    if (-not $ajoTarget) {
        Write-Host "Skipped. No AjoId. Run ajo-admin-create first or pass -AjoId." -ForegroundColor Yellow
    } else {
        Invoke-Api -Method Post -Path "/ajo/$ajoTarget/join" -Body @{} | Out-Null
    }
}

if (Should-Run "ajo-contribute") {
    Write-Section "13b. Contribute to Ajo group"
    if (-not $ajoTarget) {
        Write-Host "Skipped. No AjoId." -ForegroundColor Yellow
    } else {
        Invoke-Api -Method Post -Path "/ajo/$ajoTarget/contribute" -Body @{ amount = 1000000 } | Out-Null
    }
}

if (Should-Run "ajo-tx") {
    Write-Section "13c. My Ajo transactions"
    Invoke-Api -Method Get -Path "/ajo/transactions" | Out-Null
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
