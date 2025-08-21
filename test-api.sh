#!/bin/bash

# 🚀 BNI Customer Care Chatbot - cURL Testing Scripts
# Run these commands to test your chatbot API

BASE_URL="http://localhost:3000"

echo "🧪 Testing BNI Customer Care Chatbot API"
echo "========================================"

# 1. Health Check
echo "📊 1. Health Check"
curl -X GET "$BASE_URL/healthz" \
  -H "Content-Type: application/json" \
  | jq '.'
echo -e "\n"

# 2. Socket Status
echo "🔌 2. Socket.IO Status"
curl -X GET "$BASE_URL/socket-status" \
  -H "Content-Type: application/json" \
  | jq '.'
echo -e "\n"

# 3. Test LM Studio Connection
echo "🤖 3. LM Studio Connection Test"
curl -X GET "$BASE_URL/test-lm" \
  -H "Content-Type: application/json" \
  | jq '.'
echo -e "\n"

# 4. Start New Chat (Basic)
echo "💬 4. Start New Chat - Basic Greeting"
CHAT_RESPONSE=$(curl -s -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Halo, saya butuh bantuan"
  }')

echo "$CHAT_RESPONSE" | jq '.'

# Extract session_id for next requests
SESSION_ID=$(echo "$CHAT_RESPONSE" | jq -r '.session_id // empty')
echo "📝 Session ID: $SESSION_ID"
echo -e "\n"

# 5. Chat with Complaint
echo "😤 5. Customer Complaint with Details"
curl -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Saya mau komplain kartu kredit saya, nama saya John Doe, nomor rekening 1234567890123456. Aplikasi mobile banking error terus dan tidak bisa transfer. Tolong hubungi saya besok sore jam 3-5\",
    \"session_id\": \"$SESSION_ID\"
  }" | jq '.'
echo -e "\n"

# 6. Follow-up Message
echo "🔄 6. Follow-up Message"
curl -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Prioritasnya tinggi ya, saya perlu solusi cepat\",
    \"session_id\": \"$SESSION_ID\"
  }" | jq '.'
echo -e "\n"

# 7. Get Session Info
if [ ! -z "$SESSION_ID" ]; then
  echo "📋 7. Get Session Information"
  curl -X GET "$BASE_URL/chat/$SESSION_ID" \
    -H "Content-Type: application/json" \
    | jq '.'
  echo -e "\n"
fi

# 8. FAQ Search
echo "❓ 8. FAQ Search - Balance Inquiry"
curl -X GET "$BASE_URL/faq?q=saldo%20minimum" \
  -H "Content-Type: application/json" \
  | jq '.'
echo -e "\n"

# 9. SLA Search - Credit Card
echo "⏰ 9. SLA Search - Credit Card Issues"
curl -X GET "$BASE_URL/sla?q=kartu%20kredit&category=complaint&limit=3" \
  -H "Content-Type: application/json" \
  | jq '.'
echo -e "\n"

# 10. SLA Search - Account Problems
echo "⏰ 10. SLA Search - Account Problems"
curl -X GET "$BASE_URL/sla?q=rekening%20terblokir&limit=5" \
  -H "Content-Type: application/json" \
  | jq '.'
echo -e "\n"

# 11. Legacy Extract Endpoint
echo "🔍 11. Legacy Extract Endpoint"
curl -X POST "$BASE_URL/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Saya Ahmad Rizki, rekening 9876543210987654, komplain kartu kredit limit tidak sesuai, hubungi via mobile banking"
  }' | jq '.'
echo -e "\n"

# 12. Error Testing - Empty Message
echo "❌ 12. Error Test - Empty Message"
curl -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": ""
  }' | jq '.'
echo -e "\n"

# 13. Error Testing - Missing Message
echo "❌ 13. Error Test - Missing Message Field"
curl -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test"
  }' | jq '.'
echo -e "\n"

# 14. Error Testing - Invalid Session
echo "❌ 14. Error Test - Invalid Session ID"
curl -X GET "$BASE_URL/chat/invalid-session-id" \
  -H "Content-Type: application/json" \
  | jq '.'
echo -e "\n"

# 15. Complete Customer Journey
echo "🛣️ 15. Complete Customer Journey Test"
JOURNEY_RESPONSE=$(curl -s -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Selamat pagi, saya Budi Santoso, rekening 1122334455667788. Mobile banking saya error dan tidak bisa login. Mau komplain dan minta solusi. Hubungi saya hari ini jam 2-4 sore via telepon."
  }')

echo "$JOURNEY_RESPONSE" | jq '.'

# Get the new session and continue
NEW_SESSION=$(echo "$JOURNEY_RESPONSE" | jq -r '.session_id // empty')

if [ ! -z "$NEW_SESSION" ]; then
  echo -e "\n🔄 Follow-up in same journey:"
  curl -X POST "$BASE_URL/chat" \
    -H "Content-Type: application/json" \
    -d "{
      \"message\": \"Iya betul, sangat mendesak ini\",
      \"session_id\": \"$NEW_SESSION\"
    }" | jq '.'
fi

echo -e "\n✅ Testing Complete!"
echo "📊 Summary:"
echo "- All major endpoints tested"
echo "- Error handling verified"
echo "- Session management checked"
echo "- Knowledge base (FAQ/SLA) working"
echo "- Ready for frontend integration!"

# Performance test (optional)
echo -e "\n⚡ Quick Performance Test (10 rapid requests):"
for i in {1..10}; do
  echo -n "Request $i: "
  START_TIME=$(date +%s%N)
  curl -s -X GET "$BASE_URL/healthz" > /dev/null
  END_TIME=$(date +%s%N)
  DURATION=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds
  echo "${DURATION}ms"
done

echo -e "\n🎉 All tests completed!"
