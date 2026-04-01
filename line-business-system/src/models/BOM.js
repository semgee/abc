/**
 * BOM (物料清單) 模型 - 一階 BOM
 */
const { getDb } = require('../../config/database');

class BOM {
    // ── BOM 表頭 ──────────────────────────────
    static create({ productId, bomCode, version = '1.0', description, yieldQty = 1, items = [] }) {
        const db = getDb();

        const doCreate = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO bom_headers (product_id, bom_code, version, description, yield_qty)
                VALUES (?, ?, ?, ?, ?)
            `).run(productId, bomCode, version, description, yieldQty);

            const bomId = result.lastInsertRowid;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                db.prepare(`
                    INSERT INTO bom_items (bom_id, material_product_id, quantity, unit, waste_rate, note, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(bomId, item.materialProductId, item.quantity, item.unit || 'pcs', item.wasteRate || 0, item.note || null, i);
            }

            return BOM.findById(bomId);
        });

        return doCreate();
    }

    static findById(id) {
        const db = getDb();
        const bom = db.prepare(`
            SELECT bh.*, p.name as product_name, p.sku as product_sku
            FROM bom_headers bh
            JOIN products p ON bh.product_id = p.id
            WHERE bh.id = ?
        `).get(id);

        if (bom) {
            bom.items = db.prepare(`
                SELECT bi.*, p.name as material_name, p.sku as material_sku, p.stock as material_stock, p.price as material_price
                FROM bom_items bi
                JOIN products p ON bi.material_product_id = p.id
                WHERE bi.bom_id = ?
                ORDER BY bi.sort_order ASC
            `).all(id);
        }
        return bom;
    }

    static findByProductId(productId) {
        const db = getDb();
        const bom = db.prepare(`
            SELECT bh.*, p.name as product_name, p.sku as product_sku
            FROM bom_headers bh
            JOIN products p ON bh.product_id = p.id
            WHERE bh.product_id = ? AND bh.is_active = 1
        `).get(productId);

        if (bom) {
            bom.items = db.prepare(`
                SELECT bi.*, p.name as material_name, p.sku as material_sku, p.stock as material_stock, p.price as material_price
                FROM bom_items bi
                JOIN products p ON bi.material_product_id = p.id
                WHERE bi.bom_id = ?
                ORDER BY bi.sort_order ASC
            `).all(bom.id);
        }
        return bom;
    }

    static findAll({ page = 1, limit = 20, search = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = 'WHERE bh.is_active = 1';
        const params = [];

        if (search) {
            where += ' AND (bh.bom_code LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const total = db.prepare(`
            SELECT COUNT(*) as c FROM bom_headers bh JOIN products p ON bh.product_id = p.id ${where}
        `).get(...params).c;

        const boms = db.prepare(`
            SELECT bh.*, p.name as product_name, p.sku as product_sku,
                   (SELECT COUNT(*) FROM bom_items WHERE bom_id = bh.id) as item_count
            FROM bom_headers bh
            JOIN products p ON bh.product_id = p.id
            ${where}
            ORDER BY bh.bom_code ASC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { boms, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 更新 BOM 明細 (整批替換) */
    static updateItems(bomId, items) {
        const db = getDb();

        const doUpdate = db.transaction(() => {
            db.prepare('DELETE FROM bom_items WHERE bom_id = ?').run(bomId);

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                db.prepare(`
                    INSERT INTO bom_items (bom_id, material_product_id, quantity, unit, waste_rate, note, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(bomId, item.materialProductId, item.quantity, item.unit || 'pcs', item.wasteRate || 0, item.note || null, i);
            }

            db.prepare('UPDATE bom_headers SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(bomId);
            return BOM.findById(bomId);
        });

        return doUpdate();
    }

    /** 更新 BOM 表頭 */
    static update(id, data) {
        const db = getDb();
        const fields = [];
        const values = [];
        const allowed = {
            version: data.version, description: data.description,
            yield_qty: data.yieldQty, is_active: data.isActive,
        };
        for (const [k, v] of Object.entries(allowed)) {
            if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
        }
        if (fields.length === 0) return BOM.findById(id);
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        db.prepare(`UPDATE bom_headers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return BOM.findById(id);
    }

    /** 計算 BOM 成本 */
    static calculateCost(bomId, quantity = 1) {
        const bom = BOM.findById(bomId);
        if (!bom) throw new Error('BOM 不存在');

        const batches = Math.ceil(quantity / bom.yield_qty);
        let totalCost = 0;
        const details = [];

        for (const item of bom.items) {
            const requiredQty = item.quantity * batches * (1 + (item.waste_rate || 0));
            const cost = Math.ceil(requiredQty * item.material_price);
            totalCost += cost;
            details.push({
                materialId: item.material_product_id,
                materialName: item.material_name,
                materialSku: item.material_sku,
                requiredQty: Math.ceil(requiredQty),
                unit: item.unit,
                unitPrice: item.material_price,
                cost,
                currentStock: item.material_stock,
                sufficient: item.material_stock >= Math.ceil(requiredQty),
            });
        }

        return {
            bomCode: bom.bom_code,
            productName: bom.product_name,
            plannedQty: quantity,
            batches,
            yieldPerBatch: bom.yield_qty,
            totalCost,
            unitCost: Math.ceil(totalCost / quantity),
            details,
        };
    }

    // ── 生產工單 ──────────────────────────────
    static generateWONumber() {
        const db = getDb();
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = db.prepare("SELECT COUNT(*) as c FROM production_orders WHERE wo_number LIKE ?")
            .get(`WO-${dateStr}-%`).c;
        return `WO-${dateStr}-${String(count + 1).padStart(4, '0')}`;
    }

    /** 建立生產工單 (含領料扣庫存) */
    static createProductionOrder({ bomId, plannedQty, note, createdBy }) {
        const db = getDb();
        const bom = BOM.findById(bomId);
        if (!bom) throw new Error('BOM 不存在');

        const doCreate = db.transaction(() => {
            const woNumber = BOM.generateWONumber();
            const batches = Math.ceil(plannedQty / bom.yield_qty);

            // 檢查原料庫存是否足夠
            for (const item of bom.items) {
                const requiredQty = Math.ceil(item.quantity * batches * (1 + (item.waste_rate || 0)));
                if (item.material_stock < requiredQty) {
                    throw new Error(`原料 ${item.material_name} 庫存不足: 需要 ${requiredQty}, 現有 ${item.material_stock}`);
                }
            }

            // 建立工單
            const result = db.prepare(`
                INSERT INTO production_orders (wo_number, bom_id, planned_qty, status, note, created_by)
                VALUES (?, ?, ?, 'in_progress', ?, ?)
            `).run(woNumber, bomId, plannedQty, note, createdBy);

            // 扣除原料庫存 (領料)
            for (const item of bom.items) {
                const requiredQty = Math.ceil(item.quantity * batches * (1 + (item.waste_rate || 0)));
                const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.material_product_id);
                const beforeQty = product.stock;
                const afterQty = beforeQty - requiredQty;

                db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    .run(afterQty, item.material_product_id);

                db.prepare(`
                    INSERT INTO inventory_transactions (product_id, type, quantity, before_qty, after_qty, unit_cost, reference_type, reference_id, note, created_by)
                    VALUES (?, 'bom_consume', ?, ?, ?, ?, 'bom', ?, ?, ?)
                `).run(item.material_product_id, -requiredQty, beforeQty, afterQty,
                    item.material_price, woNumber, `工單 ${woNumber} 領料`, createdBy);
            }

            return BOM.findProductionOrder(result.lastInsertRowid);
        });

        return doCreate();
    }

    /** 完成生產工單 (成品入庫) */
    static completeProductionOrder(woId, actualQty, createdBy) {
        const db = getDb();

        const doComplete = db.transaction(() => {
            const wo = db.prepare(`
                SELECT po.*, bh.product_id, bh.yield_qty
                FROM production_orders po
                JOIN bom_headers bh ON po.bom_id = bh.id
                WHERE po.id = ? AND po.status = 'in_progress'
            `).get(woId);
            if (!wo) throw new Error('工單不存在或狀態不正確');

            const qty = actualQty || wo.planned_qty;

            // 成品入庫
            const product = db.prepare('SELECT stock, price FROM products WHERE id = ?').get(wo.product_id);
            const beforeQty = product.stock;
            const afterQty = beforeQty + qty;

            db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(afterQty, wo.product_id);

            db.prepare(`
                INSERT INTO inventory_transactions (product_id, type, quantity, before_qty, after_qty, reference_type, reference_id, note, created_by)
                VALUES (?, 'bom_produce', ?, ?, ?, 'bom', ?, ?, ?)
            `).run(wo.product_id, qty, beforeQty, afterQty, wo.wo_number, `工單 ${wo.wo_number} 生產入庫`, createdBy);

            // 更新工單
            db.prepare("UPDATE production_orders SET actual_qty = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .run(qty, woId);

            return BOM.findProductionOrder(woId);
        });

        return doComplete();
    }

    static findProductionOrder(id) {
        const db = getDb();
        return db.prepare(`
            SELECT po.*, bh.bom_code, bh.product_id, p.name as product_name, p.sku as product_sku
            FROM production_orders po
            JOIN bom_headers bh ON po.bom_id = bh.id
            JOIN products p ON bh.product_id = p.id
            WHERE po.id = ?
        `).get(id);
    }

    static findAllProductionOrders({ page = 1, limit = 20, status = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];
        if (status) { where += ' AND po.status = ?'; params.push(status); }

        const total = db.prepare(`
            SELECT COUNT(*) as c FROM production_orders po ${where}
        `).get(...params).c;

        const orders = db.prepare(`
            SELECT po.*, bh.bom_code, p.name as product_name, p.sku as product_sku
            FROM production_orders po
            JOIN bom_headers bh ON po.bom_id = bh.id
            JOIN products p ON bh.product_id = p.id
            ${where}
            ORDER BY po.created_at DESC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { orders, total, page, totalPages: Math.ceil(total / limit) };
    }
}

module.exports = BOM;
