const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

const TOKEN = '8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE'; // Замени на токен от BotFather
const bot = new TelegramBot(TOKEN, { polling: false });

// Временный Webhook (позже добавим HTTPS)
bot.setWebHook(`http://<your_domain_or_ip>/bot${TOKEN}`);

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to Thordridge!', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'Open Game',
                    web_app: { url: 'http://5.129.220.137' }
                }
            ]]
        }
    });
});

// API для проверки
app.get('/api', (req, res) => {
    res.json({ message: 'API is working!' });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});