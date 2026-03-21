# LINE 商業系統 - 完整安裝指南

## 系統架構說明

```
LINE 官方帳號
    ↕ Webhook
Node.js Express 伺服器
    ├── LINE Bot SDK (處理訊息)
    ├── SQLite 資料庫 (儲存資料)
    └── 管理後台 (網頁介面)
```

---

## 步驟一：申請 LINE 官方帳號

1. 前往 https://developers.line.biz/
2. 登入後點 **Create a new provider**
3. 建立 **Messaging API channel**
4. 記下以下兩個資訊：
   - **Channel Access Token** (Channel settings → Messaging API → Issue)
   - **Channel Secret** (Basic settings → Channel secret)

---

## 步驟二：安裝環境

### 需要安裝
- Node.js v18 以上 (https://nodejs.org)
- ngrok (測試用，讓本機可被 LINE 連到)

```bash
# 安裝 ngrok
npm install -g ngrok
```

---

## 步驟三：設定專案

```bash
# 1. 複製設定檔
cp .env.example .env

# 2. 編輯 .env 填入您的資訊
nano .env   # 或用任何文字編輯器
```

**.env 設定範例：**
```
LINE_CHANNEL_ACCESS_TOKEN=eyJ0xxxxxxxxxxxxx   ← 貼上您的 Token
LINE_CHANNEL_SECRET=abc123xxxxxx              ← 貼上您的 Secret
PORT=3000
BASE_URL=https://xxxx.ngrok.io              ← ngrok 產生的網址
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的安全密碼
JWT_SECRET=隨機字串作為加密金鑰
```

---

## 步驟四：安裝並啟動

```bash
# 安裝套件
npm install

# 建立資料庫 + 填入範例資料
npm run setup

# 啟動伺服器
npm start
```

看到以下訊息表示成功：
```
╔═══════════════════════════════════════╗
║   LINE 商業系統 已成功啟動！            ║
╚═══════════════════════════════════════╝
```

---

## 步驟五：設定 Webhook (本機測試)

```bash
# 開新終端機視窗，啟動 ngrok
ngrok http 3000

# 複製 https:// 開頭的網址，例如：
# https://abc123.ngrok.io
```

回到 LINE Developers Console：
1. Messaging API → **Webhook URL** 填入：
   `https://abc123.ngrok.io/webhook`
2. 點 **Verify** 確認成功
3. 開啟 **Use webhook**

---

## 步驟六：設定圖文選單 (Rich Menu)

```bash
# 執行設定指令
node -e "
require('dotenv').config();
const { setupRichMenu } = require('./src/services/richMenu');
setupRichMenu().then(id => console.log('Rich Menu ID:', id));
"
```

> ⚠️ 需要自己設計 2500x843 像素的圖文選單圖片
> 可用 Canva、Figma 等工具製作

---

## 步驟七：進入管理後台

開啟瀏覽器：`http://localhost:3000`

- 帳號：您在 .env 設定的 `ADMIN_USERNAME`
- 密碼：您在 .env 設定的 `ADMIN_PASSWORD`

---

## 功能說明

### LINE Bot 功能
| 用戶操作 | Bot 回應 |
|---------|---------|
| 加入好友 | 歡迎訊息 + 贈送 100 點 |
| 輸入「商品」| 格狀商品目錄 |
| 輸入「分類」| 分類選單 |
| 輸入「購物車」| 購物車內容 |
| 輸入「訂單」| 最近訂單列表 |
| 輸入「會員」| 會員資料卡 + 點數 |

### 商品目錄兩種顯示模式
1. **格狀模式 (Grid)** - 適合瀏覽大量商品，一次顯示多個
2. **清單模式 (List)** - 適合顯示詳細資訊，一次顯示 5 個

> 分類設定中可選擇每個分類的顯示方式

### 紅利點數機制
- 新會員加入：送 100 點
- 每次消費：回饋 5% 點數 (可調整)
- 1 點 = 折抵 1 元
- 付款確認後自動發放

### 會員等級
| 等級 | 累計消費門檻 |
|------|------------|
| 🟢 一般 | 0 元起 |
| 🥈 銀牌 | 2,000 元 |
| 🥇 金牌 | 5,000 元 |
| 💎 白金 | 10,000 元 |

---

## 正式上線部署

推薦使用以下平台部署：
- **Railway** (最簡單，有免費方案)
- **Render**
- **Heroku**
- **VPS (Ubuntu + PM2)**

```bash
# 使用 PM2 管理程序 (VPS)
npm install -g pm2
pm2 start src/app.js --name line-shop
pm2 save
```

---

## 目錄結構說明

```
line-business-system/
├── src/
│   ├── app.js              # 主程式入口
│   ├── routes/
│   │   ├── webhook.js      # LINE Webhook 處理
│   │   └── admin.js        # 管理後台 API
│   ├── models/
│   │   ├── Member.js       # 會員資料模型
│   │   ├── Product.js      # 商品資料模型
│   │   └── Order.js        # 訂單資料模型
│   └── services/
│       ├── flexMessages.js # LINE Flex Message 產生
│       └── richMenu.js     # LINE Rich Menu 設定
├── public/                 # 管理後台前端
│   ├── index.html
│   ├── css/admin.css
│   └── js/admin.js
├── migrations/             # 資料庫結構
├── seeds/                  # 範例資料
├── config/                 # 設定檔
└── .env.example            # 環境變數範本
```
