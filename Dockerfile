FROM node:20-alpine AS base

FROM base AS builder
WORKDIR /app

# Install dependencies needed for node-gyp and Prisma
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js application
RUN npm run build

FROM base AS runner
WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]



