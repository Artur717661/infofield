from typing import List

from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session

from backend.databse import TelegramPost, VKPost, get_db
from backend.parcer_tg import run_tg_parser
from backend.parcer_vk import run_vk_parser

app = FastAPI(title="InfoField API")


@app.get("/telegram", response_model=List[dict])
async def get_telegram_posts(db: Session = Depends(get_db)):
    await run_tg_parser()
    posts = db.query(TelegramPost).all()
    result = []
    for p in posts:
        result.append(
            {
                "id": p.id,
                "date": p.post_date.isoformat() if p.post_date else None,
                "text": p.text,
                "src": "tg",
                "aud": p.audiences,
                "sent": p.sentiment,
                "persons": p.persons,
                "units": p.units,
                "events": p.events,
                "directions": p.directions,
                "likes": p.likes,
                "comments": p.comments,
                "reposts": p.reposts,
                "views": p.views,
            }
        )
    return result


@app.get("/vk", response_model=List[dict])
async def get_vk_posts(db: Session = Depends(get_db)):
    await run_vk_parser()
    posts = db.query(VKPost).all()
    result = []
    for p in posts:
        result.append(
            {
                "id": p.id,
                "date": p.post_date.isoformat() if p.post_date else None,
                "text": p.text,
                "src": "vk",
                "aud": p.audiences,
                "sent": p.sentiment,
                "persons": p.persons,
                "units": p.units,
                "events": p.events,
                "directions": p.directions,
                "likes": p.likes,
                "comments": p.comments,
                "reposts": p.reposts,
                "views": p.views,
            }
        )
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app)
