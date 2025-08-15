
// Test chatbot connectivity from local
async function testChatbotLMConnection() {
  try {
    console.log('🔍 Testing chatbot LM connectivity...');
    
    // Test LM endpoint from chatbot server
    const testRes = await fetch('http://localhost:5000/test-lm');
    const testData = await testRes.json();
    
    console.log('\n📊 LM Connectivity Test Results:');
    console.log(`Overall Status: ${testData.overall_status}`);
    console.log(`LM Base URL: ${testData.lm_base_url}`);
    console.log(`LM Model: ${testData.lm_model}`);
    
    console.log('\n🔍 Models Test:');
    console.log(`Status: ${testData.tests.models.status}`);
    console.log(`Success: ${testData.tests.models.success}`);
    console.log(`Data: ${testData.tests.models.data}`);
    if (testData.tests.models.available_models?.length > 0) {
      console.log(`Available models: ${testData.tests.models.available_models.join(', ')}`);
    }
    
    console.log('\n💬 Chat Test:');
    console.log(`Status: ${testData.tests.chat.status}`);
    console.log(`Success: ${testData.tests.chat.success}`);
    if (testData.tests.chat.response) {
      console.log(`Response: ${testData.tests.chat.response}`);
    }
    if (testData.tests.chat.error) {
      console.log(`Error: ${testData.tests.chat.error}`);
    }
    
    if (testData.recommendations?.length > 0) {
      console.log('\n💡 Recommendations:');
      testData.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
    // Test actual chat
    if (testData.overall_status === 'HEALTHY') {
      console.log('\n🤖 Testing actual chat...');
      const chatRes = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Halo, saya ada masalah dengan ATM'
        })
      });
      
      const chatData = await chatRes.json();
      console.log(`Chat Success: ${chatRes.ok}`);
      if (chatRes.ok) {
        console.log(`Bot Response: ${chatData.message?.slice(0, 100)}...`);
        console.log(`Action: ${chatData.action}`);
        console.log(`Confidence: ${chatData.confidence}`);
      } else {
        console.log(`Chat Error: ${JSON.stringify(chatData)}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testChatbotLMConnection();
