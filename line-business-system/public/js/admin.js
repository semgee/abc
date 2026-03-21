/**
 * LINE 商業系統管理後台 JavaScript
 */
const API = '/api/admin';
let authToken = localStorage.getItem('adminToken');

// ══════════════════════════════════════════════
// 初始化
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showAdminPage();
        navigateTo('dashboard');
    } else {
        showLoginPage();
    }

    // 登入表單
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        await login(username, password);
    });

    // 側邊欄導航
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
});

// ══════════════════════════════════════════════
// 認證
// ══════════════════════════════════════════════
async function login(username, password) {
    const errorEl = document.getElementById('login-error');
    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        authToken = data.token;
        localStorage.setItem('adminToken', authToken);
        document.getElementById('admin-name').textContent = `👤 ${data.username}`;
        showAdminPage();
        navigateTo('dashboard');
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    authToken = null;
    showLoginPage();
}

function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('admin-page').classList.add('hidden');
}

function showAdminPage() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('admin-page').classList.remove('hidden');
}

async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            ...(options.headers || {}),
        },
    });
    if (res.status === 401) { logout(); return; }
    return res.json();
}

// ══════════════════════════════════════════════
// 頁面路由
// ══════════════════════════════════════════════
const pageTitles = {
    dashboard: '📊 儀表板',
    members: '👥 會員管理',
    products: '📦 商品管理',
    orders: '🛒 訂單管理',
    settings: '⚙️ 系統設定',
};

function navigateTo(page) {
    document.getElementById('page-title').textContent = pageTitles[page] || page;
    const content = document.getElementById('page-content');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">載入中...</div>';

    switch (page) {
        case 'dashboard': return renderDashboard(content);
        case 'members':   return renderMembers(content);
        case 'products':  return renderProducts(content);
        case 'orders':    return renderOrders(content);
        case 'settings':  return renderSettings(content);
    }
}

