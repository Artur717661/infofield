import asyncio
import json
from datetime import datetime, timedelta, timezone

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from backend.api_model import analyze_posts_batch
from backend.config import TG_CHANNEL_NAME
from backend.databse import (
    get_earliest_telegram_date,
    get_existing_telegram_ids,
    get_latest_telegram_date,
    save_telegram_posts,
    update_telegram_posts_metrics,
)

CHANNEL_NAME = TG_CHANNEL_NAME
CHANNEL_URL = f"https://t.me/s/{CHANNEL_NAME}"


def parse_html(html_content, start_date=None):
    soup = BeautifulSoup(html_content, "html.parser")
    messages = soup.find_all("div", class_="tgme_widget_message")

    parsed_data = []

    for msg in messages:
        data_post = msg.get("data-post", "")
        if not data_post:
            continue

        try:
            msg_id = int(data_post.split("/")[-1])
        except ValueError:
            continue

        text_div = msg.find("div", class_="tgme_widget_message_text")
        if text_div:
            text = text_div.get_text(separator=" ", strip=True)
            text = " ".join(text.split())
        else:
            text = None

        if not text:
            continue

        time_tag = msg.find("time", class_="time")
        date_str = time_tag.get("datetime") if time_tag else None

        if date_str:
            msg_date = datetime.fromisoformat(date_str)
            if start_date and msg_date < start_date:
                continue
        else:
            continue

        views_elem = msg.find("span", class_="tgme_widget_message_views")
        views = views_elem.get_text(strip=True) if views_elem else "0"

        reactions_container = msg.find("div", class_="tgme_widget_message_reactions")
        likes = 0
        if reactions_container:
            for reaction in reactions_container.find_all(
                "span", class_="tgme_reaction"
            ):
                count_str = "".join(filter(str.isdigit, reaction.get_text(strip=True)))
                if count_str:
                    likes += int(count_str)

        replies_elem = msg.find("span", class_="tgme_widget_message_replies")
        comments = 0
        if replies_elem:
            c_str = "".join(filter(str.isdigit, replies_elem.get_text(strip=True)))
            if c_str:
                comments = int(c_str)

        forwards_elem = msg.find(
            "span", class_="tgme_widget_message_forwards"
        ) or msg.find("span", class_="tgme_widget_message_shares")
        reposts = 0
        if forwards_elem:
            f_str = "".join(filter(str.isdigit, forwards_elem.get_text(strip=True)))
            if f_str:
                reposts = int(f_str)

        parsed_data.append(
            {
                "source": "telegram",
                "id": msg_id,
                "date": date_str,
                "text": text,
                "likes": likes,
                "comments": comments,
                "reposts": reposts,
                "views": views,
            }
        )

    return parsed_data


async def run_tg_parser():
    # Начинаем с самой ранней даты в БД, чтобы обновить всё, что есть
    earliest_db_date = get_earliest_telegram_date()
    if earliest_db_date:
        START_DATE = datetime.combine(
            earliest_db_date, datetime.min.time(), tzinfo=timezone.utc
        )
        print(f"Запущено обновление метрик. Самая старая запись в БД от: {START_DATE}")
    else:
        START_DATE = datetime(2026, 6, 1, tzinfo=timezone.utc)
        print(f"База данных пуста. Используем начальную дату: {START_DATE}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(CHANNEL_URL, wait_until="domcontentloaded", timeout=60000)
        except Exception as e:
            print(f"Ошибка при загрузке страницы: {e}")
            await browser.close()
            return

        print(f"Парсинг канала: {CHANNEL_NAME}")
        print(f"Ищем сообщения начиная с: {START_DATE}")

        html_content = await page.content()
        initial_msgs = parse_html(html_content)
        if initial_msgs:
            initial_msgs = sorted(initial_msgs, key=lambda x: x["id"])
            newest_date_str = initial_msgs[-1]["date"]
            if newest_date_str:
                newest_date = datetime.fromisoformat(newest_date_str)
                if newest_date < START_DATE:
                    print(f"В канале нет сообщений новее {START_DATE}.")
                    print(f"Самое новое сообщение датируется: {newest_date}")
                    await browser.close()
                    return

        while True:
            html_content = await page.content()
            current_msgs = parse_html(html_content)

            if not current_msgs:
                await asyncio.sleep(2)
                continue

            current_msgs = sorted(current_msgs, key=lambda x: x["id"])
            newest_id = current_msgs[-1]["id"]

            # Увеличиваем окно поиска, чтобы точно захватить старые сообщения при скроллинге
            feed_msgs = [m for m in current_msgs if m["id"] >= newest_id - 5000]

            if feed_msgs:
                oldest_feed_date_str = feed_msgs[0]["date"]
                if oldest_feed_date_str:
                    oldest_feed_date = datetime.fromisoformat(oldest_feed_date_str)
                    if oldest_feed_date <= START_DATE:
                        print(f"Достигли нужной даты: {oldest_feed_date}")
                        break

            prev_height = await page.evaluate("document.body.scrollHeight")

            await page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(2)

            new_height = await page.evaluate("document.body.scrollHeight")
            if new_height == prev_height:
                print("Достигли начала канала или контент больше не подгружается.")
                break
        html_content = await page.content()
        await browser.close()

    all_messages = parse_html(html_content, start_date=START_DATE)

    all_messages = sorted(all_messages, key=lambda x: x["id"], reverse=True)

    for msg in all_messages:
        if msg["date"]:
            msg["date"] = msg["date"].split("T")[0]

    print(f"Собрано сообщений за период: {len(all_messages)}")
    if all_messages:
        all_ids = [m["id"] for m in all_messages]
        existing_ids = get_existing_telegram_ids(all_ids)
        new_messages = [m for m in all_messages if m["id"] not in existing_ids]
        existing_messages = [m for m in all_messages if m["id"] in existing_ids]

        print(
            f"Уже есть в БД: {len(existing_ids)}. Новых для анализа: {len(new_messages)}"
        )

        if new_messages:
            print("Начинаем пакетный анализ новых сообщений...")
            analyzed_messages = analyze_posts_batch(new_messages)
            print(f"Успешно проанализировано: {len(analyzed_messages)}")

            save_telegram_posts(analyzed_messages)
            print("Данные успешно сохранены в таблицу telegram_posts.")
        else:
            print("Новых сообщений для анализа нет.")

        if existing_messages:
            print(f"Обновляем метрики для {len(existing_messages)} постов...")
            update_telegram_posts_metrics(existing_messages)


if __name__ == "__main__":
    asyncio.run(run_tg_parser())
