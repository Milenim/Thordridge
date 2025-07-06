// Улучшенный игровой мастер для D&D игры
// Объединяет все системы для создания реалистичного игрового опыта

const {
    ENHANCED_LOCATIONS,
    NPC_DATABASE,
    DYNAMIC_EVENTS,
    COMBAT_SYSTEM,
    CHARACTER_STATES,
    QUEST_SYSTEM,
    LOOT_SYSTEM
} = require('./enhancedGameMaster');

// ============ ОСНОВНАЯ ЛОГИКА ИГРОВОГО МАСТЕРА ============

class AdvancedGameMaster {
    constructor() {
        this.currentLocation = null;
        this.currentSublocation = null;
        this.activeQuests = [];
        this.gameState = {
            weather: 'clear',
            timeOfDay: 'day',
            globalEvents: [],
            npcRelationships: {}
        };
    }

    // Генерация улучшенного контента
    generateEnhancedContent(character, action = null, previousContext = '', gameSession = null) {
        try {
            // Определяем текущую локацию
            const location = this.determineLocation(previousContext, action);
            const sublocation = this.selectSublocation(location);
            
            // Проверяем наличие активных квестов
            const activeQuests = this.getActiveQuests(character.id);
            
            // Генерируем случайное событие
            const randomEvent = this.generateRandomEvent(sublocation, character);
            
            // Создаем базовую сцену
            let scene = this.createDetailedScene(location, sublocation, character, action, randomEvent);
            
            // Добавляем информацию о состоянии персонажа
            scene += this.addCharacterStateInfo(character);
            
            // Добавляем информацию о погоде и времени
            scene += this.addEnvironmentalInfo(location);
            
            // Генерируем действия с учетом всех систем
            const actions = this.generateIntelligentActions(character, location, sublocation, randomEvent, activeQuests);
            
            // Обрабатываем результаты предыдущего действия
            const actionResults = action ? this.processActionResults(action, character, sublocation, randomEvent) : null;
            
            return {
                scene,
                actions,
                location: location.name,
                sublocation: sublocation.name,
                event: randomEvent ? randomEvent.name : null,
                characterState: this.getCharacterState(character),
                actionResults,
                quests: activeQuests
            };
        } catch (error) {
            console.error('Ошибка в generateEnhancedContent:', error);
            return this.generateFallbackContent(character, action);
        }
    }

    // Определение локации на основе контекста
    determineLocation(context, action) {
        const contextLower = (context + ' ' + (action || '')).toLowerCase();
        
        // Проверяем ключевые слова для определения типа локации
        if (contextLower.includes('город') || contextLower.includes('рынок') || contextLower.includes('таверна')) {
            return ENHANCED_LOCATIONS.city;
        }
        if (contextLower.includes('подземелье') || contextLower.includes('катакомб') || contextLower.includes('руины')) {
            return ENHANCED_LOCATIONS.dungeon;
        }
        
        // По умолчанию лес
        return ENHANCED_LOCATIONS.forest;
    }

    // Выбор подлокации
    selectSublocation(location) {
        const sublocations = Object.values(location.sublocations);
        
        // Выбираем случайную подлокацию с учетом вероятностей
        const weights = sublocations.map(sub => {
            // Безопасные локации имеют больший вес
            if (sub.events.some(e => e.includes('safe') || e.includes('healing'))) {
                return 0.4;
            }
            // Опасные локации имеют меньший вес
            if (sub.events.some(e => e.includes('combat') || e.includes('danger'))) {
                return 0.2;
            }
            return 0.3;
        });
        
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        const random = Math.random() * totalWeight;
        
        let currentWeight = 0;
        for (let i = 0; i < sublocations.length; i++) {
            currentWeight += weights[i];
            if (random <= currentWeight) {
                return sublocations[i];
            }
        }
        
        return sublocations[0];
    }

    // Генерация случайного события
    generateRandomEvent(sublocation, character) {
        const availableEvents = sublocation.events;
        
        // Проверяем каждое событие на вероятность срабатывания
        for (const eventId of availableEvents) {
            const event = DYNAMIC_EVENTS[eventId];
            if (event && Math.random() < event.trigger_chance) {
                return event;
            }
        }
        
        return null;
    }

    // Создание детальной сцены
    createDetailedScene(location, sublocation, character, action, event) {
        let scene = '';
        
        // Если есть действие, описываем его результат
        if (action) {
            scene += this.describeActionResult(action, character, sublocation) + '\n\n';
        }
        
        // Добавляем описание локации
        const descriptions = sublocation.description;
        const selectedDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
        scene += selectedDescription;
        
        // Добавляем описание события, если оно есть
        if (event) {
            scene += '\n\n' + this.describeEvent(event, character);
        }
        
        // Добавляем информацию о присутствующих NPC
        const npcs = this.getNPCsInLocation(sublocation);
        if (npcs.length > 0) {
            scene += '\n\n' + this.describeNPCs(npcs);
        }
        
        return scene;
    }

