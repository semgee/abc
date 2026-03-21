-- =============================================
-- LINE 商業系統資料庫結構
-- =============================================

-- 會員資料表
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_user_id TEXT UNIQUE NOT NULL,        -- LINE 用戶ID
    display_name TEXT,                          -- LINE 顯示名稱
    picture_url TEXT,                           -- 頭像 URL
    status_message TEXT,                        -- 狀態訊息
    phone TEXT,                                 -- 手機號碼
    email TEXT,                                 -- 電子郵件
    birthday TEXT,                              -- 生日 (YYYY-MM-DD)
    address TEXT,                               -- 地址
    bonus_points INTEGER DEFAULT 0,            -- 紅利點數
    total_points_earned INTEGER DEFAULT 0,     -- 累計獲得點數
    total_points_used INTEGER DEFAULT 0,       -- 累計使用點數
    member_level TEXT DEFAULT 'general',       -- 等級: general/silver/gold/platinum
    is_blocked INTEGER DEFAULT 0,              -- 是否封鎖 (0=否, 1=是)
    followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 加入好友時間
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 商品分類表
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                         -- 分類名稱
    parent_id INTEGER DEFAULT NULL,            -- 父分類 (NULL=頂層)
    display_type TEXT DEFAULT 'grid',          -- 顯示方式: grid/list
    icon TEXT,                                  -- 圖示 emoji
    sort_order INTEGER DEFAULT 0,              -- 排序
    is_active INTEGER DEFAULT 1,              -- 是否啟用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- 商品資料表
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,              -- 所屬分類
    sku TEXT UNIQUE,                           -- 商品編號
    name TEXT NOT NULL,                        -- 商品名稱
    description TEXT,                          -- 商品描述
    price INTEGER NOT NULL,                    -- 售價 (元)
    original_price INTEGER,                    -- 原價
    stock INTEGER DEFAULT 0,                   -- 庫存
    image_url TEXT,                            -- 主圖 URL
    images TEXT DEFAULT '[]',                  -- 多張圖片 (JSON array)
    specifications TEXT DEFAULT '{}',          -- 規格 (JSON)
    tags TEXT DEFAULT '[]',                    -- 標籤 (JSON array)
    bonus_points_rate REAL DEFAULT 0.05,       -- 點數回饋比例 (5%)
    is_active INTEGER DEFAULT 1,              -- 是否上架
    is_featured INTEGER DEFAULT 0,            -- 是否精選
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 訂單資料表
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,         -- 訂單編號 (如: ORD-20240101-0001)
    member_id INTEGER NOT NULL,                -- 會員ID
    status TEXT DEFAULT 'pending',             -- 狀態: pending/confirmed/shipping/delivered/cancelled/refunded
    total_amount INTEGER NOT NULL,             -- 訂單總金額
    discount_amount INTEGER DEFAULT 0,         -- 折扣金額
    points_used INTEGER DEFAULT 0,             -- 使用點數
    points_used_amount INTEGER DEFAULT 0,      -- 點數折抵金額
    shipping_fee INTEGER DEFAULT 0,            -- 運費
    final_amount INTEGER NOT NULL,             -- 實付金額
    bonus_points_earned INTEGER DEFAULT 0,     -- 本單獲得點數
    payment_method TEXT DEFAULT 'line_pay',    -- 付款方式
    payment_status TEXT DEFAULT 'unpaid',      -- 付款狀態: unpaid/paid/refunded
    shipping_name TEXT,                        -- 收件人姓名
    shipping_phone TEXT,                       -- 收件人電話
    shipping_address TEXT,                     -- 收件地址
    note TEXT,                                 -- 備註
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 訂單明細資料表
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,                 -- 訂單ID
    product_id INTEGER NOT NULL,              -- 商品ID
    product_name TEXT NOT NULL,               -- 商品名稱 (快照)
    product_sku TEXT,                          -- 商品編號 (快照)
    product_image TEXT,                        -- 商品圖片 (快照)
    quantity INTEGER NOT NULL,                 -- 數量
    unit_price INTEGER NOT NULL,              -- 單價
    subtotal INTEGER NOT NULL,                -- 小計
    options TEXT DEFAULT '{}',               -- 選項 (JSON, 如顏色/尺寸)
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 點數異動紀錄表
CREATE TABLE IF NOT EXISTS points_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,               -- 會員ID
    points INTEGER NOT NULL,                  -- 點數異動 (正=獲得, 負=使用)
    balance INTEGER NOT NULL,                 -- 異動後餘額
    type TEXT NOT NULL,                       -- 類型: welcome/purchase/redeem/admin/expire
    description TEXT,                         -- 說明
    reference_id TEXT,                        -- 關聯訂單編號或其他
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 購物車資料表
CREATE TABLE IF NOT EXISTS carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,               -- 會員ID
    product_id INTEGER NOT NULL,              -- 商品ID
    quantity INTEGER NOT NULL DEFAULT 1,      -- 數量
    options TEXT DEFAULT '{}',               -- 選項 (JSON)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE(member_id, product_id)
);

-- 管理員帳號表
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'staff',               -- admin/staff
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 系統設定表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引加快查詢
CREATE INDEX IF NOT EXISTS idx_members_line_id ON members(line_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_member ON orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_points_member ON points_history(member_id);
