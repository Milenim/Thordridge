#!/bin/bash

# ========================================
# Скрипт развертывания Thornridge D&D на VPS
# ========================================

echo "🏰 Настройка Thornridge D&D на VPS..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    log_error "Пожалуйста, запустите скрипт с правами root (sudo)"
    exit 1
fi

# Обновление системы
log_info "Обновление системы..."
apt update && apt upgrade -y

# Установка Node.js
log_info "Установка Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Установка MongoDB
log_info "Установка MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update
apt-get install -y mongodb-org

# Запуск MongoDB
log_info "Запуск MongoDB..."
systemctl start mongod
systemctl enable mongod

# Установка PM2
log_info "Установка PM2..."
npm install -g pm2

# Создание пользователя для приложения
log_info "Создание пользователя thornridge..."
useradd -m -s /bin/bash thornridge

# Переход в домашнюю директорию
cd /home/thornridge

# Клонирование репозитория (если еще не клонирован)
if [ ! -d "thornridge-dnd" ]; then
    log_info "Клонирование репозитория..."
    git clone https://github.com/yourusername/thornridge-dnd.git
fi

cd thornridge-dnd

# Установка зависимостей
log_info "Установка зависимостей..."
npm install

# Создание .env файла
log_info "Создание .env файла..."
if [ ! -f ".env" ]; then
    cat > .env << EOF
# MongoDB Configuration
MONGODB_URI=mongodb://admin:Netskyline1996!@127.0.0.1:27017/thordridge?authSource=admin

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE
WEBHOOK_URL=https://thornridge.ru/bot8179863423:AAHzsQOTZ7MHkXpnYhGNf5coTugmR7rZwlE

# HuggingFace API Configuration
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
HUGGINGFACE_MODEL=microsoft/DialoGPT-large
HUGGINGFACE_API_URL=https://api-inference.huggingface.co/models/

# Server Configuration
PORT=3000
NODE_ENV=production
EOF
    
    log_warn "ВАЖНО: Отредактируйте файл .env и добавьте ваш HuggingFace API ключ!"
    log_warn "Выполните: nano .env"
    log_warn "Замените 'your_huggingface_api_key_here' на реальный ключ"
fi

# Установка прав доступа
chmod 600 .env
chown thornridge:thornridge .env

# Настройка MongoDB пользователя
log_info "Настройка MongoDB..."
mongosh --eval "
use admin
db.createUser({
  user: 'admin',
  pwd: 'Netskyline1996!',
  roles: [{ role: 'userAdminAnyDatabase', db: 'admin' }]
})
"

# Настройка Nginx (если установлен)
if command -v nginx &> /dev/null; then
    log_info "Настройка Nginx..."
    cat > /etc/nginx/sites-available/thornridge << EOF
server {
    listen 80;
    server_name thornridge.ru www.thornridge.ru;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    ln -sf /etc/nginx/sites-available/thornridge /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    log_info "Nginx настроен"
else
    log_warn "Nginx не найден. Установите его для работы с доменом"
fi

# Создание PM2 ecosystem файла
log_info "Создание PM2 конфигурации..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'thornridge-dnd',
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Создание директории для логов
mkdir -p logs

# Изменение владельца файлов
chown -R thornridge:thornridge /home/thornridge/thornridge-dnd

# Запуск приложения через PM2
log_info "Запуск приложения..."
sudo -u thornridge pm2 start ecosystem.config.js
sudo -u thornridge pm2 save
sudo -u thornridge pm2 startup

# Настройка firewall
log_info "Настройка firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable

# Создание скрипта для обновления
log_info "Создание скрипта обновления..."
cat > update.sh << 'EOF'
#!/bin/bash
echo "🔄 Обновление Thornridge D&D..."
git pull origin main
npm install
pm2 reload thornridge-dnd
echo "✅ Обновление завершено!"
EOF

chmod +x update.sh
chown thornridge:thornridge update.sh

# Финальные инструкции
log_info "🎉 Установка завершена!"
echo
echo "=========================================="
echo "ВАЖНЫЕ ШАГИ ДЛЯ ЗАВЕРШЕНИЯ НАСТРОЙКИ:"
echo "=========================================="
echo
echo "1. 📝 Отредактируйте .env файл:"
echo "   sudo -u thornridge nano /home/thornridge/thornridge-dnd/.env"
echo "   Добавьте ваш HuggingFace API ключ!"
echo
echo "2. 🔑 Получите HuggingFace API ключ:"
echo "   - Зайдите на https://huggingface.co/"
echo "   - Зарегистрируйтесь или войдите"
echo "   - Settings → Access Tokens"
echo "   - Создайте токен с правами 'Read'"
echo "   - Скопируйте и вставьте в .env"
echo
echo "3. 🔄 Перезапустите приложение:"
echo "   cd /home/thornridge/thornridge-dnd"
echo "   sudo -u thornridge pm2 reload thornridge-dnd"
echo
echo "4. 📊 Проверьте статус:"
echo "   sudo -u thornridge pm2 status"
echo "   sudo -u thornridge pm2 logs"
echo
echo "5. 🌐 Проверьте работу:"
echo "   curl http://localhost:3000/api/status"
echo
echo "6. 📱 Настройте Telegram бота:"
echo "   - Установите webhook на ваш домен"
echo "   - Добавьте Web App кнопку в меню"
echo
echo "=========================================="
echo "🏰 Добро пожаловать в Терновую гряду!"
echo "==========================================" 