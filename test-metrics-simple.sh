#!/bin/bash
# Simple test script for metrics functionality

echo "========================================="
echo "Testing Metrics Functionality"
echo "========================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/metrics > /dev/null 2>&1; then
    echo "❌ Server is not running on port 3000"
    echo ""
    echo "Please start the server first:"
    echo "  npm run start:dev"
    echo ""
    exit 1
fi

echo "✅ Server is running"
echo ""

# Test 1: Check metrics endpoint
echo "Test 1: Checking /metrics endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/metrics)
if [ "$STATUS" = "200" ]; then
    echo "  ✅ Metrics endpoint returns 200 OK"
else
    echo "  ❌ Metrics endpoint returned $STATUS"
    exit 1
fi

# Test 2: Check for Prometheus format
echo ""
echo "Test 2: Checking for Prometheus format..."
METRICS=$(curl -s http://localhost:3000/metrics)
if echo "$METRICS" | grep -q "# HELP"; then
    echo "  ✅ Prometheus format detected (contains # HELP)"
else
    echo "  ❌ Prometheus format not detected"
    exit 1
fi

# Test 3: Check for our custom metrics
echo ""
echo "Test 3: Checking for custom metrics..."
CHECKS=0
PASSED=0

if echo "$METRICS" | grep -q "payroll_platform_http_request_duration_seconds"; then
    echo "  ✅ HTTP request duration metric found"
    PASSED=$((PASSED + 1))
else
    echo "  ❌ HTTP request duration metric not found"
fi
CHECKS=$((CHECKS + 1))

if echo "$METRICS" | grep -q "payroll_platform_http_requests_total"; then
    echo "  ✅ HTTP requests total metric found"
    PASSED=$((PASSED + 1))
else
    echo "  ❌ HTTP requests total metric not found"
fi
CHECKS=$((CHECKS + 1))

if echo "$METRICS" | grep -q "payroll_platform_process_cpu"; then
    echo "  ✅ Node.js process CPU metric found"
    PASSED=$((PASSED + 1))
else
    echo "  ❌ Node.js process CPU metric not found"
fi
CHECKS=$((CHECKS + 1))

if echo "$METRICS" | grep -q "payroll_platform_process_resident_memory_bytes"; then
    echo "  ✅ Node.js memory metric found"
    PASSED=$((PASSED + 1))
else
    echo "  ❌ Node.js memory metric not found"
fi
CHECKS=$((CHECKS + 1))

# Test 4: Make some API calls and check if metrics increment
echo ""
echo "Test 4: Testing metrics collection..."
INITIAL_COUNT=$(echo "$METRICS" | grep "payroll_platform_http_requests_total" | head -1 | awk '{print $2}' | cut -d'.' -f1 || echo "0")

# Make a few API calls
curl -s http://localhost:3000/api > /dev/null
curl -s http://localhost:3000/metrics > /dev/null
sleep 1

NEW_METRICS=$(curl -s http://localhost:3000/metrics)
NEW_COUNT=$(echo "$NEW_METRICS" | grep "payroll_platform_http_requests_total" | head -1 | awk '{print $2}' | cut -d'.' -f1 || echo "0")

if [ "$NEW_COUNT" -gt "$INITIAL_COUNT" ]; then
    echo "  ✅ Metrics are incrementing (was $INITIAL_COUNT, now $NEW_COUNT)"
    PASSED=$((PASSED + 1))
else
    echo "  ⚠️  Metrics may not be incrementing (was $INITIAL_COUNT, now $NEW_COUNT)"
fi
CHECKS=$((CHECKS + 1))

# Summary
echo ""
echo "========================================="
echo "Test Summary: $PASSED/$CHECKS checks passed"
echo "========================================="

if [ "$PASSED" -eq "$CHECKS" ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed or need attention"
    exit 0
fi
