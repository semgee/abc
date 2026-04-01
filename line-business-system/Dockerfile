FROM node:18-slim

# better-sqlite3 需要 build tools
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先複製 package 檔案，利用 Docker cache
COPY package*.json ./
RUN npm ci --production

# 複製應用程式原始碼
COPY . .

# 建立資料庫目錄 (Cloud Run 使用 /tmp 做暫存)
RUN mkdir -p /tmp/data

# 設定預設環境變數
ENV PORT=8080
ENV DB_PATH=/tmp/data/database.sqlite
ENV NODE_ENV=production

# Cloud Run 會傳入 PORT 環境變數
EXPOSE 8080

# 啟動時自動執行 migration + seed，然後啟動伺服器
CMD ["sh", "-c", "node migrations/run.js && node seeds/run.js && node src/app.js"]
