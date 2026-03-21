/**
 * 商品模型
 */
const { getDb } = require('../../config/database');

class Product {
    /** 取得所有商品 (含分頁、分類、搜尋) */
    static findAll({ page = 1, limit = 20, categoryId = null, search = '', featured = false } = {}) {
        const db = getDb();
        const offset = (page - 1) * limit;

        let where = 'WHERE p.is_active = 1';
        const params = [];

        if (categoryId) {
            // 若選到父分類，也包含其子分類商品
            where += ' AND (p.category_id = ? OR c.parent_id = ?)';
            params.push(categoryId, categoryId);
        }
        if (search) {
            where += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (featured) {
            where += ' AND p.is_featured = 1';
        }

        const total = db.prepare(`
            SELECT COUNT(*) as count
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${where}
        `).get(...params).count;

        const products = db.prepare(`
            SELECT p.*, c.name as category_name, c.parent_id
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${where}
            ORDER BY p.is_featured DESC, p.sort_order ASC, p.id DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return { products, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** 依分類取得商品 (LINE Flex Message 用) */
    static findByCategory(categoryId) {
        const db = getDb();
        return db.prepare(`
            SELECT p.*, c.name as category_name
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND (p.category_id = ? OR c.parent_id = ?)
            ORDER BY p.is_featured DESC, p.sort_order ASC
            LIMIT 10
        `).all(categoryId, categoryId);
    }

    /** 依 ID 取得單一商品 */
    static findById(id) {
        const db = getDb();
        return db.prepare(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `).get(id);
    }

    /** 取得精選商品 */
    static getFeatured(limit = 5) {
        const db = getDb();
        return db.prepare(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND p.is_featured = 1
            ORDER BY p.sort_order ASC, p.id DESC
            LIMIT ?
        `).all(limit);
    }

    /** 取得所有分類 (含商品數量) */
    static getCategories() {
        const db = getDb();
        return db.prepare(`
            SELECT c.*,
                   COUNT(p.id) as product_count,
                   pc.name as parent_name
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
            LEFT JOIN categories pc ON c.parent_id = pc.id
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.sort_order ASC, c.id ASC
        `).all();
    }

    /** 建立商品 */
    static create(data) {
        const db = getDb();
        const { categoryId, sku, name, description, price, originalPrice, stock,
                imageUrl, images, specifications, tags, bonusPointsRate, isFeatured } = data;

        const result = db.prepare(`
            INSERT INTO products
                (category_id, sku, name, description, price, original_price, stock,
                 image_url, images, specifications, tags, bonus_points_rate, is_featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(categoryId, sku, name, description, price, originalPrice, stock,
               imageUrl, JSON.stringify(images || []), JSON.stringify(specifications || {}),
               JSON.stringify(tags || []), bonusPointsRate || 0.05, isFeatured ? 1 : 0);

        return Product.findById(result.lastInsertRowid);
    }

    /** 更新商品 */
    static update(id, data) {
        const db = getDb();
        const fields = [];
        const values = [];

        const allowedFields = {
            category_id: data.categoryId,
            name: data.name,
            description: data.description,
            price: data.price,
            original_price: data.originalPrice,
            stock: data.stock,
            image_url: data.imageUrl,
            is_active: data.isActive,
            is_featured: data.isFeatured,
            sort_order: data.sortOrder,
        };

        for (const [key, value] of Object.entries(allowedFields)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) return Product.findById(id);

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return Product.findById(id);
    }

    /** 更新庫存 */
    static updateStock(id, delta) {
        const db = getDb();
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, id);
    }

    /** 格式化商品規格 (方便顯示) */
    static parseSpec(product) {
        try {
            return JSON.parse(product.specifications || '{}');
        } catch {
            return {};
        }
    }

    /** 格式化商品標籤 */
    static parseTags(product) {
        try {
            return JSON.parse(product.tags || '[]');
        } catch {
            return [];
        }
    }

    /** 計算商品點數回饋 */
    static calcBonusPoints(product, quantity = 1) {
        return Math.floor(product.price * quantity * (product.bonus_points_rate || 0.05));
    }
}

module.exports = Product;
