# Ann Yoddha Web App

Web dashboard for diagnosis upload, history, and analytics.

## Stack

- Vite
- React
- TypeScript
- shadcn/ui

## Environment

Copy `.env.example` to `.env` and set:

```dotenv
VITE_API_BASE=http://172.16.204.191:8000
```

Optional legacy Supabase keys can remain in `.env`, but the current auth flow uses backend JWT endpoints.

## Run

```sh
npm install
npm run dev
```

For LAN access (phone/browser on same Wi-Fi):

```sh
npm run dev -- --host 0.0.0.0 --port 5173
```
