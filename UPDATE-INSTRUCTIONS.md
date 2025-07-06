# 🔄 Инструкция по обновлению Thornridge D&D

## Обновление на VPS

### 1. Подключитесь к VPS:
```bash
ssh root@your-server-ip
cd /var/www/Thordridge
```

### 2. Остановите приложение:
```bash
pm2 stop thordridge
```

### 3. Получите обновления:
```bash
git pull origin main
```

### 4. Установите новые зависимости (если нужно):
```bash
npm install
```

### 5. Перезапустите приложение:
```bash
pm2 restart thordridge
```

### 6. Проверьте статус:
```bash
pm2 status
pm2 logs thordridge --lines 10
curl http://localhost:3000/api/status
```

## Что было исправлено в этом обновлении:

### ✅ Проблема с UI создания персонажа:
- Исправлено позиционирование контента (было обрезано сверху)
- Добавлен scroll для длинного контента
- Улучшена адаптивность для разных размеров экрана

### ✅ Улучшена система ИИ-мастера:
- Промпт теперь генерирует текст от второго лица ("ты делаешь" вместо "игрок делает")
- Убраны шаблонные фразы типа "При выборе варианта"
- Более погружающее повествование
- Автоматическая очистка нежелательных фраз

### ✅ Очистка проекта:
- Удалены ненужные Docker файлы (MongoDB работает напрямую)
- Обновлен .gitignore для лучшей безопасности
- Добавлена документация

## Быстрое обновление одной командой:

```bash
cd /var/www/Thordridge && git pull && npm install && pm2 restart thordridge && pm2 logs --lines 5
```

## В случае проблем:

### Если приложение не запускается:
```bash
pm2 logs thordridge --lines 20
node src/index.js  # для отладки
```

### Если проблемы с зависимостями:
```bash
rm -rf node_modules package-lock.json
npm install
pm2 restart thordridge
```

### Если проблемы с MongoDB:
```bash
sudo systemctl status mongod
sudo systemctl restart mongod
```

## Проверка работы:

1. **API статус**: `curl http://localhost:3000/api/status`
2. **Telegram бот**: отправьте `/start` в Telegram
3. **Веб интерфейс**: откройте https://thornridge.ru

## Контакты для поддержки:

Если возникли проблемы, проверьте логи и статус всех компонентов. 