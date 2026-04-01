-- =============================================
-- 進銷存 + 財務管理 + 發票管理 + 一階BOM
-- =============================================

-- ─── 供應商 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,                -- 供應商編號
    name TEXT NOT NULL,                       -- 供應商名稱
    contact_person TEXT,                      -- 聯絡人
    phone TEXT,                               -- 電話
    email TEXT,                               -- Email
    address TEXT,                             -- 地址
    tax_id TEXT,                              -- 統一編號
    payment_terms INTEGER DEFAULT 30,         -- 付款天數
    note TEXT,                                -- 備註
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── 採購單 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT UNIQUE NOT NULL,           -- 採購單號 (PO-YYYYMMDD-NNNN)
    supplier_id INTEGER NOT NULL,             -- 供應商
    status TEXT DEFAULT 'draft',              -- draft/confirmed/partial_received/received/cancelled
    total_amount INTEGER DEFAULT 0,           -- 總金額
    tax_amount INTEGER DEFAULT 0,             -- 稅額
    grand_total INTEGER DEFAULT 0,            -- 含稅總額
    expected_date TEXT,                       -- 預計交貨日
    received_date TEXT,                       -- 實際收貨日
    note TEXT,
    created_by INTEGER,                       -- 建立者 (admin id)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- ─── 採購單明細 ──────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,                -- 採購數量
    received_qty INTEGER DEFAULT 0,           -- 已收數量
    unit_cost INTEGER NOT NULL,               -- 單位成本
    subtotal INTEGER NOT NULL,                -- 小計
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ─── 庫存異動紀錄 ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL,                       -- purchase_in/sale_out/adjust/bom_consume/bom_produce/return_in/return_out
    quantity INTEGER NOT NULL,                -- 正=入庫, 負=出庫
    before_qty INTEGER NOT NULL,              -- 異動前數量
    after_qty INTEGER NOT NULL,               -- 異動後數量
    unit_cost INTEGER DEFAULT 0,              -- 單位成本
    reference_type TEXT,                      -- po/order/adjust/bom
    reference_id TEXT,                        -- 關聯單號
    note TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ─── 會計科目 ────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,                -- 科目代碼 (如: 1100, 2100, 4100)
    name TEXT NOT NULL,                       -- 科目名稱
    type TEXT NOT NULL,                       -- asset/liability/equity/revenue/expense
    parent_code TEXT,                         -- 父科目代碼
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── 財務交易紀錄 (簡易分錄) ──────────────────
CREATE TABLE IF NOT EXISTS finance_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    txn_number TEXT UNIQUE NOT NULL,          -- 交易編號 (TXN-YYYYMMDD-NNNN)
    txn_date TEXT NOT NULL,                   -- 交易日期
    type TEXT NOT NULL,                       -- income/expense/transfer/payable/receivable
    description TEXT,                         -- 摘要
    debit_account_id INTEGER,                 -- 借方科目
    credit_account_id INTEGER,                -- 貸方科目
    amount INTEGER NOT NULL,                  -- 金額
    reference_type TEXT,                      -- order/po/invoice/manual
    reference_id TEXT,                        -- 關聯單號
    status TEXT DEFAULT 'posted',             -- draft/posted/voided
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (debit_account_id) REFERENCES accounts(id),
    FOREIGN KEY (credit_account_id) REFERENCES accounts(id)
);

-- ─── 應付帳款 ────────────────────────────────
CREATE TABLE IF NOT EXISTS payables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    po_id INTEGER,                            -- 關聯採購單
    invoice_number TEXT,                      -- 供應商發票號碼
    amount INTEGER NOT NULL,                  -- 應付金額
    paid_amount INTEGER DEFAULT 0,            -- 已付金額
    due_date TEXT NOT NULL,                   -- 到期日
    status TEXT DEFAULT 'unpaid',             -- unpaid/partial/paid/voided
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
);

