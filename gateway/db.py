"""Схема шлюза: пользователи, сессии, попытки входа, журнал действий.

Таблицы отдельные, с префиксом app_. Таблицы backend'а (telegram_posts,
vk_posts) шлюз не читает и не изменяет — данные он получает только по HTTP.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

from gateway.config import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AppUser(Base):
    __tablename__ = "app_users"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    # Полный argon2id-хэш вместе с параметрами и солью. Пароль нигде не хранится.
    password_hash = Column(Text, nullable=False)
    role = Column(String(16), nullable=False, default="viewer")  # viewer | admin
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    # Заставить сменить пароль при следующем входе (для первого админа).
    must_change_password = Column(Boolean, nullable=False, default=False)


class AppSession(Base):
    __tablename__ = "app_sessions"

    id = Column(Integer, primary_key=True)
    # В базе лежит только SHA-256 от токена: утечка дампа не даёт войти.
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    csrf_token = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(256), nullable=True)


class LoginAttempt(Base):
    __tablename__ = "app_login_attempts"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), nullable=False)
    ip = Column(String(64), nullable=False)
    successful = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


Index("ix_login_attempts_lookup", LoginAttempt.username, LoginAttempt.ip, LoginAttempt.created_at)


class AuditEvent(Base):
    __tablename__ = "app_audit_events"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    actor = Column(String(64), nullable=True)
    action = Column(String(64), nullable=False)
    detail = Column(Text, nullable=True)
    ip = Column(String(64), nullable=True)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def log_audit(db, *, action: str, actor: str | None = None, detail: str | None = None, ip: str | None = None) -> None:
    db.add(AuditEvent(action=action, actor=actor, detail=detail, ip=ip))