    // Описание результата действия
    describeActionResult(action, character, sublocation) {
        const actionLower = action.toLowerCase();
        
        // Определяем тип действия
        if (actionLower.includes('осмотр') || actionLower.includes('исследов')) {
            return `Внимательно осматриваясь, ты замечаешь детали, которые ускользнули от беглого взгляда.`;
        }
        
        if (actionLower.includes('поговор') || actionLower.includes('диалог')) {
            return `Твоя попытка завязать разговор привлекает внимание окружающих.`;
        }
        
        if (actionLower.includes('магия') || actionLower.includes('заклинание')) {
            return `Сосредоточившись, ты чувствуешь, как магическая энергия пульсирует в твоих венах.`;
        }
        
        if (actionLower.includes('атак') || actionLower.includes('бой')) {
            return `Приготовившись к бою, ты ощущаешь, как адреналин обостряет твои чувства.`;
        }
        
        return `Решив ${action.toLowerCase()}, ты действуешь решительно и уверенно.`;
    }

    // Описание события
    describeEvent(event, character) {
        let description = event.description;
        
        // Добавляем контекст в зависимости от класса персонажа
        const charClass = character.class;
        if (charClass === 'Волшебник' && event.name.includes('магия')) {
            description += ' Твои знания магии подсказывают, что здесь происходит нечто необычное.';
        }
        
        if (charClass === 'Следопыт' && event.name.includes('природа')) {
            description += ' Твоя связь с природой позволяет тебе почувствовать нарушение естественного баланса.';
        }
        
        if (charClass === 'Плут' && event.name.includes('торговец')) {
            description += ' Твой опыт подсказывает, что здесь может быть выгодная сделка.';
        }
        
        return description;
    }

    // Получение NPC в локации
    getNPCsInLocation(sublocation) {
        const npcs = [];
        
        for (const npcId of sublocation.npcs) {
            const npc = NPC_DATABASE[npcId];
            if (npc && Math.random() < 0.6) { // 60% шанс встретить NPC
                npcs.push(npc);
            }
        }
        
        return npcs;
    }

    // Описание NPC
    describeNPCs(npcs) {
        if (npcs.length === 0) return '';
        
        let description = '';
        
        if (npcs.length === 1) {
            const npc = npcs[0];
            description = `Здесь ты встречаешь ${npc.name}. ${npc.appearance}`;
        } else {
            description = 'Здесь ты видишь несколько интересных персонажей:';
            npcs.forEach(npc => {
                description += `\n- ${npc.name}: ${npc.appearance}`;
            });
        }
        
        return description;
    }

    // Добавление информации о состоянии персонажа
    addCharacterStateInfo(character) {
        // Здесь можно добавить информацию о здоровье, мане, усталости
        // Пока возвращаем пустую строку, но логика готова к расширению
        return '';
    }

    // Добавление информации об окружающей среде
    addEnvironmentalInfo(location) {
        let info = '';
        
        // Добавляем информацию о погоде, если локация поддерживает погодные эффекты
        if (location.weather_effects) {
            const weather = this.getCurrentWeather();
            if (weather !== 'clear') {
                info += `\n\nПогода: ${this.getWeatherDescription(weather)}`;
            }
        }
        
        // Добавляем информацию о времени суток
        const timeOfDay = this.getTimeOfDay();
        if (timeOfDay !== 'day') {
            info += `\n\n${this.getTimeDescription(timeOfDay)}`;
        }
        
        return info;
    }

    // Генерация умных действий
    generateIntelligentActions(character, location, sublocation, event, activeQuests) {
        const actions = [];
        
        // Базовые действия для исследования
        actions.push('Внимательно осмотреться вокруг');
        
        // Действия, связанные с NPC
        const npcs = this.getNPCsInLocation(sublocation);
        if (npcs.length > 0) {
            actions.push(`Поговорить с ${npcs[0].name}`);
        }
        
        // Действия, связанные с событием
        if (event) {
            const eventActions = this.getEventActions(event);
            actions.push(...eventActions);
        }
        
        // Действия, связанные с квестами
        if (activeQuests.length > 0) {
            const questAction = this.getQuestAction(activeQuests[0], sublocation);
            if (questAction) {
                actions.push(questAction);
            }
        }
        
        // Действия, специфичные для класса
        const classActions = this.getClassSpecificActions(character.class, sublocation);
        actions.push(...classActions);
        
        // Действия, связанные с локацией
        const locationActions = this.getLocationSpecificActions(sublocation);
        actions.push(...locationActions);
        
        // Убираем дубликаты и возвращаем случайные 4 действия
        const uniqueActions = [...new Set(actions)];
        return this.selectRandomActions(uniqueActions, 4);
    }

