/**
 * BOM (物料清單) + 生產工單 API 路由
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const BOM = require('../models/BOM');

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
// BOM 管理
// ══════════════════════════════════════════════
router.get('/', auth, (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    res.json(BOM.findAll({ page: +page, limit: +limit, search }));
});

router.get('/:id', auth, (req, res) => {
    const bom = BOM.findById(+req.params.id);
    if (!bom) return res.status(404).json({ error: 'BOM 不存在' });
    res.json(bom);
});

router.get('/product/:productId', auth, (req, res) => {
    const bom = BOM.findByProductId(+req.params.productId);
    if (!bom) return res.status(404).json({ error: '該商品無 BOM 資料' });
    res.json(bom);
});

router.post('/', auth, (req, res) => {
    try {
        const bom = BOM.create(req.body);
        res.status(201).json(bom);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', auth, (req, res) => {
    try {
        const bom = BOM.update(+req.params.id, req.body);
        res.json(bom);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id/items', auth, (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items)) return res.status(400).json({ error: '請提供物料清單' });
        const bom = BOM.updateItems(+req.params.id, items);
        res.json(bom);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── BOM 成本計算 ──────────────────────────────
router.get('/:id/cost', auth, (req, res) => {
    try {
        const { quantity = 1 } = req.query;
        const cost = BOM.calculateCost(+req.params.id, +quantity);
        res.json(cost);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ══════════════════════════════════════════════
// 生產工單
// ══════════════════════════════════════════════
router.get('/production-orders/list', auth, (req, res) => {
    const { page = 1, limit = 20, status = '' } = req.query;
    res.json(BOM.findAllProductionOrders({ page: +page, limit: +limit, status }));
});

router.get('/production-orders/:id', auth, (req, res) => {
    const wo = BOM.findProductionOrder(+req.params.id);
    if (!wo) return res.status(404).json({ error: '工單不存在' });
    res.json(wo);
});

router.post('/production-orders', auth, (req, res) => {
    try {
        const wo = BOM.createProductionOrder({ ...req.body, createdBy: req.admin.id });
        res.status(201).json(wo);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/production-orders/:id/complete', auth, (req, res) => {
    try {
        const { actualQty } = req.body;
        const wo = BOM.completeProductionOrder(+req.params.id, actualQty, req.admin.id);
        res.json(wo);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
