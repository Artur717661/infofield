from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    Integer,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class TelegramPost(Base):
    __tablename__ = "telegram_posts"

    id = Column(BigInteger, primary_key=True, index=True)
    post_date = Column(Date, nullable=False)
    text = Column(Text, nullable=True)

    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    reposts = Column(Integer, default=0)
    views = Column(String(50), default="0")

    sentiment = Column(String(10), default="neu")
    audiences = Column(ARRAY(Text), default=[])
    persons = Column(ARRAY(Text), default=[])
    units = Column(ARRAY(Text), default=[])
    events = Column(ARRAY(Text), default=[])
    directions = Column(ARRAY(Text), default=[])


class VKPost(Base):
    __tablename__ = "vk_posts"

    id = Column(BigInteger, primary_key=True, index=True)
    post_date = Column(Date, nullable=False)
    text = Column(Text, nullable=True)
    is_pinned = Column(Boolean, default=False)

    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    reposts = Column(Integer, default=0)
    views = Column(String(50), default="0")

    sentiment = Column(String(10), default="neu")
    audiences = Column(ARRAY(Text), default=[])
    persons = Column(ARRAY(Text), default=[])
    units = Column(ARRAY(Text), default=[])
    events = Column(ARRAY(Text), default=[])
    directions = Column(ARRAY(Text), default=[])


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def save_telegram_posts(posts_data: list[dict]):
    db = SessionLocal()
    try:
        for data in posts_data:
            post_date = (
                datetime.strptime(data["date"], "%Y-%m-%d").date()
                if data.get("date")
                else None
            )
            post = TelegramPost(
                id=data["id"],
                post_date=post_date,
                text=data.get("text"),
                likes=data.get("likes", 0),
                comments=data.get("comments", 0),
                reposts=data.get("reposts", 0),
                views=str(data.get("views", "0")),
                sentiment=data.get("sent", "neu"),
                audiences=data.get("aud", []),
                persons=data.get("persons", []),
                units=data.get("units", []),
                events=data.get("events", []),
                directions=data.get("directions", []),
            )

            db.merge(post)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Ошибка сохранения Telegram постов в БД: {e}")
    finally:
        db.close()


def save_vk_posts(posts_data: list[dict]):
    db = SessionLocal()
    try:
        for data in posts_data:
            post_date = (
                datetime.strptime(data["date"], "%Y-%m-%d").date()
                if data.get("date")
                else None
            )
            post = VKPost(
                id=data["id"],
                post_date=post_date,
                text=data.get("text"),
                is_pinned=data.get("is_pinned", False),
                likes=data.get("likes", 0),
                comments=data.get("comments", 0),
                reposts=data.get("reposts", 0),
                views=str(data.get("views", "0")),
                sentiment=data.get("sent", "neu"),
                audiences=data.get("aud", []),
                persons=data.get("persons", []),
                units=data.get("units", []),
                events=data.get("events", []),
                directions=data.get("directions", []),
            )

            db.merge(post)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Ошибка сохранения VK постов в БД: {e}")
    finally:
        db.close()


def update_telegram_posts_metrics(posts_data: list[dict]):
    db = SessionLocal()
    try:
        for data in posts_data:
            db.query(TelegramPost).filter(TelegramPost.id == data["id"]).update(
                {
                    "likes": data.get("likes", 0),
                    "comments": data.get("comments", 0),
                    "reposts": data.get("reposts", 0),
                    "views": str(data.get("views", "0")),
                }
            )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Ошибка обновления метрик Telegram постов в БД: {e}")
    finally:
        db.close()


def update_vk_posts_metrics(posts_data: list[dict]):
    db = SessionLocal()
    try:
        for data in posts_data:
            db.query(VKPost).filter(VKPost.id == data["id"]).update(
                {
                    "likes": data.get("likes", 0),
                    "comments": data.get("comments", 0),
                    "reposts": data.get("reposts", 0),
                    "views": str(data.get("views", "0")),
                }
            )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Ошибка обновления метрик VK постов в БД: {e}")
    finally:
        db.close()


def get_latest_telegram_date():
    db = SessionLocal()
    try:
        latest_date = db.query(func.max(TelegramPost.post_date)).scalar()
        return latest_date
    finally:
        db.close()


def get_latest_vk_date():
    db = SessionLocal()
    try:
        latest_date = db.query(func.max(VKPost.post_date)).scalar()
        return latest_date
    finally:
        db.close()


def get_earliest_telegram_date():
    db = SessionLocal()
    try:
        earliest_date = db.query(func.min(TelegramPost.post_date)).scalar()
        return earliest_date
    finally:
        db.close()


def get_earliest_vk_date():
    db = SessionLocal()
    try:
        earliest_date = db.query(func.min(VKPost.post_date)).scalar()
        return earliest_date
    finally:
        db.close()


def get_existing_telegram_ids(post_ids: list) -> set:
    if not post_ids:
        return set()
    db = SessionLocal()
    try:
        existing = db.query(TelegramPost.id).filter(TelegramPost.id.in_(post_ids)).all()
        return {row[0] for row in existing}
    finally:
        db.close()


def get_existing_vk_ids(post_ids: list) -> set:
    if not post_ids:
        return set()
    db = SessionLocal()
    try:
        existing = db.query(VKPost.id).filter(VKPost.id.in_(post_ids)).all()
        return {row[0] for row in existing}
    finally:
        db.close()
