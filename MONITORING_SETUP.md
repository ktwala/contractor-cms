# Monitoring Setup Guide

This guide explains how to set up and use the Prometheus and Grafana monitoring stack for the Hubsec Workforce Platform.

## Overview

The monitoring setup includes:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Metrics visualization and dashboards
- **Metrics Endpoint**: `/metrics` endpoint in the application

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start application + monitoring
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Or start monitoring separately (application already running)
docker-compose -f docker-compose.monitoring.yml --profile monitoring up -d
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `admin`
- **Prometheus**: http://localhost:9090

### 3. View Metrics

- **Application Metrics**: http://localhost:3000/metrics

## Configuration

### Prometheus Configuration

The Prometheus configuration is in `monitoring/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'workforce-platform'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['host.docker.internal:3000']
```

**Note**: If running Prometheus outside Docker, change `host.docker.internal:3000` to `localhost:3000`.

### Grafana Configuration

- Datasources: `monitoring/grafana/datasources/prometheus.yml`
- Dashboards: `monitoring/grafana/dashboards/`

## Available Metrics

The application exposes the following metrics:

### HTTP Metrics
- `workforce_platform_http_request_duration_seconds` - Request duration histogram
- `workforce_platform_http_requests_total` - Total HTTP requests counter
- `workforce_platform_http_errors_total` - HTTP errors counter

### Application Metrics
- `workforce_platform_active_connections` - Active connections gauge
- `workforce_platform_database_connections` - Database connections gauge
- `workforce_platform_cache_hits_total` - Cache hits counter
- `workforce_platform_cache_misses_total` - Cache misses counter

### Business Metrics
- `workforce_platform_payrun_calculations_total` - Payrun calculations counter
- `workforce_platform_payrun_errors_total` - Payrun errors counter
- `workforce_platform_employees_total` - Employee count gauge
- `workforce_platform_active_payruns` - Active payruns gauge

### Performance Metrics
- `workforce_platform_response_time_seconds` - Response time histogram
- `workforce_platform_database_query_duration_seconds` - Database query duration histogram

### Default Metrics (Node.js)
- `workforce_platform_process_cpu_user_seconds_total`
- `workforce_platform_process_cpu_system_seconds_total`
- `workforce_platform_process_resident_memory_bytes`
- `workforce_platform_nodejs_heap_size_total_bytes`
- `workforce_platform_nodejs_heap_size_used_bytes`
- And more...

## Creating Dashboards in Grafana

### 1. Access Grafana

Go to http://localhost:3001 and login with `admin`/`admin`.

### 2. Create a Dashboard

1. Click "+" → "Dashboard"
2. Click "Add visualization"
3. Select "Prometheus" as data source
4. Enter a PromQL query (examples below)

### 3. Useful Queries

#### Request Rate
```promql
rate(workforce_platform_http_requests_total[5m])
```

#### Request Duration (95th percentile)
```promql
histogram_quantile(0.95, rate(workforce_platform_http_request_duration_seconds_bucket[5m]))
```

#### Error Rate
```promql
rate(workforce_platform_http_errors_total[5m])
```

#### Error Percentage
```promql
(rate(workforce_platform_http_errors_total[5m]) / rate(workforce_platform_http_requests_total[5m])) * 100
```

#### Memory Usage
```promql
workforce_platform_process_resident_memory_bytes
```

#### CPU Usage
```promql
rate(workforce_platform_process_cpu_user_seconds_total[5m]) + rate(workforce_platform_process_cpu_system_seconds_total[5m])
```

#### Active Connections
```promql
workforce_platform_active_connections
```

#### Payrun Calculations
```promql
rate(workforce_platform_payrun_calculations_total[5m])
```

## Development Setup

### Running Locally (without Docker)

1. Start the application:
```bash
npm run start:dev
```

2. Start Prometheus:
```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro \
  prom/prometheus:latest
```

3. Start Grafana:
```bash
docker run -d \
  --name grafana \
  -p 3001:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  -v $(pwd)/monitoring/grafana:/etc/grafana/provisioning:ro \
  grafana/grafana:latest
```

**Important**: Update `monitoring/prometheus.yml` to use `localhost:3000` instead of `host.docker.internal:3000`.

## Production Setup

For production, consider:

1. **Authentication**: Set up authentication for Grafana
2. **TLS**: Use HTTPS for Grafana and Prometheus
3. **Retention**: Configure appropriate retention periods
4. **Alerts**: Set up alerting rules in Prometheus
5. **High Availability**: Consider Prometheus HA setup
6. **Service Discovery**: Use service discovery instead of static configs

## Troubleshooting

### Metrics Not Appearing in Prometheus

1. Check if the application is running: `curl http://localhost:3000/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify the target URL in `prometheus.yml`

### Grafana Can't Connect to Prometheus

1. Check if Prometheus is running: `docker ps | grep prometheus`
2. Verify the datasource URL in Grafana: http://localhost:3001/connections/datasources
3. Test the connection from Grafana UI

### High Memory Usage

Prometheus can use significant memory. Consider:
- Reducing scrape interval
- Reducing retention period
- Using external storage

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Query Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)
- [Grafana Dashboard Examples](https://grafana.com/grafana/dashboards/)
