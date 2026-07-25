import asyncio
import html
import json
import re
from datetime import datetime, timedelta, timezone

import httpx

from backend.api_model import analyze_posts_batch
from backend.config import VK_GROUP_NAME
from backend.databse import (
    get_earliest_vk_date,
    get_existing_vk_ids,
    get_latest_vk_date,
    save_vk_posts,
    update_vk_posts_metrics,
)

GROUP_NAME = VK_GROUP_NAME
GROUP_URL = f"https://vk.com/{GROUP_NAME}"


async def fetch_html(url, ajax=False):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    if ajax:
        headers["X-Requested-With"] = "XMLHttpRequest"

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            return resp.content.decode("cp1251", errors="ignore")
    except Exception as e:
        print(f"Error: {e}")
        return ""


async def get_owner_id(group_name):
    html_content = await fetch_html(f"https://vk.com/{group_name}")
    match = re.search(r"\"object_id\":(\d+),\"type\":\"(group|user)\"", html_content)
    if match:
        obj_id, obj_type = match.groups()
        return f"-{obj_id}" if obj_type == "group" else obj_id

    match = re.search(r"vk\.com/(public|club|event)(\d+)", html_content)
    if match:
        return f"-{match.group(2)}"

    return None


def extract_all_text_fields(s):
    results = []
    pattern = r"\"text\":\"((?:\\\"|[^\"])*?)\""
    matches = re.finditer(pattern, s)
    for m in matches:
        raw_val = m.group(1)
        try:
            val = json.loads(f'"{raw_val}"')
            results.append(val)
        except:
            results.append(raw_val)
    return results


def parse_posts_from_html(html_content):
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html_content, "html.parser")
    posts = soup.select("div._post:not(.reply)")

    parsed_data = []
    for post in posts:
        data_post_id = post.get("data-post-id") or post.get("id")
        if not data_post_id:
            continue

        is_pinned = "post_fixed" in post.get("class", [])
        container = post.select_one(".PostContentContainer")
        data_exec = html.unescape(container.get("data-exec", "")) if container else ""

        text = ""
        date_ts = 0
        likes = 0
        comments = 0
        reposts = 0
        views = "0"

        if data_exec:
            item_idx = data_exec.find('"item":{')
            item_part = data_exec[item_idx:] if item_idx != -1 else data_exec

            all_texts = extract_all_text_fields(item_part)
            if all_texts:
                text = max(all_texts, key=len)

            if not text and '"copy_history"' in data_exec:
                history_part = data_exec.split('"copy_history"', 1)[-1]
                hist_texts = extract_all_text_fields(history_part)
                if hist_texts:
                    text = f"[Repost] {max(hist_texts, key=len)}"

            def find_num(pattern):
                m = re.search(pattern, data_exec)
                return int(m.group(1)) if m else 0

            date_ts = find_num(r"\"date\":(\d+)")
            likes = find_num(r"\"likes\":\{.*?\"count\":(\d+)")
            comments = find_num(r"\"comments\":\{.*?\"count\":(\d+)")
            reposts = find_num(r"\"reposts\":\{.*?\"count\":(\d+)")
            views_num = find_num(r"\"views\":\{.*?\"count\":(\d+)")
            views = str(views_num) if views_num else "0"

        if not text:
            text_div = post.select_one(".wall_post_text, .pi_text")
            if text_div:
                text = text_div.get_text(separator=" ", strip=True)

        msg_date = None
        if date_ts:
            msg_date = datetime.fromtimestamp(date_ts, tz=timezone.utc)
        else:
            date_elem = post.select_one(".rel_date, .post_date")
            if date_elem and date_elem.get("data-date"):
                msg_date = datetime.fromtimestamp(
                    int(date_elem.get("data-date")), tz=timezone.utc
                )

        if not msg_date:
            continue

        if text:
            text = BeautifulSoup(text, "html.parser").get_text(
                separator=" ", strip=True
            )
            text = " ".join(text.split())

        if not text or text.strip() == "[Repost]":
            continue

        parsed_data.append(
            {
                "source": "vk",
                "id": data_post_id,
                "date": msg_date.isoformat(),
                "text": text,
                "likes": likes,
                "comments": comments,
                "reposts": reposts,
                "views": views,
                "is_pinned": is_pinned,
            }
        )

    return parsed_data


async def run_vk_parser():
    # Начинаем с самой ранней даты в БД
    earliest_db_date = get_earliest_vk_date()
    if earliest_db_date:
        START_DATE = datetime.combine(
            earliest_db_date, datetime.min.time(), tzinfo=timezone.utc
        )
        print(
            f"Запущено обновление метрик ВК. Самая старая запись в БД от: {START_DATE}"
        )
    else:
        START_DATE = datetime(2026, 6, 8, tzinfo=timezone.utc)
        print(f"База данных пуста. Используем начальную дату: {START_DATE}")

    print(f"Парсинг ВК: {GROUP_NAME}")
    owner_id = await get_owner_id(GROUP_NAME)
    if not owner_id:
        print("Error: Owner ID not found.")
        return

    all_messages = []
    collected_ids = set()
    offset = 0
    max_offset = 5000  # Увеличиваем лимит, чтобы захватить больше истории

    while offset < max_offset:
        url = f"https://vk.com/al_wall.php?act=get_wall&al=1&owner_id={owner_id}&offset={offset}"
        resp_text = await fetch_html(url, ajax=True)
        if not resp_text:
            break

        try:
            data = json.loads(resp_text)
            html_content = data["payload"][1][0]
        except Exception:
            break

        current_msgs = parse_posts_from_html(html_content)
        if not current_msgs:
            break

        added_count = 0
        for m in current_msgs:
            if m["id"] not in collected_ids:
                all_messages.append(m)
                collected_ids.add(m["id"])
                added_count += 1

        if added_count == 0:
            # Если новых в этом блоке нет, возможно, мы дошли до конца или дубликатов
            # Но для полного обновления продолжаем до max_offset
            pass

        offset += 20
        await asyncio.sleep(0.5)  # Немного ускорим для большого объема

    final_messages = [
        m
        for m in all_messages
        if m["date"] and datetime.fromisoformat(m["date"]) >= START_DATE
    ]
    final_messages = sorted(final_messages, key=lambda x: x["date"], reverse=True)

    for msg in final_messages:
        msg["date"] = msg["date"].split("T")[0]
        try:
            msg["id"] = (
                int(str(msg["id"]).split("_")[-1])
                if "_" in str(msg["id"])
                else int(msg["id"])
            )
        except ValueError:
            pass

    print(f"\nСобрано сообщений за период: {len(final_messages)}")
    if final_messages:
        all_ids = [m["id"] for m in final_messages]
        existing_ids = get_existing_vk_ids(all_ids)
        new_messages = [m for m in final_messages if m["id"] not in existing_ids]
        existing_messages = [m for m in final_messages if m["id"] in existing_ids]

        print(
            f"Уже есть в БД: {len(existing_ids)}. Новых для анализа: {len(new_messages)}"
        )

        if new_messages:
            print("Начинаем пакетный анализ новых сообщений ВК...")
            analyzed_messages = analyze_posts_batch(new_messages)
            print(f"Успешно проанализировано: {len(analyzed_messages)}")

            save_vk_posts(analyzed_messages)
            print("Данные успешно сохранены в таблицу vk_posts.")

        else:
            print("Новых сообщений для анализа нет.")

        if existing_messages:
            print(f"Обновляем метрики для {len(existing_messages)} постов ВК...")
            update_vk_posts_metrics(existing_messages)


if __name__ == "__main__":
    asyncio.run(run_vk_parser())
