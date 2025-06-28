const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

app.use(express.json());

const TOKEN = '8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE';
const WEBHOOK_URL = 'https://thornridge.ru/bot' + TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });

bot.setWebHook(WEBHOOK_URL).then(() => {
    console.log(`Webhook set to ${WEBHOOK_URL}`);
}).catch(err => {
    console.error('Error setting webhook:', JSON.stringify(err, null, 2));
});

app.post('/bot' + TOKEN, (req, res) => {
    console.log('Received webhook update:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

bot.onText(/\/start/, (msg) => {
    console.log('Received /start from:', msg.chat.id);
    bot.sendMessage(msg.chat.id, 'Welcome to Thordridge!', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'Open Game',
                    web_app: { url: 'https://thornridge.ru' }
                }
            ]]
        }
    }).then(() => {
        console.log('Sent /start response to:', msg.chat.id);
    }).catch(err => {
        console.error('Error sending /start response:', JSON.stringify(err, null, 2));
    });
});

app.get('/api', (req, res) => {
    res.json({ message: 'API is working!' });
});

app.post('/api/character', (req, res) => {
    const { name, class: charClass } = req.body;
    res.json({ message: `Character created: ${name} (${charClass})` });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});