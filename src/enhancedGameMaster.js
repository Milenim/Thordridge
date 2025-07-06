// Расширенная система генерации контента для D&D игры
// Создает ощущение настоящего мастера игры

// ============ СИСТЕМА ЛОКАЦИЙ ============

const ENHANCED_LOCATIONS = {
    // Лесные локации
    forest: {
        name: 'Тёмный лес',
        type: 'wilderness',
        danger_level: 'medium',
        weather_effects: true,
        sublocations: {
            grove: {
                name: 'Священная роща',
                description: [
                    'Ты входишь в древнюю рощу, где воздух наполнен магической энергией. Старые дубы образуют почти идеальный круг, а в центре бьёт кристально чистый источник.',
                    'Солнечные лучи пробиваются сквозь густую листву, создавая мистический танец света и тени. Здесь время словно замедлилось.'
                ],
                events: ['fairy_encounter', 'healing_spring', 'druid_ritual'],
                npcs: ['forest_spirit', 'old_druid']
            },
            hunters_camp: {
                name: 'Лагерь охотников',
                description: [
                    'Ты натыкаешься на заброшенный лагерь охотников. Потухший костёр ещё источает слабый дым, а палатки развеваются на ветру.',
                    'Разбросанная экипировка и следы борьбы говорят о том, что здесь произошло что-то страшное. Воздух пропитан тревогой.'
                ],
                events: ['bandits_ambush', 'wounded_hunter', 'treasure_cache'],
                npcs: ['injured_hunter', 'bandit_leader']
            },
            dark_thicket: {
                name: 'Тёмная чаща',
                description: [
                    'Ты погружаешься в самую мрачную часть леса, где деревья растут так густо, что почти не пропускают свет. Воздух здесь холодный и влажный.',
                    'Странные звуки эхом разносятся между стволами, а тени движутся даже там, где нет ветра. Каждый шаг даётся с трудом.'
                ],
                events: ['shadow_creatures', 'lost_traveler', 'cursed_tree'],
                npcs: ['shadow_wolf', 'lost_child']
            }
        }
    },
    
    // Городские локации
    city: {
        name: 'Город Терновник',
        type: 'settlement',
        danger_level: 'low',
        weather_effects: false,
        sublocations: {
            market_square: {
                name: 'Торговая площадь',
                description: [
                    'Шумная торговая площадь полна жизни даже поздним вечером. Торговцы зазывают покупателей, а воздух наполнен ароматами специй и свежеиспечённого хлеба.',
                    'Между прилавками снуют покупатели, а бродячие музыканты играют за монеты. Здесь можно найти всё, что душе угодно.'
                ],
                events: ['merchant_deal', 'pickpocket_attempt', 'street_performance'],
                npcs: ['weapon_merchant', 'information_broker', 'street_musician']
            },
            nobles_quarter: {
                name: 'Квартал знати',
                description: [
                    'Широкие мощёные улицы и величественные особняки создают атмосферу богатства и власти. Стражники в блестящих доспехах патрулируют район.',
                    'Ухоженные сады и фонтаны украшают площади. Здесь каждый камень дышит благородством и древней историей.'
                ],
                events: ['noble_intrigue', 'guard_patrol', 'masquerade_ball'],
                npcs: ['noble_lord', 'city_guard', 'court_spy']
            },
            underground: {
                name: 'Подземелья города',
                description: [
                    'Ты спускаешься в лабиринт подземных туннелей под городом. Факелы едва освещают каменные стены, покрытые мхом и странными символами.',
                    'Здесь царит другой мир - мир воров, контрабандистов и тех, кто предпочитает оставаться в тени. Воздух пропитан опасностью.'
                ],
                events: ['thieves_guild', 'smuggling_operation', 'underground_fight'],
                npcs: ['thieves_leader', 'smuggler', 'underground_fighter']
            }
        }
    },

    // Подземелья
    dungeon: {
        name: 'Древние катакомбы',
        type: 'dungeon',
        danger_level: 'high',
        weather_effects: false,
        sublocations: {
            entrance_hall: {
                name: 'Входной зал',
                description: [
                    'Массивные каменные двери скрипят, открывая вход в древние катакомбы. Воздух холодный и затхлый, пропитанный запахом старости и смерти.',
                    'Твои шаги эхом разносятся по высоким сводам. На стенах видны древние фрески, изображающие неизвестные ритуалы.'
                ],
                events: ['trap_activation', 'skeleton_guards', 'ancient_inscription'],
                npcs: ['skeleton_warrior', 'ghost_guardian']
            },
            treasure_chamber: {
                name: 'Сокровищница',
                description: [
                    'Ты входишь в огромную подземную залу, где груды золота и драгоценностей переливаются в свете факелов. Воздух здесь кажется плотнее от магической энергии.',
                    'Но что-то подсказывает тебе, что эти сокровища охраняются не просто так. Тишина зала кажется зловещей.'
                ],
                events: ['treasure_guardian', 'cursed_gold', 'magic_trap'],
                npcs: ['ancient_dragon', 'treasure_golem']
            },
            ritual_chamber: {
                name: 'Ритуальная палата',
                description: [
                    'Круглая комната с высоким сводом. В центре - каменный алтарь, покрытый тёмными пятнами. Стены украшены зловещими символами.',
                    'Воздух здесь гудит от тёмной магии. Ты чувствуешь, как волоски на затылке встают дыбом от присутствия чего-то древнего и злого.'
                ],
                events: ['dark_ritual', 'demon_summoning', 'cult_meeting'],
                npcs: ['cult_leader', 'bound_demon', 'sacrificial_victim']
            }
        }
    }
};

