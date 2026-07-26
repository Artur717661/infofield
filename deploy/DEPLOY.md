# Публикация InfoField на info-field.ru

Инструкция для чистого сервера Ubuntu 22.04 или 24.04.

## Сначала — подходит ли ваш хостинг

Проект **не запустится на обычном виртуальном хостинге** (cPanel, ISPmanager,
«хостинг для сайтов» за 150 ₽/мес). Ему нужно то, чего там нет:

| Что нужно | Зачем |
|---|---|
| Доступ по SSH с root/sudo | установка пакетов, systemd, nginx |
| Свои постоянно живущие процессы | backend и шлюз — не PHP-скрипты, они работают всё время |
| PostgreSQL | хранилище публикаций |
| Chromium (headless) | парсер Telegram открывает страницу канала |
| ≥ 2 ГБ RAM, ≥ 2 ядра, ≥ 20 ГБ диска | Chromium + Postgres + Python |

### Как понять, что у вас за хостинг

```bash
ssh ваш_логин@ваш_сервер   # если SSH нет вообще — это виртуальный хостинг
sudo -v                    # если "may not run sudo" — прав недостаточно
systemctl --version        # если команды нет — своих сервисов не поднять
free -m                    # смотрим объём памяти
```

Если SSH и sudo есть — идите к шагу 1. Если нет — нужен **VPS**. Подойдёт
любой за 400–700 ₽/мес (Timeweb, Selectel, Yandex Cloud, VDSina, Hetzner).
При заказе просите: Ubuntu 24.04, 2 vCPU, 2–4 ГБ RAM, 20+ ГБ SSD, root-доступ.

> Домен info-field.ru при переезде на VPS остаётся вашим: у регистратора
> достаточно поменять A-запись на IP нового сервера.

---

## Шаг 1. Первый вход и базовая защита сервера

```bash
ssh root@IP_СЕРВЕРА
```

Заведите себе пользователя вместо работы под root:

```bash
adduser artur
usermod -aG sudo artur
```

С локальной машины скопируйте свой SSH-ключ:

```bash
ssh-copy-id artur@IP_СЕРВЕРА
```

Проверьте, что вход по ключу работает (`ssh artur@IP_СЕРВЕРА`), и только после
этого отключите вход по паролю:

```bash
sudo nano /etc/ssh/sshd_config
```

```
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo systemctl restart ssh
```

> Не закрывайте текущую сессию, пока не убедились, что новая открывается.
> Иначе есть шанс потерять доступ к серверу.

---

## Шаг 2. DNS

У регистратора домена info-field.ru поставьте две A-записи:

| Тип | Имя | Значение |
|---|---|---|
| A | `@` | IP вашего сервера |
| A | `www` | IP вашего сервера |

Проверка (обновление записей занимает от минут до пары часов):

```bash
dig +short info-field.ru
```

Должен вернуться IP сервера. Пока не вернётся — сертификат выпустить нельзя.

---

## Шаг 3. Код на сервер

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Artur717661/infofield.git ~/infofield
cd ~/infofield
git checkout claude/analytics-dashboard-frontend-nvvjje
```

Если репозиторий приватный, git спросит логин и **токен** (не пароль):
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
→ доступ только к этому репозиторию, права Contents: Read.

---

## Шаг 4. Автоматическая настройка

```bash
sudo bash deploy/setup-server.sh
```

Скрипт поставит пакеты, создаст пользователя `infofield` и базу с отдельным
сгенерированным паролем, скопирует проект в `/opt/infofield`, установит Python-
зависимости и Chromium, зарегистрирует сервисы systemd, включит firewall
(открыты только 22/80/443) и fail2ban. Занимает 5–10 минут.

Пароль базы он запишет в `/root/.infofield-db-password` и сразу подставит
в `/opt/infofield/backend/.env`.

---

## Шаг 5. Ключ Gemini и сертификат HTTPS

```bash
sudo nano /opt/infofield/backend/.env
```

Впишите свой `GEMINI_API_KEY` (получить: https://aistudio.google.com/apikey).
Остальное уже заполнено.

Поставьте конфиг nginx и выпустите сертификат:

```bash
sudo cp /opt/infofield/deploy/nginx/info-field.ru.conf /etc/nginx/sites-available/info-field.ru
sudo ln -sf /etc/nginx/sites-available/info-field.ru /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo certbot --nginx -d info-field.ru -d www.info-field.ru
sudo nginx -t && sudo systemctl reload nginx
```

Certbot сам продлевает сертификат, проверить таймер: `systemctl list-timers | grep certbot`.

---

## Шаг 6. Сборка фронтенда и запуск

Node нужен только для сборки, в работе он не участвует:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

cd /opt/infofield/frontend
sudo -u infofield npm ci
sudo -u infofield npm run build
```

