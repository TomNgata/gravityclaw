$env:RAILWAY_API_TOKEN = '561ba333-cb84-4799-bc24-8461d722816e'
Write-Host "Initializing Railway project 'gravity-claw'..."
railway init --name gravity-claw
Write-Host "Railway project initialized."

Write-Host "Setting environment variables..."
railway variables set "TELEGRAM_BOT_TOKEN="
railway variables set "ANTHROPIC_API_KEY="
railway variables set "ALLOWED_USER_IDS="
Write-Host "Variables set (empty templates ready for population via Railway UI)."
