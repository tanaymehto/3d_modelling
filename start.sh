#!/bin/sh
# Write Railway environment variables to .env.local so Next.js reads them at runtime
cat > .env.local <<EOF
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
AUTH_SECRET=${AUTH_SECRET:-fallback-secret-for-build-time-only}
AUTH_TRUST_HOST=${AUTH_TRUST_HOST:-true}
AUTH_URL=${AUTH_URL:-http://localhost:3000}
DATABASE_URL=${DATABASE_URL:-file:./prisma/dev.db}
MESHY_API_KEY=${MESHY_API_KEY}
GEMINI_API_KEY=${GEMINI_API_KEY}
PIXAZO_SUBSCRIPTION_KEY=${PIXAZO_SUBSCRIPTION_KEY}
REPLICATE_API_TOKEN=${REPLICATE_API_TOKEN}
EOF
exec npm run start
