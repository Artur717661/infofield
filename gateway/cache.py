"""Кэш ответов backend'а.

Зачем: эндпоинты /telegram и /vk на каждый вызов синхронно запускают парсер
(Playwright + Gemini). Без кэша каждое открытие дашборда стоило бы запуска
браузера и расхода квоты Gemini, а страница грузилась бы минуту.

Логика:
- ответ живёт CACHE_TTL_SECONDS;
- обновление одного и того же ключа выполняется одним запросом (single-flight),
  остальные ждут его результат;
- если backend упал, а в кэше есть устаревшие данные — отдаём их и помечаем
  ответ как stale, чтобы дашборд показал данные вместо пустого экрана.
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from gateway import config


@dataclass
class CacheEntry:
    payload: Any = None
    fetched_at: float = 0.0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    last_error: str | None = None


class BackendCache:
    def __init__(self) -> None:
        self._entries: dict[str, CacheEntry] = {}

    def _entry(self, path: str) -> CacheEntry:
        if path not in self._entries:
            self._entries[path] = CacheEntry()
        return self._entries[path]

    def age(self, path: str) -> float | None:
        entry = self._entries.get(path)
        if entry is None or entry.fetched_at == 0.0:
            return None
        return time.monotonic() - entry.fetched_at

    async def get(self, path: str, *, force: bool = False) -> tuple[Any, bool]:
        """Возвращает (данные, stale). stale=True — данные устаревшие."""
        entry = self._entry(path)
        age = self.age(path)
        fresh = age is not None and age < config.CACHE_TTL_SECONDS and not force

        if fresh:
            return entry.payload, False

        async with entry.lock:
            # Пока ждали блокировку, другой запрос мог всё обновить.
            age = self.age(path)
            if age is not None and age < config.CACHE_TTL_SECONDS and not force:
                return entry.payload, False

            try:
                payload = await self._fetch(path)
            except Exception as error:  # noqa: BLE001 — сеть/таймаут/битый JSON
                entry.last_error = str(error)
                if entry.payload is not None:
                    return entry.payload, True
                raise

            entry.payload = payload
            entry.fetched_at = time.monotonic()
            entry.last_error = None
            return payload, False

    async def _fetch(self, path: str) -> Any:
        url = f"{config.BACKEND_URL}/{path.lstrip('/')}"
        timeout = httpx.Timeout(config.BACKEND_TIMEOUT_SECONDS, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, headers={"Accept": "application/json"})
            response.raise_for_status()
            data = response.json()
        if not isinstance(data, list):
            raise ValueError(f"{path}: backend вернул не список")
        return data

    def status(self) -> dict[str, Any]:
        return {
            path: {
                "cached": entry.payload is not None,
                "items": len(entry.payload) if isinstance(entry.payload, list) else None,
                "age_seconds": round(self.age(path) or 0),
                "ttl_seconds": config.CACHE_TTL_SECONDS,
                "last_error": entry.last_error,
            }
            for path, entry in self._entries.items()
        }


cache = BackendCache()
