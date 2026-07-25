# InfoField Frontend MVP

Frontend for the InfoField analytics dashboard. It works with the existing backend as-is and reads data only from these two FastAPI endpoints:

- `GET /telegram`
- `GET /vk`

The frontend does not require backend code changes. During local development it uses the Vite dev proxy, so requests from the browser go through the frontend dev server and are forwarded to `http://localhost:8000`.

## Stack

- React
- Vite
- TypeScript
- Recharts
- Fetch API

## Install

```bash
npm install
```

If PowerShell blocks `npm`, use:

```bash
npm.cmd install
```

## Environment

By default no custom frontend `.env` is required.

The project already works with:

- frontend on `http://127.0.0.1:4174`
- backend on `http://localhost:8000`

If you want to override the API base URL, create `.env` from `.env.example` and set:

```env
VITE_API_BASE_URL=http://localhost:8000
```

When `VITE_API_BASE_URL` is empty, the frontend uses relative paths `/telegram` and `/vk`, which are proxied by Vite in dev mode.

## Run backend

Backend is located рядом in `../backend`.

Minimal start:

```bash
python main.py
```

or

```bash
uvicorn main:app --reload
```

Backend port is not explicitly set in source, so the default is `8000`.

## Run frontend

```bash
npm run dev
```

or

```bash
npm.cmd run dev
```

Open:

- `http://127.0.0.1:4174`

## Typecheck and build

```bash
npm run typecheck
npm run build
```

## What is implemented

- dashboard header
- theme toggle
- metric cards
- client-side filters
- charts by dates, audiences, sentiment, directions, units, events, engagement
- posts table
- loading state
- error state
- empty state
- safe handling of missing fields

## Important backend limitation

The original backend stores `text` in the database but does not return `text` from `/telegram` and `/vk`.

Because of that, the frontend:

- safely shows a fallback message instead of post text when `text` is missing
- keeps analytics and filters working from the available fields
- automatically starts showing real post text if the backend later begins returning it
