// Quick test script to verify metrics endpoint
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/metrics',
  method: 'GET',
};

console.log('Testing metrics endpoint at http://localhost:3000/metrics...\n');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Content-Type: ${res.headers['content-type']}\n`);

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Metrics Response (first 1000 chars):');
    console.log('='.repeat(50));
    console.log(data.substring(0, 1000));
    console.log('='.repeat(50));
    
    // Check for key metrics
    const checks = [
      { name: 'HTTP Request Duration', pattern: /workforce_platform_http_request_duration_seconds/ },
      { name: 'HTTP Requests Total', pattern: /workforce_platform_http_requests_total/ },
      { name: 'Process CPU', pattern: /workforce_platform_process_cpu/ },
      { name: 'Memory', pattern: /workforce_platform_process_resident_memory_bytes/ },
    ];

    console.log('\n✅ Metrics Found:');
    checks.forEach(check => {
      if (check.pattern.test(data)) {
        console.log(`  ✓ ${check.name}`);
      } else {
        console.log(`  ✗ ${check.name} (not found)`);
      }
    });

    console.log(`\nTotal response size: ${data.length} bytes`);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.log('\n⚠️  Make sure the application is running on port 3000');
  console.log('   Start it with: npm run start:dev');
});

req.end();
