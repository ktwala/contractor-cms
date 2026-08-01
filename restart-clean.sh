#!/bin/bash

echo "🛑 Stopping all containers..."
docker-compose down

echo ""
echo "🧹 Clearing Docker cache and volumes..."
docker system prune -f
docker volume prune -f

echo ""
echo "🗑️  Clearing local cache files..."
rm -rf node_modules/.cache .next .nuxt dist build coverage .turbo 2>/dev/null
echo "✅ Local cache cleared"

echo ""
echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 15

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ All services restarted!"
echo ""
echo "🌐 Services:"
echo "  - Employee Portal: http://localhost:3000"
echo "  - Admin Portal: http://localhost:3001"
echo "  - Backend API: http://localhost:4000"
echo ""
echo "🔐 Test Credentials:"
echo "  Email: admin@demo.payroll"
echo "  Password: admin123"
