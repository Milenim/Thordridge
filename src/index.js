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
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'microsoft/DialoGPT-large';
const HUGGINGFACE_API_URL = process.env.HUGGINGFACE_API_URL || 'https://api-inference.huggingface.co/models/';

// Альтернативные модели для генерации RPG контента
const RPG_MODELS = {
    primary: 'microsoft/DialoGPT-large',
    alternative: 'gpt2',
    creative: 'EleutherAI/gpt-neo-1.3B'
};

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
function createDetailedGamePrompt(character, action = null, previousContext = '') {
    const characterInfo = `${character.name} - ${character.race} ${character.class} ${character.level} уровня`;
    const stats = `Сила: ${character.stats.strength}, Ловкость: ${character.stats.dexterity}, Телосложение: ${character.stats.constitution}, Мудрость: ${character.stats.wisdom}, Интеллект: ${character.stats.intelligence}, Харизма: ${character.stats.charisma}`;
    
    const basePrompt = `Ты - Мастер игры в настольную RPG "Dungeons & Dragons" в мрачном фэнтези мире "Терновая гряда".

ПЕРСОНАЖ: ${characterInfo}
ХАРАКТЕРИСТИКИ: ${stats}
ИНВЕНТАРЬ: ${character.inventory.map(item => `${item.item} (${item.quantity})`).join(', ') || 'пуст'}

ПРАВИЛА ОТВЕТА:
1. Всегда отвечай на русском языке
2. Пиши в атмосферном стиле тёмного фэнтези
3. Описывай сцены ярко и детально (2-3 предложения)
4. ОБЯЗАТЕЛЬНО пиши от второго лица (ты делаешь, ты видишь, ты слышишь)
5. НЕ используй фразы "При выборе варианта", "После действия", "Игрок делает"
6. Пиши естественно и погружающе, как будто читатель сам выполняет действия
7. Предлагай РОВНО 4 варианта действий
8. Варианты действий должны быть разнообразными: боевые, дипломатические, исследовательские, классовые
9. Учитывай класс персонажа при формировании вариантов действий
10. Каждый вариант действия должен быть написан с новой строки и начинаться с "- "

КОНТЕКСТ: ${previousContext || 'Персонаж начинает приключение в мрачном мире Терновой гряды.'}`;

    if (action) {
        return `${basePrompt}

ДЕЙСТВИЕ ИГРОКА: ${action}

Опиши что происходит, когда персонаж выполняет это действие. Пиши от второго лица (ты делаешь, ты видишь, ты чувствуешь). НЕ используй фразы "При выборе варианта" или "После действия". Пиши естественно и погружающе, как будто игрок сам это делает.

Затем предложи 4 новых варианта действий для продолжения приключения.

ОТВЕТ:`;
    } else {
        return `${basePrompt}

Создай начальную сцену приключения. Опиши где находится персонаж и что он видит вокруг себя. Пиши от второго лица (ты находишься, ты видишь, ты слышишь).

Затем предложи 4 варианта действий для начала игры.

ОТВЕТ:`;
    }
}

async function callHuggingFaceAPI(prompt, maxLength = 400, temperature = 0.7) {
    if (!HUGGINGFACE_API_KEY) {
        console.log('HuggingFace API key not provided, using fallback');
        return null;
    }

    // Пробуем разные модели по очереди
    const modelsToTry = [
        process.env.HUGGINGFACE_MODEL || RPG_MODELS.primary,
        RPG_MODELS.alternative,
        RPG_MODELS.creative
    ];

    for (const modelName of modelsToTry) {
        try {
            console.log(`Trying model: ${modelName}`);
            
            const response = await fetch(`${HUGGINGFACE_API_URL}${modelName}`, {
                headers: {
                    Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                method: 'POST',
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_length: maxLength,
                        temperature: temperature,
                        do_sample: true,
                        top_p: 0.9,
                        top_k: 50,
                        repetition_penalty: 1.1,
                        num_return_sequences: 1,
                        pad_token_id: 50256,
                        return_full_text: false
                    },
                    options: {
                        wait_for_model: true
                    }
                }),
            });

            if (!response.ok) {
                console.error(`HuggingFace API error for ${modelName}: ${response.status}`);
                continue;
            }

            const result = await response.json();
            
            if (result.error) {
                console.error(`HuggingFace API error for ${modelName}:`, result.error);
                continue;
            }

            if (result[0]?.generated_text) {
                console.log(`Successfully generated content using ${modelName}`);
                return result[0].generated_text;
            }

            console.log(`No generated text for ${modelName}, trying next model`);
        } catch (error) {
            console.error(`Error calling HuggingFace API for ${modelName}:`, error);
            continue;
        }
    }

    return null;
}

