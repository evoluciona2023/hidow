FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create writable data directories
RUN mkdir -p data/sessions data/user_memory logs

EXPOSE 3001

CMD ["node", "server.js"]
