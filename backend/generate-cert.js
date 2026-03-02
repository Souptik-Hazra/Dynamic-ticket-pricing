// This script generates a self-signed certificate for local development only.
// In production, use a certificate from a trusted CA.
// Run this script with: node generate-cert.js

const { execSync } = require('child_process');
const fs = require('fs');

const keyFile = 'server.key';
const certFile = 'server.cert';

if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
  console.log('Certificate and key already exist.');
  process.exit(0);
}

try {
  execSync(`openssl req -nodes -new -x509 -keyout ${keyFile} -out ${certFile} -subj "/CN=localhost" -days 365`, { stdio: 'inherit' });
  console.log('Self-signed certificate generated.');
} catch (err) {
  console.error('Failed to generate certificate:', err);
  process.exit(1);
}
