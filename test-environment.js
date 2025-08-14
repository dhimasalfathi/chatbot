// test-environment.js
const { detectEnvironment, getLMStudioURL, getDeploymentInstructions } = require('./lm-config');

console.log('🧪 TESTING ENVIRONMENT DETECTION');
console.log('================================');

const env = detectEnvironment();
console.log('Environment Detection:', env);
console.log('LM Studio URL:', getLMStudioURL());

const instructions = getDeploymentInstructions();
console.log('\nDeployment Instructions:');
console.log('Environment:', instructions.environment);
instructions.instructions.forEach((instruction, i) => {
  console.log(`${i + 1}. ${instruction}`);
});

console.log('\nCurrent Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('LM_BASE_URL:', process.env.LM_BASE_URL);
console.log('GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT);
console.log('Hostname:', require('os').hostname());
