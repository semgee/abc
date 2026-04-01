/**
 * 進銷存管理 API 路由
 * 包含: 供應商、採購單、庫存管理
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');

// JWT 驗證
function auth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.session?.adminToken;
    if (!token) return res.status(401).json({ error: '請先登入' });
    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        next();
    } catch { res.status(401).json({ error: 'Token 無效' }); }
}

// ══════════════════════════════════════════════
// 供應商
// ══════════════════════════════════════════════
router.get('/suppliers', auth, (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    res.json(Supplier.findAll({ page: +page, limit: +limit, search }));
});

router.get('/suppliers/:id', auth, (req, res) => {
    const supplier = Supplier.findById(+req.params.id);
    if (!supplier) return res.status(404).json({ error: '供應商不存在' });
    res.json(supplier);
});

router.post('/suppliers', auth, (req, res) => {
    try {
        const supplier = Supplier.create(req.body);
        res.status(201).json(supplier);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/suppliers/:id', auth, (req, res) => {
    try {
        const supplier = Supplier.update(+req.params.id, req.body);
        res.json(supplier);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ══════════════════════════════════════════════
// 採購單
// ══════════════════════════════════════════════
router.get('/purchase-orders', auth, (req, res) => {
    const { page = 1, limit = 20, status = '', search = '' } = req.query;
    res.json(PurchaseOrder.findAll({ page: +page, limit: +limit, status, search }));
});

router.get('/purchase-orders/:id', auth, (req, res) => {
    const po = PurchaseOrder.findById(+req.params.id);
    if (!po) return res.status(404).json({ error: '採購單不存在' });
    res.json(po);
});

router.post('/purchase-orders', auth, (req, res) => {
    try {
        const po = PurchaseOrder.create({ ...req.body, createdBy: req.admin.id });
        res.status(201).json(po);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/purchase-orders/:id/confirm', auth, (req, res) => {
    try {
        const po = PurchaseOrder.confirm(+req.params.id);
        res.json(po);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/purchase-orders/:id/receive', auth, (req, res) => {
    try {
        const { receivedItems } = req.body; // [{itemId, quantity}]
        const po = PurchaseOrder.receive(+req.params.id, receivedItems);
        res.json(po);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/purchase-orders/:id/cancel', auth, (req, res) => {
    try {
        const po = PurchaseOrder.cancel(+req.params.id);
        res.json(po);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ══════════════════════════════════════════════
// 庫存管理
// ══════════════════════════════════════════════
router.get('/inventory', auth, (req, res) => {
    const { page = 1, limit = 20, search = '', lowStock = '' } = req.query;
    res.json(Inventory.getSummary({ page: +page, limit: +limit, search, lowStock: lowStock === 'true' }));
});

router.get('/inventory/:productId/transactions', auth, (req, res) => {
    const { page = 1, limit = 30 } = req.query;
    res.json(Inventory.getTransactions(+req.params.productId, { page: +page, limit: +limit }));
});

router.post('/inventory/adjust', auth, (req, res) => {
    try {
        const { productId, quantity, note } = req.body;
        if (!productId || quantity === undefined) return res.status(400).json({ error: '缺少必要參數' });
        const result = Inventory.adjust(+productId, +quantity, note, req.admin.id);
        res.json(result);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/inventory/valuation', auth, (req, res) => {
    const report = Inventory.getValuationReport();
    const totalValue = report.reduce((sum, r) => sum + r.stock_value, 0);
    res.json({ items: report, totalValue });
});

module.exports = router;
