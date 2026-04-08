require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const ExcelJS = require('exceljs');
const useragent = require('useragent');
const fs = require('fs');
const path = require('path');

// === НАСТРОЙКИ (из .env или переменных окружения) ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '';
const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_CHAT_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const MENU = {
    download: '📥 Скачать базу данных',
    stats: '📊 Статистика заявок',
    recent: '🧾 Последние заявки'
};
const LEGACY_DOWNLOAD = '📊 Скачать базу и статистику';
const MENU_TEXTS = new Set([...Object.values(MENU), LEGACY_DOWNLOAD]);

const LEAD_PREFIXES = {
    consultation: '📋 Заявка на консультацию',
    booking: '🚗 Заявка на аренду'
};

const MAX_USER_ID_LEN = 120;
const MAX_USER_NAME_LEN = 80;
const MAX_MESSAGE_LEN = 4000;
const MAX_PAGE_LEN = 140;

const DEFAULT_ALLOWED_ORIGINS = [
    'https://davarentcar.ru',
    'https://www.davarentcar.ru',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://176.53.161.146',
    'https://176.53.161.146'
];

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const rateLimiterStore = new Map();

function escapeHtml(value = '') {
    return String(value).replace(/[&<>\"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function normalizeText(value = '', maxLen = 200) {
    return String(value)
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

function normalizeMultilineText(value = '', maxLen = MAX_MESSAGE_LEN) {
    return String(value)
        .replace(/\r/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, maxLen);
}

function normalizeUserId(value = '') {
    return String(value)
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/\s+/g, '')
        .trim()
        .slice(0, MAX_USER_ID_LEN);
}

function isAllowedOrigin(origin) {
    if (!origin) return true;
    return ALLOWED_ORIGINS.includes(origin);
}

function isRateLimited(key, limit, windowMs) {
    const now = Date.now();
    const state = rateLimiterStore.get(key);

    if (!state || now >= state.resetAt) {
        rateLimiterStore.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }

    state.count += 1;
    if (state.count > limit) {
        return true;
    }
    return false;
}

function cleanupRateLimiterStore() {
    const now = Date.now();
    for (const [key, state] of rateLimiterStore.entries()) {
        if (now >= state.resetAt) {
            rateLimiterStore.delete(key);
        }
    }
}

setInterval(cleanupRateLimiterStore, 60 * 1000).unref();

function isAdminChat(chatId) {
    return ADMIN_CHAT_IDS.includes(String(chatId));
}

function notifyAdmins(text, options = {}) {
    ADMIN_CHAT_IDS.forEach((adminId) => {
        bot.sendMessage(adminId, text, options);
    });
}

function parseLeadText(text = '') {
    let type = null;
    if (text.startsWith(LEAD_PREFIXES.consultation)) {
        type = 'Консультация';
    } else if (text.startsWith(LEAD_PREFIXES.booking)) {
        type = 'Аренда';
    } else {
        return null;
    }

    const data = { type };
    const lines = text.split('\n').slice(1);
    for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        data[key] = value;
    }
    return data;
}

function buildLeadRow(lead, row, statusInfo = {}) {
    const name = lead['ФИО'] || lead['Имя'] || '';
    const status = statusInfo.status || 'pending';
    const markedAt = statusInfo.markedAt ? new Date(statusInfo.markedAt).toLocaleString() : '';
    return {
        type: lead.type || '',
        name,
        phone: lead['Телефон'] || '',
        email: lead['Email'] || '',
        method: lead['Способ связи'] || '',
        social: lead['Ссылка/ник'] || '',
        car: lead['Авто'] || '',
        dates: lead['Даты'] || '',
        budget: lead['Бюджет'] || '',
        location: lead['Локация'] || '',
        comment: lead['Комментарий'] || '',
        page: lead['Страница'] || '',
        status,
        markedBy: statusInfo.markedBy || '',
        markedAt,
        uid: row.userId || '',
        time: new Date(row.timestamp).toLocaleString()
    };
}

function summarizeLeads(rows, statusMap = {}) {
    const leadEntries = rows
        .filter(r => r.role === 'client')
        .map(r => {
            const lead = parseLeadText(r.messageText || '');
            if (!lead) return null;
            const statusInfo = statusMap[r.id] || { status: 'pending' };
            return { lead, row: r, statusInfo };
        })
        .filter(Boolean);

    const total = leadEntries.length;
    const consultation = leadEntries.filter(l => l.lead.type === 'Консультация').length;
    const booking = leadEntries.filter(l => l.lead.type === 'Аренда').length;
    const pending = leadEntries.filter(l => (l.statusInfo.status || 'pending') === 'pending').length;
    const now = Date.now();
    const last7 = leadEntries.filter(l => now - new Date(l.row.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000).length;
    const last24 = leadEntries.filter(l => now - new Date(l.row.timestamp).getTime() <= 24 * 60 * 60 * 1000).length;

    return { total, consultation, booking, pending, last7, last24, leadEntries };
}

function loadLeadStatuses(callback) {
    db.all(`SELECT leadId, status, markedAt, markedBy FROM lead_status`, (err, rows) => {
        if (err) return callback(err, {});
        const map = {};
        rows.forEach(r => {
            map[r.leadId] = r;
        });
        callback(null, map);
    });
}

function formatLeadMessage(text, userName, userId) {
    const lead = parseLeadText(text || '');
    const safeUser = escapeHtml(userName || 'Клиент');
    const safeId = escapeHtml(userId || '');

    if (!lead) {
        return `💬 <b>Новое сообщение</b>\n👤 <b>${safeUser}</b>\n${escapeHtml(text || '')}\n\n🆔 <code>${safeId}</code>`;
    }

    const header = lead.type === 'Аренда'
        ? '🚗 <b>Заявка на аренду</b>'
        : '📋 <b>Заявка на консультацию</b>';

    const fields = [];
    const name = lead['ФИО'] || lead['Имя'];
    fields.push(`<b>Имя:</b> ${escapeHtml(name || '—')}`);
    fields.push(`<b>Телефон:</b> ${escapeHtml(lead['Телефон'] || '—')}`);

    if (lead['Email'] !== undefined) {
        fields.push(`<b>Email:</b> ${escapeHtml(lead['Email'] || '—')}`);
    }
    if (lead['Способ связи'] !== undefined) {
        fields.push(`<b>Способ связи:</b> ${escapeHtml(lead['Способ связи'] || '—')}`);
    }
    if (lead['Ссылка/ник'] !== undefined) {
        fields.push(`<b>Ссылка/ник:</b> ${escapeHtml(lead['Ссылка/ник'] || '—')}`);
    }
    if (lead['Авто'] !== undefined) {
        fields.push(`<b>Авто:</b> ${escapeHtml(lead['Авто'] || '—')}`);
    }
    if (lead['Даты'] !== undefined) {
        fields.push(`<b>Даты:</b> ${escapeHtml(lead['Даты'] || '—')}`);
    }
    if (lead['Бюджет'] !== undefined) {
        fields.push(`<b>Бюджет:</b> ${escapeHtml(lead['Бюджет'] || '—')}`);
    }
    if (lead['Локация'] !== undefined) {
        fields.push(`<b>Локация:</b> ${escapeHtml(lead['Локация'] || '—')}`);
    }
    if (lead['Комментарий'] !== undefined) {
        fields.push(`<b>Комментарий:</b> ${escapeHtml(lead['Комментарий'] || '—')}`);
    }
    if (lead['Страница'] !== undefined) {
        fields.push(`<b>Страница:</b> ${escapeHtml(lead['Страница'] || '—')}`);
    }

    fields.push(`🆔 <code>${safeId}</code>`);

    return [header, ...fields].join('\n');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error('CORS blocked'));
        },
        methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 100 * 1024
});
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '20kb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не задан. Добавьте в .env или переменные окружения.');
    process.exit(1);
}
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

