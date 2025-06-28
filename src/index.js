const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const TOKEN = '8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE';
const WEBHOOK_URL = 'https://thornridge.ru/bot' + TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });

const validClasses = [
    'Воин', 'Варвар', 'Монах', 'Чародей', 'Друид', 'Волшебник',
    'Жрец', 'Паладин', 'Колдун', 'Следопыт', 'Плут'
];
const validRaces = [
    'Человек', 'Эльф', 'Дварф', 'Гном', 'Тифлинг',
    'Полурослик', 'Драконорожденный', 'Орк'
];

// MongoDB connection
mongoose.connect('mongodb://admin:Netskyline1996!@localhost:27017/thordridge', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});

// Character schema
const characterSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    name: { type: String, required: true },
    race: { type: String, required: true },
    class: { type: String, required: true },
    stats: {
        strength: { type: Number, required: true },
        dexterity: { type: Number, required: true },
        constitution: { type: Number, required: true },
        wisdom: { type: Number, required: true },
        intelligence: { type: Number, required: true },
        charisma: { type: Number, required: true }
    },
    createdAt: { type: Date, default: Date.now }
});

const Character = mongoose.model('Character', characterSchema);

// Set webhook
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
        const { name, race, class: charClass, stats } = req.body;

        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ message: 'Имя персонажа обязательно' });
        }
        if (!validRaces.includes(race)) {
            return res.status(400).json({ message: 'Недопустимая раса персонажа' });
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

        // Get next ID
        const lastCharacter = await Character.findOne().sort({ id: -1 });
        const id = lastCharacter ? lastCharacter.id + 1 : 1;

        // Create new character
        const newCharacter = new Character({
            id,
            name: name.trim(),
            race,
            class: charClass,
            stats,
            createdAt: new Date()
        });

        // Save to MongoDB
        await newCharacter.save();

        res.json({ message: `Персонаж создан: ${name} (${race}, ${charClass})` });
    } catch (err) {
        console.error('Error saving character:', err);
        res.status(500).json({ message: 'Ошибка сервера при создании персонажа' });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});