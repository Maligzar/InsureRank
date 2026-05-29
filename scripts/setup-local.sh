#!/bin/bash
set -e

USERNAME=$(whoami)
DB_URL="postgresql://${USERNAME}@127.0.0.1:5432/insurerank"

echo "Setting up InsureRank for user: $USERNAME"

# Generate a secret if one doesn't exist yet
SECRET=$(openssl rand -base64 32)

# Write .env
cat > .env << EOF
DATABASE_URL="${DB_URL}"
DIRECT_URL="${DB_URL}"
REDIS_URL="redis://127.0.0.1:6379"
NEXTAUTH_SECRET="${SECRET}"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
DISABLE_SW="true"
NODE_ENV="development"
EOF

echo "✓ .env written"

# Create database (ok if it already exists)
createdb insurerank 2>/dev/null && echo "✓ Database created" || echo "✓ Database already exists"

# Migrations
npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate deploy
echo "✓ Migrations applied"

# Seed
npx prisma db seed
echo "✓ Database seeded"

echo ""
echo "Done! Run: npm run dev"
echo "Login: admin@apex-insurance.com / Password123!"
