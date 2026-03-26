/**
 * 財務管理模型
 */
const { getDb } = require('../../config/database');

class Finance {
    // ── 會計科目 ──────────────────────────────
    static getAccounts() {
        return getDb().prepare('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code ASC').all();
    }

    static getAccountById(id) {
        return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    }

    static createAccount({ code, name, type, parentCode }) {
        const db = getDb();
        const result = db.prepare('INSERT INTO accounts (code, name, type, parent_code) VALUES (?, ?, ?, ?)')
            .run(code, name, type, parentCode || null);
        return db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    }

    // ── 交易紀錄 ──────────────────────────────
    static generateTxnNumber() {
        const db = getDb();
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = db.prepare("SELECT COUNT(*) as c FROM finance_transactions WHERE txn_number LIKE ?")
            .get(`TXN-${dateStr}-%`).c;
        return `TXN-${dateStr}-${String(count + 1).padStart(4, '0')}`;
    }

    static createTransaction({ txnDate, type, description, debitAccountId, creditAccountId, amount, referenceType, referenceId, createdBy }) {
        const db = getDb();
        const txnNumber = Finance.generateTxnNumber();
        const result = db.prepare(`
            INSERT INTO finance_transactions (txn_number, txn_date, type, description, debit_account_id, credit_account_id, amount, reference_type, reference_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(txnNumber, txnDate, type, description, debitAccountId, creditAccountId, amount, referenceType, referenceId, createdBy);
        return Finance.findTransactionById(result.lastInsertRowid);
    }

    static findTransactionById(id) {
        return getDb().prepare(`
            SELECT ft.*,
                   da.code as debit_code, da.name as debit_name,
                   ca.code as credit_code, ca.name as credit_name
            FROM finance_transactions ft
            LEFT JOIN accounts da ON ft.debit_account_id = da.id
            LEFT JOIN accounts ca ON ft.credit_account_id = ca.id
            WHERE ft.id = ?
        `).get(id);
    }

    static findAllTransactions({ page = 1, limit = 30, type = '', startDate = '', endDate = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = "WHERE ft.status != 'voided'";
        const params = [];

        if (type) { where += ' AND ft.type = ?'; params.push(type); }
        if (startDate) { where += ' AND ft.txn_date >= ?'; params.push(startDate); }
        if (endDate) { where += ' AND ft.txn_date <= ?'; params.push(endDate); }

        const total = db.prepare(`SELECT COUNT(*) as c FROM finance_transactions ft ${where}`).get(...params).c;
        const transactions = db.prepare(`
            SELECT ft.*,
                   da.code as debit_code, da.name as debit_name,
                   ca.code as credit_code, ca.name as credit_name
            FROM finance_transactions ft
            LEFT JOIN accounts da ON ft.debit_account_id = da.id
            LEFT JOIN accounts ca ON ft.credit_account_id = ca.id
            ${where} ORDER BY ft.txn_date DESC, ft.id DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { transactions, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 作廢交易 */
    static voidTransaction(id) {
        const db = getDb();
        db.prepare("UPDATE finance_transactions SET status = 'voided' WHERE id = ?").run(id);
        return Finance.findTransactionById(id);
    }

    // ── 應付帳款 ──────────────────────────────
    static createPayable({ supplierId, poId, invoiceNumber, amount, dueDate, note }) {
        const db = getDb();
        const result = db.prepare(`
            INSERT INTO payables (supplier_id, po_id, invoice_number, amount, due_date, note)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(supplierId, poId, invoiceNumber, amount, dueDate, note);
        return db.prepare('SELECT * FROM payables WHERE id = ?').get(result.lastInsertRowid);
    }

    static payPayable(id, payAmount) {
        const db = getDb();
        const doPay = db.transaction(() => {
            const p = db.prepare('SELECT * FROM payables WHERE id = ?').get(id);
            if (!p) throw new Error('應付帳款不存在');

            const newPaid = p.paid_amount + payAmount;
            const status = newPaid >= p.amount ? 'paid' : 'partial';
            db.prepare('UPDATE payables SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(newPaid, status, id);
            return db.prepare('SELECT * FROM payables WHERE id = ?').get(id);
        });
        return doPay();
    }

    static findAllPayables({ page = 1, limit = 20, status = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];
        if (status) { where += ' AND p.status = ?'; params.push(status); }

        const total = db.prepare(`SELECT COUNT(*) as c FROM payables p ${where}`).get(...params).c;
        const payables = db.prepare(`
            SELECT p.*, s.name as supplier_name, s.code as supplier_code
            FROM payables p JOIN suppliers s ON p.supplier_id = s.id
            ${where} ORDER BY p.due_date ASC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { payables, total, page, totalPages: Math.ceil(total / limit) };
    }

    // ── 應收帳款 ──────────────────────────────
    static createReceivable({ memberId, orderId, invoiceId, amount, dueDate, note }) {
        const db = getDb();
        const result = db.prepare(`
            INSERT INTO receivables (member_id, order_id, invoice_id, amount, due_date, note)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(memberId, orderId, invoiceId, amount, dueDate, note);
        return db.prepare('SELECT * FROM receivables WHERE id = ?').get(result.lastInsertRowid);
    }

    static receivePayment(id, receiveAmount) {
        const db = getDb();
        const doReceive = db.transaction(() => {
            const r = db.prepare('SELECT * FROM receivables WHERE id = ?').get(id);
            if (!r) throw new Error('應收帳款不存在');

            const newReceived = r.received_amount + receiveAmount;
            const status = newReceived >= r.amount ? 'paid' : 'partial';
            db.prepare('UPDATE receivables SET received_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(newReceived, status, id);
            return db.prepare('SELECT * FROM receivables WHERE id = ?').get(id);
        });
        return doReceive();
    }

    static findAllReceivables({ page = 1, limit = 20, status = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];
        if (status) { where += ' AND r.status = ?'; params.push(status); }

        const total = db.prepare(`SELECT COUNT(*) as c FROM receivables r ${where}`).get(...params).c;
        const receivables = db.prepare(`
            SELECT r.*, m.display_name as member_name
            FROM receivables r LEFT JOIN members m ON r.member_id = m.id
            ${where} ORDER BY r.due_date ASC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { receivables, total, page, totalPages: Math.ceil(total / limit) };
    }

    // ── 報表 ──────────────────────────────────
    /** 損益表 (某段期間) */
    static getProfitLoss(startDate, endDate) {
        const db = getDb();
        const revenue = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM finance_transactions
            WHERE type = 'income' AND status = 'posted' AND txn_date BETWEEN ? AND ?
        `).get(startDate, endDate).total;

        const expense = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM finance_transactions
            WHERE type = 'expense' AND status = 'posted' AND txn_date BETWEEN ? AND ?
        `).get(startDate, endDate).total;

        // 從訂單統計銷售收入
        const salesRevenue = db.prepare(`
            SELECT COALESCE(SUM(final_amount), 0) as total
            FROM orders
            WHERE payment_status = 'paid' AND date(created_at) BETWEEN ? AND ?
        `).get(startDate, endDate).total;

        // 從採購統計成本
        const purchaseCost = db.prepare(`
            SELECT COALESCE(SUM(grand_total), 0) as total
            FROM purchase_orders
            WHERE status IN ('received', 'partial_received') AND date(created_at) BETWEEN ? AND ?
        `).get(startDate, endDate).total;

        return {
            period: { startDate, endDate },
            salesRevenue,
            otherIncome: revenue,
            totalRevenue: salesRevenue + revenue,
            purchaseCost,
            otherExpense: expense,
            totalExpense: purchaseCost + expense,
            netProfit: (salesRevenue + revenue) - (purchaseCost + expense),
        };
    }

    /** 現金流概覽 */
    static getCashFlow(startDate, endDate) {
        const db = getDb();

        const income = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions
            WHERE type = 'income' AND status = 'posted' AND txn_date BETWEEN ? AND ?
        `).get(startDate, endDate).total;

        const expense = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions
            WHERE type = 'expense' AND status = 'posted' AND txn_date BETWEEN ? AND ?
        `).get(startDate, endDate).total;

        const totalPayables = db.prepare(`SELECT COALESCE(SUM(amount - paid_amount), 0) as total FROM payables WHERE status != 'voided'`).get().total;
        const totalReceivables = db.prepare(`SELECT COALESCE(SUM(amount - received_amount), 0) as total FROM receivables WHERE status != 'voided'`).get().total;

        return { period: { startDate, endDate }, income, expense, netCashFlow: income - expense, totalPayables, totalReceivables };
    }
}

module.exports = Finance;