Запускаем сервисы:

```bash
sudo systemctl start infofield-backend infofield-gateway
sudo systemctl start infofield-refresh.timer

sudo systemctl status infofield-backend --no-pager
sudo systemctl status infofield-gateway --no-pager
```

---

## Шаг 7. Администратор

```bash
cd /opt/infofield
sudo -u infofield /opt/infofield/venv/bin/python -m gateway.cli create-admin admin
```

Скрипт предложит сгенерированный пароль и попросит ввести его дважды.
Требования: минимум 12 символов, три вида символов из четырёх (строчные,
прописные, цифры, знаки), без слова «infofield» и без логина внутри.

**Сохраните пароль в менеджере паролей сразу** — восстановить его нельзя,
только сбросить командой ниже.

Полезные команды:

```bash
# список пользователей
sudo -u infofield venv/bin/python -m gateway.cli list

# добавить сотрудника (роль «просмотр»)
sudo -u infofield venv/bin/python -m gateway.cli create-user ivanova

# сбросить пароль (заодно выкинет все его сессии)
sudo -u infofield venv/bin/python -m gateway.cli reset-password ivanova

# выкинуть все сессии пользователя
sudo -u infofield venv/bin/python -m gateway.cli revoke-sessions ivanova
```

Пользователей удобнее добавлять уже из браузера: вкладка **«Доступ»**
появляется у роли «админ».

---

## Шаг 8. Данные за сентябрь 2025 — июль 2026

Реальный парсинг наберёт историю не сразу, поэтому для показа залейте
демо-данные:

```bash
cd /opt/infofield
sudo systemctl stop infofield-backend
sudo -u infofield venv/bin/python tools/seed_demo_data.py
sudo systemctl start infofield-backend
```

~1500 публикаций за 01.09.2025 — 31.07.2026 с сезонной динамикой: спад
в январскую сессию, рост к приёмной кампании, пики на Дне открытых дверей
и зачислении, отдельные дни с негативом.

Когда захотите перейти на реальные данные:

```bash
sudo -u postgres psql -d InfoField -c "TRUNCATE telegram_posts, vk_posts;"
sudo systemctl start infofield-refresh.service   # первый проход, идёт долго
```

> Реальный парсер соберёт только то, что доступно на странице канала
> (`t.me/s/<канал>` отдаёт ограниченную историю), поэтому сразу получить
> глубину до сентября 2025 может не выйти. Дальше история копится сама:
> таймер обновляет данные 4 раза в сутки и дописывает новые публикации.

---

## Шаг 9. Проверка

Автоматически, одной командой:

```bash
sudo bash /opt/infofield/deploy/verify.sh
```

Проверяет 25 пунктов (сервисы, порты, база, администратор, сборка фронтенда,
сертификат, доступ, заголовки, ресурсы) и по каждой проблеме печатает команду
для починки. Ничего не изменяет.

Откройте **https://info-field.ru** — должен появиться экран входа.

Проверить вручную:

```bash
# данные без входа — должно быть 401
curl -s -o /dev/null -w "%{http_code}\n" https://info-field.ru/api/telegram

# backend снаружи недоступен — должно быть «connection refused» или таймаут
curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://info-field.ru:8000/telegram

# http перебрасывает на https — должно быть 301
curl -s -o /dev/null -w "%{http_code}\n" http://info-field.ru
```

Оценка настроек снаружи:
- https://securityheaders.com/?q=info-field.ru — ожидаемо A или A+
- https://www.ssllabs.com/ssltest/analyze.html?d=info-field.ru — ожидаемо A

---

## Обновление после изменений в коде

```bash
cd ~/infofield && git pull
sudo rsync -a --delete \
  --exclude '.git' --exclude venv --exclude node_modules \
  --exclude __pycache__ --exclude .env \
  ~/infofield/ /opt/infofield/
sudo chown -R infofield:infofield /opt/infofield

cd /opt/infofield/frontend && sudo -u infofield npm ci && sudo -u infofield npm run build
sudo systemctl restart infofield-backend infofield-gateway
```

---

## Эксплуатация

```bash
# логи
sudo journalctl -u infofield-gateway -f
sudo journalctl -u infofield-backend -f
sudo tail -f /var/log/nginx/info-field.access.log

# кто пытался войти
sudo -u postgres psql -d InfoField -c \
  "SELECT created_at, actor, action, ip FROM app_audit_events ORDER BY created_at DESC LIMIT 20;"

# кого заблокировал fail2ban
sudo fail2ban-client status nginx-limit-req

# резервная копия базы (положите в cron)
sudo -u postgres pg_dump InfoField | gzip > ~/infofield-$(date +%F).sql.gz
```