// ============ СИСТЕМА NPC ============

const NPC_DATABASE = {
    // Лесные NPC
    forest_spirit: {
        name: 'Дух леса',
        type: 'magical_creature',
        attitude: 'neutral',
        appearance: 'Полупрозрачная фигура из света и листьев, постоянно меняющая форму',
        personality: ['мудрый', 'загадочный', 'древний'],
        dialogue: {
            greeting: 'Смертный... что привело тебя в мои древние владения?',
            quest: 'Тёмные силы осквернили священные источники. Очисти их, и получишь моё благословение.',
            reward: 'Принимай дар природы, защитник леса.',
            farewell: 'Лес запомнит твою доброту, странник.'
        },
        abilities: ['forest_blessing', 'nature_guidance', 'plant_communication'],
        trades: ['healing_herbs', 'nature_magic_items']
    },
    
    old_druid: {
        name: 'Старый друид Элариан',
        type: 'human',
        attitude: 'friendly',
        appearance: 'Седобородый старец в простой коричневой робе, с посохом из живого дерева',
        personality: ['мудрый', 'спокойный', 'знающий'],
        dialogue: {
            greeting: 'Приветствую тебя, дитя. Лес шепчет мне о твоих добрых намерениях.',
            quest: 'Звери в лесу ведут себя странно. Найди источник их беспокойства.',
            reward: 'Вот тебе оберег защиты - он убережёт тебя от зла.',
            farewell: 'Иди с миром, и пусть природа оберегает твой путь.'
        },
        abilities: ['beast_speak', 'healing_magic', 'weather_control'],
        trades: ['potions', 'scrolls', 'druidic_items']
    },

    // Городские NPC
    weapon_merchant: {
        name: 'Торговец оружием Боргрим',
        type: 'dwarf',
        attitude: 'business',
        appearance: 'Коренастый дварф с мощными руками и внимательными глазами',
        personality: ['практичный', 'честный', 'знающий'],
        dialogue: {
            greeting: 'Добро пожаловать в мою кузницу! Ищешь хорошее оружие?',
            quest: 'Мне нужна редкая руда из старых шахт. Принесёшь - дам скидку.',
            reward: 'Отличная работа! Выбирай любое оружие со скидкой.',
            farewell: 'Пусть мои клинки служат тебе верно!'
        },
        abilities: ['weapon_crafting', 'item_appraisal', 'combat_advice'],
        trades: ['weapons', 'armor', 'crafting_materials']
    },

    // Враждебные NPC
    bandit_leader: {
        name: 'Главарь разбойников Чёрный Клык',
        type: 'human',
        attitude: 'hostile',
        appearance: 'Жилистый мужчина со шрамом через всё лицо, в кожаной броне',
        personality: ['жестокий', 'хитрый', 'безжалостный'],
        dialogue: {
            greeting: 'Что ж, что ж... новая жертва сама пришла к нам в руки.',
            combat: 'Убьём его и возьмём всё, что у него есть!',
            defeated: 'Ты... ты сильнее, чем я думал...',
            death: 'Проклятье... я не могу... так закончить...'
        },
        abilities: ['dirty_fighting', 'intimidation', 'ambush_tactics'],
        loot: ['bandit_weapon', 'stolen_gold', 'treasure_map']
    }
};

