"""Наполняет базу InfoField демо-данными за учебный год (сен 2025 — июл 2026).

Нужен, чтобы показать дашборд, не дожидаясь реального парсинга и не расходуя
квоту Gemini. Пишет строки через штатные функции backend'а
(`save_telegram_posts` / `save_vk_posts`), поэтому схема гарантированно
совпадает с реальной. Ни один файл в backend/ не изменяется и не требуется.

Запуск из корня проекта:

    python tools/seed_demo_data.py

База берётся из backend/.env (переменная DATABASE_URL) — та же, что использует
сам backend. Скрипт печатает, куда собирается писать, и ждёт подтверждения.

Очистить потом:

    psql -U postgres -d InfoField -c "TRUNCATE telegram_posts, vk_posts;"
"""

import random
import re
import sys
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.config import DATABASE_URL  # noqa: E402
from backend.databse import save_telegram_posts, save_vk_posts  # noqa: E402

# Показываем цель без пароля, чтобы случайно не залить демо-данные в прод.
safe_target = re.sub(r"//[^@/]*@", "//***@", DATABASE_URL)
print(f"Демо-данные будут записаны в: {safe_target}")
if input("Продолжить? [y/N] ").strip().lower() not in {"y", "yes", "д", "да"}:
    print("Отменено.")
    sys.exit(0)

random.seed(2026)

START = date(2025, 9, 1)
END = date(2026, 7, 31)

PERSONS = [
    "Иванов А.П.",
    "Петрова М.С.",
    "Сидоров К.В.",
    "Кузнецова Е.Д.",
    "Смирнов Р.И.",
    "Волкова Н.А.",
]
UNITS_GENERAL = [
    "Научный центр ИИ",
    "Лаборатория геномики",
    "Колледж",
    "Приёмная комиссия",
    "Магистратура Data Science",
    "Студенческий совет",
]
IT_UNIT = "ИТ-специалитет"
DIRECTIONS = [
    "Искусственный интеллект",
    "Биотехнологии",
    "Робототехника",
    "Data Science",
    "Информационная безопасность",
]

# Events that actually belong to a season, so the event ribbon means something.
EVENTS_BY_SEASON = {
    "autumn": ["Посвящение в студенты", "Конференция Наука 2026", "Защита диссертаций", "Спортивный турнир"],
    "winter": ["Зимняя сессия", "Новогодний хакатон", "Защита курсовых", "Спортивный турнир"],
    "spring": ["День открытых дверей", "Хакатон Код Сириуса", "Конференция Наука 2026", "Защита дипломов"],
    "summer": ["Приёмная кампания 2026", "День открытых дверей", "Онлайн-презентация ИТ-специалитета", "Летняя школа"],
}


def season_of(d: date) -> str:
    if d.month in (9, 10, 11):
        return "autumn"
    if d.month in (12, 1, 2):
        return "winter"
    if d.month in (3, 4, 5):
        return "spring"
    return "summer"


# Share of posts that are about the IT specialty, month by month. The admissions
# campaign builds from March and peaks in July; autumn is academic-life driven.
IT_SHARE = {
    9: 0.14, 10: 0.16, 11: 0.18, 12: 0.12,
    1: 0.20, 2: 0.26, 3: 0.34, 4: 0.42, 5: 0.52, 6: 0.66, 7: 0.72,
}

# Baseline daily posting volume per month (before weekday/event modifiers).
BASE_VOLUME = {
    9: 4.2, 10: 3.8, 11: 3.6, 12: 3.0,
    1: 2.4, 2: 3.2, 3: 3.8, 4: 4.0, 5: 4.4, 6: 5.0, 7: 5.4,
}

IT_TEMPLATES = [
    "Открыт приём документов на ИТ-специалитет: {n} бюджетных мест, профиль — {direction}.",
    "Онлайн-презентация ИТ-специалитета собрала {n} абитуриентов: разбирали проходной балл и общежитие.",
    "{person} рассказал(а) о программе ИТ-специалитета на {event}: акцент на {direction}.",
    "Студенты ИТ-специалитета взяли призовое место на {event} с проектом по {direction}.",
    "Приёмная комиссия отвечает на частые вопросы про ИТ-специалитет: сроки подачи и минимальные баллы ЕГЭ.",
    "Видео-тур по лабораториям ИТ-специалитета набрал {n} просмотров за сутки.",
    "Обновлён учебный план ИТ-специалитета: добавлен модуль по {direction}.",
    "Абитуриенты обсуждают конкурс на ИТ-специалитет — заявок больше, чем в прошлом году.",
    "Выпускники ИТ-специалитета рассказали, куда устроились после диплома по направлению {direction}.",
    "{person} провёл(а) открытый семинар для абитуриентов ИТ-специалитета по теме {direction}.",
    "ИТ-специалитет запускает подготовительные курсы для поступающих: разбор задач по {direction}.",
    "Итоги волны зачисления на ИТ-специалитет: проходной балл выше среднего по вузу.",
]
GENERAL_TEMPLATES = [
    "{unit} провёл открытую лекцию по направлению {direction}, участвовало {n} человек.",
    "{person} выступил(а) на {event} с докладом о {direction}.",
    "{unit} объявляет набор стажёров на направление {direction}.",
    "Итоги {event}: {unit} представил {n} проектов.",
    "{person} прокомментировал(а) результаты {event} для {unit}.",
    "Студсовет подвёл итоги месяца: {n} мероприятий, самое популярное — {event}.",
    "{unit} запускает новый курс по {direction} для студентов и сотрудников.",
    "Репортаж с {event}: {unit} и приглашённые эксперты обсудили {direction}.",
    "{unit} и партнёры подписали соглашение о совместных исследованиях по {direction}.",
    "Опубликована статья сотрудников {unit} по направлению {direction}.",
]
NEGATIVE_TEMPLATES = [
    "Сбой записи на {event} вызвал волну жалоб в комментариях, {unit} обещает разобраться.",
    "Очередь в {unit} на {event} возмутила посетителей — ждали больше двух часов.",
    "Студенты жалуются на нехватку мест в общежитии перед {event}.",
    "{unit} признал технические проблемы с трансляцией {event}.",
    "Абитуриенты не смогли загрузить документы на портал {unit} — сайт лежал несколько часов.",
]

