/**
 * LINE Webhook 路由
 * 處理所有來自 LINE 的事件
 */
const express = require('express');
const line = require('@line/bot-sdk');
const router = express.Router();

const { lineConfig, lineClient } = require('../../config/line');
const Member = require('../models/Member');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { getDb } = require('../../config/database');
const flex = require('../services/flexMessages');

// LINE Webhook 驗證 Middleware
router.post('/', line.middleware(lineConfig), async (req, res) => {
    res.json({ status: 'ok' });  // 必須立即回應 200

    const events = req.body.events;
    for (const event of events) {
        try {
            await handleEvent(event);
        } catch (err) {
            console.error('❌ 處理 Event 失敗:', err.message, event);
        }
    }
});

/**
 * 事件總路由
 */
async function handleEvent(event) {
    const { type, source, replyToken } = event;
    const lineUserId = source?.userId;
    if (!lineUserId) return;

    switch (type) {
        case 'follow':
            return handleFollow(event);
        case 'unfollow':
            return handleUnfollow(event);
        case 'message':
            return handleMessage(event);
        case 'postback':
            return handlePostback(event);
        default:
            console.log(`未處理的事件類型: ${type}`);
    }
}

/**
 * 加入好友事件
 * - 取得用戶 LINE 資料
 * - 建立或更新會員
 * - 發送歡迎訊息與歡迎點數
 */
async function handleFollow(event) {
    const { replyToken, source } = event;
    const lineUserId = source.userId;

    // 從 LINE API 取得用戶資料
    const profile = await lineClient.getProfile(lineUserId);

    // 建立或找到會員
    const member = Member.findOrCreate({
        userId: lineUserId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
    });

    // 取得設定
    const db = getDb();
    const shopName = db.prepare("SELECT value FROM settings WHERE key = 'shop_name'").get()?.value || '我的商店';
    const welcomePoints = parseInt(
        db.prepare("SELECT value FROM settings WHERE key = 'welcome_bonus_points'").get()?.value || 100
    );

    // 發送歡迎訊息
    await lineClient.replyMessage({
        replyToken,
        messages: [
            {
                type: 'flex',
                altText: `歡迎加入 ${shopName}！您獲得了 ${welcomePoints} 點歡迎禮`,
                contents: flex.buildWelcomeMessage(member, shopName, welcomePoints),
            },
        ],
    });
}

/**
 * 封鎖事件
 */
async function handleUnfollow(event) {
    const { source } = event;
    const db = getDb();
    db.prepare('UPDATE members SET is_blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE line_user_id = ?')
      .run(source.userId);
    console.log(`用戶封鎖: ${source.userId}`);
}

/**
 * 文字訊息事件
 */
async function handleMessage(event) {
    const { replyToken, message, source } = event;
    if (message.type !== 'text') return;

    const text = message.text.trim();
    const lineUserId = source.userId;
    const member = Member.findByLineId(lineUserId);
    if (!member) return;

    // 關鍵字觸發
    if (['商品', '購物', '目錄', '型錄'].some(k => text.includes(k))) {
        return sendCatalog(replyToken, member);
    }
    if (['分類', '類別'].some(k => text.includes(k))) {
        return sendCategories(replyToken);
    }
    if (['購物車', '我的購物車'].some(k => text.includes(k))) {
        return sendCart(replyToken, member);
    }
    if (['訂單', '我的訂單', '查詢訂單'].some(k => text.includes(k))) {
        return sendMyOrders(replyToken, member);
    }
    if (['會員', '我的資料', '點數', '紅利'].some(k => text.includes(k))) {
        return sendMemberCard(replyToken, member);
    }

    // 預設回覆
    await lineClient.replyMessage({
        replyToken,
        messages: [{
            type: 'text',
            text: '您好！請使用下方選單或輸入以下關鍵字：\n\n🛍️ 商品 - 瀏覽商品\n📁 分類 - 商品分類\n🛒 購物車 - 查看購物車\n📦 訂單 - 查看訂單\n👤 會員 - 我的資料',
        }],
    });
}

/**
 * Postback 事件 (按鈕點擊)
 */