// ============ СИСТЕМА СОБЫТИЙ ============

const DYNAMIC_EVENTS = {
    // Лесные события
    fairy_encounter: {
        name: 'Встреча с феей',
        trigger_chance: 0.15,
        description: 'Маленькая фея с крылышками бабочки кружится вокруг тебя, оставляя за собой след золотистой пыльцы.',
        outcomes: {
            friendly: 'Фея дарит тебе благословение удачи.',
            ignored: 'Фея улетает, обиженно звеня крылышками.',
            hostile: 'Фея призывает своих сестёр защитить лес.'
        },
        effects: {
            friendly: { luck: +2, fairy_blessing: true },
            ignored: {},
            hostile: { combat: 'angry_fairies' }
        }
    },

    merchant_deal: {
        name: 'Выгодная сделка',
        trigger_chance: 0.2,
        description: 'Торговец предлагает тебе редкий товар по особой цене.',
        outcomes: {
            accept: 'Ты получаешь ценный предмет.',
            negotiate: 'Тебе удаётся сторговаться на лучшую цену.',
            refuse: 'Торговец пожимает плечами и уходит.'
        },
        effects: {
            accept: { gold: -50, item: 'rare_item' },
            negotiate: { gold: -30, item: 'rare_item' },
            refuse: {}
        }
    },

    shadow_creatures: {
        name: 'Теневые существа',
        trigger_chance: 0.25,
        description: 'Из тьмы появляются странные теневые фигуры, медленно окружающие тебя.',
        outcomes: {
            fight: 'Ты сражаешься с теневыми существами.',
            flee: 'Ты убегаешь от преследователей.',
            magic: 'Ты используешь магию света, чтобы отогнать тени.'
        },
        effects: {
            fight: { combat: 'shadow_beasts', xp: 100 },
            flee: { stamina: -10 },
            magic: { mana: -20, xp: 50 }
        }
    }
};

// ============ БОЕВАЯ СИСТЕМА ============

const COMBAT_SYSTEM = {
    enemies: {
        shadow_beast: {
            name: 'Теневой зверь',
            hp: 45,
            attack: 8,
            defense: 5,
            special_abilities: ['shadow_strike', 'fear_aura'],
            weakness: 'light_magic',
            loot: ['shadow_essence', 'dark_crystal']
        },
        
        bandit: {
            name: 'Разбойник',
            hp: 30,
            attack: 6,
            defense: 3,
            special_abilities: ['dirty_fighting'],
            weakness: 'intimidation',
            loot: ['bandit_weapon', 'stolen_coins']
        },
        
        skeleton_warrior: {
            name: 'Воин-скелет',
            hp: 35,
            attack: 7,
            defense: 4,
            special_abilities: ['bone_armor', 'undead_resilience'],
            weakness: 'holy_magic',
            loot: ['ancient_weapon', 'bone_fragments']
        }
    },

    combat_tactics: {
        aggressive: {
            name: 'Агрессивная тактика',
            attack_bonus: 2,
            defense_penalty: 1,
            description: 'Ты атакуешь с удвоенной силой, но теряешь в защите.'
        },
        defensive: {
            name: 'Оборонительная тактика',
            defense_bonus: 2,
            attack_penalty: 1,
            description: 'Ты сосредотачиваешься на защите, жертвуя силой атаки.'
        },
        balanced: {
            name: 'Сбалансированная тактика',
            description: 'Ты сохраняешь равновесие между атакой и защитой.'
        }
    }
};

