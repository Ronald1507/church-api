FROM node:20-alpine
WORKDIR /app
# bcrypt needs native bindings
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