async function handlePostback(event) {
    const { replyToken, postback, source } = event;
    const params = new URLSearchParams(postback.data);
    const action = params.get('action');
    const lineUserId = source.userId;

    const member = Member.findByLineId(lineUserId);
    if (!member) return;

    switch (action) {
        case 'catalog':
            return sendCatalog(replyToken, member);

        case 'categories':
            return sendCategories(replyToken);

        case 'category': {
            const categoryId = parseInt(params.get('category_id'));
            return sendCategoryProducts(replyToken, categoryId);
        }

        case 'product_detail': {
            const productId = parseInt(params.get('product_id'));
            return sendProductDetail(replyToken, productId);
        }

        case 'add_to_cart': {
            const productId = parseInt(params.get('product_id'));
            return addToCart(replyToken, member, productId);
        }

        case 'cart':
            return sendCart(replyToken, member);

        case 'cart_checkout':
            return sendCheckout(replyToken, member);

        case 'my_orders':
            return sendMyOrders(replyToken, member);

        case 'my_profile':
            return sendMemberCard(replyToken, member);

        case 'points_history':
            return sendPointsHistory(replyToken, member);

        default:
            await lineClient.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: '操作未找到，請重新嘗試。' }],
            });
    }
}

// ── 各功能實作 ──────────────────────────────────

/** 發送商品目錄 (格狀) */
async function sendCatalog(replyToken, member) {
    const { products } = Product.findAll({ limit: 12 });
    const carousels = flex.buildProductGridCarousel(products, '精選商品');

    await lineClient.replyMessage({
        replyToken,
        messages: [
            { type: 'text', text: '以下是我們的精選商品 👇' },
            ...carousels.map(c => ({
                type: 'flex',
                altText: '商品目錄',
                contents: c,
            })),
        ],
    });
}

/** 發送分類選單 */
async function sendCategories(replyToken) {
    const categories = Product.getCategories();
    await lineClient.replyMessage({
        replyToken,
        messages: [{
            type: 'flex',
            altText: '商品分類',
            contents: flex.buildCategoryMenuBubble(categories),
        }],
    });
}

/** 依分類發送商品列表 */
async function sendCategoryProducts(replyToken, categoryId) {
    const products = Product.findByCategory(categoryId);
    const db = getDb();
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);

    if (!products.length) {
        return lineClient.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '此分類目前沒有商品' }],
        });
    }

    const title = category ? `${category.icon || ''} ${category.name}` : '商品列表';

    // 依分類設定顯示方式
    const displayType = category?.display_type || 'grid';

    await lineClient.replyMessage({
        replyToken,
        messages: displayType === 'list'
            ? [{
                type: 'flex',
                altText: title,
                contents: flex.buildProductListBubble(products, title),
            }]
            : flex.buildProductGridCarousel(products, title).map(c => ({
                type: 'flex',
                altText: title,
                contents: c,
            })),
    });
}

/** 發送商品詳情 */
async function sendProductDetail(replyToken, productId) {
    const product = Product.findById(productId);
    if (!product) {
        return lineClient.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '商品不存在' }],
        });
    }

    await lineClient.replyMessage({
        replyToken,
        messages: [{
            type: 'flex',
            altText: product.name,
            contents: flex.buildProductDetailBubble(product),
        }],
    });
}

/** 加入購物車 */
async function addToCart(replyToken, member, productId) {
    const product = Product.findById(productId);
    if (!product) {
        return lineClient.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '商品不存在' }],
        });
    }

    if (product.stock <= 0) {
        return lineClient.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: `😔 抱歉，${product.name} 已售完` }],
        });
    }

    // 加入購物車
    const db = getDb();
    const existing = db.prepare('SELECT * FROM carts WHERE member_id = ? AND product_id = ?')
                       .get(member.id, productId);

    if (existing) {
        db.prepare('UPDATE carts SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(existing.id);
    } else {
        db.prepare('INSERT INTO carts (member_id, product_id, quantity) VALUES (?, ?, 1)')
          .run(member.id, productId);
    }

    // 取得購物車總數
    const cartCount = db.prepare('SELECT SUM(quantity) as total FROM carts WHERE member_id = ?')
                        .get(member.id)?.total || 0;

    await lineClient.replyMessage({
        replyToken,
        messages: [
            {
                type: 'text',
                text: `✅ 已加入購物車：${product.name}\n\n購物車共 ${cartCount} 件商品`,
                quickReply: {
                    items: [
                        {
                            type: 'action',
                            action: {
                                type: 'postback',
                                label: '查看購物車',
                                data: 'action=cart',
                            },
                        },
                        {
                            type: 'action',
                            action: {
                                type: 'postback',
                                label: '繼續購物',
                                data: 'action=catalog',
                            },
                        },
                    ],
                },
            },
        ],
    });
}

