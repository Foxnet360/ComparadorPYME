# CSA Comparator Deployment Script
$PROJECT_ID = "gen-lang-client-0445908247"
$REGION = "us-east1"
$SERVICE_NAME = "comparador-csa"
$GEMINI_API_KEY = "AIzaSyApBxRhU67ybfBaRP6bTEkre0R6VDGMtKA"
$GCLOUD_PATH = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

Write-Host "Deploying $SERVICE_NAME to Google Cloud Run ($REGION)..." -ForegroundColor Cyan

# Ensure gcloud is configured for the project
& $GCLOUD_PATH config set project $PROJECT_ID

& $GCLOUD_PATH run deploy $SERVICE_NAME `
  --source . `
  --project $PROJECT_ID `
  --region $REGION `
  --allow-unauthenticated `
  --set-env-vars="NODE_ENV=production,GEMINI_API_KEY=$GEMINI_API_KEY"

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nDeployment successful!" -ForegroundColor Green
  Write-Host "You can access your service using the URL provided above." -ForegroundColor White
}
else {
  Write-Host "`nDeployment failed. Check the error messages above." -ForegroundColor Red
}
