#!/bin/bash

# Docker development helper script for Payroll Platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

case "$1" in
  start)
    log_info "Starting Payroll Platform..."
    docker compose up -d
    log_info "Waiting for services to be ready..."
    sleep 5
    log_info "Services started!"
    log_info "API: http://localhost:3000"
    log_info "API Docs: http://localhost:3000/api"
    ;;

  stop)
    log_info "Stopping Payroll Platform..."
    docker compose down
    log_info "Services stopped."
    ;;

  restart)
    log_info "Restarting Payroll Platform..."
    docker compose restart
    ;;

  logs)
    docker compose logs -f ${2:-app}
    ;;

  shell)
    log_info "Opening shell in app container..."
    docker compose exec app sh
    ;;

  db)
    log_info "Connecting to PostgreSQL..."
    docker compose exec postgres psql -U payroll -d payroll_platform
    ;;

  seed)
    log_info "Running database seed..."
    docker compose exec app npm run db:seed
    log_info "Seed completed."
    ;;

  migrate)
    log_info "Running database migrations..."
    docker compose exec app npx prisma db push
    log_info "Migrations completed."
    ;;

  reset)
    log_warn "This will delete all data. Are you sure? (y/n)"
    read -r confirm
    if [ "$confirm" = "y" ]; then
      log_info "Resetting database..."
      docker compose down -v
      docker compose up -d postgres redis
      sleep 5
      docker compose up -d app
      sleep 10
      log_info "Database reset and reseeded."
    fi
    ;;

  admin)
    log_info "Starting with pgAdmin..."
    docker compose --profile admin up -d
    log_info "pgAdmin: http://localhost:5050"
    log_info "Email: admin@payroll.local / Password: admin"
    ;;

  test-api)
    log_info "Testing API endpoints..."

    # Health check
    echo -e "\n${YELLOW}Health Check:${NC}"
    curl -s http://localhost:3000/health | jq .

    # Get auth token (you'll need to implement this based on your auth)
    # TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
    #   -H "Content-Type: application/json" \
    #   -d '{"email":"admin@test.com","password":"test123"}' | jq -r .access_token)

    log_info "Run individual API tests with curl or use the Swagger docs at http://localhost:3000/api"
    ;;

  status)
    log_info "Service Status:"
    docker compose ps
    ;;

  clean)
    log_warn "This will remove all containers, volumes, and images. Are you sure? (y/n)"
    read -r confirm
    if [ "$confirm" = "y" ]; then
      docker compose down -v --rmi local
      log_info "Cleaned up."
    fi
    ;;

  *)
    echo "Payroll Platform Docker Helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  start      Start all services"
    echo "  stop       Stop all services"
    echo "  restart    Restart all services"
    echo "  logs       View logs (optional: service name)"
    echo "  shell      Open shell in app container"
    echo "  db         Connect to PostgreSQL"
    echo "  seed       Run database seed"
    echo "  migrate    Run database migrations"
    echo "  reset      Reset database (deletes all data)"
    echo "  admin      Start with pgAdmin UI"
    echo "  test-api   Test API endpoints"
    echo "  status     Show service status"
    echo "  clean      Remove all containers/volumes/images"
    ;;
esac
