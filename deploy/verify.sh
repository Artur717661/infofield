#!/usr/bin/env bash
#
# Проверка развёрнутого InfoField. Запускать на сервере после установки:
#
#   sudo bash /opt/infofield/deploy/verify.sh
#
# Ничего не меняет, только проверяет и печатает, что не так и как починить.

DOMAIN="${DOMAIN:-info-field.ru}"
APP_DIR="/opt/infofield"

pass=0; fail=0; warn_count=0

ok()   { printf '  \033[1;32m[ OK ]\033[0m %s\n' "$*"; pass=$((pass+1)); }
bad()  { printf '  \033[1;31m[ХУЖЕ]\033[0m %s\n' "$*"; fail=$((fail+1)); }
warn() { printf '  \033[1;33m[ ! ]\033[0m %s\n' "$*"; warn_count=$((warn_count+1)); }
hint() { printf '         %s\n' "$*"; }
# Не называем эту функцию head(): она перекрыла бы системную команду head,
# которая используется ниже в конвейерах.
section() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }

section "1. Системные сервисы"
for svc in postgresql infofield-backend infofield-gateway nginx; do
  if systemctl is-active --quiet "$svc"; then
    ok "$svc запущен"
  else
    bad "$svc НЕ запущен"
    hint "journalctl -u $svc -n 40 --no-pager"
  fi
done

if systemctl is-enabled --quiet infofield-refresh.timer 2>/dev/null; then
  ok "таймер обновления данных включён"
else
  warn "таймер обновления выключен — данные не будут пополняться сами"
  hint "это нормально, если вы работаете на демо-данных"
fi

section "2. Порты"
# Backend и шлюз обязаны слушать только localhost.
for entry in "8000:backend" "8080:gateway"; do
  port="${entry%%:*}"; name="${entry##*:}"
  listen=$(ss -tlnH "sport = :$port" 2>/dev/null | awk '{print $4}' | head -1)
  if [[ -z "$listen" ]]; then
    bad "$name не слушает порт $port"
  elif [[ "$listen" == 127.0.0.1:* || "$listen" == "[::1]:$port" ]]; then
    ok "$name слушает только localhost ($listen)"
  else
    bad "$name слушает $listen — доступен из интернета!"
    hint "исправьте --host 127.0.0.1 в /etc/systemd/system/infofield-$name.service"
  fi
done

for port in 80 443; do
  if ss -tlnH "sport = :$port" 2>/dev/null | grep -q .; then
    ok "порт $port слушается (nginx)"
  else
    bad "порт $port не слушается"
  fi
done

section "3. База данных"
if [[ -r "$APP_DIR/backend/.env" ]]; then
  ok "backend/.env на месте"
  perms=$(stat -c '%a' "$APP_DIR/backend/.env")
  if [[ "$perms" == "600" ]]; then
    ok "права на backend/.env: 600"
  else
    warn "права на backend/.env: $perms (лучше 600)"
    hint "chmod 600 $APP_DIR/backend/.env"
  fi
  if grep -q '^GEMINI_API_KEY=вставьте' "$APP_DIR/backend/.env" 2>/dev/null; then
    warn "GEMINI_API_KEY не заполнен — разметка новых публикаций работать не будет"
  fi
else
  bad "нет $APP_DIR/backend/.env"
fi

posts=$(sudo -u postgres psql -d InfoField -tAc \
  "select (select count(*) from telegram_posts)+(select count(*) from vk_posts);" 2>/dev/null)
if [[ -n "$posts" && "$posts" -gt 0 ]]; then
  span=$(sudo -u postgres psql -d InfoField -tAc \
    "select min(d)||' .. '||max(d) from (select min(post_date) d from telegram_posts union select min(post_date) from vk_posts union select max(post_date) from telegram_posts union select max(post_date) from vk_posts) t;" 2>/dev/null)
  ok "публикаций в базе: $posts (период $span)"
else
  warn "в базе нет публикаций — дашборд будет пустым"
  hint "залейте демо-данные: sudo -u infofield $APP_DIR/venv/bin/python $APP_DIR/tools/seed_demo_data.py"
fi

users=$(sudo -u postgres psql -d InfoField -tAc "select count(*) from app_users where is_active;" 2>/dev/null)
admins=$(sudo -u postgres psql -d InfoField -tAc "select count(*) from app_users where is_active and role='admin';" 2>/dev/null)
if [[ "${admins:-0}" -gt 0 ]]; then
  ok "активных пользователей: $users, из них админов: $admins"
