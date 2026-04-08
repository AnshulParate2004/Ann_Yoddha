# Ann Yoddha Local Deployment + Phone Test Guide

Last verified: 2026-04-08

This guide runs all three apps locally on LAN so you can test from a real phone.

## 1. Prerequisites

- Windows machine on same Wi-Fi as your phone
- Node.js 20+ and npm
- Python environment ready in `ann_yoddha_backend/.venv`
- Expo Go installed on phone

## 2. Find your LAN IPv4

Run:

```powershell
ipconfig
```

Use the IPv4 address from your active Wi-Fi adapter.  
Current detected Wi-Fi IP: `172.16.204.191`

## 3. Backend local deployment

Terminal A:

```powershell
cd C:\Users\aryan\Desktop\Subjects\Coding\Ann_Yoddha\ann_yoddha_backend
Copy-Item .env.example .env -Force
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Health check from laptop:

```powershell
curl http://127.0.0.1:8000/health
```

Expected response: `{"status":"ok"}`

## 4. Web local deployment

Terminal B:

```powershell
cd C:\Users\aryan\Desktop\Subjects\Coding\Ann_Yoddha\ann-yoddha-harvest-help
Copy-Item .env.example .env -Force
```

Edit `.env` and set:

```dotenv
VITE_API_BASE=http://172.16.204.191:8000
```

Then run:

```powershell
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open on laptop: `http://127.0.0.1:5173`  
Open on phone browser: `http://172.16.204.191:5173`

## 5. Mobile local deployment (Expo)

Terminal C:

```powershell
cd C:\Users\aryan\Desktop\Subjects\Coding\Ann_Yoddha\ann-yoddha-mobile
Copy-Item .env.example .env -Force
```

Edit `.env` and set:

```dotenv
EXPO_PUBLIC_BACKEND_URL=http://172.16.204.191:8000
```

Start Expo LAN server:

```powershell
npm install
npx expo start --lan -c
```

Scan QR in Expo Go from phone.

## 6. Phone validation checklist (Step 4 real flow)

Run these on phone:

1. Login with seeded account:
   - email: `farmer_01@annyoddha.com`
   - password: `FarmerPassword123!`
2. Open **Scan** tab and capture one image.
3. Confirm diagnosis card appears inside scanner screen.
4. Confirm status says either:
   - `Saved to cloud`, or
   - `Saved offline, sync pending`
5. Go to **Home** tab and verify:
   - latest diagnosis updates
   - pending sync count updates
6. Disable internet on phone, scan again, verify offline save.
7. Re-enable internet and tap **Sync Offline Scans**.
8. Open **History** and verify new records + sync status badges.

## 7. Backend/API quick checks

From laptop:

```powershell
curl http://127.0.0.1:8000/health
```

Optional auth check (PowerShell):

```powershell
$body = "username=farmer_01%40annyoddha.com&password=FarmerPassword123!"
Invoke-RestMethod -Uri "http://127.0.0.1:8000/auth/login" -Method Post -ContentType "application/x-www-form-urlencoded" -Body $body
```

## 8. Common phone issues

- Phone cannot connect to backend:
  - ensure backend runs on `--host 0.0.0.0`
  - confirm `EXPO_PUBLIC_BACKEND_URL` uses LAN IP, not `localhost`
- Web/mobile can open but API fails:
  - verify IP in `.env` files matches current Wi-Fi network
  - restart app after env changes
- QR scan works but app hangs:
  - run `npx expo start --lan -c`
  - ensure laptop firewall allows Node/Expo + Python inbound on private network

## 9. What is already verified in this workspace

- Backend request-level checks passed for:
  - `/health`
  - `/auth/login`
  - `/auth/me`
  - `/predict`
  - `/sync`
  - `/history`
- Web production build passed
- Mobile TypeScript check passed

Device-camera runtime validation still requires your physical phone run (section 6).
