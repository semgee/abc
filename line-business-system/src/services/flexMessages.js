/**
 * LINE Flex Message 產生服務
 * 包含: 商品目錄(2種格式)、商品詳情、訂單確認、會員資料
 */

/**
 * ──────────────────────────────────────────────
 * 型錄顯示方式 1: 格狀目錄 (Grid Carousel)
 * 適合: 瀏覽商品、比較商品
 * ──────────────────────────────────────────────
 */
function buildProductGridCarousel(products, title = '商品目錄') {
    const bubbles = products.map(p => buildProductGridBubble(p));

    // LINE Carousel 最多 12 個 bubble
    const chunks = chunkArray(bubbles, 12);
    return chunks.map(chunk => ({
        type: 'carousel',
        contents: chunk,
    }));
}

function buildProductGridBubble(product) {
    const discountRate = product.original_price
        ? Math.round((1 - product.price / product.original_price) * 100)
        : 0;

    return {
        type: 'bubble',
        size: 'micro',           // 小格式，一行可顯示更多
        hero: {
            type: 'image',
            url: product.image_url || 'https://via.placeholder.com/300x300/EEEEEE/999999?text=無圖片',
            size: 'full',
            aspectRatio: '1:1',
            aspectMode: 'cover',
            action: {
                type: 'postback',
                label: '查看商品',
                data: `action=product_detail&product_id=${product.id}`,
            },
        },
        body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '8px',
            spacing: 'xs',
            contents: [
                {
                    type: 'text',
                    text: product.name,
                    size: 'xs',
                    weight: 'bold',
                    wrap: true,
                    maxLines: 2,
                    color: '#222222',
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: `$${product.price}`,
                            size: 'sm',
                            color: '#E53935',
                            weight: 'bold',
                            flex: 1,
                        },
                        ...(discountRate > 0 ? [{
                            type: 'text',
                            text: `${discountRate}折`,
                            size: 'xxs',
                            color: '#FF5722',
                            align: 'end',
                            offsetTop: '2px',
                        }] : []),
                    ],
                },
                ...(product.original_price ? [{
                    type: 'text',
                    text: `原價 $${product.original_price}`,
                    size: 'xxs',
                    color: '#AAAAAA',
                    decoration: 'line-through',
                }] : []),
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '8px',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    height: 'sm',
                    color: '#FF6B35',
                    action: {
                        type: 'postback',
                        label: '加入購物車',
                        data: `action=add_to_cart&product_id=${product.id}`,
                    },
                },
            ],
        },
    };
}

/**
 * ──────────────────────────────────────────────
 * 型錄顯示方式 2: 清單式目錄 (List Bubble)
 * 適合: 詳細資訊、比較規格
 * ──────────────────────────────────────────────
 */
function buildProductListBubble(products, title = '商品列表') {
    const items = products.slice(0, 5).map(p => ({
        type: 'box',
        layout: 'horizontal',
        spacing: 'md',
        paddingAll: '12px',
        borderWidth: '1px',
        borderColor: '#EEEEEE',
        cornerRadius: '8px',
        action: {
            type: 'postback',
            label: '查看',
            data: `action=product_detail&product_id=${p.id}`,
        },
        contents: [
            {
                type: 'image',
                url: p.image_url || 'https://via.placeholder.com/100x100/EEEEEE/999999?text=No+Image',
                flex: 2,
                aspectRatio: '1:1',
                aspectMode: 'cover',
                cornerRadius: '6px',
            },
            {
                type: 'box',
                layout: 'vertical',
                flex: 5,
                spacing: 'xs',
                contents: [
                    {
                        type: 'text',
                        text: p.name,
                        size: 'sm',
                        weight: 'bold',
                        wrap: true,
                        maxLines: 2,
                        color: '#222222',
                    },
                    {
                        type: 'text',
                        text: p.description || '點擊查看詳情',
                        size: 'xxs',
                        color: '#888888',
                        wrap: true,
                        maxLines: 2,
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        spacing: 'md',
                        contents: [
                            {
                                type: 'text',
                                text: `$${p.price}`,
                                size: 'md',
                                weight: 'bold',
                                color: '#E53935',
                                flex: 1,
                            },
                            ...(p.original_price ? [{
                                type: 'text',
                                text: `$${p.original_price}`,
                                size: 'xs',
                                color: '#AAAAAA',
                                decoration: 'line-through',
                                align: 'end',
                            }] : []),
                        ],
                    },
                    {
                        type: 'text',
                        text: `🎁 消費回饋 ${Math.round((p.bonus_points_rate || 0.05) * 100)}% 點數`,
                        size: 'xxs',
                        color: '#FF6B35',
                    },
                ],
            },
        ],
    }));

    return {
        type: 'bubble',
        size: 'mega',
        header: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '16px',
            backgroundColor: '#FF6B35',
            contents: [
                {
                    type: 'text',
                    text: title,
                    color: '#FFFFFF',
                    size: 'lg',
                    weight: 'bold',
                },
                {
                    type: 'text',
                    text: `共 ${products.length} 件商品`,
                    color: '#FFE0D0',
                    size: 'xs',
                },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            paddingAll: '12px',
            contents: items,
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '12px',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    color: '#FF6B35',
                    action: {
                        type: 'uri',
                        label: '查看完整目錄',
                        uri: `${process.env.BASE_URL}/catalog`,
                    },
                },
            ],
        },
    };
}

