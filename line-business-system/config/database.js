/**
 * 資料庫連線設定
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(process.env.DB_PATH || './database.sqlite');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('foreign_keys = ON');
        db.pragma('journal_mode = WAL');
    }
    return db;
}

module.exports = { getDb };
