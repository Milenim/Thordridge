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
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'gpt2';
const HUGGINGFACE_API_URL = process.env.HUGGINGFACE_API_URL || 'https://api-inference.huggingface.co/models/';

// Проверенные доступные модели HuggingFace (2024)
const RPG_MODELS = {
    primary: 'gpt2',
    alternative: 'distilgpt2',
    creative: 'openai-community/gpt2-medium',
    story: 'microsoft/DialoGPT-small',
    simple: 'openai-community/gpt2-xl'
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

    // Пробуем разные модели по очереди (от простых к сложным)
    const modelsToTry = [
        process.env.HUGGINGFACE_MODEL || RPG_MODELS.primary,
        RPG_MODELS.alternative,
        RPG_MODELS.creative,
        RPG_MODELS.simple,
        RPG_MODELS.story
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
                        max_new_tokens: Math.min(maxLength, 500),
                        temperature: temperature,
                        do_sample: true,
                        top_p: 0.9,
                        top_k: 50,
                        repetition_penalty: 1.1,
                        return_full_text: false
                    },
                    options: {
                        wait_for_model: true,
                        use_cache: false
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ HuggingFace API error for ${modelName}: ${response.status} - ${errorText.substring(0, 200)}`);
                continue;
            }

            const result = await response.json();
            
            if (result.error) {
                console.error(`HuggingFace API error for ${modelName}:`, result.error);
                continue;
            }

            if (result[0]?.generated_text) {
                console.log(`✅ Successfully generated content using ${modelName}`);
                console.log(`Generated content preview: ${result[0].generated_text.substring(0, 100)}...`);
                return result[0].generated_text;
            }

            console.log(`❌ No generated text for ${modelName}, trying next model`);
        } catch (error) {
            console.error(`🔥 Error calling HuggingFace API for ${modelName}:`, error.message || error);
            continue;
        }
    }

    console.log('🚫 All HuggingFace models failed, using fallback content generation');
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
    // Расширенные сцены по локациям
    const locationScenes = {
        forest: [
            "Ты идёшь по извилистой тропе сквозь дремучий лес Терновой гряды. Древние дубы переплетают свои ветви над головой, создавая живой свод. Сквозь листву пробиваются лучи заходящего солнца, освещая танец пылинок в воздухе.",
            "Тёмная чаща окружает тебя со всех сторон. Корни деревьев причудливо переплетаются под ногами, а в тишине слышен лишь твой собственный шёпот дыхания. Где-то вдали хрустнула ветка."
        ],
        ruins: [
            "Перед тобой простираются руины некогда величественного города. Разрушенные арки и покосившиеся колонны рассказывают историю былого величия. Из трещин в камне пробивается странное голубоватое свечение.",
            "Ты стоишь среди развалин древнего храма. Сломанные статуи богов безмолвно взирают на тебя пустыми глазницами. Ветер свистит между разрушенными стенами, унося эхо забытых молитв."
        ],
        castle: [
            "Мрачный замок возвышается перед тобой на скалистом утёсе. Его чёрные башни пронзают грозовые облака, а единственное окно в главной башне светится зловещим красным светом. Воздух густо пропитан запахом старой крови и серы.",
            "Массивные врата замка приоткрыты, словно приглашая войти. Но что-то в этом приглашении кажется ловушкой. Железные петли скрипят на ветру, а с зубцов стен свисают старые цепи."
        ],
        cemetery: [
            "Заброшенное кладбище простирается перед тобой под бледным светом луны. Покосившиеся надгробия создают лабиринт теней, а из-под земли доносятся едва слышные шорохи. Туман стелется между могил, скрывая древние секреты.",
            "Ты идёшь по узкой тропинке между старых склепов. Некоторые двери приоткрыты, зияя чёрной пустотой. На мраморных плитах едва различимы стёртые временем имена и даты."
        ],
        tavern: [
            "Ты входишь в полутёмную таверну 'Золотой Грифон'. Тёплый свет очага играет на закопчённых стенах, а воздух наполнен ароматом эля и жареного мяса. За столами сидят странные путники, каждый из которых хранит свои секреты.",
            "Трактир гудит от разговоров и смеха. Бардочка в углу наигрывает печальную мелодию на лютне, а хозяин таверны полирует кружки, внимательно прислушиваясь к беседам гостей."
        ]
    };

    // Умные переходы действий
    const actionResponses = {
        exploration: [
            `Решив ${action.toLowerCase()}, ты обнаруживаешь нечто неожиданное.`,
            `Твоё решение ${action.toLowerCase()} приводит к удивительной находке.`,
            `Когда ты ${action.toLowerCase()}, окружающий мир словно отвечает на твои действия.`
        ],
        social: [
            `Пытаясь ${action.toLowerCase()}, ты замечаешь изменения в поведении окружающих.`,
            `Твоя попытка ${action.toLowerCase()} вызывает неожиданную реакцию.`,
            `${action} открывает новые возможности для взаимодействия.`
        ],
        combat: [
            `Готовясь к ${action.toLowerCase()}, ты чувствуешь, как адреналин разгоняет кровь по венам.`,
            `Твоё намерение ${action.toLowerCase()} меняет атмосферу вокруг - опасность витает в воздухе.`,
            `${action} - мудрое решение в данной ситуации, учитывая твои навыки.`
        ],
        magic: [
            `Концентрируясь на ${action.toLowerCase()}, ты чувствуешь, как магические силы откликаются на твой зов.`,
            `Попытка ${action.toLowerCase()} пробуждает древние энергии в этом месте.`,
            `${action} заставляет воздух вокруг тебя мерцать от магической энергии.`
        ]
    };

    let scene;
    if (action) {
        // Определяем тип действия для более точного ответа
        const actionType = determineActionType(action, character.class);
        const responses = actionResponses[actionType] || actionResponses.exploration;
        const response = responses[Math.floor(Math.random() * responses.length)];
        
        // Выбираем локацию на основе контекста
        const location = determineLocation(previousContext, action);
        const locationSceneArray = locationScenes[location] || locationScenes.forest;
        const locationScene = locationSceneArray[Math.floor(Math.random() * locationSceneArray.length)];
        
        scene = `${response} ${locationScene}`;
    } else {
        // Начальная сцена - выбираем случайную локацию
        const locations = Object.keys(locationScenes);
        const randomLocation = locations[Math.floor(Math.random() * locations.length)];
        const locationSceneArray = locationScenes[randomLocation];
        scene = locationSceneArray[Math.floor(Math.random() * locationSceneArray.length)];
    }
    
    // Генерируем более разнообразные действия
    const baseActions = generateVariedActions(character, action);
    const classActions = getClassBasedActions(character.class);
    const contextActions = getContextBasedActions(scene);
    
    // Смешиваем и выбираем лучшие
    const allActions = [...baseActions, ...classActions, ...contextActions];
    const selectedActions = selectBestActions(allActions, 4);
    
    return {
        scene,
        actions: selectedActions
    };
}

function determineActionType(action, characterClass) {
    const actionLower = action.toLowerCase();
    
    // Магические действия
    if (actionLower.includes('магия') || actionLower.includes('заклинание') || actionLower.includes('энергия') || 
        ['Чародей', 'Волшебник', 'Друид', 'Жрец', 'Паладин', 'Колдун'].includes(characterClass)) {
        return 'magic';
    }
    
    // Боевые действия
    if (actionLower.includes('бой') || actionLower.includes('атак') || actionLower.includes('оружие') || 
        actionLower.includes('защита') || actionLower.includes('удар')) {
        return 'combat';
    }
    
    // Социальные действия
    if (actionLower.includes('говор') || actionLower.includes('убед') || actionLower.includes('переговор') || 
        actionLower.includes('спрос')) {
        return 'social';
    }
    
    return 'exploration';
}

function determineLocation(context, action) {
    const contextLower = (context + ' ' + (action || '')).toLowerCase();
    
    if (contextLower.includes('лес') || contextLower.includes('дерев') || contextLower.includes('тропа')) return 'forest';
    if (contextLower.includes('руины') || contextLower.includes('развал') || contextLower.includes('храм')) return 'ruins';
    if (contextLower.includes('замок') || contextLower.includes('башня') || contextLower.includes('крепость')) return 'castle';
    if (contextLower.includes('кладбище') || contextLower.includes('могил') || contextLower.includes('склеп')) return 'cemetery';
    if (contextLower.includes('таверна') || contextLower.includes('трактир') || contextLower.includes('гостиница')) return 'tavern';
    
    return 'forest'; // по умолчанию
}

function generateVariedActions(character, previousAction) {
    const explorationActions = [
        'Внимательно осмотреться вокруг',
        'Проследить за звуками в тишине',
        'Исследовать ближайшие объекты',
        'Найти безопасное место для отдыха'
    ];
    
    const movementActions = [
        'Продолжить путь осторожно',
        'Свернуть с основной дороги',
        'Вернуться назад',
        'Подняться на возвышенность для обзора'
    ];
    
    const interactionActions = [
        'Попытаться найти следы других путников',
        'Прислушаться к звукам природы',
        'Проверить свою экипировку',
        'Изучить карту местности'
    ];
    
    // Избегаем повторений предыдущего действия
    const allActions = [...explorationActions, ...movementActions, ...interactionActions];
    return allActions.filter(action => action !== previousAction);
}

function getContextBasedActions(scene) {
    const sceneLower = scene.toLowerCase();
    
    if (sceneLower.includes('лес') || sceneLower.includes('дерев')) {
        return [
            'Собрать лекарственные травы',
            'Поискать следы диких животных',
            'Найти источник воды'
        ];
    }
    
    if (sceneLower.includes('руины') || sceneLower.includes('развал')) {
        return [
            'Исследовать древние надписи',
            'Поискать ценные артефакты',
            'Проверить устойчивость конструкций'
        ];
    }
    
    if (sceneLower.includes('замок') || sceneLower.includes('башня')) {
        return [
            'Попытаться найти тайный проход',
            'Изучить архитектуру строения',
            'Подслушать разговоры внутри'
        ];
    }
    
    if (sceneLower.includes('кладбище') || sceneLower.includes('могил')) {
        return [
            'Прочитать надписи на надгробиях',
            'Поискать признаки нежити',
            'Найти самую старую могилу'
        ];
    }
    
    return [
        'Оценить текущую ситуацию',
        'Подготовиться к неожиданностям'
    ];
}

function selectBestActions(actions, count) {
    // Убираем дубликаты
    const uniqueActions = [...new Set(actions)];
    
    // Если действий мало, возвращаем все
    if (uniqueActions.length <= count) {
        return uniqueActions;
    }
    
    // Случайно выбираем нужное количество
    const shuffled = uniqueActions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
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

// Test HuggingFace API endpoint
app.get('/api/test-huggingface', async (req, res) => {
    try {
        if (!HUGGINGFACE_API_KEY) {
            return res.json({
                status: 'no_api_key',
                message: 'HuggingFace API key not configured',
                models_to_test: Object.values(RPG_MODELS)
            });
        }

        const testPrompt = "Привет, это тест нейросети.";
        const results = [];

        for (const modelName of Object.values(RPG_MODELS)) {
            try {
                console.log(`Testing model: ${modelName}`);
                const response = await fetch(`${HUGGINGFACE_API_URL}${modelName}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: testPrompt,
                        parameters: {
                            max_new_tokens: 50,
                            temperature: 0.7
                        },
                        options: {
                            wait_for_model: true,
                            use_cache: false
                        }
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    results.push({
                        model: modelName,
                        status: 'success',
                        response: result[0]?.generated_text || result
                    });
                    break; // Если одна модель работает, останавливаемся
                } else {
                    results.push({
                        model: modelName,
                        status: 'failed',
                        error: `HTTP ${response.status}`
                    });
                }
            } catch (error) {
                results.push({
                    model: modelName,
                    status: 'error',
                    error: error.message
                });
            }
        }

        res.json({
            status: 'tested',
            api_key_configured: true,
            results: results,
            working_models: results.filter(r => r.status === 'success').length,
            total_models: results.length
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});