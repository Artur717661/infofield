#!/usr/bin/env bash
#
# Подготовка чистого сервера Ubuntu 22.04/24.04 под InfoField.
# Запускать от root на СВЕЖЕМ сервере:
#
#   sudo bash deploy/setup-server.sh
#
# Что делает: ставит пакеты, создаёт пользователя infofield, базу с отдельным
# паролем, копирует проект в /opt/infofield, ставит зависимости, настраивает
# systemd, firewall и fail2ban. Сертификат и .env — отдельными шагами
# из deploy/DEPLOY.md, потому что требуют ваших данных.
#
# Скрипт идемпотентный: повторный запуск не ломает уже настроенное.

set -euo pipefail

DOMAIN="${DOMAIN:-info-field.ru}"
APP_DIR="/opt/infofield"
APP_USER="infofield"
DB_NAME="InfoField"
DB_USER="infofield"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;31m[!] %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m    %s\033[0m\n' "$*"; }

# --------------------------------------------------------------------------
log "0/9 Проверки перед установкой"

if [[ $EUID -ne 0 ]]; then
  warn "Запустите через sudo."
  exit 1
fi

# ОС. Скрипт рассчитан на Ubuntu 22.04/24.04; на другом дистрибутиве имена
# пакетов и пути отличаются, лучше остановиться сразу, чем сломать систему.
if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "    ОС: ${PRETTY_NAME:-неизвестно}"
  if [[ "${ID:-}" != "ubuntu" ]]; then
    warn "Скрипт проверен только на Ubuntu 22.04 и 24.04."
    read -rp "    Продолжить на свой риск? [y/N] " answer
    [[ "${answer,,}" == y* ]] || exit 1
  fi
else
  warn "Не удалось определить ОС."
  exit 1
fi

# Память. Проект в покое занимает ~560 МБ, при парсинге ~860 МБ.
TOTAL_RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
echo "    RAM: ${TOTAL_RAM_MB} МБ"
if (( TOTAL_RAM_MB < 900 )); then
  warn "Меньше 1 ГБ памяти — проект не заработает даже со swap."
  exit 1
fi
if (( TOTAL_RAM_MB < 1900 )); then
  warn "1 ГБ памяти: обязательно выполните раздел «Если у вас тариф с 1 ГБ RAM»"
  warn "из deploy/REGRU.md, иначе парсер будет убивать процессы."
  HAS_SWAP=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
  if (( HAS_SWAP < 512 )); then
    warn "Swap не настроен (${HAS_SWAP} МБ). Настоятельно рекомендую сделать это ДО запуска."
    read -rp "    Продолжить без swap? [y/N] " answer
    [[ "${answer,,}" == y* ]] || exit 1
  fi
fi

# Диск. Нужно ~6 ГБ: Ubuntu, Chromium, Python-пакеты, база.
FREE_DISK_MB=$(df -m --output=avail / | tail -1 | tr -d ' ')
echo "    Свободно на диске: ${FREE_DISK_MB} МБ"
if (( FREE_DISK_MB < 7000 )); then
  warn "Меньше 7 ГБ свободно — Chromium и зависимости могут не поместиться."
  read -rp "    Продолжить? [y/N] " answer
  [[ "${answer,,}" == y* ]] || exit 1
fi

# Порты 80/443. На шаблонах хостеров часто уже висит Apache или панель.
for port in 80 443; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    holder=$(ss -tlnp 2>/dev/null | grep ":${port} " | grep -oP 'users:\(\("\K[^"]+' | head -1)
    if [[ "$holder" != "nginx" ]]; then
      warn "Порт ${port} уже занят процессом '${holder}'."
      warn "Обычно это Apache или панель хостера. Освободите порт:"
      warn "    systemctl disable --now apache2   # если это Apache"
      exit 1
    fi
  fi
done
ok "проверки пройдены"

# --------------------------------------------------------------------------
log "1/9 Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  python3 python3-venv python3-dev build-essential \
  postgresql postgresql-contrib libpq-dev \
  nginx certbot python3-certbot-nginx \
  ufw fail2ban curl git rsync openssl iproute2 unattended-upgrades
# Системные библиотеки для Chromium ставит сам Playwright (шаг 6):
# в Ubuntu 24.04 часть пакетов переименована с суффиксом t64, и держать
# этот список вручную — гарантированный источник ошибок между 22.04 и 24.04.

# --------------------------------------------------------------------------
log "2/9 Автоматические обновления безопасности"
dpkg-reconfigure -f noninteractive unattended-upgrades

# --------------------------------------------------------------------------
log "3/9 Системный пользователь $APP_USER"
if ! id "$APP_USER" &>/dev/null; then
  # Без домашнего каталога и без возможности логина по SSH.
  useradd --system --shell /usr/sbin/nologin --home-dir "$APP_DIR" "$APP_USER"
  echo "    создан"
else
  echo "    уже есть"
fi

# --------------------------------------------------------------------------
log "4/9 База данных"
systemctl enable --now postgresql

DB_PASS_FILE="/root/.infofield-db-password"
if [[ -f "$DB_PASS_FILE" ]]; then
  DB_PASS="$(cat "$DB_PASS_FILE")"
  echo "    пароль базы взят из $DB_PASS_FILE"
else
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)"
  printf '%s' "$DB_PASS" > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
  echo "    сгенерирован новый пароль базы, сохранён в $DB_PASS_FILE"
fi

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || sudo -u postgres psql -qc "CREATE USER \"$DB_USER\" WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -qc "ALTER USER \"$DB_USER\" WITH PASSWORD '$DB_PASS';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres psql -qc "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"