Ежедневный бэкап в 4 утра:

```bash
sudo crontab -e
```

```
0 4 * * * sudo -u postgres pg_dump InfoField | gzip > /var/backups/infofield-$(date +\%F).sql.gz && find /var/backups -name 'infofield-*.sql.gz' -mtime +14 -delete
```

---

## Что именно защищает сайт

**Сеть.** Из интернета открыты только 80 и 443. Backend слушает `127.0.0.1:8000`,
шлюз — `127.0.0.1:8080`; напрямую к ним снаружи подключиться нельзя. HTTP
перебрасывается на HTTPS, включён HSTS на год.

**Вход.** Пароли хранятся как argon2id-хэши (победитель Password Hashing
Competition, устойчив к подбору на видеокартах) — сам пароль в базе не лежит.
После 5 неудачных попыток вход блокируется на 15 минут, причём и по логину,
и по IP. Nginx дополнительно ограничивает `/api/auth/login` до 5 запросов
в минуту, а fail2ban банит настойчивые адреса на час. Ответ на неверный логин
не отличается от ответа на неверный пароль, поэтому по нему нельзя перебрать
существующие логины.

**Сессии.** В куке лежит случайный токен, в базе — только его SHA-256, так что
утечка дампа базы не даёт войти. Кука `HttpOnly` (недоступна JavaScript),
`Secure` (только по HTTPS), `SameSite=Lax`. Сессия умирает через 2 часа без
активности и через 12 часов в любом случае. Смена пароля и отключение
пользователя сбрасывают все его сессии немедленно.

**CSRF.** Три слоя: `SameSite=Lax` на куке, проверка заголовка `Origin` на всех
изменяющих запросах и отдельный CSRF-токен, который сверяется с сессией.

**XSS.** Тексты публикаций — это чужой ввод из Telegram и ВКонтакте. Они
выводятся только как текстовые узлы React, `dangerouslySetInnerHTML` не
используется нигде. CSP запрещает сторонние скрипты и `eval`.

**Роли.** «Просмотр» видит только дашборд. «Админ» дополнительно управляет
пользователями и может принудительно обновить данные. Последнего активного
админа система не даст отключить, чтобы не потерять доступ к управлению.

**Журнал.** Входы, неудачные попытки, смены пароля и изменения пользователей
пишутся в `app_audit_events` с IP и временем, видны на вкладке «Доступ».

**Процессы.** Backend и шлюз работают под системным пользователем `infofield`
без права логина, с ограничениями systemd (`ProtectSystem=strict`,
`NoNewPrivileges`, `PrivateTmp`). У базы отдельный пользователь с правами
только на свою базу. Обновления безопасности Ubuntu ставятся автоматически.

**Экспорт.** В CSV ячейки, начинающиеся с `=`, `+`, `-`, `@`, экранируются,
чтобы текст поста не выполнился как формула при открытии в Excel.

---

## Если что-то не работает

**Сайт не открывается.** `sudo systemctl status nginx` и `sudo nginx -t`.
Проверьте, что DNS уже указывает на сервер: `dig +short info-field.ru`.

**«Нет связи с backend».** `sudo journalctl -u infofield-backend -n 50`.
Чаще всего — неверный `DATABASE_URL` или Postgres не запущен.

**Вход отдаёт 403.** `ALLOWED_ORIGINS` в `/opt/infofield/gateway/.env` не
совпадает с доменом, с которого вы заходите. Исправьте и
`sudo systemctl restart infofield-gateway`.

**Заблокировал сам себя перебором.** Подождите 15 минут или снимите вручную:

```bash
sudo -u postgres psql -d InfoField -c "DELETE FROM app_login_attempts;"
```

**Забыл пароль админа.**

```bash
cd /opt/infofield && sudo -u infofield venv/bin/python -m gateway.cli reset-password admin
```

**Дашборд грузится минуту.** Первый запрос после перезапуска идёт в backend,
тот запускает парсер. Дальше ответ берётся из кэша (15 минут) и открывается
мгновенно. Прогреть кэш заранее: `sudo systemctl start infofield-refresh.service`.

**Ошибки Gemini 429.** Исчерпана квота API. Парсер сам ждёт и повторяет;
уже сохранённые публикации продолжают отдаваться.

**Кончилось место.** `df -h`, затем почистите старые логи:
`sudo journalctl --vacuum-time=7d`.