/**
 * ──────────────────────────────────────────────
 * 商品詳情頁 Flex Message
 * ──────────────────────────────────────────────
 */
function buildProductDetailBubble(product) {
    const specs = (() => {
        try { return Object.entries(JSON.parse(product.specifications || '{}')); }
        catch { return []; }
    })();

    const bonusPoints = Math.floor(product.price * (product.bonus_points_rate || 0.05));

    return {
        type: 'bubble',
        size: 'mega',
        hero: {
            type: 'image',
            url: product.image_url || 'https://via.placeholder.com/800x500/EEEEEE/999999?text=無圖片',
            size: 'full',
            aspectRatio: '20:13',
            aspectMode: 'cover',
        },
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
                // 商品名稱
                {
                    type: 'text',
                    text: product.name,
                    size: 'xl',
                    weight: 'bold',
                    wrap: true,
                    color: '#222222',
                },
                // 分類標籤
                {
                    type: 'box',
                    layout: 'horizontal',
                    spacing: 'sm',
                    contents: [
                        {
                            type: 'text',
                            text: `📁 ${product.category_name || '未分類'}`,
                            size: 'xs',
                            color: '#888888',
                        },
                        {
                            type: 'text',
                            text: `📦 庫存 ${product.stock} 件`,
                            size: 'xs',
                            color: product.stock > 0 ? '#32CD32' : '#DC143C',
                            align: 'end',
                        },
                    ],
                },
                // 分隔線
                { type: 'separator' },
                // 價格區塊
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: `$${product.price}`,
                            size: 'xxl',
                            weight: 'bold',
                            color: '#E53935',
                            flex: 1,
                        },
                        ...(product.original_price ? [{
                            type: 'box',
                            layout: 'vertical',
                            flex: 1,
                            contents: [
                                {
                                    type: 'text',
                                    text: `原價 $${product.original_price}`,
                                    size: 'sm',
                                    color: '#AAAAAA',
                                    decoration: 'line-through',
                                    align: 'end',
                                },
                                {
                                    type: 'text',
                                    text: `省 $${product.original_price - product.price}`,
                                    size: 'sm',
                                    color: '#FF6B35',
                                    align: 'end',
                                    weight: 'bold',
                                },
                            ],
                        }] : []),
                    ],
                },
                // 點數回饋
                {
                    type: 'box',
                    layout: 'horizontal',
                    backgroundColor: '#FFF3E0',
                    cornerRadius: '6px',
                    paddingAll: '8px',
                    contents: [
                        {
                            type: 'text',
                            text: `🎁 購買可獲得 ${bonusPoints} 點紅利`,
                            size: 'sm',
                            color: '#FF6B35',
                            weight: 'bold',
                        },
                    ],
                },
                // 商品描述
                {
                    type: 'text',
                    text: product.description || '暫無商品描述',
                    size: 'sm',
                    color: '#555555',
                    wrap: true,
                },
                // 商品規格
                ...(specs.length > 0 ? [
                    { type: 'separator' },
                    {
                        type: 'text',
                        text: '商品規格',
                        size: 'sm',
                        weight: 'bold',
                        color: '#444444',
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'xs',
                        contents: specs.map(([key, value]) => ({
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                {
                                    type: 'text',
                                    text: key,
                                    size: 'xs',
                                    color: '#888888',
                                    flex: 2,
                                },
                                {
                                    type: 'text',
                                    text: String(value),
                                    size: 'xs',
                                    color: '#444444',
                                    flex: 3,
                                },
                            ],
                        })),
                    },
                ] : []),
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    color: '#FF6B35',
                    action: {
                        type: 'postback',
                        label: '🛒 加入購物車',
                        data: `action=add_to_cart&product_id=${product.id}`,
                    },
                },
                {
                    type: 'button',
                    style: 'secondary',
                    action: {
                        type: 'postback',
                        label: '⚡ 立即購買',
                        data: `action=buy_now&product_id=${product.id}`,
                    },
                },
            ],
        },
    };
}

/**
 * ──────────────────────────────────────────────
 * 分類選單 Flex Message
 * ──────────────────────────────────────────────
 */