# Named story beats, so the anomaly detector has real events to find and the
# demo has something concrete to click on.
STORY_DAYS = {
    date(2025, 9, 1): ("volume", "Посвящение в студенты"),
    date(2025, 11, 18): ("negative", "Сбой портала приёмной комиссии"),
    date(2026, 2, 10): ("volume", "Новогодний хакатон: итоги"),
    date(2026, 4, 11): ("volume", "День открытых дверей"),
    date(2026, 5, 21): ("negative", "Проблемы с трансляцией"),
    date(2026, 6, 25): ("volume", "Старт приёмной кампании"),
    date(2026, 7, 20): ("volume", "Итоги зачисления"),
}


def pick_event(d: date) -> str:
    return random.choice(EVENTS_BY_SEASON[season_of(d)])


def make_post_text(d: date) -> tuple[str, list[str], list[str], list[str]]:
    """Returns (text, units, events, directions)."""
    event = pick_event(d)
    direction = random.choice(DIRECTIONS)
    person = random.choice(PERSONS)

    if random.random() < IT_SHARE[d.month]:
        template = random.choice(IT_TEMPLATES)
        text = template.format(n=random.randint(60, 720), direction=direction, person=person, event=event)
        events = [event] if "{event}" in template else []
        return text, [IT_UNIT], events, [direction]

    if random.random() < 0.07:
        template = random.choice(NEGATIVE_TEMPLATES)
        unit = random.choice(UNITS_GENERAL)
        return template.format(unit=unit, event=event), [unit], [event], []

    template = random.choice(GENERAL_TEMPLATES)
    unit = random.choice(UNITS_GENERAL)
    text = template.format(unit=unit, direction=direction, person=person, event=event, n=random.randint(15, 320))
    events = [event] if "{event}" in template else []
    return text, [unit], events, [direction]


def sentiment_for(text: str) -> str:
    if any(k in text for k in ("жалоб", "возмутила", "проблемы", "жалуются", "Сбой", "не смогли")):
        return random.choice(["neg", "neg", "neg", "neu"])
    if any(k in text for k in ("Итоги", "призовое", "выше среднего", "запускает", "Открыт приём", "подписали")):
        return random.choice(["pos", "pos", "pos", "neu"])
    return random.choice(["pos", "neu", "neu"])


def audiences_for(text: str) -> list[str]:
    if IT_UNIT in text or "абитуриент" in text.lower() or "поступающих" in text:
        return random.choice([["applicants"], ["applicants"], ["applicants", "students"]])
    if any(k in text for k in ("сотрудник", "статья", "исследован", "диссертац", "соглашение")):
        return random.choice([["employees"], ["employees"], ["employees", "students"]])
    return random.choice([["students"], ["students"], ["students", "employees"], ["applicants"]])


def build(source: str, id_start: int) -> list[dict]:
    posts: list[dict] = []
    next_id = id_start
    d = START

    while d <= END:
        base = BASE_VOLUME[d.month] * (0.55 if source == "vk" else 1.0)
        # Weekends are quieter on an official university channel.
        if d.weekday() >= 5:
            base *= 0.45

        story = STORY_DAYS.get(d)
        if story and story[0] == "volume":
            base *= 3.4
        elif story and story[0] == "negative":
            base *= 2.6

        n_posts = max(0, int(random.gauss(base, base * 0.35)))

        for _ in range(n_posts):
            if story and story[0] == "negative" and random.random() < 0.7:
                unit = "Приёмная комиссия"
                event = pick_event(d)
                text = random.choice(NEGATIVE_TEMPLATES).format(unit=unit, event=event)
                units, events, directions = [unit], [event], []
                sentiment = "neg"
            else:
                text, units, events, directions = make_post_text(d)
                sentiment = sentiment_for(text)

            viral = story is not None and story[0] == "volume"
            reach_base = 46 if source == "tg" else 28
            boost = random.uniform(3.0, 5.5) if viral else 1.0
            it_boost = 1.35 if IT_UNIT in units else 1.0

            likes = max(0, int(random.randint(2, reach_base) * boost * it_boost))
            comments = max(0, int(random.randint(0, max(2, reach_base // 4)) * boost))
            reposts = max(0, int(random.randint(0, max(1, reach_base // 8)) * boost))
            views = likes * random.randint(7, 16)

            posts.append(
                {
                    "id": next_id,
                    "date": d.isoformat(),
                    "text": text,
                    "likes": likes,
                    "comments": comments,
                    "reposts": reposts,
                    "views": views,
                    "sent": sentiment,
                    "aud": audiences_for(text),
                    "persons": random.sample(PERSONS, k=random.choice([0, 1, 1, 1, 2])),
                    "units": units,
                    "events": events,
                    "directions": directions,
                    "is_pinned": False,
                }
            )
            next_id += 1
        d += timedelta(days=1)
    return posts


tg_posts = build("tg", id_start=100000)
vk_posts = build("vk", id_start=300000)

save_telegram_posts(tg_posts)
save_vk_posts(vk_posts)

print(f"Готово: {len(tg_posts)} публикаций Telegram + {len(vk_posts)} ВКонтакте, {START} .. {END}")
