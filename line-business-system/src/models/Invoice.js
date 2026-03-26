/**
 * 發票管理模型
 */
const { getDb } = require('../../config/database');

class Invoice {
    /** 產生發票號碼 */
    static generateInvoiceNumber(prefix = 'INV') {
        const db = getDb();
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE invoice_number LIKE ?")
            .get(`${prefix}-${dateStr}-%`).c;
        return `${prefix}-${dateStr}-${String(count + 1).padStart(4, '0')}`;
    }

    /**
     * 開立銷售發票 (從訂單)
     */
    static createFromOrder(orderId, { buyerName, buyerTaxId, buyerAddress, taxRate = 0.05, createdBy } = {}) {
        const db = getDb();

        const doCreate = db.transaction(() => {
            const order = db.prepare(`
                SELECT o.*, m.display_name, m.email, m.address
                FROM orders o JOIN members m ON o.member_id = m.id
                WHERE o.id = ?
            `).get(orderId);
            if (!order) throw new Error('訂單不存在');

            // 檢查是否已開過發票
            const existing = db.prepare('SELECT id FROM invoices WHERE order_id = ? AND type = ? AND status != ?')
                .get(orderId, 'sales', 'voided');
            if (existing) throw new Error('此訂單已開立發票');

            const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

            const subtotal = order.total_amount;
            const taxAmount = Math.round(subtotal * taxRate);
            const totalAmount = subtotal + taxAmount;
            const invoiceNumber = Invoice.generateInvoiceNumber('INV');
            const issuedDate = new Date().toISOString().slice(0, 10);

            const result = db.prepare(`
                INSERT INTO invoices (invoice_number, type, order_id, member_id, buyer_name, buyer_tax_id, buyer_address,
                    subtotal, tax_rate, tax_amount, total_amount, status, issued_date, created_by)
                VALUES (?, 'sales', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?)
            `).run(invoiceNumber, orderId, order.member_id,
                buyerName || order.display_name, buyerTaxId || null, buyerAddress || order.address,
                subtotal, taxRate, taxAmount, totalAmount, issuedDate, createdBy);

            const invoiceId = result.lastInsertRowid;

            for (const item of orderItems) {
                db.prepare(`
                    INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price, subtotal)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(invoiceId, item.product_id, item.product_name, item.quantity, item.unit_price, item.subtotal);
            }

            return Invoice.findById(invoiceId);
        });

        return doCreate();
    }

    /**
     * 開立採購發票 (進貨)
     */
    static createFromPO(poId, { invoiceNumber: supplierInvNum, taxRate = 0.05, createdBy } = {}) {
        const db = getDb();

        const doCreate = db.transaction(() => {
            const po = db.prepare(`
                SELECT po.*, s.name as supplier_name, s.tax_id as supplier_tax_id, s.address as supplier_address
                FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id
                WHERE po.id = ?
            `).get(poId);
            if (!po) throw new Error('採購單不存在');

            const poItems = db.prepare(`
                SELECT poi.*, p.name as product_name
                FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id
                WHERE poi.po_id = ?
            `).all(poId);

            const invoiceNumber = Invoice.generateInvoiceNumber('PINV');
            const issuedDate = new Date().toISOString().slice(0, 10);

            const result = db.prepare(`
                INSERT INTO invoices (invoice_number, type, po_id, supplier_id, buyer_name, buyer_tax_id,
                    subtotal, tax_rate, tax_amount, total_amount, status, issued_date, note, created_by)
                VALUES (?, 'purchase', ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)
            `).run(invoiceNumber, poId, po.supplier_id,
                po.supplier_name, po.supplier_tax_id,
                po.total_amount, taxRate, po.tax_amount, po.grand_total,
                issuedDate, supplierInvNum ? `供應商發票: ${supplierInvNum}` : null, createdBy);

            const invoiceId = result.lastInsertRowid;

            for (const item of poItems) {
                db.prepare(`
                    INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price, subtotal)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(invoiceId, item.product_id, item.product_name, item.quantity, item.unit_cost, item.subtotal);
            }

            return Invoice.findById(invoiceId);
        });

        return doCreate();
    }

