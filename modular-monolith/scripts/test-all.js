import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
  'test-threads.js',
  'test-os-optimizations.js',
  'test-phase2-os.js',
  'test-durability.js'
  // 'test-transactions.js' // Requires running MongoDB, skipping for automated pass/fail report
];

console.log('🚀 Running Master System Audit...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

let allPassed = true;

tests.forEach(testFile => {
  console.log(`\n🔍 Executing: ${testFile}...`);
  const result = spawnSync('node', [path.join(__dirname, testFile)], { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  if (result.status === 0) {
    console.log(`✅ ${testFile} PASSED`);
  } else {
    console.log(`❌ ${testFile} FAILED`);
    allPassed = false;
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (allPassed) {
  console.log('🎉 ALL SYSTEM OPTIMIZATIONS VERIFIED SUCCESSFULLY!');
} else {
  console.error('⚠️ SOME TESTS FAILED. PLEASE CHECK LOGS ABOVE.');
  process.exit(1);
}