// Расширенная структура БД
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        userName TEXT,
        ip TEXT,
        browser TEXT,
        os TEXT,
        device TEXT,
        screen TEXT,
        language TEXT,
        firstVisit DATETIME,
        lastSeen DATETIME
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        role TEXT, -- 'client' или 'admin'
        senderName TEXT,
        messageText TEXT,
        timestamp DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS lead_status (
        leadId INTEGER PRIMARY KEY,
        status TEXT DEFAULT 'pending',
        markedAt DATETIME,
        markedBy TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        page TEXT,
        createdAt DATETIME
    )`);
});

// Создаем постоянную кнопку под клавиатурой
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Бот-менеджер запущен.", {
        reply_markup: {
            keyboard: [
                [{ text: MENU.download }, { text: MENU.stats }],
                [{ text: MENU.recent }]
            ],
            resize_keyboard: true
        }
    });
});

function setStaticCacheHeaders(res, filePath) {
    if (/\.(jpg|jpeg|png|webp|avif|gif|svg|ico|woff2?|ttf)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return;
    }

    if (/\.(css|js)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return;
    }

    if (/\.html?$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=300');
    }
}

const publicAssetsDir = path.join(__dirname, 'assets');
const publicRootFiles = new Set(['style.css', 'script.js']);
const publicHtmlFiles = new Set(
    fs.readdirSync(__dirname)
        .filter((name) => /^[a-z0-9-]+\.html$/i.test(name))
);

app.use('/assets', express.static(publicAssetsDir, {
    etag: true,
    maxAge: '5m',
    dotfiles: 'deny',
    setHeaders: setStaticCacheHeaders
}));

app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.sendFile(filePath);
});

for (const fileName of publicRootFiles) {
    app.get(`/${fileName}`, (req, res) => {
        const filePath = path.join(__dirname, fileName);
        if (!fs.existsSync(filePath)) {
            res.status(404).send('Not found');
            return;
        }
        setStaticCacheHeaders(res, filePath);
        res.sendFile(filePath);
    });
}

for (const fileName of publicHtmlFiles) {
    app.get(`/${fileName}`, (req, res) => {
        const filePath = path.join(__dirname, fileName);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.sendFile(filePath);
    });
}

app.post('/api/subscribe', (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(`subscribe:${ip}`, 20, 60 * 1000)) {
        res.status(429).json({ ok: false, message: 'Слишком много запросов' });
        return;
    }

    const email = (req.body?.email || '').trim().toLowerCase();
    const page = normalizeText(req.body?.page || '', MAX_PAGE_LEN);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
        res.status(400).json({ ok: false, message: 'Некорректный email' });
        return;
    }

    const createdAt = new Date().toISOString();
    db.run(
        `INSERT OR IGNORE INTO subscriptions (email, page, createdAt) VALUES (?, ?, ?)`,
        [email, page, createdAt],
        function (err) {
            if (err) {
                res.status(500).json({ ok: false, message: 'Ошибка базы данных' });
                return;
            }
            const duplicate = this.changes === 0;
            res.json({ ok: true, duplicate });
        }
    );
});

io.on('connection', (socket) => {
    const handshakeUserId = normalizeUserId(socket.handshake.query.userId || '');
    if (!handshakeUserId) {
        socket.disconnect(true);
        return;
    }

    socket.join(handshakeUserId);

    const agent = useragent.parse(socket.handshake.headers['user-agent']);
    const rawForwarded = socket.handshake.headers['x-forwarded-for'];
    const ipFromProxy = typeof rawForwarded === 'string' ? rawForwarded.split(',')[0].trim() : '';
    const clientIp = ipFromProxy || socket.handshake.address || socket.conn?.remoteAddress || 'unknown';
    
    // Собираем инфо об устройстве
    const deviceInfo = {
        browser: normalizeText(agent.toAgent(), 180),
        os: normalizeText(agent.os.toString(), 120),
        device: normalizeText(agent.device.toString(), 120),
        language: normalizeText(socket.handshake.headers['accept-language']?.split(',')[0] || 'unknown', 40),
        ip: normalizeText(clientIp, 64)
    };

    socket.on('init_user', (data) => {
        const userName = normalizeText(data?.userName || 'Клиент', MAX_USER_NAME_LEN) || 'Клиент';
        const screen = normalizeText(data?.screen || '', 30);
        db.run(`INSERT INTO users (userId, userName, ip, browser, os, device, screen, language, firstVisit, lastSeen) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(userId) DO UPDATE SET lastSeen = ?, userName = ?, screen = ?`,
            [handshakeUserId, userName, deviceInfo.ip, deviceInfo.browser, deviceInfo.os, deviceInfo.device, screen, deviceInfo.language, new Date().toISOString(), new Date().toISOString(), 
             new Date().toISOString(), userName, screen]);
    });

    db.all(`SELECT role, senderName, messageText FROM messages WHERE userId = ? ORDER BY timestamp ASC`, [handshakeUserId], (err, rows) => {
        if (!err) socket.emit('load_history', rows);
    });

    socket.on('send_to_admin', (data) => {
        if (isRateLimited(`lead:${clientIp}`, 80, 60 * 1000)) {
            return;
        }

        const userId = normalizeUserId(data?.userId || handshakeUserId) || handshakeUserId;
        const userName = normalizeText(data?.userName || 'Клиент', MAX_USER_NAME_LEN) || 'Клиент';
        const text = normalizeMultilineText(data?.text || '', MAX_MESSAGE_LEN);
        const leadType = normalizeText(data?.leadType || '', 24);

        if (!text) {
            return;
        }

        socket.join(userId);
        const timestamp = new Date().toISOString();

        db.run(`INSERT INTO messages (userId, role, senderName, messageText, timestamp) VALUES (?, ?, ?, ?, ?)`,
            [userId, 'client', userName, text, timestamp],
            function (err) {
                if (err) {
                    console.error('❌ Ошибка записи сообщения:', err);
                    return;
                }

                const messageId = this.lastID;
                db.run(`INSERT OR IGNORE INTO lead_status (leadId, status) VALUES (?, 'pending')`, [messageId]);

                const messageBody = formatLeadMessage(text, userName, userId);
                const shouldReply = leadType !== 'consultation';

                const keyboard = [];
                if (shouldReply) {
                    keyboard.push([{ text: '↩️ Ответить', callback_data: `reply:${messageId}` }]);
                }
                keyboard.push([
                    { text: '✅ Одобрено', callback_data: `lead:${messageId}:ok` },
                    { text: '❌ Отклонить', callback_data: `lead:${messageId}:no` }
                ]);

                const options = {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: keyboard }
                };

                notifyAdmins(messageBody, options);
            }
        );
    });
});

const adminState = {};

bot.on('message', async (msg) => {
    const text = normalizeMultilineText(msg.text || '', MAX_MESSAGE_LEN);
    const chatId = msg.chat.id;
    const isAdmin = isAdminChat(chatId);
    const isMenuCommand = MENU_TEXTS.has(text);

    if (isMenuCommand) {
        if (!isAdmin) return;
        if (adminState[chatId]) delete adminState[chatId];

        if (text === MENU.download || text === LEGACY_DOWNLOAD) {
            const workbook = new ExcelJS.Workbook();
            const sheetMsg = workbook.addWorksheet('История диалогов');
            const sheetUsers = workbook.addWorksheet('Данные клиентов');
            const sheetLeads = workbook.addWorksheet('Заявки');
            const sheetStats = workbook.addWorksheet('Статистика');

            // Настройка колонок диалогов
            sheetMsg.columns = [
                { header: 'Дата/Время', key: 'time', width: 25 },
                { header: 'Кто пишет', key: 'who', width: 20 },
                { header: 'Имя в чате', key: 'name', width: 20 },
                { header: 'Сообщение', key: 'text', width: 70 },
                { header: 'ID Пользователя', key: 'uid', width: 35 }
            ];

            // Настройка колонок пользователей (Тех. инфо)
            sheetUsers.columns = [
                { header: 'ID', key: 'id', width: 35 },
                { header: 'Имя', key: 'name', width: 20 },
                { header: 'Браузер', key: 'browser', width: 30 },
                { header: 'ОС', key: 'os', width: 20 },
                { header: 'Экран', key: 'screen', width: 15 },
                { header: 'Язык', key: 'lang', width: 10 },
                { header: 'IP', key: 'ip', width: 20 },
                { header: 'Последний визит', key: 'seen', width: 25 }
            ];

            sheetLeads.columns = [
                { header: 'Тип', key: 'type', width: 15 },
                { header: 'Имя', key: 'name', width: 20 },
                { header: 'Телефон', key: 'phone', width: 18 },
                { header: 'Email', key: 'email', width: 25 },
                { header: 'Способ связи', key: 'method', width: 18 },
                { header: 'Ссылка/ник', key: 'social', width: 30 },
                { header: 'Авто', key: 'car', width: 25 },
                { header: 'Даты', key: 'dates', width: 22 },
                { header: 'Бюджет', key: 'budget', width: 18 },
                { header: 'Локация', key: 'location', width: 20 },
                { header: 'Комментарий', key: 'comment', width: 40 },
                { header: 'Страница', key: 'page', width: 25 },
                { header: 'Статус', key: 'status', width: 14 },
                { header: 'Отметил', key: 'markedBy', width: 12 },
                { header: 'Дата отметки', key: 'markedAt', width: 20 },
                { header: 'ID Пользователя', key: 'uid', width: 35 },
                { header: 'Дата/Время', key: 'time', width: 22 }
            ];

            sheetStats.columns = [
                { header: 'Показатель', key: 'metric', width: 30 },
                { header: 'Значение', key: 'value', width: 15 }
            ];

            // Стилизация: жирный шрифт и перенос текста
            [sheetMsg, sheetUsers, sheetLeads, sheetStats].forEach(s => {
                s.getRow(1).font = { bold: true, size: 12 };
                s.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
            });
            sheetMsg.getColumn('text').alignment = { wrapText: true, vertical: 'top' };
            sheetLeads.getColumn('comment').alignment = { wrapText: true, vertical: 'top' };

            loadLeadStatuses((statusErr, statusMap) => {
                if (statusErr) {
                    bot.sendMessage(chatId, 'Ошибка чтения статусов заявок.');
                    return;
                }

                db.all(`SELECT * FROM messages ORDER BY timestamp DESC`, (err, rows) => {
                    if (err) {
                        bot.sendMessage(chatId, 'Ошибка чтения базы сообщений.');
                        return;
                    }

                    rows.forEach(r => {
                        sheetMsg.addRow({
                            time: new Date(r.timestamp).toLocaleString(),
                            who: r.role === 'client' ? 'КЛИЕНТ ⬅️' : 'МЕНЕДЖЕР ➡️',
                            name: r.senderName,
                            text: r.messageText,
                            uid: r.userId
                        });
                    });

                    const { total, consultation, booking, pending, last7, last24, leadEntries } = summarizeLeads(rows, statusMap);
                    leadEntries.forEach(({ lead, row, statusInfo }) => {
                        sheetLeads.addRow(buildLeadRow(lead, row, statusInfo));
                    });

                    sheetStats.addRows([
                        { metric: 'Всего заявок', value: total },
                        { metric: 'Заявки на консультацию', value: consultation },
                        { metric: 'Заявки на аренду', value: booking },
                        { metric: 'Неотмеченные', value: pending },
                        { metric: 'За последние 7 дней', value: last7 },
                        { metric: 'За последние 24 часа', value: last24 }
                    ]);

                    db.all(`SELECT * FROM users`, async (errUsers, uRows) => {
                        if (errUsers) {
                            bot.sendMessage(chatId, 'Ошибка чтения базы пользователей.');
                            return;
                        }

                        uRows.forEach(u => {
                            sheetUsers.addRow({
                                id: u.userId, name: u.userName, browser: u.browser,
                                os: u.os, screen: u.screen, lang: u.language, ip: u.ip,
                                seen: new Date(u.lastSeen).toLocaleString()
                            });
                        });

                        const filePath = './DAVA_Base.xlsx';
                        await workbook.xlsx.writeFile(filePath);
                        await bot.sendDocument(chatId, filePath, {
                            caption: `✅ База обновлена\n👥 Клиентов: ${uRows.length}\n💬 Сообщений: ${rows.length}\n🧾 Заявок: ${total}\n⏳ Неотмеченных: ${pending}`
                        });
                    });
                });
            });
            return;
        }

        if (text === MENU.stats) {
            loadLeadStatuses((statusErr, statusMap) => {
                if (statusErr) {
                    bot.sendMessage(chatId, 'Ошибка чтения статусов заявок.');
                    return;
                }
                db.all(`SELECT id, messageText, timestamp, role FROM messages ORDER BY timestamp DESC`, (err, rows) => {
                    if (err) {
                        bot.sendMessage(chatId, 'Ошибка чтения статистики.');
                        return;
                    }
                    const { total, consultation, booking, pending, last7, last24 } = summarizeLeads(rows, statusMap);
                    const statsText = [
                        '📊 Статистика заявок',
                        '',
                        `Всего заявок: ${total}`,
                        `Консультации: ${consultation}`,
                        `Аренда: ${booking}`,
                        `Неотмеченные: ${pending}`,
                        `За последние 7 дней: ${last7}`,
                        `За последние 24 часа: ${last24}`
                    ].join('\n');
                    bot.sendMessage(chatId, statsText);
                });
            });
            return;
        }

        if (text === MENU.recent) {
            loadLeadStatuses((statusErr, statusMap) => {
                if (statusErr) {
                    bot.sendMessage(chatId, 'Ошибка чтения статусов заявок.');
                    return;
                }
                db.all(`SELECT id, messageText, timestamp, role FROM messages ORDER BY timestamp DESC`, (err, rows) => {
                    if (err) {
                        bot.sendMessage(chatId, 'Ошибка чтения заявок.');
                        return;
                    }
                    const { leadEntries } = summarizeLeads(rows, statusMap);
                    const pending = leadEntries.filter(entry => (entry.statusInfo.status || 'pending') === 'pending');
                    const recent = pending.slice(0, 5);
                    if (!recent.length) {
                        bot.sendMessage(chatId, 'Пока нет неотмеченных заявок.');
                        return;
                    }

                    const blocks = recent.map((entry, index) => {
                        const lead = entry.lead;
                        const time = new Date(entry.row.timestamp).toLocaleString();
                        const name = lead['ФИО'] || lead['Имя'] || 'Не указано';
                        const phone = lead['Телефон'] || 'Не указан';
                        const car = lead['Авто'] || lead['Страница'] || 'Не указано';
                        const typeLabel = lead.type === 'Аренда' ? '🚗 Аренда' : '🧑‍💼 Консультация';
                        return [
                            `${index + 1}. ${typeLabel}`,
                            `Имя: ${name}`,
                            `Телефон: ${phone}`,
                            `Авто/страница: ${car}`,
                            `Дата: ${time}`
                        ].join('\n');
                    });

                    bot.sendMessage(chatId, ['🧾 Последние заявки (неотмеченные)', '', blocks.join('\n\n')].join('\n'));
                });
            });
            return;
        }
    }

    const state = adminState[chatId];
    if (state && text && isAdmin && !isMenuCommand) {
        db.run(`INSERT INTO messages (userId, role, senderName, messageText, timestamp) VALUES (?, ?, ?, ?, ?)`,
            [state.id, 'admin', 'Менеджер', text, new Date().toISOString()]);
        io.to(state.id).emit('admin_reply_global', { targetId: state.id, text });
        bot.sendMessage(chatId, `✅ Отправлено пользователю ${state.name}`);
        delete adminState[chatId];
    }
});
bot.on('callback_query', (query) => {
    const data = query.data || '';
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;

    if (!chatId || !messageId) {
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (!isAdminChat(chatId)) {
        bot.answerCallbackQuery(query.id, { text: 'Недостаточно прав' });
        return;
    }

    if (data === 'noop') {
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (data.startsWith('reply:') || data.startsWith('reply_')) {
        const leadId = data.startsWith('reply:') ? data.split(':')[1] : data.replace('reply_', '');
        db.get('SELECT userId, senderName FROM messages WHERE id = ?', [leadId], (err, row) => {
            if (err || !row) {
                bot.answerCallbackQuery(query.id, { text: 'Заявка не найдена' });
                return;
            }
            const targetId = normalizeUserId(row.userId || '');
            if (!targetId) {
                bot.answerCallbackQuery(query.id, { text: 'Невалидный ID пользователя' });
                return;
            }
            const name = normalizeText(row.senderName || 'клиент', MAX_USER_NAME_LEN) || 'клиент';
            adminState[chatId] = { id: targetId, name };
            bot.sendMessage(chatId, `✍️ Пишем для ${name}:`);
            bot.answerCallbackQuery(query.id);
        });
        return;
    }

    if (data.startsWith('lead:')) {
        const parts = data.split(':');
        const leadId = parts[1];
        const action = parts[2];
        const status = action === 'ok' ? 'approved' : 'rejected';
        const statusLabel = status === 'approved' ? '✅ Одобрено' : '❌ Отклонено';
        const now = new Date().toISOString();
        const marker = String(query.from?.id || '');

        db.run(
            `INSERT INTO lead_status (leadId, status, markedAt, markedBy)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(leadId) DO UPDATE SET status = ?, markedAt = ?, markedBy = ?`,
            [leadId, status, now, marker, status, now, marker],
            (err) => {
                if (err) {
                    bot.answerCallbackQuery(query.id, { text: 'Ошибка обновления' });
                    return;
                }
                bot.editMessageReplyMarkup(
                    { inline_keyboard: [[{ text: statusLabel, callback_data: 'noop' }]] },
                    { chat_id: chatId, message_id: messageId }
                );
                bot.answerCallbackQuery(query.id, { text: 'Готово' });
            }
        );
        return;
    }

    bot.answerCallbackQuery(query.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('🚀 Server OK, port', PORT));
