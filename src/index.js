const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const TOKEN = '8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE';
const WEBHOOK_URL = 'https://thornridge.ru/bot' + TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });
const DATA_DIR = path.join(__dirname, '../data');
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json');

const validClasses = [
    'Воин', 'Варвар', 'Монах', 'Чародей', 'Друид', 'Волшебник',
    'Жрец', 'Паладин', 'Колдун', 'Следопыт', 'Плут'
];

// Ensure data directory and file exist
async function initDataFile() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        try {
            await fs.access(CHARACTERS_FILE);
        } catch {
            await fs.writeFile(CHARACTERS_FILE, JSON.stringify([]));
        }
    } catch (err) {
        console.error('Error initializing data file:', err);
    }
}

initDataFile();

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
    bot.sendMessage(msg.chat.id, 'Добро пожаловать в Терновую гряду!', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'Открыть игру',
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
    res.json({ message: 'API работает!' });
});

app.post('/api/character', async (req, res) => {
    try {
        const { name, class: charClass, stats } = req.body;

        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ message: 'Имя персонажа обязательно' });
        }
        if (!validClasses.includes(charClass)) {
            return res.status(400).json({ message: 'Недопустимый класс персонажа' });
        }
        if (!stats || typeof stats !== 'object') {
            return res.status(400).json({ message: 'Характеристики обязательны' });
        }
        const { strength, dexterity, constitution, wisdom, intelligence, charisma } = stats;
        const statValues = [strength, dexterity, constitution, wisdom, intelligence, charisma];
        if (statValues.some(val => !Number.isInteger(val) || val < 8 || val > 20)) {
            return res.status(400).json({ message: 'Характеристики должны быть целыми числами от 8 до 20' });
        }
        const totalPoints = statValues.reduce((sum, val) => sum + (val - 8), 0);
        if (totalPoints !== 15) {
            return res.status(400).json({ message: 'Сумма добавленных очков характеристик должна равняться 15' });
        }

        // Read existing characters
        const characters = JSON.parse(await fs.readFile(CHARACTERS_FILE));

        // Generate unique ID
        const id = characters.length > 0 ? Math.max(...characters.map(c => c.id)) + 1 : 1;

        // Create new character
        const newCharacter = {
            id,
            name: name.trim(),
            class: charClass,
            stats,
            createdAt: new Date().toISOString()
        };

        // Save character
        characters.push(newCharacter);
        await fs.writeFile(CHARACTERS_FILE, JSON.stringify(characters, null, 2));

        res.json({ message: `Персонаж создан: ${name} (${charClass})` });
    } catch (err) {
        console.error('Error saving character:', err);
        res.status(500).json({ message: 'Ошибка сервера при создании персонажа' });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});