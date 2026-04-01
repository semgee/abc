/**
 * 供應商模型
 */
const { getDb } = require('../../config/database');

class Supplier {
    static findAll({ page = 1, limit = 20, search = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        let where = 'WHERE is_active = 1';
        const params = [];

        if (search) {
            where += ' AND (name LIKE ? OR code LIKE ? OR contact_person LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM suppliers ${where}`).get(...params).c;
        const suppliers = db.prepare(`
            SELECT * FROM suppliers ${where}
            ORDER BY code ASC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { suppliers, total, page, totalPages: Math.ceil(total / limit) };
    }

    static findById(id) {
        return getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    }

    static findByCode(code) {
        return getDb().prepare('SELECT * FROM suppliers WHERE code = ?').get(code);
    }

    static create(data) {
        const db = getDb();
        const { code, name, contactPerson, phone, email, address, taxId, paymentTerms, note } = data;
        const result = db.prepare(`
            INSERT INTO suppliers (code, name, contact_person, phone, email, address, tax_id, payment_terms, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(code, name, contactPerson, phone, email, address, taxId, paymentTerms || 30, note);
        return Supplier.findById(result.lastInsertRowid);
    }

    static update(id, data) {
        const db = getDb();
        const fields = [];
        const values = [];
        const allowed = {
            name: data.name, contact_person: data.contactPerson, phone: data.phone,
            email: data.email, address: data.address, tax_id: data.taxId,
            payment_terms: data.paymentTerms, note: data.note, is_active: data.isActive,
        };
        for (const [k, v] of Object.entries(allowed)) {
            if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
        }
        if (fields.length === 0) return Supplier.findById(id);
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return Supplier.findById(id);
    }
}

module.exports = Supplier;