    /**
     * 手動開立發票
     */
    static create({ type = 'sales', buyerName, buyerTaxId, buyerAddress, memberId, supplierId,
                     items, taxRate = 0.05, dueDate, note, createdBy }) {
        const db = getDb();

        const doCreate = db.transaction(() => {
            let subtotal = 0;
            for (const item of items) {
                subtotal += item.unitPrice * item.quantity;
            }
            const taxAmount = Math.round(subtotal * taxRate);
            const totalAmount = subtotal + taxAmount;
            const prefix = type === 'sales' ? 'INV' : type === 'credit_note' ? 'CN' : 'PINV';
            const invoiceNumber = Invoice.generateInvoiceNumber(prefix);
            const issuedDate = new Date().toISOString().slice(0, 10);

            const result = db.prepare(`
                INSERT INTO invoices (invoice_number, type, member_id, supplier_id, buyer_name, buyer_tax_id, buyer_address,
                    subtotal, tax_rate, tax_amount, total_amount, status, issued_date, due_date, note, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?)
            `).run(invoiceNumber, type, memberId || null, supplierId || null,
                buyerName, buyerTaxId || null, buyerAddress || null,
                subtotal, taxRate, taxAmount, totalAmount, issuedDate, dueDate || null, note || null, createdBy);

            const invoiceId = result.lastInsertRowid;

            for (const item of items) {
                db.prepare(`
                    INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price, subtotal)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(invoiceId, item.productId || null, item.description, item.quantity, item.unitPrice, item.unitPrice * item.quantity);
            }

            return Invoice.findById(invoiceId);
        });

        return doCreate();
    }

    static findById(id) {
        const db = getDb();
        const invoice = db.prepare(`
            SELECT inv.*,
                   m.display_name as member_name,
                   s.name as supplier_name
            FROM invoices inv
            LEFT JOIN members m ON inv.member_id = m.id
            LEFT JOIN suppliers s ON inv.supplier_id = s.id
            WHERE inv.id = ?
        `).get(id);
        if (invoice) {
            invoice.items = db.prepare(`
                SELECT ii.*, p.sku as product_sku
                FROM invoice_items ii
                LEFT JOIN products p ON ii.product_id = p.id
                WHERE ii.invoice_id = ?
            `).all(id);
        }
        return invoice;
    }

    static findAll({ page = 1, limit = 20, type = '', status = '', search = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];

        if (type) { where += ' AND inv.type = ?'; params.push(type); }
        if (status) { where += ' AND inv.status = ?'; params.push(status); }
        if (search) {
            where += ' AND (inv.invoice_number LIKE ? OR inv.buyer_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM invoices inv ${where}`).get(...params).c;
        const invoices = db.prepare(`
            SELECT inv.*, m.display_name as member_name, s.name as supplier_name
            FROM invoices inv
            LEFT JOIN members m ON inv.member_id = m.id
            LEFT JOIN suppliers s ON inv.supplier_id = s.id
            ${where} ORDER BY inv.created_at DESC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { invoices, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 作廢發票 */
    static void(id, reason) {
        const db = getDb();
        db.prepare("UPDATE invoices SET status = 'voided', voided_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(reason, id);
        return Invoice.findById(id);
    }

    /** 標記已付款 */
    static markPaid(id) {
        const db = getDb();
        db.prepare("UPDATE invoices SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        return Invoice.findById(id);
    }

    /** 發票統計 */
    static getStats(startDate, endDate) {
        const db = getDb();
        return {
            salesTotal: db.prepare(`
                SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
                FROM invoices WHERE type = 'sales' AND status != 'voided' AND issued_date BETWEEN ? AND ?
            `).get(startDate, endDate),
            purchaseTotal: db.prepare(`
                SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
                FROM invoices WHERE type = 'purchase' AND status != 'voided' AND issued_date BETWEEN ? AND ?
            `).get(startDate, endDate),
            voidedCount: db.prepare(`
                SELECT COUNT(*) as count FROM invoices WHERE status = 'voided' AND issued_date BETWEEN ? AND ?
            `).get(startDate, endDate).count,
        };
    }
}

module.exports = Invoice;
