"""Шлюз авторизации для дашборда InfoField.

Единственная точка входа из интернета. Отдаёт статику фронтенда, держит
сессии и только для вошедших пользователей проксирует данные из backend'а,
который слушает исключительно localhost.

Backend не изменяется: шлюз обращается к нему по HTTP как обычный клиент.
"""

import asyncio
import secrets
from pathlib import Path
from typing import Annotated

from fastapi import Body, Cookie, Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from gateway import auth, config
from gateway.cache import cache
from gateway.db import AppSession, AppUser, get_db, init_db, log_audit, utcnow

app = FastAPI(title="InfoField Gateway", docs_url=None, redoc_url=None, openapi_url=None)

STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    config.warn_on_unsafe_config()


# --------------------------------------------------------------------------
# вспомогательное
# --------------------------------------------------------------------------


def client_ip(request: Request) -> str:
    """IP клиента. X-Forwarded-For берём только если сами поставили прокси."""
    if config.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Первый адрес в цепочке — исходный клиент.
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def set_security_headers(response: Response) -> None:
    """Заголовки, которые нельзя задать через <meta> в index.html."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    set_security_headers(response)
    # Ответы с данными не должны оставаться в кэше браузера или прокси.
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def require_trusted_origin(request: Request) -> None:
    """Проверка Origin на изменяющих запросах — второй слой против CSRF.

    Первый слой — SameSite=Lax на куке сессии, третий — CSRF-токен.
    """
    if not config.ALLOWED_ORIGINS:
        return

    origin = request.headers.get("origin")
    if origin is None:
        # Некоторые клиенты не присылают Origin на same-origin запросах;
        # тогда полагаемся на Referer.
        referer = request.headers.get("referer")
        if referer is None:
            return
        origin = "/".join(referer.split("/")[:3])

    if origin.rstrip("/") not in config.ALLOWED_ORIGINS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Запрос пришёл с недоверенного источника.")


def set_session_cookies(response: Response, token: str, csrf: str) -> None:
    response.set_cookie(
        config.SESSION_COOKIE_NAME,
        token,
        httponly=True,  # JavaScript не увидит токен даже при XSS
        secure=config.COOKIE_SECURE,
        samesite="lax",
        max_age=config.SESSION_ABSOLUTE_HOURS * 3600,
        path="/",
    )
    # CSRF-токен читается фронтендом, поэтому httponly=False. Это не секрет:
    # его смысл в том, что чужой сайт не может прочитать нашу куку.
    response.set_cookie(
        config.CSRF_COOKIE_NAME,
        csrf,
        httponly=False,
        secure=config.COOKIE_SECURE,
        samesite="lax",
        max_age=config.SESSION_ABSOLUTE_HOURS * 3600,
        path="/",
    )


def clear_session_cookies(response: Response) -> None:
    for name in (config.SESSION_COOKIE_NAME, config.CSRF_COOKIE_NAME):
        response.delete_cookie(name, path="/", secure=config.COOKIE_SECURE, samesite="lax")


# --------------------------------------------------------------------------
# зависимости авторизации
# --------------------------------------------------------------------------

SessionCookie = Annotated[str | None, Cookie(alias=config.SESSION_COOKIE_NAME)]


def current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    session_token: SessionCookie = None,
) -> AppUser:
    resolved = auth.resolve_session(db, session_token)
    if resolved is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Нужно войти в систему.")
    session, user = resolved
    db.commit()  # фиксируем продление last_seen_at
    request.state.session = session
    return user


def current_admin(user: Annotated[AppUser, Depends(current_user)]) -> AppUser:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нужны права администратора.")
    return user


def verify_csrf(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    session_token: SessionCookie = None,
    csrf_header: Annotated[str | None, Header(alias=config.CSRF_HEADER_NAME)] = None,
) -> None:
    """CSRF для POST: заголовок должен совпасть с токеном сессии в базе."""
    require_trusted_origin(request)

    resolved = auth.resolve_session(db, session_token)
    if resolved is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Нужно войти в систему.")

    session, _ = resolved
    if not csrf_header or not secrets.compare_digest(csrf_header, session.csrf_token):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Неверный CSRF-токен, обновите страницу.")


# --------------------------------------------------------------------------
# модели запросов
# --------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9._@-]+$")
    password: str = Field(min_length=1, max_length=256)
    role: str = Field(default="viewer", pattern=r"^(viewer|admin)$")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)


# --------------------------------------------------------------------------
# авторизация
# --------------------------------------------------------------------------


@app.post("/api/auth/login")
def login(
    request: Request,
    response: Response,
    payload: Annotated[LoginRequest, Body()],
    db: Annotated[Session, Depends(get_db)],
):
    require_trusted_origin(request)

    ip = client_ip(request)
    username = payload.username.strip().lower()

    locked_for = auth.is_locked_out(db, username, ip)
    if locked_for:
        db.commit()
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Слишком много неудачных попыток. Повторите через {locked_for // 60 + 1} мин.",
        )

    user = db.query(AppUser).filter(AppUser.username == username).one_or_none()

    # Проверяем пароль даже для несуществующего логина, чтобы время ответа не
    # выдавало, какие логины существуют.
    stored_hash = user.password_hash if user else auth.hash_password(secrets.token_urlsafe(16))
    password_ok = auth.verify_password(stored_hash, payload.password)

    if user is None or not password_ok or not user.is_active:
        auth.record_attempt(db, username, ip, successful=False)
        log_audit(db, action="login_failed", actor=username, ip=ip)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный логин или пароль.")

    if auth.needs_rehash(user.password_hash):
        user.password_hash = auth.hash_password(payload.password)

    token, csrf = auth.create_session(db, user, ip, request.headers.get("user-agent", ""))
    auth.record_attempt(db, username, ip, successful=True)
    auth.clear_attempts(db, username, ip)
    auth.prune_expired_sessions(db)
    auth.prune_old_attempts(db)
    log_audit(db, action="login_ok", actor=username, ip=ip)
    db.commit()

    set_session_cookies(response, token, csrf)
    return {
        "username": user.username,
        "role": user.role,
        "mustChangePassword": user.must_change_password,
    }


@app.post("/api/auth/logout")
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    session_token: SessionCookie = None,
):
    resolved = auth.resolve_session(db, session_token)
    if resolved is not None:
        _, user = resolved
        log_audit(db, action="logout", actor=user.username, ip=client_ip(request))
    auth.revoke_session(db, session_token)
    db.commit()
    clear_session_cookies(response)
    return {"ok": True}


@app.get("/api/auth/me")
def whoami(
    db: Annotated[Session, Depends(get_db)],
    session_token: SessionCookie = None,
):
    """Фронтенд спрашивает это при загрузке: 200 — вошёл, 401 — покажи логин."""
    resolved = auth.resolve_session(db, session_token)
    if resolved is None:
        db.commit()
        return JSONResponse({"authenticated": False}, status_code=status.HTTP_401_UNAUTHORIZED)

    session, user = resolved
    db.commit()
    return {
        "authenticated": True,
        "username": user.username,
        "role": user.role,
        "mustChangePassword": user.must_change_password,
        "sessionExpiresAt": session.expires_at.isoformat(),
    }


@app.post("/api/auth/password")
def change_password(
    request: Request,
    payload: Annotated[ChangePasswordRequest, Body()],
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[AppUser, Depends(current_user)],
    _csrf: Annotated[None, Depends(verify_csrf)] = None,
):
    if not auth.verify_password(user.password_hash, payload.current_password):
        log_audit(db, action="password_change_failed", actor=user.username, ip=client_ip(request))
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Текущий пароль неверен.")

    try:
        auth.validate_password(payload.new_password, user.username)
    except auth.PasswordPolicyError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from error

    user.password_hash = auth.hash_password(payload.new_password)
    user.must_change_password = False
    # Смена пароля выкидывает все прочие сессии этого пользователя.
    auth.revoke_all_user_sessions(db, user.id)
    log_audit(db, action="password_changed", actor=user.username, ip=client_ip(request))
    db.commit()
    return {"ok": True, "reloginRequired": True}


# --------------------------------------------------------------------------
# данные (только для вошедших)
# --------------------------------------------------------------------------


async def _serve(path: str, force: bool = False):
    try:
        payload, stale = await cache.get(path, force=force)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Backend не отдал данные /{path}: {error}",
        ) from error

    headers = {"X-Data-Stale": "1"} if stale else {}
    return JSONResponse(payload, headers=headers)


@app.get("/api/telegram")
async def telegram(_user: Annotated[AppUser, Depends(current_user)]):
    return await _serve("telegram")


@app.get("/api/vk")
async def vk(_user: Annotated[AppUser, Depends(current_user)]):
    return await _serve("vk")


@app.post("/api/refresh")
async def refresh(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AppUser, Depends(current_admin)],
    _csrf: Annotated[None, Depends(verify_csrf)] = None,
):
    """Принудительно обновить данные. Только админ: запускает парсер и Gemini."""
    log_audit(db, action="cache_refresh", actor=admin.username, ip=client_ip(request))
    db.commit()
    results = await asyncio.gather(
        cache.get("telegram", force=True),
        cache.get("vk", force=True),
        return_exceptions=True,
    )
    errors = [str(r) for r in results if isinstance(r, Exception)]
    if errors:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "; ".join(errors))
    return {"ok": True, "cache": cache.status()}


# --------------------------------------------------------------------------
# админка
# --------------------------------------------------------------------------


@app.get("/api/admin/users")
def list_users(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[AppUser, Depends(current_admin)],
):
    users = db.query(AppUser).order_by(AppUser.created_at).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "isActive": u.is_active,
            "createdAt": u.created_at.isoformat(),
            "lastLoginAt": u.last_login_at.isoformat() if u.last_login_at else None,
            "activeSessions": auth.count_active_sessions(db, u.id),
        }
        for u in users
    ]


@app.post("/api/admin/users")
def create_user(
    request: Request,
    payload: Annotated[CreateUserRequest, Body()],
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AppUser, Depends(current_admin)],
    _csrf: Annotated[None, Depends(verify_csrf)] = None,
):
    username = payload.username.strip().lower()
    if db.query(AppUser).filter(AppUser.username == username).one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с таким логином уже есть.")

    try:
        auth.validate_password(payload.password, username)
    except auth.PasswordPolicyError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from error

    user = AppUser(
        username=username,
        password_hash=auth.hash_password(payload.password),
        role=payload.role,
        must_change_password=True,
    )
    db.add(user)
    log_audit(db, action="user_created", actor=admin.username, detail=f"{username} ({payload.role})", ip=client_ip(request))
    db.commit()
    return {"ok": True, "username": username}


@app.post("/api/admin/users/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AppUser, Depends(current_admin)],
    _csrf: Annotated[None, Depends(verify_csrf)] = None,
):
    user = db.query(AppUser).filter(AppUser.id == user_id).one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден.")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя отключить самого себя.")

    active_admins = db.query(AppUser).filter(AppUser.role == "admin", AppUser.is_active.is_(True)).count()
    if user.role == "admin" and active_admins <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Это последний активный админ, его нельзя отключить.")

    user.is_active = False
    revoked = auth.revoke_all_user_sessions(db, user.id)
    log_audit(
        db,
        action="user_deactivated",
        actor=admin.username,
        detail=f"{user.username}, сессий отозвано: {revoked}",
        ip=client_ip(request),
    )
    db.commit()
    return {"ok": True, "revokedSessions": revoked}


@app.post("/api/admin/users/{user_id}/activate")
def activate_user(
    user_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[AppUser, Depends(current_admin)],
    _csrf: Annotated[None, Depends(verify_csrf)] = None,
):
    user = db.query(AppUser).filter(AppUser.id == user_id).one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден.")
    user.is_active = True
    log_audit(db, action="user_activated", actor=admin.username, detail=user.username, ip=client_ip(request))
    db.commit()
    return {"ok": True}


@app.get("/api/admin/audit")
def audit_log(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[AppUser, Depends(current_admin)],
    limit: int = 50,
):
    from gateway.db import AuditEvent

    events = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(min(limit, 200)).all()
    return [
        {
            "at": e.created_at.isoformat(),
            "actor": e.actor,
            "action": e.action,
            "detail": e.detail,
            "ip": e.ip,
        }
        for e in events
    ]


@app.get("/api/admin/status")
def gateway_status(_admin: Annotated[AppUser, Depends(current_admin)]):
    return {"cache": cache.status(), "now": utcnow().isoformat()}


# --------------------------------------------------------------------------
# статика фронтенда
# --------------------------------------------------------------------------

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        """SPA: любой не-API путь отдаёт index.html."""
        if full_path.startswith("api/"):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Неизвестный эндпоинт.")
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("gateway.main:app", host="127.0.0.1", port=8080)
