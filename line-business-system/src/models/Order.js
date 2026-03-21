/**
 * 訂單模型
 */
const { getDb } = require('../../config/database');
const Member = require('./Member');
const Product = require('./Product');

class Order {
    /** 產生訂單編號 */
    static generateOrderNumber() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const db = getDb();

        // 取得今日訂單數
        const count = db.prepare(
            "SELECT COUNT(*) as c FROM orders WHERE order_number LIKE ?"
        ).get(`ORD-${dateStr}-%`).c;

        return `ORD-${dateStr}-${String(count + 1).padStart(4, '0')}`;
    }

    /**
     * 建立訂單
     * @param {object} params
     * @param {number} params.memberId
     * @param {Array} params.items - [{productId, quantity, options}]
     * @param {number} params.pointsToUse - 要使用的點數
     * @param {object} params.shipping - {name, phone, address}
     * @param {string} params.note
     */
    static create({ memberId, items, pointsToUse = 0, shipping, note = '' }) {
        const db = getDb();
        const member = Member.findById(memberId);
        if (!member) throw new Error('會員不存在');

        // 計算訂單金額
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            const product = Product.findById(item.productId);
            if (!product) throw new Error(`商品不存在: ${item.productId}`);
            if (product.stock < item.quantity) throw new Error(`商品庫存不足: ${product.name}`);

            const subtotal = product.price * item.quantity;
            totalAmount += subtotal;

            orderItems.push({
                productId: product.id,
                productName: product.name,
                productSku: product.sku,
                productImage: product.image_url,
                quantity: item.quantity,
                unitPrice: product.price,
                subtotal,
                options: JSON.stringify(item.options || {}),
                bonusRate: product.bonus_points_rate || 0.05,
            });
        }

        // 計算運費
        const freeShippingThreshold = parseInt(
            db.prepare("SELECT value FROM settings WHERE key = 'free_shipping_threshold'").get()?.value || 500
        );
        const shippingFee = totalAmount >= freeShippingThreshold ? 0 : parseInt(
            db.prepare("SELECT value FROM settings WHERE key = 'shipping_fee'").get()?.value || 60
        );

        // 計算點數折抵
        const pointsValue = parseInt(
            db.prepare("SELECT value FROM settings WHERE key = 'points_value'").get()?.value || 1
        );
        const maxPointsUse = Math.min(pointsToUse, member.bonus_points);
        const pointsDiscount = maxPointsUse * pointsValue;
        const finalAmount = Math.max(0, totalAmount + shippingFee - pointsDiscount);

        // 計算本單獲得點數
        const bonusPointsEarned = orderItems.reduce((acc, item) => {
            return acc + Math.floor(item.subtotal * item.bonusRate);
        }, 0);

        // 使用交易確保原子性
        const insertOrder = db.transaction(() => {
            const orderNumber = Order.generateOrderNumber();

            // 建立訂單
            const orderResult = db.prepare(`
                INSERT INTO orders
                    (order_number, member_id, total_amount, discount_amount, points_used,
                     points_used_amount, shipping_fee, final_amount, bonus_points_earned,
                     shipping_name, shipping_phone, shipping_address, note, status, payment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')
            `).run(
                orderNumber, memberId, totalAmount, 0, maxPointsUse,
                pointsDiscount, shippingFee, finalAmount, bonusPointsEarned,
                shipping?.name || member.display_name,
                shipping?.phone || member.phone,
                shipping?.address || member.address,
                note
            );

            const orderId = orderResult.lastInsertRowid;

            // 建立訂單明細
            for (const item of orderItems) {
                db.prepare(`
                    INSERT INTO order_items
                        (order_id, product_id, product_name, product_sku, product_image,
                         quantity, unit_price, subtotal, options)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(orderId, item.productId, item.productName, item.productSku,
                       item.productImage, item.quantity, item.unitPrice, item.subtotal, item.options);

                // 扣除庫存
                Product.updateStock(item.productId, -item.quantity);
            }

            // 扣除使用的點數
            if (maxPointsUse > 0) {
                Member.addPoints(memberId, -maxPointsUse, 'redeem', `訂單 ${orderNumber} 點數折抵`, orderNumber);
            }

            return Order.findByNumber(orderNumber);
        });

        return insertOrder();
    }

    /** 確認付款並發放點數 */
    static confirmPayment(orderId) {
        const db = getDb();
        const order = Order.findById(orderId);
        if (!order) throw new Error('訂單不存在');

        db.prepare(`
            UPDATE orders
            SET payment_status = 'paid', status = 'confirmed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(orderId);

        // 發放購物點數
        if (order.bonus_points_earned > 0) {
            Member.addPoints(
                order.member_id,
                order.bonus_points_earned,
                'purchase',
                `訂單 ${order.order_number} 消費回饋`,
                order.order_number
            );
        }

        // 更新會員等級
        Member.updateLevel(order.member_id);

        return Order.findById(orderId);
    }

    /** 更新訂單狀態 */
    static updateStatus(orderId, status) {
        const db = getDb();
        db.prepare(`
            UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(status, orderId);
        return Order.findById(orderId);
    }

    /** 依ID查訂單 */
    static findById(id) {
        const db = getDb();
        const order = db.prepare(`
            SELECT o.*, m.display_name, m.line_user_id
            FROM orders o
            JOIN members m ON o.member_id = m.id
            WHERE o.id = ?
        `).get(id);

        if (order) {
            order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
        }
        return order;
    }

    /** 依訂單編號查詢 */
    static findByNumber(orderNumber) {
        const db = getDb();
        const order = db.prepare(`
            SELECT o.*, m.display_name, m.line_user_id
            FROM orders o
            JOIN members m ON o.member_id = m.id
            WHERE o.order_number = ?
        `).get(orderNumber);

        if (order) {
            order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
        }
        return order;
    }

    /** 取得會員的訂單列表 */
    static findByMember(memberId, { page = 1, limit = 10 } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;

        const total = db.prepare('SELECT COUNT(*) as c FROM orders WHERE member_id = ?').get(memberId).c;
        const orders = db.prepare(`
            SELECT * FROM orders WHERE member_id = ?
            ORDER BY created_at DESC LIMIT ? OFFSET ?
        `).all(memberId, limit, offset);

        return { orders, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 取得所有訂單 (後台用) */
    static findAll({ page = 1, limit = 20, status = '', search = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];

        if (status) {
            where += ' AND o.status = ?';
            params.push(status);
        }
        if (search) {
            where += ' AND (o.order_number LIKE ? OR m.display_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const total = db.prepare(`
            SELECT COUNT(*) as c FROM orders o
            JOIN members m ON o.member_id = m.id ${where}
        `).get(...params).c;

        const orders = db.prepare(`
            SELECT o.*, m.display_name, m.picture_url
            FROM orders o
            JOIN members m ON o.member_id = m.id
            ${where}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { orders, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 取得訂單狀態標籤 */
    static getStatusLabel(status) {
        const labels = {
            pending: '待付款',
            confirmed: '已確認',
            shipping: '配送中',
            delivered: '已送達',
            cancelled: '已取消',
            refunded: '已退款',
        };
        return labels[status] || status;
    }

    /** 取得訂單狀態顏色 */
    static getStatusColor(status) {
        const colors = {
            pending: '#FFA500',
            confirmed: '#4169E1',
            shipping: '#20B2AA',
            delivered: '#32CD32',
            cancelled: '#DC143C',
            refunded: '#808080',
        };
        return colors[status] || '#808080';
    }
}

module.exports = Order;
