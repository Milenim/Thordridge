const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

// Парсим JSON для Webhook (на будущее)
app.use(express.json());

const TOKEN = '8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE'; // Твой токен
const bot = new TelegramBot(TOKEN, { polling: true });

// Логируем запуск бота
console.log('Bot started with polling');

// Обработка всех входящих обновлений для отладки
bot.on('message', (msg) => {
    console.log('Received message:', msg);
});

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    console.log('Received /start from:', msg.chat.id);
    bot.sendMessage(msg.chat.id, 'Welcome to Thordridge!', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'Open Game',
                    web_app: { url: 'http://5.129.220.137' }
                }
            ]]
        }
    }).then(() => {
        console.log('Sent /start response to:', msg.chat.id);
    }).catch(err => {
        console.error('Error sending /start response:', err);
    });
});

// API для проверки
app.get('/api', (req, res) => {
    res.json({ message: 'API is working!' });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});