# Права только на свою базу; в остальные этот пользователь не попадёт.
sudo -u postgres psql -qc "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";"
sudo -u postgres psql -d "$DB_NAME" -qc "GRANT ALL ON SCHEMA public TO \"$DB_USER\";"

# --------------------------------------------------------------------------
log "5/9 Копирование проекта в $APP_DIR"
mkdir -p "$APP_DIR"
# Исключаем то, что не должно попасть на сервер.
rsync -a --delete \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude 'node_modules' \
  --exclude '__pycache__' \
  --exclude '.env' \
  "$REPO_DIR"/ "$APP_DIR"/
mkdir -p "$APP_DIR/.playwright"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# --------------------------------------------------------------------------
log "6/9 Python-окружение и Chromium"
if [[ ! -x "$APP_DIR/venv/bin/python" ]]; then
  python3 -m venv "$APP_DIR/venv"
fi
"$APP_DIR/venv/bin/pip" install --quiet --upgrade pip
"$APP_DIR/venv/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"
"$APP_DIR/venv/bin/pip" install --quiet -r "$APP_DIR/gateway/requirements.txt"

# --with-deps: Playwright сам определяет дистрибутив и ставит нужные
# системные библиотеки с правильными именами, включая кириллические шрифты
# (без них страница Telegram отрендерится квадратами).
PLAYWRIGHT_BROWSERS_PATH="$APP_DIR/.playwright" \
  "$APP_DIR/venv/bin/python" -m playwright install --with-deps chromium
chown -R "$APP_USER:$APP_USER" "$APP_DIR/venv" "$APP_DIR/.playwright"

# Сразу проверяем, что Chromium реально запускается под нужным пользователем:
# если чего-то не хватает, лучше узнать сейчас, а не при первом парсинге.
if sudo -u "$APP_USER" env PLAYWRIGHT_BROWSERS_PATH="$APP_DIR/.playwright" \
     "$APP_DIR/venv/bin/python" -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); b.close()
" 2>/dev/null; then
  ok "Chromium запускается"
else
  warn "Chromium не запустился. Парсер работать не будет, но сайт с уже"
  warn "загруженными данными — будет. Диагностика:"
  warn "    sudo -u $APP_USER $APP_DIR/venv/bin/python -m playwright install --with-deps chromium"
fi

# --------------------------------------------------------------------------
log "7/9 Заготовки .env"
for pair in "backend:backend" "gateway:gateway"; do
  name="${pair%%:*}"
  target="$APP_DIR/$name/.env"
  if [[ ! -f "$target" ]]; then
    cp "$APP_DIR/deploy/env/$name.env.example" "$target"
    if [[ "$name" == "backend" ]]; then
      # Подставляем реальный пароль базы, чтобы не искать его вручную.
      sed -i "s|postgresql://infofield:СГЕНЕРИРОВАННЫЙ_ПАРОЛЬ@localhost/InfoField|postgresql://$DB_USER:$DB_PASS@localhost/$DB_NAME|" "$target"
    fi
    chown "$APP_USER:$APP_USER" "$target"
    chmod 600 "$target"
    echo "    создан $target"
  else
    echo "    $target уже есть, не трогаю"
  fi
done

# --------------------------------------------------------------------------
log "8/9 systemd и nginx"
cp "$APP_DIR"/deploy/systemd/infofield-*.service /etc/systemd/system/
cp "$APP_DIR"/deploy/systemd/infofield-*.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable infofield-backend.service infofield-gateway.service infofield-refresh.timer

# Конфиг nginx. Сертификата ещё нет, поэтому ставим только http-часть:
# certbot добавит https-блоки сам при выпуске сертификата (шаг из DEPLOY.md).
NGINX_CONF="/etc/nginx/sites-available/info-field.ru"
cp "$APP_DIR/deploy/nginx/info-field.ru.conf" "$NGINX_CONF"

mkdir -p /etc/nginx/snippets
cp "$APP_DIR/deploy/nginx/security-headers.conf" /etc/nginx/snippets/infofield-security.conf

# Если на сервере отключён IPv6, строки listen [::] уронят nginx с ошибкой
# "Address family not supported by protocol". Проверяем и убираем их.
if [[ ! -f /proc/net/if_inet6 ]]; then
  warn "IPv6 на сервере отключён — убираю строки listen [::] из конфига nginx"
  sed -i 's/^\(\s*\)listen \[::\]/\1# listen [::]/' "$NGINX_CONF"
fi

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/info-field.ru
rm -f /etc/nginx/sites-enabled/default
ok "конфиг nginx установлен (https включится после выпуска сертификата)"

# --------------------------------------------------------------------------
log "9/9 Firewall и fail2ban"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
echo "    открыты только 22, 80 и 443"

cat > /etc/fail2ban/jail.d/infofield.local <<'JAIL'
# Блокируем IP, который упирается в лимит nginx на /api/auth/login.
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/info-field.error.log
findtime = 600
maxretry = 10
bantime = 3600

[sshd]
enabled = true
maxretry = 5
bantime = 3600
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban

mkdir -p /var/www/certbot

cat <<FINAL

================================================================
Базовая настройка закончена. Осталось три шага вручную:

1. Впишите ключ Gemini в /opt/infofield/backend/.env
     sudo nano /opt/infofield/backend/.env
   (пароль базы уже подставлен, он же лежит в $DB_PASS_FILE)

2. Проверьте, что DNS домена $DOMAIN указывает на этот сервер,
   и выпустите сертификат:
     sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN

3. Соберите фронтенд, запустите сервисы и создайте админа —
   команды в deploy/DEPLOY.md, раздел «Шаг 6».
================================================================
FINAL