// ============ СИСТЕМА СОСТОЯНИЙ ============

const CHARACTER_STATES = {
    health: {
        max: 100,
        current: 100,
        effects: {
            injured: { threshold: 50, effect: 'Ты ранен и движешься медленнее.' },
            critical: { threshold: 20, effect: 'Ты серьёзно ранен, каждое движение даётся с трудом.' },
            dying: { threshold: 5, effect: 'Ты на грани смерти.' }
        }
    },
    
    mana: {
        max: 50,
        current: 50,
        effects: {
            low: { threshold: 10, effect: 'Твоя магическая энергия почти истощена.' },
            depleted: { threshold: 0, effect: 'Ты не можешь использовать магию.' }
        }
    },
    
    stamina: {
        max: 100,
        current: 100,
        effects: {
            tired: { threshold: 30, effect: 'Ты устал и нуждаешься в отдыхе.' },
            exhausted: { threshold: 10, effect: 'Ты измотан, все действия даются с трудом.' }
        }
    }
};

// ============ СИСТЕМА КВЕСТОВ ============

const QUEST_SYSTEM = {
    forest_corruption: {
        name: 'Порча леса',
        type: 'main',
        stages: [
            {
                id: 'discover',
                description: 'Ты замечаешь странные изменения в лесу.',
                objective: 'Исследуй источник проблемы',
                reward: { xp: 50 }
            },
            {
                id: 'investigate',
                description: 'Ты находишь осквернённый источник.',
                objective: 'Найди способ очистить источник',
                reward: { xp: 100 }
            },
            {
                id: 'cleanse',
                description: 'Ты узнаёшь о ритуале очищения.',
                objective: 'Выполни ритуал очищения',
                reward: { xp: 200, item: 'nature_blessing' }
            }
        ]
    },
    
    merchant_troubles: {
        name: 'Проблемы торговца',
        type: 'side',
        stages: [
            {
                id: 'help_request',
                description: 'Торговец просит помощи с разбойниками.',
                objective: 'Найди логово разбойников',
                reward: { xp: 75, gold: 100 }
            },
            {
                id: 'confrontation',
                description: 'Ты нашёл разбойников.',
                objective: 'Разберись с угрозой',
                reward: { xp: 150, gold: 200, item: 'merchant_discount' }
            }
        ]
    }
};

// ============ СИСТЕМА ЛУТА ============

const LOOT_SYSTEM = {
    weapons: {
        enchanted_sword: {
            name: 'Зачарованный меч',
            type: 'weapon',
            damage: 12,
            special: 'Светится в темноте',
            rarity: 'rare',
            value: 500
        },
        
        shadow_dagger: {
            name: 'Теневой кинжал',
            type: 'weapon',
            damage: 8,
            special: 'Может нанести критический удар из тени',
            rarity: 'uncommon',
            value: 200
        }
    },
    
    potions: {
        healing_potion: {
            name: 'Зелье лечения',
            type: 'consumable',
            effect: 'Восстанавливает 50 HP',
            rarity: 'common',
            value: 50
        },
        
        mana_potion: {
            name: 'Зелье маны',
            type: 'consumable',
            effect: 'Восстанавливает 30 MP',
            rarity: 'common',
            value: 40
        }
    }
};

module.exports = {
    ENHANCED_LOCATIONS,
    NPC_DATABASE,
    DYNAMIC_EVENTS,
    COMBAT_SYSTEM,
    CHARACTER_STATES,
    QUEST_SYSTEM,
    LOOT_SYSTEM
}; 