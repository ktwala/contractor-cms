FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the source
COPY . .

EXPOSE 3001

# Dev mode with hot-reload
CMD ["npm", "run", "dev"]
