# Quick Test Guide - Metrics Functionality

## Prerequisites

1. **Fix compilation errors** (if any):
   - The Sentry issue has been fixed
   - Other compilation errors are pre-existing and don't affect metrics

2. **Start the application**:
```bash
npm run start:dev
```

Wait for the server to start. You should see:
```
Server running on: http://localhost:3000
Swagger docs:      http://localhost:3000/api
Metrics:           http://localhost:3000/metrics
```

## Quick Test (30 seconds)

### Option 1: Browser Test
1. Open browser: http://localhost:3000/metrics
2. You should see Prometheus-formatted metrics
3. Look for metrics starting with `payroll_platform_`

### Option 2: Command Line Test
```bash
# Test 1: Check if endpoint works
curl http://localhost:3000/metrics | head -20

# Test 2: Check for our metrics
curl http://localhost:3000/metrics | grep "payroll_platform_http_requests_total"

# Test 3: Run automated test
./test-metrics-simple.sh
```

### Option 3: Node.js Test
```bash
node test-metrics.js
```

## Expected Output

When you access http://localhost:3000/metrics, you should see:

```
# HELP payroll_platform_http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE payroll_platform_http_request_duration_seconds histogram
payroll_platform_http_request_duration_seconds_bucket{method="GET",route="/metrics",status_code="200",le="0.005"} 1

# HELP payroll_platform_http_requests_total Total number of HTTP requests
# TYPE payroll_platform_http_requests_total counter
payroll_platform_http_requests_total{method="GET",route="/metrics",status_code="200"} 5

# HELP payroll_platform_process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE payroll_platform_process_cpu_user_seconds_total counter
payroll_platform_process_cpu_user_seconds_total 0.123

# HELP payroll_platform_process_resident_memory_bytes Resident memory size in bytes.
# TYPE payroll_platform_process_resident_memory_bytes gauge
payroll_platform_process_resident_memory_bytes 45678901
```

## Verification Checklist

- [ ] Server starts without errors
- [ ] `/metrics` endpoint returns 200 OK
- [ ] Response contains Prometheus format (`# HELP`, `# TYPE`)
- [ ] HTTP request metrics are present
- [ ] Node.js process metrics are present
- [ ] Metrics increment after making API calls

## Troubleshooting

### Server won't start
- Check for compilation errors: `npm run build`
- Fix any TypeScript errors
- Check if port 3000 is available

### Metrics endpoint returns 404
- Verify `MetricsController` is in `CommonModule`
- Check that `CommonModule` is imported in `AppModule`
- Restart the server

### No metrics in response
- Check application logs for errors
- Verify `MetricsService` is instantiated
- Ensure `prom-client` is installed: `npm list prom-client`

### Metrics not incrementing
- Make sure `MetricsInterceptor` is registered in `AppModule`
- Check that requests are being made
- Wait a moment for metrics to update

## Next Steps

Once metrics are working:
1. Set up Prometheus to scrape metrics
2. Configure Grafana dashboards
3. See `MONITORING_SETUP.md` for full setup
