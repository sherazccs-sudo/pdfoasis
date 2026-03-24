FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source
COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "server.js"]
