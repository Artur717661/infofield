import json
import re
import time

from google import genai
from google.genai import types
from pydantic import BaseModel

from backend.config import GEMINI_API_KEY


class NLPResult(BaseModel):
    id: int
    aud: list[str]
    sent: str
    persons: list[str]
    units: list[str]
    events: list[str]
    directions: list[str]


class NLPBatchResult(BaseModel):
    results: list[NLPResult]


SYSTEM_PROMPT = """
Ты — AI-аналитик. Тебе будет передан список сообщений.
Для КАЖДОГО сообщения извлеки данные и верни строго в формате JSON по схеме.
aud: ["students", "employees", "applicants"]
sent: "pos", "neg", "neu"
persons: ФИО
units: организации, лаборатории, центры
events: мероприятия
directions: научные направления
"""

client = genai.Client(api_key=GEMINI_API_KEY)


def analyze_posts_batch(posts: list[dict], chunk_size: int = 10) -> list[dict]:
    if not posts:
        return []

    all_final_messages = []

    for i in range(0, len(posts), chunk_size):
        if i > 0:
            print("Ожидание перед следующим батчем (2 сек)...")
            time.sleep(2)

        chunk = posts[i : i + chunk_size]
        print(
            f"Обработка батча: {i // chunk_size + 1}/{(len(posts) - 1) // chunk_size + 1} (сообщений: {len(chunk)})"
        )

        batch_input = []
        for p in chunk:
            batch_input.append(f"ID: {p['id']}\nText: {p['text']}")

        combined_text = "\n---\n".join(batch_input)

        generate_content_config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=NLPBatchResult,
            temperature=0.1,
        )

        max_retries = 5
        chunk_success = False

        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=combined_text,
                    config=generate_content_config,
                )

                batch_data = json.loads(response.text)
                results_dict = {item["id"]: item for item in batch_data["results"]}

                for p in chunk:
                    nlp_info = results_dict.get(p["id"], {})
                    all_final_messages.append(
                        {
                            "id": p.get("id"),
                            "date": p.get("date"),
                            "src": "tg"
                            if p.get("source") == "telegram"
                            else p.get("source"),
                            "text": p.get("text"),
                            "aud": nlp_info.get("aud", []),
                            "sent": nlp_info.get("sent", "neu"),
                            "persons": nlp_info.get("persons", []),
                            "units": nlp_info.get("units", []),
                            "events": nlp_info.get("events", []),
                            "directions": nlp_info.get("directions", []),
                            "likes": p.get("likes", 0),
                            "comments": p.get("comments", 0),
                            "reposts": p.get("reposts", 0),
                            "views": p.get("views", 0),
                        }
                    )
                chunk_success = True
                break

            except Exception as e:
                error_str = str(e)
                if any(
                    code in error_str
                    for code in ["429", "500", "503", "EOF", "SSL", "OS Error"]
                ):
                    wait_time = 120
                    if "429" in error_str:
                        wait_match = re.search(r"retry in (\d+\.?\d*)s", error_str)
                        wait_time = (
                            float(wait_match.group(1)) + 10 if wait_match else 120
                        )

                    print(
                        f"Квота исчерпана или сетевой сбой. Ждем {wait_time}с... (Попытка {attempt + 1}/{max_retries})"
                    )
                    time.sleep(wait_time)
                    continue

                print(f"Критическая ошибка в батче: {e}")
                break

        if not chunk_success:
            print(
                f"Не удалось обработать батч после {max_retries} попыток. Пропускаем..."
            )

    return all_final_messages


def analyze_post(raw_post: dict) -> dict:
    results = analyze_posts_batch([raw_post])
    return results[0] if results else {"error": "Failed to analyze"}


if __name__ == "__main__":
    test_posts = [
        {"id": 1, "text": "Тестовое сообщение про Сириус", "source": "telegram"},
        {"id": 2, "text": "Еще один пост про науку", "source": "telegram"},
    ]
    print(analyze_posts_batch(test_posts))
