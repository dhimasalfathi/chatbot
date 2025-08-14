// Comprehensive SLA API Testing
async function testSLAScenarios() {
  const scenarios = [
    {
      name: "ATM Transfer Problems",
      url: "http://localhost:5000/sla?q=ATM%20transfer&limit=2"
    },
    {
      name: "Kartu Kredit Issues", 
      url: "http://localhost:5000/sla?q=kartu%20kredit&category=Pembayaran&limit=2"
    },
    {
      name: "Top Up Problems",
      url: "http://localhost:5000/sla?q=top%20up&limit=3"
    },
    {
      name: "Tarik Tunai Issues",
      url: "http://localhost:5000/sla?q=tarik%20tunai&limit=1"
    }
  ];

  for (const scenario of scenarios) {
    try {
      console.log(`\n=== ${scenario.name} ===`);
      const response = await fetch(scenario.url);
      const data = await response.json();
      
      console.log(`Found ${data.count} results:`);
      data.results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.category}`);
        console.log(`   SLA: ${result.sla_days} hari kerja`);
        console.log(`   UIC: ${result.uic}`);
        console.log(`   Channel: ${result.channel}`);
      });
    } catch (error) {
      console.error(`Error in ${scenario.name}:`, error.message);
    }
  }
}

async function testChat() {
  try {
    const response = await fetch('http://localhost:5000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: "Halo, saya ada masalah dengan transaksi ATM pembayaran kartu kredit"
      })
    });
    
    const data = await response.json();
    console.log('Chat Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testSLA() {
  try {
    const response = await fetch('http://localhost:5000/sla?q=ATM%20pembayaran&category=Pembayaran&limit=3');
    const data = await response.json();
    console.log('SLA Search Results:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run comprehensive tests
console.log('🔍 Testing SLA API with different scenarios...');
testSLAScenarios();

setTimeout(() => {
  console.log('\n\n💬 Testing basic SLA search...');
  testSLA();
}, 3000);

setTimeout(() => {
  console.log('\n\n🤖 Testing chat with SLA integration...');
  testChat();
}, 5000);
