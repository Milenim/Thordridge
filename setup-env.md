# Настройка файла .env

Создайте файл `.env` в корневой папке проекта со следующим содержимым:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=ваш_токен_бота_telegram
WEBHOOK_URL=https://ваш-домен.com/bot

# MongoDB Configuration  
MONGODB_URI=mongodb://admin:Netskyline1996!@127.0.0.1:27017/thordridge?authSource=admin

# HuggingFace Configuration (БЕСПЛАТНО!)
HUGGINGFACE_API_KEY=ваш_токен_huggingface
HUGGINGFACE_MODEL=microsoft/DialoGPT-medium

# Server Configuration
PORT=3000
```

## Как получить HuggingFace API токен (БЕСПЛАТНО!):

1. **Зарегистрируйтесь** на https://huggingface.co/
2. **Войдите** в свой аккаунт
3. **Перейдите** в настройки профиля: https://huggingface.co/settings/tokens
4. **Создайте новый токен**:
   - Нажмите "New token"
   - Введите название (например: "thornridge-dnd")
   - Выберите роль "Read" (достаточно для нашей игры)
   - Нажмите "Generate a token"
5. **Скопируйте токен** и вставьте в файл .env как `HUGGINGFACE_API_KEY`

## Альтернативные модели для экспериментов:

```env
# Для более качественного русского языка (если доступна):
HUGGINGFACE_MODEL=DeepPavlov/rubert-base-cased

# Для более креативных ответов:
HUGGINGFACE_MODEL=microsoft/DialoGPT-large

# Для быстрых ответов:
HUGGINGFACE_MODEL=microsoft/DialoGPT-small
```

## Важно:

- **Игра работает БЕЗ токена!** Просто оставьте поле `HUGGINGFACE_API_KEY` пустым
- **С токеном** - игра использует ИИ для генерации уникальных историй
- **Без токена** - игра использует предустановленные сценарии и действия по классам

## Проверка работы:

После настройки перезапустите сервер и проверьте логи - должно появиться сообщение о статусе ИИ. 