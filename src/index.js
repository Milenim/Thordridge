const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

// Парсим JSON для Webhook (на будущее)
app.use(express.json());

const TOKEN = '8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE'; // Замени на токен от BotFather
const bot = new TelegramBot(TOKEN, { polling: true }); // Включаем polling

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    console.log('Received /start from:', msg.chat.id); // Логируем для отладки
    bot.sendMessage(msg.chat.id, 'Welcome to Thordridge!', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'Open Game',
                    web_app: { url: 'http://5.129.220.137' }
                }
            ]]
        }
    }).catch(err => {
        console.error('Error sending message:', err);
    });
});

// API для проверки
app.get('/api', (req, res) => {
    res.json({ message: 'API is working!' });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});