// Simple direct chat test
async function simpleChatTest() {
  try {
    console.log('🔍 Testing direct chat...');
    
    const response = await fetch('http://localhost:5000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: "Halo, saya ada masalah dengan ATM transfer"
      })
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Chat Response:');
      console.log(`Message: ${data.message}`);
      console.log(`Action: ${data.action}`);
      console.log(`Confidence: ${data.confidence}`);
      console.log(`Session ID: ${data.session_id}`);
      
      if (data.collected_info) {
        console.log('\n📊 Collected Info:');
        console.log(JSON.stringify(data.collected_info, null, 2));
      }
    } else {
      const text = await response.text();
      console.log('❌ Error Response:');
      console.log(text);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

simpleChatTest();
