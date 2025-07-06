const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();

app.use(express.json());
app.use(express.static('public'));

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://thornridge.ru/bot' + TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });

// HuggingFace Configuration
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'microsoft/DialoGPT-medium';

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:Netskyline1996!@127.0.0.1:27017/thordridge?authSource=admin', {
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

// Game Session schema
const gameSessionSchema = new mongoose.Schema({
    characterId: { type: Number, required: true },
    messages: [{
        role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    currentScene: { type: String, default: '' },
    currentActions: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const GameSession = mongoose.model('GameSession', gameSessionSchema);

// AI Game Master Functions
function createGamePrompt(character, action = null) {
    const characterInfo = `${character.name} (${character.race} ${character.class}, уровень ${character.level})`;
    
    if (action) {
        return `В тёмном фэнтези мире "Терновая гряда", ${characterInfo} выполняет действие: ${action}. Опиши что происходит и предложи 3 новых варианта действий.`;
    } else {
        return `В тёмном фэнтези мире "Терновая гряда", ${characterInfo} начинает приключение. Опиши начальную сцену и предложи 3 варианта действий.`;
    }
}

async function callHuggingFaceAPI(prompt, maxLength = 200) {
    if (!HUGGINGFACE_API_KEY) {
        console.log('HuggingFace API key not provided, using fallback');
        return null;
    }

    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`, {
            headers: {
                Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: maxLength,
                    temperature: 0.8,
                    do_sample: true,
                    top_p: 0.9
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`HuggingFace API error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
            console.error('HuggingFace API error:', result.error);
            return null;
        }

        return result[0]?.generated_text || null;
    } catch (error) {
        console.error('Error calling HuggingFace API:', error);
        return null;
    }
}

function parseAIResponse(response) {
    // Пытаемся извлечь сцену и действия из ответа ИИ
    const lines = response.split('\n').filter(line => line.trim());
    
    let scene = '';
    let actions = [];
    let inActions = false;
    
    for (let line of lines) {
        line = line.trim();
        
        if (line.toLowerCase().includes('действия') || line.toLowerCase().includes('варианты') || line.includes(':')) {
            inActions = true;
            continue;
        }
        
        if (inActions) {
            // Извлекаем действия (строки с цифрами, точками или дефисами)
            if (line.match(/^[\d\-\*•]\s*\.?\s*/)) {
                const action = line.replace(/^[\d\-\*•]\s*\.?\s*/, '').trim();
                if (action && actions.length < 4) {
                    actions.push(action);
                }
            }
        } else {
            // Добавляем к описанию сцены
            if (line && !line.includes('персонаж') && !line.includes('уровень')) {
                scene += line + ' ';
            }
        }
    }
    
    return {
        scene: scene.trim() || response.substring(0, 300),
        actions: actions.length > 0 ? actions : null
    };
}

function getClassBasedActions(characterClass) {
    const actionsByClass = {
        'Воин': ['Атаковать мечом', 'Защищаться щитом', 'Использовать боевую тактику'],
        'Варвар': ['Войти в ярость', 'Сокрушающий удар', 'Угрожающий рык'],
        'Монах': ['Ударить без оружия', 'Использовать ки', 'Уклониться'],
        'Чародей': ['Применить магию', 'Использовать врождённые силы', 'Магический снаряд'],
        'Друид': ['Превратиться в животное', 'Природная магия', 'Говорить с животными'],
        'Волшебник': ['Изучить заклинание', 'Волшебная атака', 'Магический анализ'],
        'Жрец': ['Молитва', 'Божественная магия', 'Исцеление'],
        'Паладин': ['Священная клятва', 'Изгнание нежити', 'Божественное наказание'],
        'Колдун': ['Магия покровителя', 'Тёмные силы', 'Проклятие'],
        'Следопыт': ['Выследить', 'Стрельба из лука', 'Знания о природе'],
        'Плут': ['Скрыться в тенях', 'Удар исподтишка', 'Вскрыть замок']
    };
    
    return actionsByClass[characterClass] || ['Осмотреться', 'Продолжить путь', 'Подождать'];
}

function generateFallbackContent(character, action = null) {
    const scenes = [
        "Вы находитесь в тёмном лесу Терновой гряды. Древние деревья шепчут тайны прошлого, а туман скрывает опасности впереди.",
        "Перед вами простирается заброшенная деревня. Пустые окна домов смотрят на вас как мёртвые глаза.",
        "Вы стоите у входа в древнюю пещеру. Оттуда доносятся странные звуки и слабое свечение.",
        "Дорога ведёт к мрачному замку на холме. Вороны кружат над его башнями.",
        "Вы обнаруживаете руины старого храма. Магическая энергия пульсирует в воздухе."
    ];
    
    const scene = action 
        ? `После действия "${action}" обстановка изменилась. ${scenes[Math.floor(Math.random() * scenes.length)]}`
        : scenes[Math.floor(Math.random() * scenes.length)];
    
    const baseActions = ['Осмотреться вокруг', 'Продолжить путь', 'Остановиться и подумать'];
    const classActions = getClassBasedActions(character.class);
    
    return {
        scene,
        actions: [...baseActions, classActions[Math.floor(Math.random() * classActions.length)]]
    };
}

async function generateGameContent(character, sessionMessages, userAction = null) {
    try {
        const prompt = createGamePrompt(character, userAction);
        
        // Пытаемся получить ответ от HuggingFace
        const aiResponse = await callHuggingFaceAPI(prompt, 300);
        
        if (aiResponse) {
            console.log('AI Response:', aiResponse);
            const parsed = parseAIResponse(aiResponse);
            
            // Если удалось извлечь действия из ответа ИИ, используем их
            if (parsed.actions && parsed.actions.length >= 3) {
                return {
                    scene: parsed.scene,
                    actions: parsed.actions
                };
            }
            
            // Если сцена есть, но действий нет, добавляем свои
            if (parsed.scene) {
                const classActions = getClassBasedActions(character.class);
                return {
                    scene: parsed.scene,
                    actions: [
                        'Осмотреться вокруг',
                        'Продолжить путь', 
                        'Использовать навыки',
                        classActions[Math.floor(Math.random() * classActions.length)]
                    ]
                };
            }
        }
        
        // Если ИИ не сработал, используем fallback
        console.log('Using fallback content generation');
        return generateFallbackContent(character, userAction);
        
    } catch (error) {
        console.error('Error generating game content:', error);
        return generateFallbackContent(character, userAction);
    }
}

async function getOrCreateGameSession(characterId) {
    try {
        let session = await GameSession.findOne({ characterId });
        
        if (!session) {
            const character = await Character.findOne({ id: characterId });
            if (!character) {
                throw new Error('Персонаж не найден');
            }

            // Создаём новую сессию с начальной сценой
            const initialContent = await generateGameContent(character, []);
            
            session = new GameSession({
                characterId,
                messages: [
                    { role: 'assistant', content: JSON.stringify(initialContent) }
                ],
                currentScene: initialContent.scene,
                currentActions: initialContent.actions
            });
            
            await session.save();
        }
        
        return session;
    } catch (error) {
        console.error('Error getting or creating game session:', error);
        throw error;
    }
}

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
            connectionString: 'mongodb://admin:***@127.0.0.1:27017/thordridge?authSource=admin'
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

// Game Session endpoints
app.get('/api/game-session/:characterId', async (req, res) => {
    try {
        const characterId = parseInt(req.params.characterId);
        const session = await getOrCreateGameSession(characterId);
        
        res.json({
            scene: session.currentScene,
            actions: session.currentActions
        });
    } catch (err) {
        console.error('Error getting game session:', JSON.stringify(err, null, 2));
        res.status(500).json({ message: 'Ошибка сервера при загрузке игровой сессии' });
    }
});

app.post('/api/perform-action', async (req, res) => {
    try {
        const { characterId, action } = req.body;
        
        if (!characterId || !action) {
            return res.status(400).json({ message: 'Необходимо указать ID персонажа и действие' });
        }
        
        const character = await Character.findOne({ id: characterId });
        if (!character) {
            return res.status(404).json({ message: 'Персонаж не найден' });
        }
        
        const session = await getOrCreateGameSession(characterId);
        
        // Генерируем новую сцену на основе действия
        const newContent = await generateGameContent(character, session.messages, action);
        
        // Обновляем сессию
        session.messages.push(
            { role: 'user', content: `Игрок выбирает действие: ${action}` },
            { role: 'assistant', content: JSON.stringify(newContent) }
        );
        session.currentScene = newContent.scene;
        session.currentActions = newContent.actions;
        session.updatedAt = new Date();
        
        await session.save();
        
        res.json({
            scene: newContent.scene,
            actions: newContent.actions,
            performedAction: action
        });
    } catch (err) {
        console.error('Error performing action:', JSON.stringify(err, null, 2));
        res.status(500).json({ message: 'Ошибка сервера при выполнении действия' });
    }
});

app.delete('/api/game-session/:characterId', async (req, res) => {
    try {
        const characterId = parseInt(req.params.characterId);
        await GameSession.deleteOne({ characterId });
        res.json({ message: 'Игровая сессия сброшена' });
    } catch (err) {
        console.error('Error resetting game session:', JSON.stringify(err, null, 2));
        res.status(500).json({ message: 'Ошибка сервера при сбросе игровой сессии' });
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

app.get('/api/test-mongo-no-auth', async (req, res) => {
    try {
        const mongoose2 = require('mongoose');
        const testConnection = mongoose2.createConnection('mongodb://127.0.0.1:27017/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
        
        testConnection.on('connected', () => {
            testConnection.close();
            res.json({ 
                noauth: 'success',
                message: 'MongoDB basic connection successful (no auth)'
            });
        });
        
        testConnection.on('error', (err) => {
            testConnection.close();
            res.json({ 
                noauth: 'failed',
                error: err.message,
                message: 'MongoDB basic connection failed (no auth)'
            });
        });
        
        setTimeout(() => {
            testConnection.close();
            res.json({ 
                noauth: 'timeout',
                message: 'MongoDB basic connection timeout (no auth)'
            });
        }, 10000);
        
    } catch (err) {
        res.status(500).json({ 
            error: 'No-auth test failed',
            message: err.message
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});