function parseAIResponse(response) {
    if (!response) return null;

    // Очищаем ответ от лишних символов
    let cleanResponse = response.replace(/^[^А-Яа-яЁё]*/, '').trim();
    
    // Разделяем на части по ключевым словам
    const sections = cleanResponse.split(/(?:действия|варианты|выбор|можете|можно)[\s\w]*:/i);
    
    let scene = '';
    let actions = [];
    
    if (sections.length >= 2) {
        // Первая часть - описание сцены
        scene = sections[0].trim();
        
        // Вторая часть - действия
        const actionText = sections[1];
        actions = extractActionsFromText(actionText);
    } else {
        // Если не удалось разделить, пробуем найти действия по маркерам
        const lines = cleanResponse.split('\n').filter(line => line.trim());
        
        let sceneLines = [];
        let actionLines = [];
        let foundActions = false;
        
        for (const line of lines) {
            if (line.match(/^[\s]*[-\*\d\.]\s*/) || line.toLowerCase().includes('действие')) {
                foundActions = true;
            }
            
            if (foundActions && line.match(/^[\s]*[-\*\d\.]\s*/)) {
                actionLines.push(line);
            } else if (!foundActions) {
                sceneLines.push(line);
            }
        }
        
        scene = sceneLines.join(' ').trim();
        actions = actionLines.map(line => line.replace(/^[\s]*[-\*\d\.]\s*/, '').trim()).filter(action => action.length > 0);
    }
    
    // Если сцена слишком короткая, используем весь ответ
    if (scene.length < 50) {
        scene = cleanResponse.substring(0, 300).trim();
    }
    
    // Убираем нежелательные фразы из сцены
    scene = scene.replace(/При выборе варианта[^.]*\./gi, '');
    scene = scene.replace(/После действия[^.]*\./gi, '');
    scene = scene.replace(/Игрок[^.]*\./gi, '');
    scene = scene.trim();
    
    // Если действий недостаточно, дополняем базовыми
    if (actions.length < 4) {
        const baseActions = ['Осмотреться внимательнее', 'Продолжить путь осторожно', 'Остановиться и подумать', 'Использовать свои навыки'];
        actions = [...actions, ...baseActions].slice(0, 4);
    }
    
    return {
        scene: scene || 'Вы находитесь в загадочном месте Терновой гряды...',
        actions: actions.slice(0, 4)
    };
}

function extractActionsFromText(text) {
    const actions = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Поиск действий с маркерами
        if (trimmed.match(/^[\s]*[-\*\d\.]\s*(.+)$/)) {
            const action = trimmed.replace(/^[\s]*[-\*\d\.]\s*/, '').trim();
            if (action.length > 3 && action.length < 100) {
                actions.push(action);
            }
        }
    }
    
    return actions;
}

function getClassBasedActions(characterClass) {
    const actionsByClass = {
        'Воин': ['Изучить тактическую позицию', 'Проверить оружие и доспехи', 'Выполнить боевой приём', 'Занять оборонительную позицию'],
        'Варвар': ['Прислушаться к зову дикой природы', 'Войти в боевое бешенство', 'Использовать первобытные инстинкты', 'Запугать противника'],
        'Монах': ['Медитировать для обретения ясности', 'Использовать дыхательные техники', 'Применить боевые искусства', 'Найти внутреннее равновесие'],
        'Чародей': ['Почувствовать магические потоки', 'Использовать врождённую магию', 'Создать магический эффект', 'Призвать силы стихий'],
        'Друид': ['Пообщаться с природой', 'Превратиться в животное', 'Использовать природную магию', 'Прочитать знаки природы'],
        'Волшебник': ['Изучить магические ауры', 'Применить заклинание', 'Консультироваться с заклинательной книгой', 'Провести магический анализ'],
        'Жрец': ['Помолиться своему божеству', 'Использовать божественную магию', 'Освятить место', 'Изгнать нежить'],
        'Паладин': ['Произнести священную клятву', 'Использовать божественные силы', 'Обнаружить зло', 'Защитить невинных'],
        'Колдун': ['Связаться с покровителем', 'Использовать тёмную магию', 'Призвать мистические силы', 'Заключить магическую сделку'],
        'Следопыт': ['Исследовать следы', 'Использовать знания о природе', 'Выследить цель', 'Применить навыки выживания'],
        'Плут': ['Осмотреться в поисках скрытого', 'Использовать воровские навыки', 'Скрыться в тенях', 'Вскрыть замок или ловушку']
    };
    
    return actionsByClass[characterClass] || ['Осмотреться вокруг', 'Продолжить путь', 'Подождать развития событий', 'Использовать базовые навыки'];
}

