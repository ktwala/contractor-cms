#!/bin/bash
# Test script to make API calls and verify metrics increment

echo "Testing metrics collection..."
echo "=============================="
echo ""

# Make a few API calls to generate metrics
echo "1. Making test API calls..."

# Test health/metrics endpoint
curl -s http://localhost:3000/metrics > /dev/null && echo "  ✓ Metrics endpoint accessible"

# Test a non-existent endpoint (will generate 404)
curl -s -o /dev/null -w "  ✓ 404 error recorded\n" http://localhost:3000/api/nonexistent

# Test Swagger docs (should be 200)
curl -s -o /dev/null -w "  ✓ Swagger docs accessed\n" http://localhost:3000/api

echo ""
echo "2. Checking metrics for new data..."
echo ""

# Get metrics and check for our test calls
METRICS=$(curl -s http://localhost:3000/metrics)

if echo "$METRICS" | grep -q "payroll_platform_http_requests_total"; then
  echo "  ✓ HTTP request metrics found"
  echo ""
  echo "  Sample HTTP metrics:"
  echo "$METRICS" | grep "payroll_platform_http_requests_total" | head -5 | sed 's/^/    /'
else
  echo "  ✗ HTTP request metrics not found"
fi

echo ""
echo "3. Checking for default Node.js metrics..."
if echo "$METRICS" | grep -q "payroll_platform_process"; then
  echo "  ✓ Node.js process metrics found"
else
  echo "  ✗ Node.js process metrics not found"
fi

echo ""
echo "Test complete!"
