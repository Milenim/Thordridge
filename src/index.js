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

// Определяем расовые бонусы для валидации на сервере
const raceBonuses = {
    'Человек': { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1, charisma: 1 },
    'Драконорождённый': { strength: 2, charisma: 1 },
    'Гном': { intelligence: 2 },
    'Тифлинг': { intelligence: 1, charisma: 2 },
    'Полуэльф': { charisma: 2, custom: 2 }, // +1 к двум характеристикам (например, Сила и Ловкость)
    'Полуорк': { strength: 2, constitution: 1 },
    'Дварф': { constitution: 2 }
};

// MongoDB connection
mongoose.connect('mongodb://admin:Netskyline1996!@localhost:27017/thordridge?authSource=admin', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', JSON.stringify(err, null, 2));
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
                    web_app: { url: 'https://thornridge.ru/login.html' }
                },
                {
                    text: 'Посмотреть персонажей',
                    web_app: { url: 'https://thornridge.ru/characters' }
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
        console.log('Received character data:', JSON.stringify(req.body, null, 2));
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

        // Вычисляем расовые бонусы
        let raceBonusPoints = 0;
        const bonuses = raceBonuses[race] || {};
        for (let stat in stats) {
            const bonus = bonuses[stat] || 0;
            if (stat === 'custom' && race === 'Полуэльф') {
                // Для Полуэльфа учитываем +1 к двум характеристикам (например, Сила и Ловкость)
                raceBonusPoints += 2;
            } else {
                raceBonusPoints += bonus;
            }
        }

        // Проверяем сумму пользовательских очков (вычитаем расовые бонусы)
        const totalPoints = statValues.reduce((sum, val) => sum + (val - 8), 0) - raceBonusPoints;
        if (totalPoints !== 15) {
            return res.status(400).json({ 
                message: `Сумма добавленных очков характеристик должна равняться 15 (текущая сумма: ${totalPoints})` 
            });
        }

        // Get next ID
        const lastCharacter = await Character.findOne().sort({ id: -1 }).exec();
        console.log('Last character:', lastCharacter);
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
        console.log('Character saved:', newCharacter);

        res.json({ message: `Персонаж создан: ${name} (${race}, ${charClass})`, characterId: id });
    } catch (err) {
        console.error('Error saving character:', JSON.stringify(err, null, 2));
        res.status(500).json({ message: 'Ошибка сервера при создании персонажа' });
    }
});

app.get('/api/characters', async (req, res) => {
    try {
        const characters = await Character.find().sort({ createdAt: -1 }).exec();
        res.json(characters);
    } catch (err) {
        console.error('Error fetching characters:', JSON.stringify(err, null, 2));
        res.status(500).json({ message: 'Ошибка сервера при загрузке персонажей' });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});