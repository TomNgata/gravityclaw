FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDeps for tsc)
RUN npm install

# Copy source
COPY . .

# Compile TypeScript fresh every build
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
