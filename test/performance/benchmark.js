/**
 * Performance Benchmark Tests
 * Simple Node.js script for benchmarking specific operations
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function benchmarkEndpoint(name, method, url, headers = {}) {
  const times = [];
  const iterations = 100;

  console.log(`\nBenchmarking: ${name}`);
  console.log(`URL: ${method} ${url}`);
  console.log(`Iterations: ${iterations}`);

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      await axios({ method, url: `${API_URL}${url}`, headers });
      const duration = Date.now() - start;
      times.push(duration);
    } catch (error) {
      console.error(`Error on iteration ${i + 1}:`, error.message);
    }
  }

  const sorted = times.sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`Results:`);
  console.log(`  Min: ${min}ms`);
  console.log(`  Max: ${max}ms`);
  console.log(`  Avg: ${avg.toFixed(2)}ms`);
  console.log(`  P50: ${p50}ms`);
  console.log(`  P95: ${p95}ms`);
  console.log(`  P99: ${p99}ms`);
}

async function runBenchmarks() {
  console.log('Starting Performance Benchmarks...');
  console.log(`Target: ${API_URL}`);

  // Health check
  await benchmarkEndpoint('Health Check', 'GET', '/health');

  // Metrics endpoint
  await benchmarkEndpoint('Metrics', 'GET', '/metrics');

  // API endpoints (may require auth)
  // await benchmarkEndpoint('Employees', 'GET', '/api/v1/employees', {
  //   Authorization: 'Bearer mock-token',
  // });

  console.log('\nBenchmarks complete!');
}

runBenchmarks().catch(console.error);