-- ─── 應收帳款 ────────────────────────────────
CREATE TABLE IF NOT EXISTS receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER,                        -- 會員 (可為空表示非會員)
    order_id INTEGER,                         -- 關聯訂單
    invoice_id INTEGER,                       -- 關聯發票
    amount INTEGER NOT NULL,                  -- 應收金額
    received_amount INTEGER DEFAULT 0,        -- 已收金額
    due_date TEXT NOT NULL,
    status TEXT DEFAULT 'unpaid',             -- unpaid/partial/paid/voided
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ─── 發票主檔 ────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,      -- 發票號碼 (INV-YYYYMMDD-NNNN)
    type TEXT NOT NULL DEFAULT 'sales',       -- sales/purchase/credit_note
    order_id INTEGER,                         -- 關聯銷售訂單
    po_id INTEGER,                            -- 關聯採購單
    member_id INTEGER,                        -- 客戶 (會員)
    supplier_id INTEGER,                      -- 供應商
    buyer_name TEXT,                          -- 買受人名稱
    buyer_tax_id TEXT,                        -- 買受人統編
    buyer_address TEXT,                       -- 買受人地址
    subtotal INTEGER NOT NULL,                -- 未稅金額
    tax_rate REAL DEFAULT 0.05,               -- 稅率 (5%)
    tax_amount INTEGER NOT NULL,              -- 稅額
    total_amount INTEGER NOT NULL,            -- 含稅總額
    status TEXT DEFAULT 'issued',             -- draft/issued/paid/voided
    issued_date TEXT NOT NULL,                -- 開立日期
    due_date TEXT,                            -- 付款期限
    note TEXT,
    voided_reason TEXT,                       -- 作廢原因
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- ─── 發票明細 ────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER,
    description TEXT NOT NULL,                -- 品名
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,              -- 單價
    subtotal INTEGER NOT NULL,                -- 小計 (未稅)
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ─── BOM 表頭 (成品) ─────────────────────────
CREATE TABLE IF NOT EXISTS bom_headers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL UNIQUE,       -- 成品 (對應 products 表)
    bom_code TEXT UNIQUE NOT NULL,            -- BOM編號 (BOM-XXX)
    version TEXT DEFAULT '1.0',               -- 版本
    description TEXT,
    yield_qty INTEGER DEFAULT 1,              -- 每批產出數量
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ─── BOM 明細 (原料/零件，一階) ────────────────
CREATE TABLE IF NOT EXISTS bom_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bom_id INTEGER NOT NULL,
    material_product_id INTEGER NOT NULL,     -- 原料 (也是 products 表中的品項)
    quantity REAL NOT NULL,                    -- 用量 (支援小數)
    unit TEXT DEFAULT 'pcs',                  -- 單位 (pcs/kg/g/m/L...)
    waste_rate REAL DEFAULT 0,                -- 損耗率 (0.05 = 5%)
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (bom_id) REFERENCES bom_headers(id),
    FOREIGN KEY (material_product_id) REFERENCES products(id)
);

-- ─── BOM 生產工單 ────────────────────────────
CREATE TABLE IF NOT EXISTS production_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wo_number TEXT UNIQUE NOT NULL,           -- 工單號 (WO-YYYYMMDD-NNNN)
    bom_id INTEGER NOT NULL,
    planned_qty INTEGER NOT NULL,             -- 計劃生產數量
    actual_qty INTEGER DEFAULT 0,             -- 實際產出數量
    status TEXT DEFAULT 'draft',              -- draft/in_progress/completed/cancelled
    started_at DATETIME,
    completed_at DATETIME,
    note TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bom_id) REFERENCES bom_headers(id)
);

-- ─── 索引 ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_type ON inventory_transactions(type);
CREATE INDEX IF NOT EXISTS idx_fin_txn_date ON finance_transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_fin_txn_type ON finance_transactions(type);
CREATE INDEX IF NOT EXISTS idx_payables_supplier ON payables(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bom_product ON bom_headers(product_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_bom ON production_orders(bom_id);