    // Получение действий для события
    getEventActions(event) {
        const actions = [];
        
        for (const outcome in event.outcomes) {
            switch (outcome) {
                case 'friendly':
                    actions.push('Дружелюбно поприветствовать');
                    break;
                case 'hostile':
                    actions.push('Приготовиться к бою');
                    break;
                case 'ignore':
                    actions.push('Проигнорировать и пройти мимо');
                    break;
                case 'investigate':
                    actions.push('Осторожно исследовать');
                    break;
                case 'accept':
                    actions.push('Принять предложение');
                    break;
                case 'negotiate':
                    actions.push('Попытаться договориться');
                    break;
                case 'refuse':
                    actions.push('Вежливо отказаться');
                    break;
                case 'fight':
                    actions.push('Атаковать первым');
                    break;
                case 'flee':
                    actions.push('Быстро отступить');
                    break;
                case 'magic':
                    actions.push('Использовать магию');
                    break;
            }
        }
        
        return actions;
    }

    // Получение действий для квеста
    getQuestAction(quest, sublocation) {
        // Здесь логика для определения действий, связанных с активными квестами
        return null; // Заглушка для будущей реализации
    }

    // Получение действий, специфичных для класса
    getClassSpecificActions(characterClass, sublocation) {
        const actions = [];
        
        switch (characterClass) {
            case 'Волшебник':
                actions.push('Проанализировать магические ауры');
                actions.push('Изучить древние символы');
                break;
            case 'Плут':
                actions.push('Поискать скрытые проходы');
                actions.push('Проверить на наличие ловушек');
                break;
            case 'Жрец':
                actions.push('Прочитать молитву');
                actions.push('Освятить место');
                break;
            case 'Следопыт':
                actions.push('Изучить следы');
                actions.push('Найти безопасный путь');
                break;
            case 'Варвар':
                actions.push('Продемонстрировать силу');
                actions.push('Прислушаться к инстинктам');
                break;
            case 'Друид':
                actions.push('Связаться с природой');
                actions.push('Найти природные ресурсы');
                break;
        }
        
        return actions;
    }

    // Получение действий, специфичных для локации
    getLocationSpecificActions(sublocation) {
        const actions = [];
        
        // Анализируем события локации для определения возможных действий
        sublocation.events.forEach(eventId => {
            const event = DYNAMIC_EVENTS[eventId];
            if (event) {
                switch (eventId) {
                    case 'fairy_encounter':
                        actions.push('Поискать других фей');
                        break;
                    case 'merchant_deal':
                        actions.push('Изучить товары торговцев');
                        break;
                    case 'thieves_guild':
                        actions.push('Поискать контакты в подземном мире');
                        break;
                    case 'ancient_inscription':
                        actions.push('Расшифровать древние письмена');
                        break;
                }
            }
        });
        
        return actions;
    }

    // Выбор случайных действий
    selectRandomActions(actions, count) {
        const shuffled = [...actions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // Обработка результатов действия
    processActionResults(action, character, sublocation, event) {
        // Здесь логика для обработки результатов действий
        // Возвращает объект с результатами (опыт, лут, изменения состояния)
        return {
            xp: 0,
            gold: 0,
            items: [],
            stateChanges: {}
        };
    }

    // Получение состояния персонажа
    getCharacterState(character) {
        // Здесь логика для получения текущего состояния персонажа
        return {
            health: 100,
            mana: 50,
            stamina: 100,
            level: character.level,
            xp: character.xp
        };
    }

    // Получение активных квестов
    getActiveQuests(characterId) {
        // Заглушка для будущей реализации системы квестов
        return [];
    }

    // Вспомогательные методы для погоды и времени
    getCurrentWeather() {
        return this.gameState.weather;
    }

    getTimeOfDay() {
        return this.gameState.timeOfDay;
    }

    getWeatherDescription(weather) {
        const descriptions = {
            rain: 'Моросящий дождь создает мрачную атмосферу.',
            storm: 'Гроза грохочет над головой, молнии освещают небо.',
            fog: 'Густой туман окутывает всё вокруг.',
            snow: 'Мягкий снег тихо падает, покрывая всё белым покрывалом.'
        };
        return descriptions[weather] || '';
    }

    getTimeDescription(time) {
        const descriptions = {
            dawn: 'Первые лучи рассвета окрашивают небо в розовые тона.',
            dusk: 'Сумерки опускаются на землю, создавая таинственную атмосферу.',
            night: 'Ночная тьма окутывает всё вокруг, лишь звёзды освещают путь.'
        };
        return descriptions[time] || '';
    }

    // Генерация запасного контента (на случай ошибок)
    generateFallbackContent(character, action) {
        return {
            scene: 'Ты находишься в загадочном месте мира Терновой гряды. Вокруг тебя простирается неизведанная территория, полная тайн и возможностей.',
            actions: [
                'Осмотреться вокруг',
                'Продолжить путь',
                'Поискать укрытие',
                'Использовать навыки своего класса'
            ],
            location: 'Неизвестная локация',
            sublocation: 'Неизвестная область',
            event: null,
            characterState: this.getCharacterState(character),
            actionResults: null,
            quests: []
        };
    }
}

module.exports = AdvancedGameMaster; 