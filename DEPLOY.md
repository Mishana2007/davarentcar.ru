# Развёртывание сайта DAVA RENT CAR на сервере

Домен: **davarentcar.ru**  
Сервер: Ubuntu, SSH `root@176.53.161.146`  
Сайт работает на Node.js (Express + Socket.IO + Telegram-бот).

---

## 1. Локальная проверка перед деплоем

На своём компьютере в папке проекта:

```bash
# Установка зависимостей (если ещё не ставили)
npm install

# Запуск сервера
npm start
```

Откройте в браузере: **http://localhost:3000**

Проверьте:
- Открывается главная, навигация по якорям (#home, #cars и т.д.).
- Страницы авто (например http://localhost:3000/bmw-430i-2020.html) открываются, фото отображаются целиком.
- Кнопка чата справа внизу открывает виджет, сообщения отправляются.
- В Telegram приходят сообщения из чата и можно ответить по кнопке «Ответить».

Остановка: `Ctrl+C`.

---

## 2. Подготовка сервера (Ubuntu)

Подключитесь по SSH:

```bash
ssh root@176.53.161.146
```

### 2.1 Обновление и базовые пакеты

```bash
apt update && apt upgrade -y
apt install -y curl git
```

### 2.2 Установка Node.js (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # должно быть v20.x
npm -v
```

### 2.3 Установка Nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 2.4 Установка PM2 (запуск приложения в фоне)

```bash
npm install -g pm2
```

---

## 3. Загрузка проекта на сервер

**Вариант A — через Git (если проект в репозитории):**

```bash
cd /var/www
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> davarentcar
cd davarentcar
npm install --production
```

**Вариант B — через SCP с вашего компьютера:**

На **вашем компьютере** (в папке с проектом, не на сервере):

```bash
cd /Users/misaminic/.cursor/worktrees/3______/baa
scp -r . root@176.53.161.146:/var/www/davarentcar/
```

На **сервере**:

```bash
mkdir -p /var/www/davarentcar
# после того как scp выполнится:
cd /var/www/davarentcar
npm install --production
```

Не копируйте папку `node_modules` с компьютера — на сервере выполните `npm install --production`.

---

## 4. Переменные окружения на сервере

На сервере создайте файл `.env` в корне проекта:

```bash
cd /var/www/davarentcar
nano .env
```

Содержимое (подставьте свои реальные данные):

```env
TELEGRAM_BOT_TOKEN=PASTE_YOUR_REAL_TOKEN_HERE
ADMIN_CHAT_ID=PASTE_YOUR_ADMIN_CHAT_ID_HERE
PORT=3000
```

Сохраните: `Ctrl+O`, Enter, `Ctrl+X`.

Проверьте, что файл на месте: `cat .env`

---

## 5. Запуск приложения через PM2

```bash
cd /var/www/davarentcar
pm2 start server.js --name davarentcar
pm2 save
pm2 startup
```

Проверка:

```bash
pm2 status
pm2 logs davarentcar
```

Сайт пока доступен по IP и порту 3000. Дальше настраиваем Nginx и домен.

---

## 6. Nginx и домен davarentcar.ru

У вас уже есть SSL для davarentcar.ru. Настраиваем Nginx как обратный прокси.

Создайте конфиг:

```bash
nano /etc/nginx/sites-available/davarentcar.ru
```

Вставьте (пути к SSL-сертификатам замените на свои, если они в другом месте):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name davarentcar.ru www.davarentcar.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name davarentcar.ru www.davarentcar.ru;

    ssl_certificate     /etc/letsencrypt/live/davarentcar.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/davarentcar.ru/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте сайт и перезапустите Nginx:

```bash
ln -sf /etc/nginx/sites-available/davarentcar.ru /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Если сертификаты ещё не получены (нет папки Let's Encrypt):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d davarentcar.ru -d www.davarentcar.ru
```

Certbot сам добавит SSL в конфиг. После этого снова проверьте конфиг и сделайте `nginx -t` и `systemctl reload nginx`.

---

## 7. DNS для davarentcar.ru

В панели управления доменом (где покупали домен) создайте A-записи:

| Тип | Имя | Значение    | TTL |
|-----|-----|-------------|-----|
| A   | @   | 176.53.161.146 | 300 |
| A   | www | 176.53.161.146 | 300 |

Подождите 5–15 минут (иногда до 24 часов), затем проверьте: `https://davarentcar.ru`

---

## 8. Проверка после деплоя

1. Откройте **https://davarentcar.ru** — должна открыться главная.
2. Переход по разделам (Главная, Преимущества, Автопарк и т.д.).
3. Открытие страниц авто (например https://davarentcar.ru/bmw-430i-2020.html).
4. Чат: нажать на кнопку чата, ввести имя и сообщение — в Telegram должно прийти сообщение; ответ по кнопке «Ответить» должен появиться в чате на сайте.
5. Кнопка «Скачать базу и статистику» в Telegram — в ответ приходит файл Excel.

---

## 9. Полезные команды на сервере

| Действие              | Команда |
|------------------------|---------|
| Логи приложения        | `pm2 logs davarentcar` |
| Перезапуск             | `pm2 restart davarentcar` |
| Остановка              | `pm2 stop davarentcar` |
| Статус                 | `pm2 status` |
| Логи Nginx             | `tail -f /var/log/nginx/error.log` |
| Проверка конфига Nginx | `nginx -t` |

---

## 10. Обновление сайта на сервере

После изменений в коде:

**Если используете Git:**

```bash
cd /var/www/davarentcar
git pull
npm install --production
pm2 restart davarentcar
```

**Если заливаете файлы вручную (scp):**

На своём компьютере:

```bash
scp -r index.html *.html assets root@176.53.161.146:/var/www/davarentcar/
scp server.js root@176.53.161.146:/var/www/davarentcar/
```

На сервере:

```bash
cd /var/www/davarentcar
pm2 restart davarentcar
```

---

Сайт и чат с Telegram рассчитаны на работу через один сервер (server.js). Файл `telegram-bot.js` в проекте — отдельный сценарий с WebSocket; для текущей схемы он не используется, достаточно только `server.js` и настроенного `.env`.
