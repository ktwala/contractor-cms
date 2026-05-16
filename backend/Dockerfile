FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the source
COPY . .

EXPOSE 3000

# Dev mode with hot-reload
CMD ["npm", "run", "start:dev"]
