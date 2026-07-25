# InfoField Frontend

Analytics dashboard for university media monitoring (Telegram / VK / Max). Reads
only from the existing FastAPI backend, unmodified:

- `GET /telegram`
- `GET /vk`

## Stack

- React 19 + TypeScript + Vite
- Recharts (sentiment donut) + hand-rolled SVG for the rest of the charts
  (anomaly line, calendar heatmap, treemap, bump chart, collocation graph,
  funnel, n-gram bars) so every visual can carry its own click-to-drill-down
  behaviour without fighting a charting library's event model
- Framer Motion for tab transitions and the drill-down panel

## Install & run

```bash
npm install
npm run dev
```

Opens on `http://127.0.0.1:4174`. In dev, `/telegram` and `/vk` are proxied by
Vite to `http://localhost:8000` (see `vite.config.mjs`) — no `.env` required.
To point at a different backend, set `VITE_API_BASE_URL`.

## What's implemented

- Global filter bar: date range, source (TG/VK), audience, sentiment, free
  text search, and a dedicated "ИТ-специалитет" toggle
- KPI row: mention volume with period-over-period delta, engagement rate,
  reach (views), loyalty index `(pos − neg) / total × 100`, anomaly day count
  (`|z| ≥ 2` on the daily mention series)
- Обзор: anomaly line chart, sentiment donut, activity calendar heatmap, topic
  tag cloud — every chart element is clickable and opens a drill-down panel
  with the underlying posts
- Сущности: department treemap, monthly person-rank (bump) chart, persona ↔
  event collocation graph
- Тренды: анонс → пост-релиз funnel, monthly volume split
- Контент: bigram comparison (students vs employees lexicon), top directions
- ИТ-специалитет: a dedicated view tracking how the specialty's admissions
  campaign performs in the info field — share of voice, engagement vs the
  overall stream, sentiment, and the same funnel

## Data note

The backend's `post_date` column only stores a date, not a timestamp, so an
hour-of-day heatmap isn't derivable from real data — the "Активность по дням"
view uses a day-level calendar heatmap instead of a fabricated 24×7 grid.
"Reach" is the sum of measured `views`, not subscriber counts (the API doesn't
expose channel audience size).

## Security

- `Content-Security-Policy` and `Referrer-Policy` set via `<meta>` in
  `index.html` (`script-src 'self'`, no `unsafe-eval`)
- Post text from Telegram/VK is untrusted input: it is only ever rendered as
  a React text child, never through `dangerouslySetInnerHTML`
- `fetch()` calls use `credentials: "omit"` — the API is same-origin (via the
  dev proxy) and never receives cookies
- If you deploy the built frontend behind a static host / reverse proxy, also
  set the response headers a `<meta>` tag cannot express:
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, and a
  CORS allowlist on the backend limited to the frontend's real origin
