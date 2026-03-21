/**
 * LINE Bot SDK 設定
 */
const line = require('@line/bot-sdk');

const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new line.messagingApi.MessagingApiClient({
    channelAccessToken: lineConfig.channelAccessToken,
});

module.exports = { lineConfig, lineClient };
