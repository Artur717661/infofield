"""Управление пользователями из командной строки.

    python -m gateway.cli create-admin              # создать администратора
    python -m gateway.cli create-user <логин>       # создать обычного пользователя
    python -m gateway.cli reset-password <логин>    # сменить пароль
    python -m gateway.cli list                      # показать пользователей
    python -m gateway.cli revoke-sessions <логин>   # выкинуть все сессии

Пароль всегда вводится скрытым вводом и никогда не передаётся аргументом,
чтобы не попасть в историю shell и в вывод `ps`.
"""

import getpass
import secrets
import string
import sys

from gateway import auth, config
from gateway.db import AppUser, SessionLocal, init_db, log_audit


class Aborted(Exception):
    """Ввод прерван (Ctrl+C, Ctrl+D или пустой stdin)."""


def _ask_password(username: str) -> str:
    while True:
        try:
            first = getpass.getpass("Пароль: ")
        except (EOFError, KeyboardInterrupt) as error:
            raise Aborted from error

        try:
            auth.validate_password(first, username)
        except auth.PasswordPolicyError as error:
            print(f"  {error}")
            continue

        try:
            second = getpass.getpass("Повторите пароль: ")
        except (EOFError, KeyboardInterrupt) as error:
            raise Aborted from error

        if first != second:
            print("  Пароли не совпадают, попробуйте снова.")
            continue
        return first


def suggest_password(length: int = 20) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        try:
            auth.validate_password(candidate)
        except auth.PasswordPolicyError:
            continue
        return candidate


def create_user(username: str, role: str) -> int:
    init_db()
    username = username.strip().lower()
    db = SessionLocal()
    try:
        if db.query(AppUser).filter(AppUser.username == username).one_or_none() is not None:
            print(f"Пользователь '{username}' уже существует.")
            return 1

        print(f"Создание пользователя '{username}' с ролью {role}.")
        print(f"Требования: минимум {config.MIN_PASSWORD_LENGTH} символов, три вида символов.")
        print(f"Можно взять сгенерированный: {suggest_password()}")
        password = _ask_password(username)

        db.add(
            AppUser(
                username=username,
                password_hash=auth.hash_password(password),
                role=role,
                must_change_password=False,
            )
        )
        log_audit(db, action="user_created_cli", actor="cli", detail=f"{username} ({role})")
        db.commit()
        print(f"Готово. Пользователь '{username}' создан, роль {role}.")
        return 0
    finally:
        db.close()


def reset_password(username: str) -> int:
    init_db()
    username = username.strip().lower()
    db = SessionLocal()
    try:
        user = db.query(AppUser).filter(AppUser.username == username).one_or_none()
        if user is None:
            print(f"Пользователь '{username}' не найден.")
            return 1

        print(f"Смена пароля для '{username}'. Можно взять: {suggest_password()}")
        password = _ask_password(username)
        user.password_hash = auth.hash_password(password)
        user.must_change_password = False
        revoked = auth.revoke_all_user_sessions(db, user.id)
        log_audit(db, action="password_reset_cli", actor="cli", detail=username)
        db.commit()
        print(f"Пароль обновлён. Отозвано активных сессий: {revoked}.")
        return 0
    finally:
        db.close()


def list_users() -> int:
    init_db()
    db = SessionLocal()
    try:
        users = db.query(AppUser).order_by(AppUser.created_at).all()
        if not users:
            print("Пользователей нет. Создайте админа: python -m gateway.cli create-admin")
            return 0
        print(f"{'логин':<24} {'роль':<8} {'активен':<8} {'сессий':<7} последний вход")
        for user in users:
            last = user.last_login_at.strftime("%Y-%m-%d %H:%M") if user.last_login_at else "—"
            sessions = auth.count_active_sessions(db, user.id)
            print(f"{user.username:<24} {user.role:<8} {'да' if user.is_active else 'нет':<8} {sessions:<7} {last}")
        return 0
    finally:
        db.close()


def revoke_sessions(username: str) -> int:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(AppUser).filter(AppUser.username == username.strip().lower()).one_or_none()
        if user is None:
            print(f"Пользователь '{username}' не найден.")
            return 1
        revoked = auth.revoke_all_user_sessions(db, user.id)
        log_audit(db, action="sessions_revoked_cli", actor="cli", detail=user.username)
        db.commit()
        print(f"Отозвано сессий: {revoked}.")
        return 0
    finally:
        db.close()


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 1

    command, *rest = argv

    try:
        return _dispatch(command, rest)
    except Aborted:
        print("\nОтменено, изменений не внесено.")
        return 130


def _dispatch(command: str, rest: list[str]) -> int:
    if command == "create-admin":
        return create_user(rest[0] if rest else "admin", "admin")
    if command == "create-user":
        if not rest:
            print("Укажите логин: python -m gateway.cli create-user <логин>")
            return 1
        return create_user(rest[0], "viewer")
    if command == "reset-password":
        if not rest:
            print("Укажите логин: python -m gateway.cli reset-password <логин>")
            return 1
        return reset_password(rest[0])
    if command == "list":
        return list_users()
    if command == "revoke-sessions":
        if not rest:
            print("Укажите логин: python -m gateway.cli revoke-sessions <логин>")
            return 1
        return revoke_sessions(rest[0])

    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
