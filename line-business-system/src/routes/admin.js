/**
 * 管理後台 API 路由
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Member = require('../models/Member');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { getDb } = require('../../config/database');

// JWT 驗證 Middleware
function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.session?.adminToken;
    if (!token) return res.status(401).json({ error: '請先登入' });

    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        next();
    } catch {
        res.status(401).json({ error: 'Token 無效，請重新登入' });
    }
}

// ══════════════════════════════════════════════
// 登入
// ══════════════════════════════════════════════
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const token = jwt.sign(
        { id: admin.id, username: admin.username, role: admin.role },
        process.env.JWT_SECRET || 'default_secret',
        { expiresIn: '8h' }
    );

    req.session.adminToken = token;
    res.json({ token, username: admin.username, role: admin.role });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: '已登出' });
});

// ══════════════════════════════════════════════
// 儀表板統計
// ══════════════════════════════════════════════
router.get('/dashboard', authMiddleware, (req, res) => {
    const db = getDb();

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    const stats = {
        // 會員統計
        totalMembers: db.prepare('SELECT COUNT(*) as c FROM members WHERE is_blocked = 0').get().c,
        newMembersToday: db.prepare("SELECT COUNT(*) as c FROM members WHERE date(followed_at) = ?").get(today).c,
        newMembersThisMonth: db.prepare("SELECT COUNT(*) as c FROM members WHERE strftime('%Y-%m', followed_at) = ?").get(thisMonth).c,

        // 訂單統計
        totalOrders: db.prepare("SELECT COUNT(*) as c FROM orders").get().c,
        ordersToday: db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = ?").get(today).c,
        pendingOrders: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c,

        // 金額統計
        revenueToday: db.prepare("SELECT COALESCE(SUM(final_amount),0) as s FROM orders WHERE date(created_at) = ? AND payment_status = 'paid'").get(today).s,
        revenueThisMonth: db.prepare("SELECT COALESCE(SUM(final_amount),0) as s FROM orders WHERE strftime('%Y-%m', created_at) = ? AND payment_status = 'paid'").get(thisMonth).s,
        totalRevenue: db.prepare("SELECT COALESCE(SUM(final_amount),0) as s FROM orders WHERE payment_status = 'paid'").get().s,

        // 商品統計
        totalProducts: db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active = 1').get().c,
        lowStockProducts: db.prepare('SELECT COUNT(*) as c FROM products WHERE stock < 10 AND is_active = 1').get().c,

        // 最近訂單
        recentOrders: db.prepare(`
            SELECT o.*, m.display_name FROM orders o
            JOIN members m ON o.member_id = m.id
            ORDER BY o.created_at DESC LIMIT 5
        `).all(),

        // 各會員等級分布
        memberLevels: db.prepare(`
            SELECT member_level, COUNT(*) as count FROM members
            WHERE is_blocked = 0 GROUP BY member_level
        `).all(),
    };

    res.json(stats);
});

// ══════════════════════════════════════════════
// 會員管理
// ══════════════════════════════════════════════
router.get('/members', authMiddleware, (req, res) => {
    const { page = 1, limit = 20, search = '', level = '' } = req.query;
    const result = Member.findAll({ page: parseInt(page), limit: parseInt(limit), search, level });
    res.json(result);
});

router.get('/members/:id', authMiddleware, (req, res) => {
    const member = Member.findById(parseInt(req.params.id));
    if (!member) return res.status(404).json({ error: '會員不存在' });

    const pointsHistory = Member.getPointsHistory(member.id, { limit: 20 });
    const { orders } = Order.findByMember(member.id, { limit: 10 });

    res.json({ member, pointsHistory, orders });
});

router.post('/members/:id/points', authMiddleware, (req, res) => {
    const { points, description } = req.body;
    if (!points || !description) return res.status(400).json({ error: '缺少參數' });

    try {
        const newBalance = Member.addPoints(
            parseInt(req.params.id),
            parseInt(points),
            'admin',
            `管理員調整: ${description}`
        );
        res.json({ balance: newBalance, message: '點數調整成功' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════
// 商品管理
// ══════════════════════════════════════════════
router.get('/products', authMiddleware, (req, res) => {
    const { page = 1, limit = 20, search = '', categoryId = '' } = req.query;
    const result = Product.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        categoryId: categoryId ? parseInt(categoryId) : null,
    });
    res.json(result);
});

router.get('/products/:id', authMiddleware, (req, res) => {
    const product = Product.findById(parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: '商品不存在' });
    res.json(product);
});

router.post('/products', authMiddleware, (req, res) => {
    try {
        const product = Product.create(req.body);
        res.status(201).json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/products/:id', authMiddleware, (req, res) => {
    try {
        const product = Product.update(parseInt(req.params.id), req.body);
        res.json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/products/:id', authMiddleware, (req, res) => {
    const db = getDb();
    db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: '商品已下架' });
});

// 取得分類
router.get('/categories', authMiddleware, (req, res) => {
    const categories = Product.getCategories();
    res.json(categories);
});

// 新增分類
router.post('/categories', authMiddleware, (req, res) => {
    const { name, parentId, displayType, icon, sortOrder } = req.body;
    const db = getDb();
    const result = db.prepare(`
        INSERT INTO categories (name, parent_id, display_type, icon, sort_order)
        VALUES (?, ?, ?, ?, ?)
    `).run(name, parentId || null, displayType || 'grid', icon || '📦', sortOrder || 0);
    res.status(201).json({ id: result.lastInsertRowid });
});

// ══════════════════════════════════════════════
// 訂單管理
// ══════════════════════════════════════════════
router.get('/orders', authMiddleware, (req, res) => {
    const { page = 1, limit = 20, status = '', search = '' } = req.query;
    const result = Order.findAll({ page: parseInt(page), limit: parseInt(limit), status, search });
    res.json(result);
});

router.get('/orders/:id', authMiddleware, (req, res) => {
    const order = Order.findById(parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: '訂單不存在' });
    res.json(order);
});

router.put('/orders/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: '無效的狀態' });

    try {
        const order = Order.updateStatus(parseInt(req.params.id), status);
        res.json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/orders/:id/confirm-payment', authMiddleware, (req, res) => {
    try {
        const order = Order.confirmPayment(parseInt(req.params.id));
        res.json({ message: '付款確認成功，點數已發放', order });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════
// 系統設定
// ══════════════════════════════════════════════
router.get('/settings', authMiddleware, (req, res) => {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings ORDER BY key').all();
    res.json(settings);
});

router.put('/settings', authMiddleware, (req, res) => {
    const db = getDb();
    const updates = req.body; // { key: value, ... }

    const updateStmt = db.prepare(
        'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
    );

    const updateMany = db.transaction((updates) => {
        for (const [key, value] of Object.entries(updates)) {
            updateStmt.run(String(value), key);
        }
    });

    updateMany(updates);
    res.json({ message: '設定已更新' });
});

module.exports = router;
