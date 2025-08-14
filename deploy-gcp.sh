# Build and deploy
gcloud builds submit --tag gcr.io/chatbot-441815/chatbot-server

# Deploy to Cloud Run with environment variables
gcloud run deploy chatbot-server \
  --image gcr.io/chatbot-441815/chatbot-server \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 1000 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars PORT=8080 \
  --set-env-vars LM_BASE_URL=https://6a7d04fe49a2.ngrok-free.app/v1 \
  --set-env-vars LM_MODEL=qwen2.5-7b-instruct-1m \
  --set-env-vars LM_TEMPERATURE=0.8
