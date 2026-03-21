/**
 * 會員模型 - 處理所有會員相關資料操作
 */
const { getDb } = require('../../config/database');

class Member {
    /**
     * 透過 LINE User ID 查找或建立會員
     * 當用戶加入好友時呼叫此方法
     */
    static findOrCreate(lineProfile) {
        const db = getDb();
        const { userId, displayName, pictureUrl, statusMessage } = lineProfile;

        let member = db.prepare(
            'SELECT * FROM members WHERE line_user_id = ?'
        ).get(userId);

        if (!member) {
            // 新會員 - 寫入資料庫
            const result = db.prepare(`
                INSERT INTO members (line_user_id, display_name, picture_url, status_message)
                VALUES (?, ?, ?, ?)
            `).run(userId, displayName, pictureUrl || null, statusMessage || null);

            member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);

            // 給予新會員歡迎點數
            const welcomePoints = parseInt(
                db.prepare("SELECT value FROM settings WHERE key = 'welcome_bonus_points'").get()?.value || 100
            );
            Member.addPoints(member.id, welcomePoints, 'welcome', '新會員歡迎禮');
        } else {
            // 更新現有會員的 LINE 資料
            db.prepare(`
                UPDATE members
                SET display_name = ?, picture_url = ?, status_message = ?, updated_at = CURRENT_TIMESTAMP
                WHERE line_user_id = ?
            `).run(displayName, pictureUrl || null, statusMessage || null, userId);
        }

        return member;
    }

    /** 透過 LINE User ID 查找會員 */
    static findByLineId(lineUserId) {
        const db = getDb();
        return db.prepare('SELECT * FROM members WHERE line_user_id = ?').get(lineUserId);
    }

    /** 透過 ID 查找會員 */
    static findById(id) {
        const db = getDb();
        return db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    }

    /** 取得所有會員 (含分頁) */
    static findAll({ page = 1, limit = 20, search = '', level = '' } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];

        if (search) {
            where += ' AND (display_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (level) {
            where += ' AND member_level = ?';
            params.push(level);
        }

        const total = db.prepare(`SELECT COUNT(*) as count FROM members ${where}`).get(...params).count;
        const members = db.prepare(`
            SELECT * FROM members ${where}
            ORDER BY followed_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { members, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 更新會員資料 */
    static update(id, data) {
        const db = getDb();
        const { phone, email, birthday, address } = data;
        db.prepare(`
            UPDATE members
            SET phone = ?, email = ?, birthday = ?, address = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(phone, email, birthday, address, id);
        return Member.findById(id);
    }

    /**
     * 新增點數
     * @param {number} memberId - 會員ID
     * @param {number} points - 點數 (正=獲得, 負=使用)
     * @param {string} type - 類型: welcome/purchase/redeem/admin
     * @param {string} description - 說明
     * @param {string} referenceId - 關聯訂單編號
     */
    static addPoints(memberId, points, type, description, referenceId = null) {
        const db = getDb();
        const member = Member.findById(memberId);
        if (!member) throw new Error('會員不存在');

        const newBalance = member.bonus_points + points;
        if (newBalance < 0) throw new Error('點數不足');

        // 更新會員點數
        if (points > 0) {
            db.prepare(`
                UPDATE members
                SET bonus_points = bonus_points + ?,
                    total_points_earned = total_points_earned + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(points, points, memberId);
        } else {
            db.prepare(`
                UPDATE members
                SET bonus_points = bonus_points + ?,
                    total_points_used = total_points_used + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(points, Math.abs(points), memberId);
        }

        // 記錄點數歷史
        db.prepare(`
            INSERT INTO points_history (member_id, points, balance, type, description, reference_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(memberId, points, newBalance, type, description, referenceId);

        // 更新會員等級
        Member.updateLevel(memberId);

        return newBalance;
    }

    /** 自動更新會員等級 */
    static updateLevel(memberId) {
        const db = getDb();
        const member = Member.findById(memberId);

        // 計算累計消費金額
        const totalSpent = db.prepare(`
            SELECT COALESCE(SUM(final_amount), 0) as total
            FROM orders
            WHERE member_id = ? AND status NOT IN ('cancelled', 'refunded')
        `).get(memberId).total;

        const settings = {
            silver: parseInt(db.prepare("SELECT value FROM settings WHERE key = 'silver_threshold'").get()?.value || 2000),
            gold: parseInt(db.prepare("SELECT value FROM settings WHERE key = 'gold_threshold'").get()?.value || 5000),
            platinum: parseInt(db.prepare("SELECT value FROM settings WHERE key = 'platinum_threshold'").get()?.value || 10000),
        };

        let level = 'general';
        if (totalSpent >= settings.platinum) level = 'platinum';
        else if (totalSpent >= settings.gold) level = 'gold';
        else if (totalSpent >= settings.silver) level = 'silver';

        if (level !== member.member_level) {
            db.prepare('UPDATE members SET member_level = ? WHERE id = ?').run(level, memberId);
        }
    }

    /** 取得點數歷史 */
    static getPointsHistory(memberId, { page = 1, limit = 20 } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;
        return db.prepare(`
            SELECT * FROM points_history
            WHERE member_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(memberId, limit, offset);
    }

    /** 取得會員等級標籤 */
    static getLevelLabel(level) {
        const labels = {
            general: '一般會員',
            silver: '銀牌會員',
            gold: '金牌會員',
            platinum: '白金會員',
        };
        return labels[level] || '一般會員';
    }

    /** 取得會員等級 emoji */
    static getLevelEmoji(level) {
        const emojis = { general: '🟢', silver: '🥈', gold: '🥇', platinum: '💎' };
        return emojis[level] || '🟢';
    }
}

module.exports = Member;
