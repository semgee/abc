/**
 * 購物車模型
 */
const { getDb } = require('../../config/database');

class Cart {
    /** 取得會員的購物車 */
    static getByMember(memberId) {
        const db = getDb();
        return db.prepare(`
            SELECT c.*, p.name, p.price, p.image_url, p.stock, p.is_active
            FROM carts c
            JOIN products p ON c.product_id = p.id
            WHERE c.member_id = ? AND p.is_active = 1
            ORDER BY c.updated_at DESC
        `).all(memberId);
    }

    /** 加入購物車 */
    static addItem(memberId, productId, quantity = 1) {
        const db = getDb();
        const existing = db.prepare(
            'SELECT * FROM carts WHERE member_id = ? AND product_id = ?'
        ).get(memberId, productId);

        if (existing) {
            db.prepare(
                'UPDATE carts SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(quantity, existing.id);
        } else {
            db.prepare(
                'INSERT INTO carts (member_id, product_id, quantity) VALUES (?, ?, ?)'
            ).run(memberId, productId, quantity);
        }
    }

    /** 更新數量 */
    static updateQuantity(memberId, productId, quantity) {
        const db = getDb();
        if (quantity <= 0) {
            Cart.removeItem(memberId, productId);
        } else {
            db.prepare(
                'UPDATE carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE member_id = ? AND product_id = ?'
            ).run(quantity, memberId, productId);
        }
    }

    /** 移除商品 */
    static removeItem(memberId, productId) {
        const db = getDb();
        db.prepare('DELETE FROM carts WHERE member_id = ? AND product_id = ?').run(memberId, productId);
    }

    /** 清空購物車 */
    static clear(memberId) {
        const db = getDb();
        db.prepare('DELETE FROM carts WHERE member_id = ?').run(memberId);
    }

    /** 計算購物車總計 */
    static calcTotal(items) {
        return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    }
}

module.exports = Cart;
