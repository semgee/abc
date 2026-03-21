/**
 * 範例資料填充腳本
 * 執行方式: node seeds/run.js
 */
require('dotenv').config();
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './database.sqlite';
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

console.log('🌱 開始填充範例資料...');

// ── 商品分類 ──────────────────────────────────
const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, parent_id, display_type, icon, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
`);

// 頂層分類
insertCat.run(1, '全部商品', null, 'grid', '🛍️', 0);
insertCat.run(2, '食品飲料', null, 'grid', '🍜', 1);
insertCat.run(3, '美妝保養', null, 'grid', '💄', 2);
insertCat.run(4, '生活用品', null, 'grid', '🏠', 3);
insertCat.run(5, '限定優惠', null, 'list', '🔥', 4);

// 子分類
insertCat.run(6, '零食點心', 2, 'grid', '🍿', 0);
insertCat.run(7, '飲品沖泡', 2, 'grid', '☕', 1);
insertCat.run(8, '乾貨熟食', 2, 'grid', '🥡', 2);
insertCat.run(9, '護膚品', 3, 'list', '🧴', 0);
insertCat.run(10, '彩妝', 3, 'list', '💋', 1);

console.log('✅ 分類資料完成');

// ── 商品資料 ──────────────────────────────────
const insertProd = db.prepare(`
    INSERT OR IGNORE INTO products
        (id, category_id, sku, name, description, price, original_price, stock,
         image_url, images, specifications, tags, bonus_points_rate, is_featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const products = [
    // 零食類
    [1, 6, 'SNK-001', '海苔脆片 (原味)', '嚴選韓國海苔，酥脆鮮香，一口接一口停不下來', 89, 120, 200,
     'https://via.placeholder.com/400x400/FFB347/white?text=海苔脆片',
     '[]', '{"重量":"40g","口味":"原味","保存期限":"12個月"}',
     '["零食","韓國","熱銷"]', 0.05, 1],
    [2, 6, 'SNK-002', '蜂蜜起司薯片', '濃郁起司配上蜂蜜甜香，層次豐富的滋味', 79, 99, 150,
     'https://via.placeholder.com/400x400/F4C542/white?text=起司薯片',
     '[]', '{"重量":"60g","口味":"蜂蜜起司","保存期限":"6個月"}',
     '["零食","薯片","新品"]', 0.05, 0],
    [3, 7, 'DRK-001', '台灣高山烏龍茶 (茶包)', '台灣高山烏龍茶葉製成，清香甘甜，回甘持久', 299, 380, 80,
     'https://via.placeholder.com/400x400/7BB661/white?text=烏龍茶',
     '[]', '{"規格":"20包/盒","茶葉產地":"阿里山","保存期限":"24個月"}',
     '["茶","台灣","高山"]', 0.05, 1],
    [4, 7, 'DRK-002', '即溶咖啡三合一 (10包)', '醇厚咖啡香，方便快速，上班族必備', 149, 180, 300,
     'https://via.placeholder.com/400x400/6F4E37/white?text=咖啡',
     '[]', '{"規格":"10包/盒","沖泡方式":"熱水即溶","保存期限":"18個月"}',
     '["咖啡","即溶","方便"]', 0.05, 0],
    // 美妝類
    [5, 9, 'SKN-001', '玻尿酸保濕精華液 30ml', '添加三重玻尿酸，深層補水保濕，打造水潤美肌', 680, 880, 50,
     'https://via.placeholder.com/400x400/B5E8F7/white?text=精華液',
     '[]', '{"容量":"30ml","適用膚質":"全膚質","使用方式":"早晚潔膚後取適量塗抹"}',
     '["保濕","玻尿酸","精華"]', 0.05, 1],
    [6, 9, 'SKN-002', '淡斑美白面膜 (5片)', '含有煙醯胺及維生素C，有效淡化斑點提亮膚色', 350, 450, 100,
     'https://via.placeholder.com/400x400/FFF0F5/white?text=美白面膜',
     '[]', '{"規格":"5片/盒","使用頻率":"每週2-3次","保存期限":"36個月"}',
     '["美白","面膜","保濕"]', 0.05, 0],
    // 限定優惠
    [7, 5, 'SALE-001', '【超值組合】保養三件組', '精華液+面膜+乳液三件組超值優惠，限量100組', 1280, 1980, 30,
     'https://via.placeholder.com/400x400/FF6B6B/white?text=三件組',
     '[]', '{"包含":"精華液30ml+面膜5片+乳液50ml","限量":"100組"}',
     '["組合","限定","超值"]', 0.08, 1],
    [8, 5, 'SALE-002', '【週年慶】零食大禮包', '精選10款人氣零食，送禮自用兩相宜', 599, 899, 50,
     'https://via.placeholder.com/400x400/FFA500/white?text=零食禮包',
     '[]', '{"內容":"精選10款零食","重量":"約500g","適合":"送禮/自用"}',
     '["禮包","零食","週年慶"]', 0.08, 1],
];

for (const p of products) {
    insertProd.run(...p);
}
console.log('✅ 商品資料完成 (8筆)');

db.close();
console.log('🎉 範例資料填充完成！');
