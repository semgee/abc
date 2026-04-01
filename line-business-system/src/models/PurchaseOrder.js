/**
 * 採購單模型
 */
const { getDb } = require('../../config/database');

class PurchaseOrder {
    /** 產生採購單號 */
    static generatePONumber() {
        const db = getDb();
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = db.prepare("SELECT COUNT(*) as c FROM purchase_orders WHERE po_number LIKE ?")
            .get(`PO-${dateStr}-%`).c;
        return `PO-${dateStr}-${String(count + 1).padStart(4, '0')}`;
    }

    /**
     * 建立採購單
     * @param {object} params
     * @param {number} params.supplierId
     * @param {Array} params.items - [{productId, quantity, unitCost}]
     * @param {string} params.expectedDate
     * @param {string} params.note
     * @param {number} params.createdBy
     */
    static create({ supplierId, items, expectedDate, note, createdBy }) {
        const db = getDb();

        const insertPO = db.transaction(() => {
            const poNumber = PurchaseOrder.generatePONumber();
            let totalAmount = 0;

            for (const item of items) {
                totalAmount += item.unitCost * item.quantity;
            }

            const taxAmount = Math.round(totalAmount * 0.05);
            const grandTotal = totalAmount + taxAmount;

            const result = db.prepare(`
                INSERT INTO purchase_orders (po_number, supplier_id, total_amount, tax_amount, grand_total, expected_date, note, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(poNumber, supplierId, totalAmount, taxAmount, grandTotal, expectedDate, note, createdBy);

            const poId = result.lastInsertRowid;

            for (const item of items) {
                db.prepare(`
                    INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost, subtotal)
                    VALUES (?, ?, ?, ?, ?)
                `).run(poId, item.productId, item.quantity, item.unitCost, item.unitCost * item.quantity);
            }

            return PurchaseOrder.findById(poId);
        });

        return insertPO();
    }

    /** 確認採購單 */
    static confirm(id) {
        const db = getDb();
        db.prepare("UPDATE purchase_orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'").run(id);
        return PurchaseOrder.findById(id);
    }

    /** 收貨 */
    static receive(id, receivedItems) {
        const db = getDb();
        const po = PurchaseOrder.findById(id);
        if (!po || (po.status !== 'confirmed' && po.status !== 'partial_received')) {
            throw new Error('採購單狀態不允許收貨');
        }

        const doReceive = db.transaction(() => {
            let allReceived = true;

            for (const ri of receivedItems) {
                const poItem = db.prepare('SELECT * FROM purchase_order_items WHERE id = ? AND po_id = ?').get(ri.itemId, id);
                if (!poItem) continue;

                const newReceivedQty = poItem.received_qty + ri.quantity;
                db.prepare('UPDATE purchase_order_items SET received_qty = ? WHERE id = ?').run(newReceivedQty, ri.itemId);

                // 更新庫存
                const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(poItem.product_id);
                const beforeQty = product.stock;
                const afterQty = beforeQty + ri.quantity;
                db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(afterQty, poItem.product_id);

                // 記錄庫存異動
                db.prepare(`
                    INSERT INTO inventory_transactions (product_id, type, quantity, before_qty, after_qty, unit_cost, reference_type, reference_id, note)
                    VALUES (?, 'purchase_in', ?, ?, ?, ?, 'po', ?, ?)
                `).run(poItem.product_id, ri.quantity, beforeQty, afterQty, poItem.unit_cost, po.po_number, `採購入庫 ${po.po_number}`);

                if (newReceivedQty < poItem.quantity) allReceived = false;
            }

            // 檢查所有品項是否都收齊
            const remaining = db.prepare('SELECT COUNT(*) as c FROM purchase_order_items WHERE po_id = ? AND received_qty < quantity').get(id).c;
            const newStatus = remaining === 0 ? 'received' : 'partial_received';
            db.prepare("UPDATE purchase_orders SET status = ?, received_date = CASE WHEN ? = 'received' THEN date('now') ELSE received_date END, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .run(newStatus, newStatus, id);

            return PurchaseOrder.findById(id);
        });

        return doReceive();
    }

    static findById(id) {
        const db = getDb();
        const po = db.prepare(`
            SELECT po.*, s.name as supplier_name, s.code as supplier_code
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            WHERE po.id = ?
        `).get(id);
        if (po) {
            po.items = db.prepare(`
                SELECT poi.*, p.name as product_name, p.sku
                FROM purchase_order_items poi
                JOIN products p ON poi.product_id = p.id
                WHERE poi.po_id = ?
            `).all(id);
        }
        return po;
    }

    static findAll({ page = 1, limit = 20, status = '', search = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];

        if (status) { where += ' AND po.status = ?'; params.push(status); }
        if (search) {
            where += ' AND (po.po_number LIKE ? OR s.name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id ${where}`).get(...params).c;
        const orders = db.prepare(`
            SELECT po.*, s.name as supplier_name, s.code as supplier_code
            FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id
            ${where} ORDER BY po.created_at DESC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { orders, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 取消採購單 */
    static cancel(id) {
        const db = getDb();
        db.prepare("UPDATE purchase_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('draft','confirmed')").run(id);
        return PurchaseOrder.findById(id);
    }
}

module.exports = PurchaseOrder;