function buildCategoryMenuBubble(categories) {
    // 只取頂層分類
    const topLevel = categories.filter(c => !c.parent_id);

    const buttons = topLevel.map(cat => ({
        type: 'button',
        style: 'secondary',
        height: 'sm',
        action: {
            type: 'postback',
            label: `${cat.icon || '📦'} ${cat.name} (${cat.product_count})`,
            data: `action=category&category_id=${cat.id}`,
        },
    }));

    return {
        type: 'bubble',
        size: 'kilo',
        header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#FF6B35',
            paddingAll: '16px',
            contents: [
                { type: 'text', text: '🛍️ 商品分類', color: '#FFFFFF', weight: 'bold', size: 'lg' },
                { type: 'text', text: '選擇您感興趣的分類', color: '#FFE0D0', size: 'xs' },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            paddingAll: '12px',
            contents: buttons,
        },
    };
}

/**
 * ──────────────────────────────────────────────
 * 會員資料 Flex Message
 * ──────────────────────────────────────────────
 */
function buildMemberCardBubble(member) {
    const levelEmoji = { general: '🟢', silver: '🥈', gold: '🥇', platinum: '💎' };
    const levelLabel = { general: '一般會員', silver: '銀牌會員', gold: '金牌會員', platinum: '白金會員' };
    const levelColor = { general: '#4CAF50', silver: '#9E9E9E', gold: '#FFC107', platinum: '#9C27B0' };

    return {
        type: 'bubble',
        size: 'mega',
        header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: levelColor[member.member_level] || '#4CAF50',
            paddingAll: '16px',
            contents: [
                {
                    type: 'box',
                    layout: 'horizontal',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'image',
                            url: member.picture_url || 'https://via.placeholder.com/100x100/CCCCCC/999999?text=User',
                            size: '60px',
                            aspectRatio: '1:1',
                            aspectMode: 'cover',
                            cornerRadius: '50%',
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            justifyContent: 'center',
                            contents: [
                                { type: 'text', text: member.display_name, color: '#FFFFFF', weight: 'bold', size: 'lg' },
                                { type: 'text', text: `${levelEmoji[member.member_level]} ${levelLabel[member.member_level]}`, color: '#FFFFFF80', size: 'sm' },
                            ],
                        },
                    ],
                },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            paddingAll: '16px',
            contents: [
                // 點數卡
                {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#FFF8F0',
                    cornerRadius: '12px',
                    paddingAll: '16px',
                    contents: [
                        { type: 'text', text: '🎁 紅利點數', size: 'sm', color: '#FF6B35', weight: 'bold' },
                        { type: 'text', text: `${member.bonus_points.toLocaleString()}`, size: 'xxl', weight: 'bold', color: '#FF6B35' },
                        { type: 'text', text: `可折抵 $${member.bonus_points} 元`, size: 'xs', color: '#888888' },
                    ],
                },
                // 統計資料
                {
                    type: 'box',
                    layout: 'horizontal',
                    spacing: 'sm',
                    contents: [
                        buildStatBox('累計獲得', `${member.total_points_earned}點`, '#32CD32'),
                        buildStatBox('累計使用', `${member.total_points_used}點`, '#FF6B35'),
                    ],
                },
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            paddingAll: '12px',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    color: '#FF6B35',
                    action: { type: 'postback', label: '📋 查看訂單', data: 'action=my_orders' },
                },
                {
                    type: 'button',
                    style: 'secondary',
                    action: { type: 'postback', label: '🎁 點數明細', data: 'action=points_history' },
                },
            ],
        },
    };
}

/**
 * ──────────────────────────────────────────────
 * 訂單確認 Flex Message
 * ──────────────────────────────────────────────
 */
