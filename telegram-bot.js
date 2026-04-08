// telegram-bot.js
const TelegramBot = require('node-telegram-bot-api');
const WebSocket = require('ws');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_WS_URL = 'ws://localhost:3000/ws';

if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Токен бота не найден. Используйте setupTelegramBot() на сайте для настройки.');
    process.exit(1);
}

// Создаем бота
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
let wsClient = null;

console.log('🤖 Telegram бот запускается...');

// Подключение к WebSocket серверу
function connectWebSocket() {
    wsClient = new WebSocket(SERVER_WS_URL);
    
    wsClient.on('open', () => {
        console.log('✅ Подключено к локальному серверу');
        
        // Отправляем информацию о боте
        wsClient.send(JSON.stringify({
            type: 'bot_info',
            botName: 'DAVA Rent Manager',
            connected: true
        }));
    });
    
    wsClient.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('📨 Получено от сервера:', message.type);
        } catch (error) {
            console.error('Ошибка парсинга сообщения:', error);
        }
    });
    
    wsClient.on('error', (error) => {
        console.error('❌ WebSocket ошибка:', error);
    });
    
    wsClient.on('close', () => {
        console.log('🔌 WebSocket отключен, переподключение через 5 секунд...');
        setTimeout(connectWebSocket, 5000);
    });
}

// Отправка сообщения на сервер
function sendToServer(data) {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify(data));
        return true;
    }
    return false;
}

// Обработка сообщений в Telegram
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const senderName = msg.from.first_name || 'Пользователь';
    
    console.log(`📨 Сообщение от ${senderName} (${chatId}): ${text}`);
    
    // Если это сообщение от администратора (ответ на сообщение с сайта)
    if (chatId.toString() === ADMIN_CHAT_ID || !ADMIN_CHAT_ID) {
        // Отправляем сообщение на сервер
        const sent = sendToServer({
            type: 'telegram_message',
            message: text,
            sender: senderName,
            chatId: chatId,
            timestamp: new Date().toISOString()
        });
        
        if (sent) {
            bot.sendMessage(chatId, '✅ Ответ отправлен на сайт!', {
                reply_to_message_id: msg.message_id
            });
        } else {
            bot.sendMessage(chatId, '❌ Сервер не отвечает. Попробуйте позже.', {
                reply_to_message_id: msg.message_id
            });
        }
    } else {
        // Если это сообщение от другого пользователя (не админа)
        bot.sendMessage(chatId, 'Привет! Я бот для DAVA RENT CAR. Сообщения с сайта приходят администратору.');
    }
});

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeText = `🤖 *DAVA RENT CAR Manager Bot*\n\nЯ буду отправлять вам сообщения с сайта и передавать ваши ответы обратно.\n\n`;
    
    if (chatId.toString() === ADMIN_CHAT_ID) {
        bot.sendMessage(chatId, welcomeText + '✅ Вы администратор. Все сообщения с сайта будут приходить сюда.', {
            parse_mode: 'Markdown'
        });
    } else {
        bot.sendMessage(chatId, welcomeText + '⚠️ Вы не являетесь администратором. Сообщения с сайта отправляются другому пользователю.', {
            parse_mode: 'Markdown'
        });
    }
});

// Команда /status
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const status = wsClient && wsClient.readyState === WebSocket.OPEN ? '✅ Подключено' : '❌ Отключено';
    
    bot.sendMessage(chatId, `📊 Статус бота:\n\nСервер: ${status}\nID чата: ${chatId}\nАдмин ID: ${ADMIN_CHAT_ID || 'Не установлен'}`, {
        parse_mode: 'Markdown'
    });
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    const helpText = `📋 *Доступные команды:*\n\n` +
        `/start - Начало работы\n` +
        `/status - Статус подключения\n` +
        `/help - Эта справка\n\n` +
        `💡 *Как это работает:*\n` +
        `1. Пользователь пишет сообщение на сайте\n` +
        `2. Сообщение приходит сюда\n` +
        `3. Вы отвечаете на это сообщение\n` +
        `4. Ответ появляется на сайте\n\n` +
        `🔧 *Настройка:*\n` +
        `Для смены администратора используйте команду на сайте setupTelegramBot()`;
    
    bot.sendMessage(msg.chat.id, helpText, {
        parse_mode: 'Markdown'
    });
});

// При запуске бота
bot.getMe().then((botInfo) => {
    console.log(`✅ Бот запущен: @${botInfo.username} (${botInfo.first_name})`);
    console.log(`👤 Администратор: ${ADMIN_CHAT_ID || 'Не установлен'}`);
    
    // Подключаемся к WebSocket серверу
    connectWebSocket();
    
    // Отправляем приветственное сообщение администратору
    if (ADMIN_CHAT_ID) {
        bot.sendMessage(ADMIN_CHAT_ID, 
            `✅ *Бот DAVA RENT CAR запущен!*\n\n` +
            `🤖 Имя: ${botInfo.first_name}\n` +
            `🔗 Username: @${botInfo.username}\n\n` +
            `📱 Теперь все сообщения с сайта будут приходить сюда.\n` +
            `💬 Просто отвечайте на сообщения, и ответы появятся на сайте.\n\n` +
            `ℹ️ Используйте /help для справки`,
            { parse_mode: 'Markdown' }
        );
    }
}).catch((error) => {
    console.error('❌ Ошибка запуска бота:', error);
    process.exit(1);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error);
});

bot.on('webhook_error', (error) => {
    console.error('❌ Ошибка webhook:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Остановка Telegram бота...');
    bot.stopPolling();
    if (wsClient) {
        wsClient.close();
    }
    console.log('✅ Бот остановлен');
    process.exit(0);
});