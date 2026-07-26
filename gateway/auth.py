"""Пароли, сессии и защита от подбора."""

import hashlib
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error
from sqlalchemy import func
from sqlalchemy.orm import Session

from gateway import config
from gateway.db import AppSession, AppUser, LoginAttempt, utcnow

# argon2id с параметрами по умолчанию argon2-cffi — победитель Password Hashing
# Competition, устойчив к подбору на GPU в отличие от sha/md5.
_hasher = PasswordHasher()

# Явно запрещаем очевидные пароли: длины мало, если пароль — "Password1234".
_WEAK_PASSWORDS = {
    "password", "parol", "qwerty", "admin", "administrator", "infofield",
    "123456", "1234567890", "qwerty123", "passw0rd", "letmein", "welcome",
}


class PasswordPolicyError(ValueError):
    pass


def validate_password(password: str, username: str = "") -> None:
    """Бросает PasswordPolicyError с понятным текстом, если пароль слабый."""
    if len(password) < config.MIN_PASSWORD_LENGTH:
        raise PasswordPolicyError(f"Пароль должен быть не короче {config.MIN_PASSWORD_LENGTH} символов.")

    lowered = password.lower()
    if lowered in _WEAK_PASSWORDS:
        raise PasswordPolicyError("Этот пароль слишком очевиден, выберите другой.")
    if any(weak in lowered for weak in ("password", "qwerty", "infofield", "123456")):
        raise PasswordPolicyError("Пароль содержит распространённую последовательность, выберите другой.")
    if username and username.lower() in lowered:
        raise PasswordPolicyError("Пароль не должен содержать логин.")

    classes = sum(
        [
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        ]
    )
    if classes < 3:
        raise PasswordPolicyError(
            "Пароль должен содержать минимум три вида символов: строчные, прописные, цифры, знаки."
        )


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Любая ошибка проверки — это неудачный вход, а не исключение наружу."""
    try:
        _hasher.verify(password_hash, password)
        return True
    except Argon2Error:
        return False


def needs_rehash(password_hash: str) -> bool:
    """True, если хэш сделан устаревшими параметрами и его пора обновить."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except Argon2Error:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# --- защита от подбора ----------------------------------------------------


def is_locked_out(db: Session, username: str, ip: str) -> int:
    """Возвращает число секунд до конца блокировки, 0 — если не заблокирован.

    Считаем неудачи и по логину, и по IP: так перебор одного логина с разных
    адресов и перебор разных логинов с одного адреса ловятся одинаково.
    """
    window_start = utcnow() - timedelta(minutes=config.ATTEMPT_WINDOW_MINUTES)

    for column, value in ((LoginAttempt.username, username), (LoginAttempt.ip, ip)):
        recent = (
            db.query(LoginAttempt)
            .filter(column == value, LoginAttempt.created_at >= window_start, LoginAttempt.successful.is_(False))
            .order_by(LoginAttempt.created_at.desc())
            .all()
        )
        if len(recent) >= config.MAX_FAILED_ATTEMPTS:
            unlock_at = recent[0].created_at + timedelta(minutes=config.LOCKOUT_MINUTES)
            remaining = int((unlock_at - utcnow()).total_seconds())
            if remaining > 0:
                return remaining
    return 0


def record_attempt(db: Session, username: str, ip: str, successful: bool) -> None:
    db.add(LoginAttempt(username=username[:64], ip=ip[:64], successful=successful))


def clear_attempts(db: Session, username: str, ip: str) -> None:
    db.query(LoginAttempt).filter(
        LoginAttempt.username == username, LoginAttempt.ip == ip, LoginAttempt.successful.is_(False)
    ).delete(synchronize_session=False)


def prune_old_attempts(db: Session) -> None:
    cutoff = utcnow() - timedelta(days=7)
    db.query(LoginAttempt).filter(LoginAttempt.created_at < cutoff).delete(synchronize_session=False)


# --- сессии ---------------------------------------------------------------


def create_session(db: Session, user: AppUser, ip: str, user_agent: str) -> tuple[str, str]:
    """Создаёт сессию, возвращает (session_token, csrf_token).

    Сырой токен возвращается один раз и уходит в куку; в базе — только хэш.
    """
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)

    session = AppSession(
        token_hash=hash_token(token),
        user_id=user.id,
        csrf_token=csrf,
        expires_at=utcnow() + timedelta(hours=config.SESSION_ABSOLUTE_HOURS),
        ip=ip[:64],
        user_agent=(user_agent or "")[:256],
    )
    db.add(session)
    user.last_login_at = utcnow()
    return token, csrf


def resolve_session(db: Session, token: str | None) -> tuple[AppSession, AppUser] | None:
    """Проверяет токен и продлевает сессию. None — если сессия невалидна."""
    if not token:
        return None

    session = db.query(AppSession).filter(AppSession.token_hash == hash_token(token)).one_or_none()
    if session is None or session.revoked_at is not None:
        return None

    now = utcnow()
    if session.expires_at <= now:
        return None
    if session.last_seen_at + timedelta(minutes=config.SESSION_IDLE_MINUTES) <= now:
        session.revoked_at = now
        return None

    user = db.query(AppUser).filter(AppUser.id == session.user_id).one_or_none()
    if user is None or not user.is_active:
        session.revoked_at = now
        return None

    session.last_seen_at = now
    return session, user


def revoke_session(db: Session, token: str | None) -> None:
    if not token:
        return
    session = db.query(AppSession).filter(AppSession.token_hash == hash_token(token)).one_or_none()
    if session is not None and session.revoked_at is None:
        session.revoked_at = utcnow()


def revoke_all_user_sessions(db: Session, user_id: int) -> int:
    return (
        db.query(AppSession)
        .filter(AppSession.user_id == user_id, AppSession.revoked_at.is_(None))
        .update({AppSession.revoked_at: utcnow()}, synchronize_session=False)
    )


def prune_expired_sessions(db: Session) -> None:
    cutoff = utcnow() - timedelta(days=30)
    db.query(AppSession).filter(AppSession.expires_at < cutoff).delete(synchronize_session=False)


def count_active_sessions(db: Session, user_id: int) -> int:
    return (
        db.query(func.count(AppSession.id))
        .filter(
            AppSession.user_id == user_id,
            AppSession.revoked_at.is_(None),
            AppSession.expires_at > utcnow(),
        )
        .scalar()
        or 0
    )