function generateFallbackContent(character, action = null, previousContext = '') {
    const scenes = [
        "Ты идёшь по тропе, окутанной древним туманом Терновой гряды. Вековые деревья возвышаются как безмолвные стражи, их ветви переплетаются в причудливые узоры. Где-то вдали ты слышишь волчий вой.",
        "Перед тобой простираются руины некогда величественного города. Разрушенные башни пронзают сумеречное небо, а из трещин в камне пробивается странное зелёное свечение.",
        "Ты стоишь у подножия мрачного замка на скалистом утёсе. Его чёрные башни теряются в облаках, а единственное окно светится зловещим красным светом. Воздух наполнен запахом серы и старой крови.",
        "Ты находишься на заброшенном кладбище под бледной луной. Покосившиеся надгробия создают лабиринт теней, а из-под земли доносятся странные звуки. Туман стелется между могил.",
        "Тёмный лес встречает тебя шёпотом листьев и треском веток. Тропинка едва различима в густой тени, а ты чувствуешь, как глаза неведомых существ следят за каждым твоим шагом из чащи."
    ];
    
    let scene;
    if (action) {
        // Генерируем реакцию на действие
        const actionResponses = [
            `Выполняя "${action}", ты замечаешь, как обстановка вокруг меняется.`,
            `Когда ты ${action.toLowerCase()}, происходит нечто неожиданное.`,
            `${action} приводит к неожиданному повороту событий.`
        ];
        const response = actionResponses[Math.floor(Math.random() * actionResponses.length)];
        scene = `${response} ${scenes[Math.floor(Math.random() * scenes.length)]}`;
    } else {
        scene = scenes[Math.floor(Math.random() * scenes.length)];
    }
    
    const baseActions = ['Осмотреться внимательнее', 'Продолжить путь осторожно', 'Остановиться и прислушаться'];
    const classActions = getClassBasedActions(character.class);
    const randomClassAction = classActions[Math.floor(Math.random() * classActions.length)];
    
    return {
        scene,
        actions: [...baseActions, randomClassAction]
    };
}

async function generateGameContent(character, sessionMessages, userAction = null) {
    try {
        // Формируем контекст из предыдущих сообщений
        const previousContext = sessionMessages
            .slice(-3) // Берём последние 3 сообщения для контекста
            .map(msg => msg.content)
            .join(' ');
        
        const prompt = createDetailedGamePrompt(character, userAction, previousContext);
        console.log('Generated prompt:', prompt.substring(0, 200) + '...');
        
        // Пытаемся получить ответ от HuggingFace
        const aiResponse = await callHuggingFaceAPI(prompt, 500, 0.8);
        
        if (aiResponse) {
            console.log('AI Response received:', aiResponse.substring(0, 200) + '...');
            const parsed = parseAIResponse(aiResponse);
            
            if (parsed && parsed.scene && parsed.actions && parsed.actions.length >= 3) {
                console.log('Successfully parsed AI response');
                return {
                    scene: parsed.scene,
                    actions: parsed.actions
                };
            }
            
            console.log('AI response parsing failed, using fallback');
        }
        
        // Если ИИ не сработал, используем fallback
        console.log('Using fallback content generation');
        return generateFallbackContent(character, userAction, previousContext);
        
            } catch (error) {
            console.error('Error generating game content:', error);
            return generateFallbackContent(character, userAction, '');
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