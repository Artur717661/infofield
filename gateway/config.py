"""Настройки шлюза авторизации.

Читает те же переменные окружения, что и backend (общий .env), плюс свои.
Ничего из backend/ не импортирует и не изменяет.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

# --- база данных -----------------------------------------------------------
# По умолчанию та же база, что у backend: шлюз создаёт в ней свои таблицы
# с префиксом app_ и не касается telegram_posts / vk_posts.
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/InfoField")

# --- куда проксировать данные ---------------------------------------------
# Backend слушает только localhost и никогда не публикуется в интернет.
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")

# Парсер + Gemini запускаются на каждый запрос к /telegram и /vk, поэтому
# держим ответ в кэше. 900 с = 15 минут.
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "900"))
BACKEND_TIMEOUT_SECONDS = float(os.getenv("BACKEND_TIMEOUT_SECONDS", "600"))

# --- сессии ---------------------------------------------------------------
SESSION_COOKIE_NAME = "infofield_session"
CSRF_COOKIE_NAME = "infofield_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"

# Сколько живёт сессия без активности и максимум в целом.
SESSION_IDLE_MINUTES = int(os.getenv("SESSION_IDLE_MINUTES", "120"))
SESSION_ABSOLUTE_HOURS = int(os.getenv("SESSION_ABSOLUTE_HOURS", "12"))

# Secure-флаг на куках. В проде обязателен (сайт только по HTTPS),
# для локальной разработки по http его можно снять.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() not in {"false", "0", "no"}

# --- защита от подбора пароля --------------------------------------------
MAX_FAILED_ATTEMPTS = int(os.getenv("MAX_FAILED_ATTEMPTS", "5"))
LOCKOUT_MINUTES = int(os.getenv("LOCKOUT_MINUTES", "15"))
ATTEMPT_WINDOW_MINUTES = int(os.getenv("ATTEMPT_WINDOW_MINUTES", "15"))

# --- требования к паролю -------------------------------------------------
MIN_PASSWORD_LENGTH = int(os.getenv("MIN_PASSWORD_LENGTH", "12"))

# --- прочее ---------------------------------------------------------------
# Список доверенных origin для проверки Origin/Referer на POST-запросах.
# По умолчанию — сам домен. Через запятую, если нужно несколько.
_origins = os.getenv("ALLOWED_ORIGINS", "https://info-field.ru,https://www.info-field.ru")
ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in _origins.split(",") if o.strip()]

# Доверять ли заголовку X-Forwarded-For при определении IP.
# true только если перед шлюзом действительно стоит наш nginx.
TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "true").lower() not in {"false", "0", "no"}


def warn_on_unsafe_config() -> None:
    """Печатает предупреждения, если конфигурация опасна для прода."""
    problems = []
    if not COOKIE_SECURE:
        problems.append("COOKIE_SECURE=false — куки сессии пойдут по http, в проде так нельзя")
    if not ALLOWED_ORIGINS:
        problems.append("ALLOWED_ORIGINS пуст — проверка Origin на POST отключится")
    if "password@localhost" in DATABASE_URL:
        problems.append("DATABASE_URL использует пароль по умолчанию 'password'")

    for problem in problems:
        print(f"[gateway][ВНИМАНИЕ] {problem}", file=sys.stderr)
