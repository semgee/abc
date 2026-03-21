/**
 * 資料庫遷移執行腳本
 * 執行方式: node migrations/run.js
 */
require('dotenv').config();
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = process.env.DB_PATH || './database.sqlite';
const db = new Database(DB_PATH);

// 啟用外鍵約束
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

console.log('📦 開始執行資料庫遷移...');

// 讀取並執行 SQL 檔案
const sqlFile = path.join(__dirname, '001_create_tables.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// 分割並執行每個語句
db.exec(sql);
console.log('✅ 資料表建立完成');

// 建立預設管理員帳號
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
const passwordHash = bcrypt.hashSync(adminPassword, 10);

const existingAdmin = db.prepare('SELECT id FROM admins WHERE username = ?').get(adminUsername);
if (!existingAdmin) {
    db.prepare('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)').run(
        adminUsername, passwordHash, 'admin'
    );
    console.log(`✅ 管理員帳號建立: ${adminUsername}`);
}

// 建立系統預設設定
const defaultSettings = [
    ['shop_name', '我的LINE商店', '商店名稱'],
    ['shop_description', '歡迎光臨！', '商店描述'],
    ['welcome_bonus_points', '100', '新會員歡迎點數'],
    ['points_per_order_percentage', '5', '消費金額點數回饋百分比'],
    ['points_value', '1', '1點折抵金額(元)'],
    ['min_redeem_points', '100', '最低兌換點數'],
    ['shipping_fee', '60', '運費'],
    ['free_shipping_threshold', '500', '免運費門檻'],
    ['silver_threshold', '2000', '銀牌門檻(累計消費)'],
    ['gold_threshold', '5000', '金牌門檻(累計消費)'],
    ['platinum_threshold', '10000', '白金門檻(累計消費)'],
];

const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)'
);
for (const [key, value, description] of defaultSettings) {
    insertSetting.run(key, value, description);
}
console.log('✅ 系統設定初始化完成');

db.close();
console.log('🎉 資料庫遷移完成！');