// ══════════════════════════════════════════════
// 儀表板
// ══════════════════════════════════════════════
async function renderDashboard(container) {
    const data = await apiFetch(`${API}/dashboard`);
    if (!data) return;

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">總會員數</div>
                <div class="stat-value">${data.totalMembers.toLocaleString()}</div>
                <div class="stat-sub">今日新增 ${data.newMembersToday} 人</div>
            </div>
            <div class="stat-card green">
                <div class="stat-label">今日訂單</div>
                <div class="stat-value">${data.ordersToday}</div>
                <div class="stat-sub">待處理 ${data.pendingOrders} 筆</div>
            </div>
            <div class="stat-card blue">
                <div class="stat-label">今日營收</div>
                <div class="stat-value">$${data.revenueToday.toLocaleString()}</div>
                <div class="stat-sub">本月 $${data.revenueThisMonth.toLocaleString()}</div>
            </div>
            <div class="stat-card orange">
                <div class="stat-label">低庫存商品</div>
                <div class="stat-value">${data.lowStockProducts}</div>
                <div class="stat-sub">共 ${data.totalProducts} 件上架</div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header">最近訂單</div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr><th>訂單編號</th><th>會員</th><th>金額</th><th>狀態</th><th>時間</th></tr>
                        </thead>
                        <tbody>
                            ${data.recentOrders.map(o => `
                                <tr>
                                    <td><code>${o.order_number}</code></td>
                                    <td>${o.display_name}</td>
                                    <td>$${o.final_amount.toLocaleString()}</td>
                                    <td><span class="badge badge-${o.status}">${getStatusLabel(o.status)}</span></td>
                                    <td>${o.created_at.slice(0, 16)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card">
                <div class="card-header">會員等級分布</div>
                <div class="card-body">
                    ${data.memberLevels.map(l => `
                        <div style="margin-bottom:12px">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                                <span class="badge badge-${l.member_level}">${getLevelLabel(l.member_level)}</span>
                                <strong>${l.count} 人</strong>
                            </div>
                            <div style="background:#e2e8f0;border-radius:4px;height:8px">
                                <div style="background:var(--primary);height:8px;border-radius:4px;width:${Math.min(100, l.count / data.totalMembers * 100)}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// ══════════════════════════════════════════════
// 會員管理
// ══════════════════════════════════════════════
async function renderMembers(container, page = 1, search = '', level = '') {
    const data = await apiFetch(`${API}/members?page=${page}&search=${encodeURIComponent(search)}&level=${level}`);
    if (!data) return;

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span>會員列表 (共 ${data.total} 人)</span>
                <button class="btn btn-secondary btn-sm" onclick="exportMembers()">
                    <i class="fas fa-download"></i> 匯出
                </button>
            </div>
            <div class="card-body" style="padding-bottom:0">
                <div class="search-bar">
                    <input type="text" id="member-search" placeholder="搜尋姓名、電話、Email..." value="${search}">
                    <select id="level-filter" onchange="filterMembers()">
                        <option value="">全部等級</option>
                        <option value="general" ${level==='general'?'selected':''}>一般會員</option>
                        <option value="silver" ${level==='silver'?'selected':''}>銀牌會員</option>
                        <option value="gold" ${level==='gold'?'selected':''}>金牌會員</option>
                        <option value="platinum" ${level==='platinum'?'selected':''}>白金會員</option>
                    </select>
                    <button class="btn btn-primary" onclick="filterMembers()">搜尋</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>會員</th><th>等級</th><th>點數</th><th>電話</th><th>加入時間</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                        ${data.members.map(m => `
                            <tr>
                                <td>
                                    <div class="member-avatar">
                                        <img class="avatar-img" src="${m.picture_url || 'https://via.placeholder.com/36x36/EEEEEE'}" alt="">
                                        <div>
                                            <div style="font-weight:600">${m.display_name || '-'}</div>
                                            <div style="font-size:12px;color:#999">${m.email || ''}</div>
                                        </div>
                                    </div>
                                </td>
                                <td><span class="badge badge-${m.member_level}">${getLevelLabel(m.member_level)}</span></td>
                                <td style="color:var(--primary);font-weight:600">🎁 ${m.bonus_points}</td>
                                <td>${m.phone || '-'}</td>
                                <td>${m.followed_at?.slice(0,10) || '-'}</td>
                                <td>
                                    <button class="btn btn-primary btn-sm" onclick="showMemberDetail(${m.id})">詳情</button>
                                    <button class="btn btn-secondary btn-sm" onclick="showAddPoints(${m.id}, '${m.display_name}')">送點數</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${renderPagination(data.page, data.totalPages, (p) => renderMembers(container, p, search, level))}
        </div>
    `;

    document.getElementById('member-search').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') filterMembers();
    });

    window._membersContainer = container;
    window._membersPage = page;
}

function filterMembers() {
    const search = document.getElementById('member-search')?.value || '';
    const level = document.getElementById('level-filter')?.value || '';
    renderMembers(window._membersContainer, 1, search, level);
}

async function showMemberDetail(memberId) {
    const data = await apiFetch(`${API}/members/${memberId}`);
    showModal(`
        <div class="modal-header">
            <span class="modal-title">👤 會員詳情</span>
            <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="member-avatar" style="margin-bottom:16px">
            <img class="avatar-img" style="width:60px;height:60px" src="${data.member.picture_url || 'https://via.placeholder.com/60'}" alt="">
            <div>
                <h3>${data.member.display_name}</h3>
                <span class="badge badge-${data.member.member_level}">${getLevelLabel(data.member.member_level)}</span>
            </div>
        </div>
        <table style="width:100%;font-size:14px">
            <tr><td style="color:#999;padding:4px 0">手機</td><td>${data.member.phone || '-'}</td></tr>
            <tr><td style="color:#999;padding:4px 0">Email</td><td>${data.member.email || '-'}</td></tr>
            <tr><td style="color:#999;padding:4px 0">生日</td><td>${data.member.birthday || '-'}</td></tr>
            <tr><td style="color:#999;padding:4px 0">當前點數</td><td style="color:var(--primary);font-weight:700">${data.member.bonus_points} 點</td></tr>
            <tr><td style="color:#999;padding:4px 0">累計獲得</td><td>${data.member.total_points_earned} 點</td></tr>
            <tr><td style="color:#999;padding:4px 0">加入時間</td><td>${data.member.followed_at?.slice(0,16)}</td></tr>
        </table>
        <hr style="margin:16px 0">
        <h4 style="margin-bottom:12px">最近點數異動</h4>
        ${data.pointsHistory.slice(0,5).map(h => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px">
                <span>${h.description}</span>
                <span style="color:${h.points>0?'#4CAF50':'#f44336'};font-weight:600">${h.points>0?'+':''}${h.points}點</span>
            </div>
        `).join('')}
    `);
}

function showAddPoints(memberId, memberName) {
    showModal(`
        <div class="modal-header">
            <span class="modal-title">🎁 送出點數給 ${memberName}</span>
            <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="form-group">
            <label>點數數量 (負數=扣除)</label>
            <input type="number" id="points-amount" placeholder="例如: 100" value="100">
        </div>
        <div class="form-group">
            <label>說明</label>
            <input type="text" id="points-desc" placeholder="例如: 活動贈點" value="活動贈點">
        </div>
        <button class="btn btn-primary btn-block" onclick="submitAddPoints(${memberId})">確認送出</button>
    `);
}

async function submitAddPoints(memberId) {
    const points = parseInt(document.getElementById('points-amount').value);
    const description = document.getElementById('points-desc').value;
    const data = await apiFetch(`${API}/members/${memberId}/points`, {
        method: 'POST',
        body: JSON.stringify({ points, description }),
    });
    if (data?.balance !== undefined) {
        closeModal();
        alert(`✅ 點數調整成功！餘額: ${data.balance} 點`);
        filterMembers();
    }
}

// ══════════════════════════════════════════════
// 商品管理
// ══════════════════════════════════════════════
async function renderProducts(container, page = 1, search = '') {
    const [data, cats] = await Promise.all([
        apiFetch(`${API}/products?page=${page}&search=${encodeURIComponent(search)}`),
        apiFetch(`${API}/categories`),
    ]);
    if (!data) return;

    window._productsContainer = container;
    window._productsPage = page;
    window._categories = cats || [];

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span>商品列表 (共 ${data.total} 件)</span>
                <button class="btn btn-primary btn-sm" onclick="showAddProduct()">
                    <i class="fas fa-plus"></i> 新增商品
                </button>
            </div>
            <div class="card-body" style="padding-bottom:0">
                <div class="search-bar">
                    <input type="text" id="product-search" placeholder="搜尋商品名稱..." value="${search}">
                    <button class="btn btn-primary" onclick="filterProducts()">搜尋</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>商品</th><th>分類</th><th>售價</th><th>庫存</th><th>狀態</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                        ${data.products.map(p => `
                            <tr>
                                <td>
                                    <div class="member-avatar">
                                        <img class="avatar-img" src="${p.image_url || 'https://via.placeholder.com/36'}" alt="">
                                        <div>
                                            <div style="font-weight:600">${p.name}</div>
                                            <div style="font-size:12px;color:#999">${p.sku || ''}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>${p.category_name || '-'}</td>
                                <td style="font-weight:600;color:#E53935">$${p.price}</td>
                                <td>
                                    <span style="color:${p.stock>10?'#4CAF50':p.stock>0?'#FF9800':'#f44336'};font-weight:600">
                                        ${p.stock}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge" style="background:${p.is_active?'#E8F5E9':'#FFEBEE'};color:${p.is_active?'#4CAF50':'#f44336'}">
                                        ${p.is_active ? '上架中' : '已下架'}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-secondary btn-sm" onclick="showEditProduct(${p.id})">編輯</button>
                                    <button class="btn btn-danger btn-sm" onclick="toggleProduct(${p.id}, ${p.is_active})">
                                        ${p.is_active ? '下架' : '上架'}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${renderPagination(data.page, data.totalPages, (p) => renderProducts(container, p, search))}
        </div>
    `;
}

function filterProducts() {
    const search = document.getElementById('product-search')?.value || '';
    renderProducts(window._productsContainer, 1, search);
}

function showAddProduct() {
    const cats = window._categories || [];
    showModal(`
        <div class="modal-header">
            <span class="modal-title">📦 新增商品</span>
            <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>商品名稱 *</label>
                <input type="text" id="p-name" placeholder="商品名稱">
            </div>
            <div class="form-group">
                <label>商品編號 (SKU)</label>
                <input type="text" id="p-sku" placeholder="SKU-001">
            </div>
        </div>
        <div class="form-group">
            <label>所屬分類 *</label>
            <select id="p-category">
                ${cats.filter(c=>!c.parent_id).map(c => `<option value="${c.id}">${c.icon||''} ${c.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>售價 *</label>
                <input type="number" id="p-price" placeholder="0">
            </div>
            <div class="form-group">
                <label>原價</label>
                <input type="number" id="p-original-price" placeholder="0 (選填)">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>庫存數量</label>
                <input type="number" id="p-stock" value="0">
            </div>
            <div class="form-group">
                <label>點數回饋 (%)</label>
                <input type="number" id="p-points-rate" value="5" min="0" max="100">
            </div>
        </div>
        <div class="form-group">
            <label>商品圖片 URL</label>
            <input type="text" id="p-image" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>商品描述</label>
            <textarea id="p-desc" rows="3" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px"></textarea>
        </div>
        <div class="form-group">
            <label><input type="checkbox" id="p-featured"> 設為精選商品</label>
        </div>
        <button class="btn btn-primary btn-block" onclick="submitAddProduct()">新增商品</button>
    `);
}

async function submitAddProduct() {
    const data = {
        categoryId: parseInt(document.getElementById('p-category').value),
        sku: document.getElementById('p-sku').value,
        name: document.getElementById('p-name').value,
        description: document.getElementById('p-desc').value,
        price: parseInt(document.getElementById('p-price').value),
        originalPrice: parseInt(document.getElementById('p-original-price').value) || null,
        stock: parseInt(document.getElementById('p-stock').value),
        imageUrl: document.getElementById('p-image').value,
        bonusPointsRate: parseFloat(document.getElementById('p-points-rate').value) / 100,
        isFeatured: document.getElementById('p-featured').checked,
    };

    const result = await apiFetch(`${API}/products`, { method: 'POST', body: JSON.stringify(data) });
    if (result?.id) {
        closeModal();
        filterProducts();
    }
}

async function toggleProduct(productId, currentStatus) {
    await apiFetch(`${API}/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: currentStatus ? 0 : 1 }),
    });
    filterProducts();
}

// ══════════════════════════════════════════════
// 訂單管理
// ══════════════════════════════════════════════
async function renderOrders(container, page = 1, status = '', search = '') {
    const data = await apiFetch(`${API}/orders?page=${page}&status=${status}&search=${encodeURIComponent(search)}`);
    if (!data) return;

    window._ordersContainer = container;

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span>訂單列表 (共 ${data.total} 筆)</span>
            </div>
            <div class="card-body" style="padding-bottom:0">
                <div class="search-bar">
                    <input type="text" id="order-search" placeholder="搜尋訂單編號或會員..." value="${search}">
                    <select id="status-filter" onchange="filterOrders()">
                        <option value="">全部狀態</option>
                        <option value="pending" ${status==='pending'?'selected':''}>待付款</option>
                        <option value="confirmed" ${status==='confirmed'?'selected':''}>已確認</option>
                        <option value="shipping" ${status==='shipping'?'selected':''}>配送中</option>
                        <option value="delivered" ${status==='delivered'?'selected':''}>已送達</option>
                        <option value="cancelled" ${status==='cancelled'?'selected':''}>已取消</option>
                    </select>
                    <button class="btn btn-primary" onclick="filterOrders()">搜尋</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>訂單編號</th><th>會員</th><th>金額</th><th>付款</th><th>狀態</th><th>時間</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                        ${data.orders.map(o => `
                            <tr>
                                <td><code style="font-size:12px">${o.order_number}</code></td>
                                <td>
                                    <div class="member-avatar">
                                        <img class="avatar-img" src="${o.picture_url || 'https://via.placeholder.com/36'}" alt="">
                                        <span>${o.display_name}</span>
                                    </div>
                                </td>
                                <td style="font-weight:600;color:#E53935">$${o.final_amount.toLocaleString()}</td>
                                <td>
                                    <span class="badge" style="background:${o.payment_status==='paid'?'#E8F5E9':'#FFF3E0'};color:${o.payment_status==='paid'?'#4CAF50':'#FF9800'}">
                                        ${o.payment_status === 'paid' ? '已付款' : '未付款'}
                                    </span>
                                </td>
                                <td><span class="badge badge-${o.status}">${getStatusLabel(o.status)}</span></td>
                                <td style="font-size:12px">${o.created_at?.slice(0,16)}</td>
                                <td>
                                    <button class="btn btn-primary btn-sm" onclick="showOrderDetail(${o.id})">詳情</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${renderPagination(data.page, data.totalPages, (p) => renderOrders(container, p, status, search))}
        </div>
    `;
}

function filterOrders() {
    const search = document.getElementById('order-search')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    renderOrders(window._ordersContainer, 1, status, search);
}

async function showOrderDetail(orderId) {
    const order = await apiFetch(`${API}/orders/${orderId}`);
    showModal(`
        <div class="modal-header">
            <span class="modal-title">📦 訂單詳情</span>
            <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <p style="font-size:13px;color:#999;margin-bottom:12px">${order.order_number}</p>
        <table style="width:100%;font-size:14px;margin-bottom:16px">
            <tr><td style="color:#999;padding:4px 0;width:80px">收件人</td><td>${order.shipping_name || '-'}</td></tr>
            <tr><td style="color:#999;padding:4px 0">電話</td><td>${order.shipping_phone || '-'}</td></tr>
            <tr><td style="color:#999;padding:4px 0">地址</td><td>${order.shipping_address || '-'}</td></tr>
            <tr><td style="color:#999;padding:4px 0">備註</td><td>${order.note || '-'}</td></tr>
        </table>
        <h4 style="margin-bottom:8px">訂購商品</h4>
        ${(order.items || []).map(item => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px">
                <span>${item.product_name} x${item.quantity}</span>
                <span>$${item.subtotal}</span>
            </div>
        `).join('')}
        <div style="margin-top:12px;font-size:14px">
            <div style="display:flex;justify-content:space-between;padding:4px 0"><span>商品小計</span><span>$${order.total_amount}</span></div>
            <div style="display:flex;justify-content:space-between;padding:4px 0"><span>運費</span><span>$${order.shipping_fee}</span></div>
            ${order.points_used > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#4CAF50"><span>點數折抵</span><span>-$${order.points_used_amount}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #eee;font-weight:700;font-size:16px"><span>實付金額</span><span style="color:#E53935">$${order.final_amount}</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
            ${order.payment_status !== 'paid' ? `<button class="btn btn-success" onclick="confirmPayment(${order.id})">✅ 確認付款</button>` : ''}
            <select id="new-status" style="flex:1;padding:8px;border:1px solid #e2e8f0;border-radius:8px">
                <option value="confirmed" ${order.status==='confirmed'?'selected':''}>已確認</option>
                <option value="shipping" ${order.status==='shipping'?'selected':''}>配送中</option>
                <option value="delivered" ${order.status==='delivered'?'selected':''}>已送達</option>
                <option value="cancelled" ${order.status==='cancelled'?'selected':''}>已取消</option>
            </select>
            <button class="btn btn-primary" onclick="updateOrderStatus(${order.id})">更新狀態</button>
        </div>
    `);
}

async function confirmPayment(orderId) {
    const data = await apiFetch(`${API}/orders/${orderId}/confirm-payment`, { method: 'POST' });
    if (data?.message) {
        closeModal();
        alert(`✅ ${data.message}`);
        filterOrders();
    }
}

async function updateOrderStatus(orderId) {
    const status = document.getElementById('new-status').value;
    await apiFetch(`${API}/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });
    closeModal();
    filterOrders();
}

// ══════════════════════════════════════════════
// 系統設定
// ══════════════════════════════════════════════
async function renderSettings(container) {
    const settings = await apiFetch(`${API}/settings`);
    if (!settings) return;

    const settingMap = {};
    settings.forEach(s => settingMap[s.key] = s.value);

    container.innerHTML = `
        <div class="card">
            <div class="card-header">⚙️ 系統設定</div>
            <div class="card-body">
                <form id="settings-form">
                    <h3 style="margin-bottom:16px">商店基本設定</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>商店名稱</label>
                            <input type="text" name="shop_name" value="${settingMap.shop_name || ''}">
                        </div>
                        <div class="form-group">
                            <label>商店描述</label>
                            <input type="text" name="shop_description" value="${settingMap.shop_description || ''}">
                        </div>
                    </div>
                    <h3 style="margin:20px 0 16px">🎁 紅利點數設定</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>新會員歡迎點數</label>
                            <input type="number" name="welcome_bonus_points" value="${settingMap.welcome_bonus_points || 100}">
                        </div>
                        <div class="form-group">
                            <label>消費金額回饋 (%)</label>
                            <input type="number" name="points_per_order_percentage" value="${settingMap.points_per_order_percentage || 5}" min="0" max="100">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>1點折抵金額 (元)</label>
                            <input type="number" name="points_value" value="${settingMap.points_value || 1}">
                        </div>
                        <div class="form-group">
                            <label>最低兌換點數</label>
                            <input type="number" name="min_redeem_points" value="${settingMap.min_redeem_points || 100}">
                        </div>
                    </div>
                    <h3 style="margin:20px 0 16px">🚚 運費設定</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>運費 (元)</label>
                            <input type="number" name="shipping_fee" value="${settingMap.shipping_fee || 60}">
                        </div>
                        <div class="form-group">
                            <label>免運費門檻 (元)</label>
                            <input type="number" name="free_shipping_threshold" value="${settingMap.free_shipping_threshold || 500}">
                        </div>
                    </div>
                    <h3 style="margin:20px 0 16px">👑 會員等級門檻 (累計消費)</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>🥈 銀牌門檻 (元)</label>
                            <input type="number" name="silver_threshold" value="${settingMap.silver_threshold || 2000}">
                        </div>
                        <div class="form-group">
                            <label>🥇 金牌門檻 (元)</label>
                            <input type="number" name="gold_threshold" value="${settingMap.gold_threshold || 5000}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>💎 白金門檻 (元)</label>
                            <input type="number" name="platinum_threshold" value="${settingMap.platinum_threshold || 10000}">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">💾 儲存設定</button>
                </form>
            </div>
        </div>
    `;

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const settings = Object.fromEntries(formData.entries());
        const result = await apiFetch(`${API}/settings`, { method: 'PUT', body: JSON.stringify(settings) });
        if (result?.message) alert('✅ ' + result.message);
    });
}

// ══════════════════════════════════════════════
// 通用工具函數
// ══════════════════════════════════════════════
function getStatusLabel(status) {
    const labels = { pending: '待付款', confirmed: '已確認', shipping: '配送中', delivered: '已送達', cancelled: '已取消', refunded: '已退款' };
    return labels[status] || status;
}

function getLevelLabel(level) {
    const labels = { general: '一般會員', silver: '🥈 銀牌', gold: '🥇 金牌', platinum: '💎 白金' };
    return labels[level] || level;
}

function renderPagination(current, total, onClick) {
    if (total <= 1) return '';
    const buttons = [];
    for (let i = 1; i <= total; i++) {
        buttons.push(`<button class="page-btn ${i===current?'active':''}" onclick="(${onClick.toString()})(${i})">${i}</button>`);
    }
    return `<div class="pagination">${buttons.join('')}</div>`;
}

function showModal(content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${content}</div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
}

function closeModal() {
    document.getElementById('modal-overlay')?.remove();
}