function buildOrderConfirmBubble(order) {
    const statusColor = Order_getStatusColor(order.status);

    const itemLines = (order.items || []).slice(0, 4).map(item => ({
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
            { type: 'text', text: item.product_name, size: 'xs', flex: 3, wrap: true, maxLines: 1 },
            { type: 'text', text: `x${item.quantity}`, size: 'xs', flex: 1, align: 'center' },
            { type: 'text', text: `$${item.subtotal}`, size: 'xs', flex: 1, align: 'end', weight: 'bold' },
        ],
    }));

    return {
        type: 'bubble',
        size: 'mega',
        header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: statusColor,
            paddingAll: '16px',
            contents: [
                { type: 'text', text: '📦 訂單資訊', color: '#FFFFFF', weight: 'bold', size: 'md' },
                { type: 'text', text: order.order_number, color: '#FFFFFF', size: 'xs' },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            paddingAll: '16px',
            contents: [
                // 訂單狀態
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        { type: 'text', text: '訂單狀態', size: 'sm', color: '#888888', flex: 1 },
                        { type: 'text', text: getStatusLabel(order.status), size: 'sm', weight: 'bold', color: statusColor, align: 'end' },
                    ],
                },
                { type: 'separator' },
                // 商品列表
                {
                    type: 'text',
                    text: '訂購商品',
                    size: 'xs',
                    color: '#888888',
                    weight: 'bold',
                },
                ...itemLines,
                { type: 'separator' },
                // 金額明細
                buildAmountRow('商品小計', `$${order.total_amount}`),
                buildAmountRow('運費', `$${order.shipping_fee}`),
                ...(order.points_used > 0
                    ? [buildAmountRow('點數折抵', `-$${order.points_used_amount}`, '#32CD32')]
                    : []
                ),
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        { type: 'text', text: '實付金額', size: 'md', weight: 'bold', color: '#222222' },
                        { type: 'text', text: `$${order.final_amount}`, size: 'xl', weight: 'bold', color: '#E53935', align: 'end' },
                    ],
                },
                // 點數回饋
                ...(order.bonus_points_earned > 0 ? [{
                    type: 'text',
                    text: `🎁 本單預計獲得 ${order.bonus_points_earned} 點紅利`,
                    size: 'xs',
                    color: '#FF6B35',
                }] : []),
            ],
        },
    };
}

/**
 * ──────────────────────────────────────────────
 * 歡迎訊息
 * ──────────────────────────────────────────────
 */
function buildWelcomeMessage(member, shopName, welcomePoints) {
    return {
        type: 'bubble',
        size: 'mega',
        hero: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#FF6B35',
            paddingAll: '24px',
            contents: [
                { type: 'text', text: '🎉 歡迎加入！', color: '#FFFFFF', size: 'xxl', weight: 'bold', align: 'center' },
                { type: 'text', text: shopName, color: '#FFE0D0', size: 'md', align: 'center' },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            paddingAll: '20px',
            contents: [
                {
                    type: 'text',
                    text: `嗨，${member.display_name}！`,
                    size: 'lg',
                    weight: 'bold',
                    color: '#222222',
                },
                {
                    type: 'text',
                    text: '很高興認識您！作為新朋友，我們送給您：',
                    size: 'sm',
                    color: '#555555',
                    wrap: true,
                },
                {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#FFF8F0',
                    cornerRadius: '12px',
                    paddingAll: '16px',
                    contents: [
                        { type: 'text', text: '🎁 新會員歡迎禮', size: 'sm', color: '#FF6B35', weight: 'bold' },
                        { type: 'text', text: `${welcomePoints} 點紅利`, size: 'xxl', weight: 'bold', color: '#FF6B35' },
                        { type: 'text', text: `等同 $${welcomePoints} 元折扣券`, size: 'xs', color: '#888888' },
                    ],
                },
                { type: 'text', text: '立即開始購物，享受會員專屬優惠！', size: 'sm', color: '#555555', wrap: true },
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            paddingAll: '12px',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    color: '#FF6B35',
                    action: { type: 'postback', label: '🛍️ 立即購物', data: 'action=catalog' },
                },
                {
                    type: 'button',
                    style: 'secondary',
                    action: { type: 'postback', label: '👤 我的會員資料', data: 'action=my_profile' },
                },
            ],
        },
    };
}

// ── 輔助函數 ──────────────────────────────────
function buildStatBox(label, value, color) {
    return {
        type: 'box',
        layout: 'vertical',
        flex: 1,
        backgroundColor: '#F5F5F5',
        cornerRadius: '8px',
        paddingAll: '12px',
        contents: [
            { type: 'text', text: label, size: 'xs', color: '#888888', align: 'center' },
            { type: 'text', text: value, size: 'md', weight: 'bold', color, align: 'center' },
        ],
    };
}

function buildAmountRow(label, value, color = '#555555') {
    return {
        type: 'box',
        layout: 'horizontal',
        contents: [
            { type: 'text', text: label, size: 'sm', color: '#888888' },
            { type: 'text', text: value, size: 'sm', color, align: 'end', weight: 'bold' },
        ],
    };
}

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

function Order_getStatusColor(status) {
    const colors = { pending: '#FFA500', confirmed: '#4169E1', shipping: '#20B2AA', delivered: '#32CD32', cancelled: '#DC143C', refunded: '#808080' };
    return colors[status] || '#808080';
}

function getStatusLabel(status) {
    const labels = { pending: '待付款', confirmed: '已確認', shipping: '配送中', delivered: '已送達', cancelled: '已取消', refunded: '已退款' };
    return labels[status] || status;
}

module.exports = {
    buildProductGridCarousel,
    buildProductGridBubble,
    buildProductListBubble,
    buildProductDetailBubble,
    buildCategoryMenuBubble,
    buildMemberCardBubble,
    buildOrderConfirmBubble,
    buildWelcomeMessage,
};
