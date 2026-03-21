/**
 * LINE Rich Menu (圖文選單) 設定服務
 * Rich Menu 是 LINE 聊天畫面底部的選單
 */
const { lineClient } = require('../../config/line');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * 建立完整的圖文選單
 * 選單分為 6 個功能區塊:
 * ┌────────┬────────┬────────┐
 * │ 商品目錄 │ 我的購物車 │ 我的訂單 │
 * ├────────┼────────┼────────┤
 * │ 分類瀏覽 │ 會員資料 │ 聯絡客服 │
 * └────────┴────────┴────────┘
 */
async function createRichMenu() {
    const richMenuData = {
        size: { width: 2500, height: 843 },
        selected: true,
        name: '主選單',
        chatBarText: '點我開始購物 🛍️',
        areas: [
            // 第一列
            {
                bounds: { x: 0, y: 0, width: 833, height: 421 },
                action: {
                    type: 'postback',
                    label: '商品目錄',
                    data: 'action=catalog',
                },
            },
            {
                bounds: { x: 833, y: 0, width: 834, height: 421 },
                action: {
                    type: 'postback',
                    label: '購物車',
                    data: 'action=cart',
                },
            },
            {
                bounds: { x: 1667, y: 0, width: 833, height: 421 },
                action: {
                    type: 'postback',
                    label: '我的訂單',
                    data: 'action=my_orders',
                },
            },
            // 第二列
            {
                bounds: { x: 0, y: 421, width: 833, height: 422 },
                action: {
                    type: 'postback',
                    label: '分類瀏覽',
                    data: 'action=categories',
                },
            },
            {
                bounds: { x: 833, y: 421, width: 834, height: 422 },
                action: {
                    type: 'postback',
                    label: '會員資料',
                    data: 'action=my_profile',
                },
            },
            {
                bounds: { x: 1667, y: 421, width: 833, height: 422 },
                action: {
                    type: 'uri',
                    label: '聯絡客服',
                    uri: `${process.env.BASE_URL || 'https://line.me'}/contact`,
                },
            },
        ],
    };

    try {
        const result = await lineClient.createRichMenu(richMenuData);
        console.log('✅ Rich Menu 建立成功:', result.richMenuId);
        return result.richMenuId;
    } catch (error) {
        console.error('❌ Rich Menu 建立失敗:', error.message);
        throw error;
    }
}

/**
 * 上傳 Rich Menu 圖片
 * 圖片規格: 2500x843 像素, PNG/JPEG, 最大 1MB
 */
async function uploadRichMenuImage(richMenuId, imagePath) {
    const imageData = fs.readFileSync(imagePath);
    const contentType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    try {
        await lineClient.setRichMenuImage(richMenuId, new Blob([imageData], { type: contentType }));
        console.log('✅ Rich Menu 圖片上傳成功');
    } catch (error) {
        console.error('❌ Rich Menu 圖片上傳失敗:', error.message);
        throw error;
    }
}

/**
 * 設定預設 Rich Menu
 */
async function setDefaultRichMenu(richMenuId) {
    try {
        await lineClient.setDefaultRichMenu(richMenuId);
        console.log('✅ 預設 Rich Menu 設定成功');
    } catch (error) {
        console.error('❌ 預設 Rich Menu 設定失敗:', error.message);
        throw error;
    }
}

/**
 * 刪除所有 Rich Menu (重置用)
 */
async function deleteAllRichMenus() {
    try {
        const { richmenus } = await lineClient.getRichMenuList();
        for (const menu of richmenus) {
            await lineClient.deleteRichMenu(menu.richMenuId);
            console.log(`🗑️ 刪除 Rich Menu: ${menu.richMenuId}`);
        }
    } catch (error) {
        console.error('❌ 刪除 Rich Menu 失敗:', error.message);
    }
}

/**
 * 一鍵設定 Rich Menu (建立 + 上傳圖片 + 設為預設)
 */
async function setupRichMenu(imagePath = null) {
    console.log('🚀 開始設定 Rich Menu...');

    // 先清除舊的選單
    await deleteAllRichMenus();

    // 建立新選單
    const richMenuId = await createRichMenu();

    // 如果有提供圖片則上傳
    if (imagePath && fs.existsSync(imagePath)) {
        await uploadRichMenuImage(richMenuId, imagePath);
    } else {
        console.log('⚠️  未提供 Rich Menu 圖片，請手動上傳');
        console.log(`   Rich Menu ID: ${richMenuId}`);
        console.log('   請至 LINE Official Account Manager 上傳圖片');
    }

    // 設為預設
    await setDefaultRichMenu(richMenuId);

    return richMenuId;
}

module.exports = { createRichMenu, uploadRichMenuImage, setDefaultRichMenu, deleteAllRichMenus, setupRichMenu };
