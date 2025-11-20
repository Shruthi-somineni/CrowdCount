# Test CrowdCount Auth Server Endpoints

Write-Host "Testing CrowdCount Auth Server Endpoints" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$BASE_URL = "http://127.0.0.1:3000"

# Test 1: Health Check
Write-Host "1. Testing /api/health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/health" -Method GET -ErrorAction Stop
    Write-Host "✅ Health check passed" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Login with correct credentials
Write-Host "2. Testing /api/login with valid credentials..." -ForegroundColor Yellow
try {
    $body = @{
        username = "testuser"
        password = "password123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BASE_URL/api/login" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "   Access Token: $($response.accessToken.Substring(0, 20))..." -ForegroundColor Green
    Write-Host "   Expires In: $($response.expiresIn)" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Signup (new user)
Write-Host "3. Testing /api/signup endpoint..." -ForegroundColor Yellow
try {
    $randomId = Get-Random -Minimum 1000 -Maximum 9999
    $body = @{
        username = "testuser$randomId"
        email = "testuser$randomId@example.com"
        password = "password123"
        name = "Test User $randomId"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BASE_URL/api/signup" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "✅ Signup successful" -ForegroundColor Green
    Write-Host "   New user created: testuser$randomId" -ForegroundColor Green
} catch {
    Write-Host "❌ Signup failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
