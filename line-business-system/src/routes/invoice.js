/**
 * 發票管理 API 路由
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Invoice = require('../models/Invoice');

// JWT 驗證
function auth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.session?.adminToken;
    if (!token) return res.status(401).json({ error: '請先登入' });
    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        next();
    } catch { res.status(401).json({ error: 'Token 無效' }); }
}

// ── 發票列表 ──────────────────────────────────
router.get('/', auth, (req, res) => {
    const { page = 1, limit = 20, type = '', status = '', search = '' } = req.query;
    res.json(Invoice.findAll({ page: +page, limit: +limit, type, status, search }));
});

// ── 發票詳情 ──────────────────────────────────
router.get('/:id', auth, (req, res) => {
    const invoice = Invoice.findById(+req.params.id);
    if (!invoice) return res.status(404).json({ error: '發票不存在' });
    res.json(invoice);
});

// ── 從訂單開立銷售發票 ────────────────────────
router.post('/from-order', auth, (req, res) => {
    try {
        const { orderId, buyerName, buyerTaxId, buyerAddress, taxRate } = req.body;
        if (!orderId) return res.status(400).json({ error: '缺少訂單ID' });
        const invoice = Invoice.createFromOrder(+orderId, {
            buyerName, buyerTaxId, buyerAddress, taxRate, createdBy: req.admin.id,
        });
        res.status(201).json(invoice);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── 從採購單開立進貨發票 ──────────────────────
router.post('/from-po', auth, (req, res) => {
    try {
        const { poId, invoiceNumber, taxRate } = req.body;
        if (!poId) return res.status(400).json({ error: '缺少採購單ID' });
        const invoice = Invoice.createFromPO(+poId, {
            invoiceNumber, taxRate, createdBy: req.admin.id,
        });
        res.status(201).json(invoice);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── 手動開立發票 ──────────────────────────────
router.post('/', auth, (req, res) => {
    try {
        const invoice = Invoice.create({ ...req.body, createdBy: req.admin.id });
        res.status(201).json(invoice);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── 作廢發票 ──────────────────────────────────
router.post('/:id/void', auth, (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: '請填寫作廢原因' });
        const invoice = Invoice.void(+req.params.id, reason);
        res.json(invoice);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── 標記已付款 ────────────────────────────────
router.post('/:id/mark-paid', auth, (req, res) => {
    try {
        const invoice = Invoice.markPaid(+req.params.id);
        res.json(invoice);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── 發票統計 ──────────────────────────────────
router.get('/reports/stats', auth, (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: '請提供起訖日期' });
    res.json(Invoice.getStats(startDate, endDate));
});

module.exports = router;
