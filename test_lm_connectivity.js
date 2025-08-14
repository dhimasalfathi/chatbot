// Test LM Studio connectivity from GCP
async function testLMStudioConnectivity() {
  const LM_BASE_URL = "https://6a7d04fe49a2.ngrok-free.app/v1";
  
  console.log('🔍 Testing LM Studio connectivity...');
  console.log(`📡 Target URL: ${LM_BASE_URL}`);
  
  // Test 1: Health check - Models endpoint
  try {
    console.log('\n1️⃣ Testing /models endpoint...');
    const modelsRes = await fetch(`${LM_BASE_URL}/models`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'Chatbot-Test/1.0'
      }
    });
    
    console.log(`Status: ${modelsRes.status}`);
    if (modelsRes.ok) {
      const models = await modelsRes.json();
      console.log('✅ Models endpoint works!');
      console.log(`Found ${models.data?.length || 0} models`);
      if (models.data?.length > 0) {
        console.log(`Active model: ${models.data[0].id}`);
      }
    } else {
      console.log('❌ Models endpoint failed');
      const text = await modelsRes.text();
      console.log('Response:', text.slice(0, 200));
    }
  } catch (error) {
    console.log('❌ Models endpoint error:', error.message);
  }
  
  // Test 2: Chat completions endpoint
  try {
    console.log('\n2️⃣ Testing /chat/completions endpoint...');
    const chatRes = await fetch(`${LM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer lm-studio',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'Chatbot-Test/1.0'
      },
      body: JSON.stringify({
        model: 'qwen2.5-7b-instruct-1m',
        messages: [
          { role: 'user', content: 'Hello, test connection' }
        ],
        temperature: 0.7,
        max_tokens: 50
      }),
      timeout: 15000
    });
    
    console.log(`Status: ${chatRes.status}`);
    if (chatRes.ok) {
      const response = await chatRes.json();
      console.log('✅ Chat endpoint works!');
      console.log(`Response: ${response.choices?.[0]?.message?.content || 'No content'}`);
    } else {
      console.log('❌ Chat endpoint failed');
      const text = await chatRes.text();
      console.log('Response:', text.slice(0, 300));
    }
  } catch (error) {
    console.log('❌ Chat endpoint error:', error.message);
  }
  
  // Test 3: Connection from specific IP (simulate GCP)
  try {
    console.log('\n3️⃣ Testing with various headers...');
    const testRes = await fetch(`${LM_BASE_URL}/models`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'GCP-Chatbot/1.0',
        'X-Forwarded-For': '34.101.123.456', // Simulate GCP IP
        'Accept': 'application/json'
      }
    });
    
    console.log(`Status with GCP headers: ${testRes.status}`);
    if (testRes.ok) {
      console.log('✅ GCP simulation works!');
    } else {
      const text = await testRes.text();
      console.log('❌ GCP simulation failed:', text.slice(0, 200));
    }
  } catch (error) {
    console.log('❌ GCP simulation error:', error.message);
  }
  
  console.log('\n🔍 Test completed. Check results above.');
}

// Run the test
testLMStudioConnectivity();
