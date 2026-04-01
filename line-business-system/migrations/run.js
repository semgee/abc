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
const sqlFiles = [
    '001_create_tables.sql',
    '002_inventory_finance_invoice_bom.sql',
];

for (const file of sqlFiles) {
    const sqlFile = path.join(__dirname, file);
    if (fs.existsSync(sqlFile)) {
        const sql = fs.readFileSync(sqlFile, 'utf8');
        db.exec(sql);
        console.log(`✅ ${file} 執行完成`);
    }
}

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

// 建立預設會計科目
const defaultAccounts = [
    // 資產
    ['1100', '現金', 'asset', null],
    ['1200', '銀行存款', 'asset', null],
    ['1300', '應收帳款', 'asset', null],
    ['1400', '存貨', 'asset', null],
    // 負債
    ['2100', '應付帳款', 'liability', null],
    ['2200', '應付稅款', 'liability', null],
    ['2300', '預收款項', 'liability', null],
    // 權益
    ['3100', '股本', 'equity', null],
    ['3200', '保留盈餘', 'equity', null],
    // 收入
    ['4100', '銷貨收入', 'revenue', null],
    ['4200', '其他收入', 'revenue', null],
    // 費用
    ['5100', '銷貨成本', 'expense', null],
    ['5200', '進貨成本', 'expense', null],
    ['5300', '薪資費用', 'expense', null],
    ['5400', '租金費用', 'expense', null],
    ['5500', '運費', 'expense', null],
    ['5600', '其他費用', 'expense', null],
];

const insertAccount = db.prepare(
    'INSERT OR IGNORE INTO accounts (code, name, type, parent_code) VALUES (?, ?, ?, ?)'
);
for (const [code, name, type, parentCode] of defaultAccounts) {
    insertAccount.run(code, name, type, parentCode);
}
console.log('✅ 會計科目初始化完成');

db.close();
console.log('🎉 資料庫遷移完成！');