else
  bad "нет ни одного активного администратора — войти будет некому"
  hint "cd $APP_DIR && sudo -u infofield venv/bin/python -m gateway.cli create-admin admin"
fi

section "4. Фронтенд"
if [[ -f "$APP_DIR/frontend/dist/index.html" ]]; then
  ok "сборка фронтенда на месте"
  if ls "$APP_DIR"/frontend/dist/assets/*.js >/dev/null 2>&1; then
    ok "файлы assets на месте"
  else
    bad "нет файлов в frontend/dist/assets"
  fi
else
  bad "нет $APP_DIR/frontend/dist/index.html — фронтенд не собран"
  hint "cd $APP_DIR/frontend && sudo -u infofield npm ci && sudo -u infofield npm run build"
fi

section "5. HTTPS и домен"
resolved=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1)
myip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null)
if [[ -z "$resolved" ]]; then
  warn "$DOMAIN пока не разрешается в IP — DNS ещё не обновился"
elif [[ -n "$myip" && "$resolved" == "$myip" ]]; then
  ok "$DOMAIN указывает на этот сервер ($resolved)"
else
  warn "$DOMAIN -> $resolved, а внешний IP сервера $myip"
  hint "проверьте A-записи в панели рег.ру"
fi

if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  days=$(( ( $(date -d "$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | cut -d= -f2)" +%s) - $(date +%s) ) / 86400 ))
  if (( days > 20 )); then
    ok "сертификат действует ещё $days дн."
  else
    warn "сертификат истекает через $days дн."
    hint "certbot renew --dry-run"
  fi
else
  bad "сертификат для $DOMAIN не найден"
  hint "certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

section "6. Доступ и защита (через nginx)"
code=$(curl -sk --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 10 "https://127.0.0.1/" -H "Host: $DOMAIN" 2>/dev/null)
[[ "$code" == "200" ]] && ok "главная страница отдаётся (200)" || bad "главная страница вернула $code"

code=$(curl -sk --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 10 "https://127.0.0.1/api/telegram" -H "Host: $DOMAIN" 2>/dev/null)
[[ "$code" == "401" ]] && ok "данные без входа закрыты (401)" || bad "/api/telegram без входа вернул $code, ожидался 401"

code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1/" -H "Host: $DOMAIN" 2>/dev/null)
[[ "$code" == "301" ]] && ok "http перебрасывает на https (301)" || warn "http вернул $code, ожидался 301"

headers=$(curl -skI --noproxy '*' --max-time 10 "https://127.0.0.1/" -H "Host: $DOMAIN" 2>/dev/null)
for h in "strict-transport-security" "x-frame-options" "x-content-type-options" "referrer-policy"; do
  if grep -qi "^$h:" <<<"$headers"; then
    ok "заголовок $h отдаётся"
  else
    bad "заголовок $h отсутствует"
    hint "проверьте include /etc/nginx/snippets/infofield-security.conf в каждом location"
  fi
done

# Backend не должен быть доступен снаружи.
if [[ -n "$myip" ]]; then
  code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 5 "http://$myip:8000/telegram" 2>/dev/null)
  [[ "$code" == "000" ]] && ok "backend снаружи недоступен" || bad "backend отвечает снаружи (код $code)!"
fi

section "7. Ресурсы"
ram=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
swap=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
echo "         RAM $ram МБ, свободно $avail МБ, swap $swap МБ"
if (( ram < 1900 && swap < 512 )); then
  warn "1 ГБ памяти без swap — парсер может убивать процессы"
  hint "см. deploy/REGRU.md, раздел «Если у вас тариф с 1 ГБ RAM»"
elif (( avail < 200 )); then
  warn "свободно меньше 200 МБ"
else
  ok "памяти достаточно"
fi

if dmesg 2>/dev/null | grep -qi "out of memory"; then
  warn "в dmesg есть записи об OOM — процессы уже убивались"
  hint "dmesg | grep -i 'out of memory' | tail -5"
fi

disk=$(df -m --output=avail / | tail -1 | tr -d ' ')
(( disk > 2000 )) && ok "на диске свободно $disk МБ" || warn "на диске мало места: $disk МБ"

section "Итог"
printf "  успешно: %d   проблем: %d   предупреждений: %d\n" "$pass" "$fail" "$warn_count"
if (( fail == 0 )); then
  printf '\n  \033[1;32mКритических проблем нет. Откройте https://%s\033[0m\n\n' "$DOMAIN"
  exit 0
else
  printf '\n  \033[1;31mЕсть проблемы — смотрите строки [ХУЖЕ] выше.\033[0m\n\n'
  exit 1
fi
