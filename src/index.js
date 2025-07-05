const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const TOKEN = '8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE';
const WEBHOOK_URL = 'https://thornridge.ru/bot' + TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });

// MongoDB connection
mongoose.connect('mongodb://admin:Netskyline1996!@5.129.220.137:27017/thordridge?authSource=admin', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
    // Set Telegram commands and Web App button after bot initialization
    bot.setMyCommands([
        { command: '/start', description: 'Начать игру' }
    ]).then(() => {
        console.log('Telegram commands set');
    }).catch(err => {
        console.error('Error setting Telegram commands:', JSON.stringify(err, null, 2));
    });

    bot.setChatMenuButton({
        chat_id: null,
        menu_button: {
            type: 'web_app',
            text: 'Войти в игру',
            web_app: { url: 'https://thornridge.ru/login.html' }
        }
    }).then(() => {
        console.log('Web App menu button set to login.html');
    }).catch(err => {
        console.error('Error setting Web App menu button:', JSON.stringify(err, null, 2));
    });

    // Set webhook
    bot.setWebHook(WEBHOOK_URL).then(() => {
        console.log(`Webhook set to ${WEBHOOK_URL}`);
    }).catch(err => {
        console.error('Error setting webhook:', JSON.stringify(err, null, 2));
    });
}).catch(err => {
    console.error('Error connecting to MongoDB:', JSON.stringify(err, null, 2));
});

mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', JSON.stringify(err, null, 2));
    // Убираем отправку сообщения в Telegram при ошибке подключения к MongoDB
    console.log('MongoDB connection failed. Please check your database server.');
    global.mongoError = err.message || 'Unknown MongoDB error';
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
    global.mongoError = 'MongoDB disconnected';
});

mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully');
    global.mongoError = null;
});

const validClasses = [
    'Воин', 'Варвар', 'Монах', 'Чародей', 'Друид', 'Волшебник',
    'Жрец', 'Паладин', 'Колдун', 'Следопыт', 'Плут'
];
const validRaces = [
    'Человек', 'Эльф', 'Дварф', 'Гном', 'Тифлинг',
    'Полуэльф', 'Полуорк', 'Драконорождённый'
];

// Определяем расовые бонусы для валидации на сервере
const raceBonuses = {
    'Человек': { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1, charisma: 1 },
    'Эльф': { dexterity: 2 },
    'Дварф': { constitution: 2 },
    'Гном': { intelligence: 2 },
    'Тифлинг': { intelligence: 1, charisma: 2 },
    'Полуэльф': { charisma: 2, custom: 2 }, // +1 к двум характеристикам (например, Сила и Ловкость)
    'Полуорк': { strength: 2, constitution: 1 },
    'Драконорождённый': { strength: 2, charisma: 1 }
};

// Character schema
const characterSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    name: { type: String, required: true, unique: true },
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
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    inventory: [{ item: String, quantity: { type: Number, default: 1 } }],
    createdAt: { type: Date, default: Date.now }
});

const Character = mongoose.model('Character', characterSchema);

app.post('/bot' + TOKEN, (req, res) => {
    console.log('Received webhook update:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

bot.onText(/\/start/, (msg) => {
    console.log('Received /start from:', msg.chat.id);
    bot.sendMessage(msg.chat.id, 'Нажмите на кнопку меню слева, чтобы войти в игру!').then(() => {
        console.log('Sent /start response to:', msg.chat.id);
    }).catch(err => {
        console.error('Error sending /start response:', JSON.stringify(err, null, 2));
    });
});

app.get('/api', (req, res) => {
    res.json({ message: 'API работает!' });
});

app.get('/api/status', (req, res) => {
    try {
        const mongoState = mongoose.connection.readyState;
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        res.json({ 
            api: 'working',
            mongodb: states[mongoState] || 'unknown',
            mongoState: mongoState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name,
            error: global.mongoError || null,
            connectionString: 'mongodb://admin:***@5.129.220.137:27017/thordridge?authSource=admin'
        });
    } catch (err) {
        res.status(500).json({ 
            error: 'Status check failed',
            message: err.message
        });
    }
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

        const existingCharacter = await Character.findOne({ name: name.trim() });
        if (existingCharacter) {
            return res.status(400).json({ message: 'Персонаж с таким именем уже существует' });
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

app.get('/api/character/:id', async (req, res) => {
    try {
        const character = await Character.findOne({ id: parseInt(req.params.id) });
        if (!character) {
            return res.status(404).json({ message: 'Персонаж не найден' });
        }
        res.json(character);
    } catch (err) {
        console.error('Error fetching character:', JSON.stringify(err, null, 2));
        res.status(500).json({ message: 'Ошибка сервера при загрузке персонажа' });
    }
});

app.post('/api/roll', async (req, res) => {
    try {
        const { characterId, diceType, result } = req.body;
        if (!['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].includes(diceType)) {
            return res.status(400).json({ message: 'Недопустимый тип кубика' });
        }
        if (!Number.isInteger(result) || result < 1 || result > parseInt(diceType.slice(1))) {
            return res.status(400).json({ message: `Результат должен быть от 1 до ${diceType.slice(1)}` });
        }
        // Можно добавить логирование броска в MongoDB, если нужно
        res.json({ message: `Бросок ${diceType}: ${result}` });
    } catch (err) {
        console.error('Error processing roll:', JSON.stringify(err, null, 2));
        res.status(500).json({ message: 'Ошибка сервера при обработке броска' });
    }
});

app.get('/api/test-local-mongo', async (req, res) => {
    try {
        const localMongoose = require('mongoose');
        const localConnection = localMongoose.createConnection('mongodb://admin:Netskyline1996!@localhost:27017/thordridge?authSource=admin', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
        
        localConnection.on('connected', () => {
            localConnection.close();
            res.json({ 
                local: 'success',
                message: 'Local MongoDB connection successful'
            });
        });
        
        localConnection.on('error', (err) => {
            localConnection.close();
            res.json({ 
                local: 'failed',
                error: err.message,
                message: 'Local MongoDB connection failed'
            });
        });
        
        setTimeout(() => {
            localConnection.close();
            res.json({ 
                local: 'timeout',
                message: 'Local MongoDB connection timeout'
            });
        }, 10000);
        
    } catch (err) {
        res.status(500).json({ 
            error: 'Local test failed',
            message: err.message
        });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});