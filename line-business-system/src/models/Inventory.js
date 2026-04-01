/**
 * 庫存管理模型
 */
const { getDb } = require('../../config/database');

class Inventory {
    /** 取得庫存總覽 (含安全庫存警示) */
    static getSummary({ page = 1, limit = 20, search = '', lowStock = false } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = 'WHERE p.is_active = 1';
        const params = [];

        if (search) {
            where += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (lowStock) {
            where += ' AND p.stock < 10';
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM products p ${where}`).get(...params).c;
        const items = db.prepare(`
            SELECT p.id, p.sku, p.name, p.stock, p.price, p.category_id,
                   c.name as category_name,
                   (SELECT COALESCE(SUM(CASE WHEN it.quantity > 0 THEN it.quantity ELSE 0 END), 0)
                    FROM inventory_transactions it WHERE it.product_id = p.id) as total_in,
                   (SELECT COALESCE(SUM(CASE WHEN it.quantity < 0 THEN ABS(it.quantity) ELSE 0 END), 0)
                    FROM inventory_transactions it WHERE it.product_id = p.id) as total_out
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${where}
            ORDER BY p.stock ASC, p.name ASC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { items, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 取得某商品的庫存異動紀錄 */
    static getTransactions(productId, { page = 1, limit = 30 } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;

        const total = db.prepare('SELECT COUNT(*) as c FROM inventory_transactions WHERE product_id = ?').get(productId).c;
        const transactions = db.prepare(`
            SELECT * FROM inventory_transactions
            WHERE product_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(productId, limit, offset);

        return { transactions, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 手動調整庫存 */
    static adjust(productId, quantity, note, createdBy) {
        const db = getDb();

        const doAdjust = db.transaction(() => {
            const product = db.prepare('SELECT id, stock, name FROM products WHERE id = ?').get(productId);
            if (!product) throw new Error('商品不存在');

            const beforeQty = product.stock;
            const afterQty = beforeQty + quantity;
            if (afterQty < 0) throw new Error('調整後庫存不可為負數');

            db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(afterQty, productId);

            db.prepare(`
                INSERT INTO inventory_transactions (product_id, type, quantity, before_qty, after_qty, reference_type, reference_id, note, created_by)
                VALUES (?, 'adjust', ?, ?, ?, 'adjust', NULL, ?, ?)
            `).run(productId, quantity, beforeQty, afterQty, note || '手動調整', createdBy);

            return { productId, productName: product.name, beforeQty, afterQty, delta: quantity };
        });

        return doAdjust();
    }

    /** 庫存價值報表 */
    static getValuationReport() {
        const db = getDb();
        return db.prepare(`
            SELECT p.id, p.sku, p.name, p.stock, p.price,
                   (p.stock * p.price) as stock_value,
                   c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND p.stock > 0
            ORDER BY stock_value DESC
        `).all();
    }

    /** 異動類型中文標籤 */
    static getTypeLabel(type) {
        const labels = {
            purchase_in: '採購入庫', sale_out: '銷售出庫', adjust: '手動調整',
            bom_consume: 'BOM 領料', bom_produce: 'BOM 產出',
            return_in: '退貨入庫', return_out: '退貨出庫',
        };
        return labels[type] || type;
    }
}

module.exports = Inventory;