/** 發送購物車 */
async function sendCart(replyToken, member) {
    const db = getDb();
    const cartItems = db.prepare(`
        SELECT c.*, p.name, p.price, p.image_url, p.stock
        FROM carts c
        JOIN products p ON c.product_id = p.id
        WHERE c.member_id = ?
    `).all(member.id);

    if (!cartItems.length) {
        return lineClient.replyMessage({
            replyToken,
            messages: [{
                type: 'text',
                text: '購物車是空的 🛒\n\n輸入「商品」開始選購吧！',
            }],
        });
    }

    const total = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const itemText = cartItems.map(item =>
        `• ${item.name} x${item.quantity} = $${item.price * item.quantity}`
    ).join('\n');

    const freeShippingThreshold = parseInt(
        db.prepare("SELECT value FROM settings WHERE key = 'free_shipping_threshold'").get()?.value || 500
    );
    const shippingFee = total >= freeShippingThreshold ? 0 : 60;

    await lineClient.replyMessage({
        replyToken,
        messages: [
            {
                type: 'text',
                text: `🛒 您的購物車\n\n${itemText}\n\n───────────\n商品小計: $${total}\n運費: $${shippingFee}${shippingFee === 0 ? ' (免運)' : ''}\n合計: $${total + shippingFee}\n\n🎁 您有 ${member.bonus_points} 點可使用`,
                quickReply: {
                    items: [
                        {
                            type: 'action',
                            action: {
                                type: 'postback',
                                label: '前往結帳',
                                data: 'action=cart_checkout',
                            },
                        },
                        {
                            type: 'action',
                            action: {
                                type: 'postback',
                                label: '繼續購物',
                                data: 'action=catalog',
                            },
                        },
                    ],
                },
            },
        ],
    });
}

/** 結帳流程 */
async function sendCheckout(replyToken, member) {
    await lineClient.replyMessage({
        replyToken,
        messages: [{
            type: 'text',
            text: `💳 結帳確認\n\n請前往網頁完成結帳程序，可使用 ${member.bonus_points} 點紅利折抵`,
            quickReply: {
                items: [{
                    type: 'action',
                    action: {
                        type: 'uri',
                        label: '前往結帳',
                        uri: `${process.env.BASE_URL}/checkout?member=${member.line_user_id}`,
                    },
                }],
            },
        }],
    });
}

/** 發送我的訂單 */
async function sendMyOrders(replyToken, member) {
    const { orders } = Order.findByMember(member.id, { limit: 5 });

    if (!orders.length) {
        return lineClient.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '您還沒有訂單紀錄\n\n輸入「商品」開始選購吧！' }],
        });
    }

    const orderText = orders.map(o =>
        `📦 ${o.order_number}\n   狀態: ${Order.getStatusLabel(o.status)}\n   金額: $${o.final_amount}\n   時間: ${o.created_at.slice(0, 10)}`
    ).join('\n\n');

    await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: `📋 我的訂單\n\n${orderText}` }],
    });
}

/** 發送會員資料 */
async function sendMemberCard(replyToken, member) {
    // 重新讀取最新資料
    const freshMember = Member.findById(member.id);
    await lineClient.replyMessage({
        replyToken,
        messages: [{
            type: 'flex',
            altText: '我的會員資料',
            contents: flex.buildMemberCardBubble(freshMember),
        }],
    });
}

/** 發送點數歷史 */
async function sendPointsHistory(replyToken, member) {
    const history = Member.getPointsHistory(member.id, { limit: 5 });

    if (!history.length) {
        return lineClient.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '暫無點數紀錄' }],
        });
    }

    const historyText = history.map(h => {
        const sign = h.points > 0 ? '+' : '';
        return `${h.created_at.slice(0, 10)} ${h.description}\n   ${sign}${h.points}點 (餘額: ${h.balance}點)`;
    }).join('\n\n');

    await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: `🎁 點數異動紀錄\n\n${historyText}` }],
    });
}

module.exports = router;
