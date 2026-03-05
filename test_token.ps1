$token = '561ba333-cb84-4799-bc24-8461d722816e'

Write-Host "--- Testing as RAILWAY_TOKEN ---"
$env:RAILWAY_TOKEN = $token
$env:RAILWAY_API_TOKEN = $null
railway status
railway variables

Write-Host "`n--- Testing as RAILWAY_API_TOKEN ---"
$env:RAILWAY_TOKEN = $null
$env:RAILWAY_API_TOKEN = $token
railway status
railway variables
