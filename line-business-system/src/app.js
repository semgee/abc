/**
 * LINE 商業系統主程式入口
 *
 * 啟動方式:
 *   1. 複製 .env.example → .env 並填入設定
 *   2. npm install
 *   3. npm run setup   (建立資料庫 + 填入範例資料)
 *   4. npm start       (啟動伺服器)
 */
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
    secret: process.env.JWT_SECRET || 'line_shop_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 }, // 8小時
}));

// ── 路由 ──────────────────────────────────────
// LINE Webhook (需要 raw body 驗證簽名)
const webhookRouter = require('./routes/webhook');
app.use('/webhook', webhookRouter);

// 一般 JSON 解析 (放在 webhook 後面)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 管理後台 API
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

// 進銷存管理 API
const inventoryRouter = require('./routes/inventory');
app.use('/api/inventory', inventoryRouter);

// 財務管理 API
const financeRouter = require('./routes/finance');
app.use('/api/finance', financeRouter);

// 發票管理 API
const invoiceRouter = require('./routes/invoice');
app.use('/api/invoices', invoiceRouter);

// BOM + 生產管理 API
const bomRouter = require('./routes/bom');
app.use('/api/bom', bomRouter);

// 健康檢查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 前台頁面 (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ── 錯誤處理 ────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('❌ 未捕獲的錯誤:', err.message);
    res.status(500).json({ error: '伺服器內部錯誤' });
});

// ── 啟動 ──────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   LINE 商業系統 已成功啟動！            ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log(`║  伺服器端口: ${PORT}                      ║`);
    console.log(`║  Webhook URL: /webhook                 ║`);
    console.log(`║  管理後台:   /admin                     ║`);
    console.log(`║  API 文件:   /api/admin                 ║`);
    console.log('╚═══════════════════════════════════════╝');
    console.log('');
    console.log('📋 LINE Developers Console 設定:');
    console.log(`   Webhook URL: ${process.env.BASE_URL || 'https://your-domain.com'}/webhook`);
    console.log('');
});

module.exports = app;
