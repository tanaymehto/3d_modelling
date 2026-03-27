#!/bin/sh
# Write Railway environment variables to .env.local so Next.js reads them at runtime
echo "AUTH_SECRET=${AUTH_SECRET}" > .env.local
echo "AUTH_TRUST_HOST=${AUTH_TRUST_HOST}" >> .env.local
echo "AUTH_URL=${AUTH_URL}" >> .env.local
echo "DATABASE_URL=${DATABASE_URL}" >> .env.local
echo "MESHY_API_KEY=${MESHY_API_KEY}" >> .env.local
echo "GEMINI_API_KEY=${GEMINI_API_KEY}" >> .env.local
echo "PIXAZO_SUBSCRIPTION_KEY=${PIXAZO_SUBSCRIPTION_KEY}" >> .env.local
echo "REPLICATE_API_TOKEN=${REPLICATE_API_TOKEN}" >> .env.local
exec npm run start
