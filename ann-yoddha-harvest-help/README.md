# Ann Yoddha (Harvest Help)

Wheat disease detection for farmers. Sign up, upload crop/leaf images for diagnosis, get treatment recommendations, and view your history. Includes an analytics dashboard for regional hotspots.

## Stack

- **Vite** · **React** · **TypeScript**
- **Supabase** (Auth, Storage)
- **shadcn/ui** · **Tailwind CSS**

## Run

```sh
npm i
cp .env.example .env   # add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Backend: [ann_yoddha_backend](../ann_yoddha_backend) (FastAPI). Set `VITE_API_BASE` in `.env` if the API is not at `http://localhost:8000`.
