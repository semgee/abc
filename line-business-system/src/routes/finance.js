/**
 * 財務管理 API 路由
 * 包含: 會計科目、交易紀錄、應付/應收帳款、報表
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Finance = require('../models/Finance');

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
// 會計科目
// ══════════════════════════════════════════════
router.get('/accounts', auth, (req, res) => {
    res.json(Finance.getAccounts());
});

router.post('/accounts', auth, (req, res) => {
    try {
        const account = Finance.createAccount(req.body);
        res.status(201).json(account);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ══════════════════════════════════════════════
// 交易紀錄
// ══════════════════════════════════════════════
router.get('/transactions', auth, (req, res) => {
    const { page = 1, limit = 30, type = '', startDate = '', endDate = '' } = req.query;
    res.json(Finance.findAllTransactions({ page: +page, limit: +limit, type, startDate, endDate }));
});

router.get('/transactions/:id', auth, (req, res) => {
    const txn = Finance.findTransactionById(+req.params.id);
    if (!txn) return res.status(404).json({ error: '交易不存在' });
    res.json(txn);
});

router.post('/transactions', auth, (req, res) => {
    try {
        const txn = Finance.createTransaction({ ...req.body, createdBy: req.admin.id });
        res.status(201).json(txn);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/transactions/:id/void', auth, (req, res) => {
    try {
        const txn = Finance.voidTransaction(+req.params.id);
        res.json(txn);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ══════════════════════════════════════════════
// 應付帳款
// ══════════════════════════════════════════════
router.get('/payables', auth, (req, res) => {
    const { page = 1, limit = 20, status = '' } = req.query;
    res.json(Finance.findAllPayables({ page: +page, limit: +limit, status }));
});

router.post('/payables', auth, (req, res) => {
    try {
        const payable = Finance.createPayable(req.body);
        res.status(201).json(payable);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/payables/:id/pay', auth, (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ error: '請輸入有效金額' });
        const payable = Finance.payPayable(+req.params.id, +amount);
        res.json(payable);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ══════════════════════════════════════════════
// 應收帳款
// ══════════════════════════════════════════════
router.get('/receivables', auth, (req, res) => {
    const { page = 1, limit = 20, status = '' } = req.query;
    res.json(Finance.findAllReceivables({ page: +page, limit: +limit, status }));
});

router.post('/receivables', auth, (req, res) => {
    try {
        const receivable = Finance.createReceivable(req.body);
        res.status(201).json(receivable);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/receivables/:id/receive', auth, (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ error: '請輸入有效金額' });
        const receivable = Finance.receivePayment(+req.params.id, +amount);
        res.json(receivable);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ══════════════════════════════════════════════
// 財務報表
// ══════════════════════════════════════════════
router.get('/reports/profit-loss', auth, (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: '請提供起訖日期' });
    res.json(Finance.getProfitLoss(startDate, endDate));
});

router.get('/reports/cash-flow', auth, (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: '請提供起訖日期' });
    res.json(Finance.getCashFlow(startDate, endDate));
});

module.exports = router;
