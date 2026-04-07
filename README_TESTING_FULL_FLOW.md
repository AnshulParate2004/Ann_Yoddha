# Ann Yoddha Testing Flow

This guide is only for verifying the real backend model inference and the mobile prediction flow.

## Goal

Confirm all of the following:

- the FastAPI backend starts
- the real Keras model at `ann_yoddha_backend/models/wheat_model.keras` loads
- login works
- `POST /predict` returns a diagnosis
- the mobile app can call the backend and show/save the prediction

## 1. Start the backend

Open a PowerShell window:

```powershell
cd C:\Users\aryan\Desktop\Subjects\Coding\Ann_Yoddha\ann_yoddha_backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Expected:

- server starts on `http://127.0.0.1:8000`
- no import crash
- no TensorFlow model load crash on first prediction

## 2. Check backend health

Open a second PowerShell window:

```powershell
curl.exe http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## 3. Login and get a JWT

Use the seeded farmer user:

```powershell
curl.exe -X POST http://127.0.0.1:8000/auth/login ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -d "username=farmer_01@annyoddha.com&password=FarmerPassword123!"
```

Expected:

- response contains `access_token`
- save that token for the next command

## 4. Test the real model directly with `/predict`

Use any wheat crop image from your machine:

```powershell
curl.exe -X POST http://127.0.0.1:8000/predict ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -F "image=@C:\full\path\to\test-image.jpg"
```

Expected JSON shape:

```json
{
  "disease_name": "yellow rust",
  "confidence": 0.87,
  "treatment": "...",
  "timestamp": "2026-04-07T12:34:56.000000",
  "status": "saved_to_cloud"
}
```

Important checks:

- `disease_name` is one of the 15 configured classes or `uncertain`
- `confidence` is numeric
- `treatment` is present
- the request does not return the old stubbed diagnosis payload

If confidence is below `0.5`, expected behavior is:

- `disease_name` becomes `uncertain`

## 5. Confirm history is being saved

```powershell
curl.exe http://127.0.0.1:8000/history ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected:

- the new prediction appears in `history`

## 6. Point the mobile app to the backend

The mobile app currently uses:

`ann-yoddha-mobile/src/utils/constants.ts`

Current value:

```ts
export const BACKEND_URL = "http://172.16.198.112:8000";
```

Before testing on mobile, make sure this IP is reachable from your phone/emulator.

Rules:

- Android emulator usually works with `http://10.0.2.2:8000`
- iOS simulator usually works with `http://127.0.0.1:8000`
- physical device must use your laptop LAN IP like `http://192.168.x.x:8000`

If needed, update `ann-yoddha-mobile/src/utils/constants.ts` before starting Expo.

## 7. Start the mobile app

Open another PowerShell window:

```powershell
cd C:\Users\aryan\Desktop\Subjects\Coding\Ann_Yoddha\ann-yoddha-mobile
npm install
npx expo start
```

Optional typecheck:

```powershell
cd C:\Users\aryan\Desktop\Subjects\Coding\Ann_Yoddha\ann-yoddha-mobile
npx tsc --noEmit
```

## 8. Mobile manual test flow

On the mobile app:

1. Login with:
   - email: `farmer_01@annyoddha.com`
   - password: `FarmerPassword123!`
2. Open the scanner
3. Capture a crop image
4. Wait for `Analyzing crop image...`
5. Confirm the result alert shows:
   - disease name
   - confidence
   - treatment
   - saved/cloud behavior

Expected success behavior:

- authenticated request reaches backend `/predict`
- backend uses the real Keras model
- scan is saved locally
- successful online prediction is stored with sync complete

Expected offline/failure behavior:

- scan is still saved locally
- sync state remains pending

## 9. Optional sync test from mobile/backend

You can also test backend sync manually:

```powershell
curl.exe -X POST http://127.0.0.1:8000/sync ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -d "{\"scans\":[{\"local_id\":1,\"disease_name\":\"uncertain\",\"confidence\":0.41,\"treatment\":\"Retake the image in better lighting.\",\"image_url\":\"file:///scan1.jpg\",\"timestamp\":\"2026-04-07T10:00:00Z\"}]}"
```

## 10. Troubleshooting

If backend fails on startup:

- install missing Python packages
- confirm TensorFlow installs successfully in your Python environment

If `/predict` fails:

- verify the token is valid
- verify the uploaded field name is `image`
- verify the file is a real image
- verify `ann_yoddha_backend/models/wheat_model.keras` exists

If mobile cannot reach backend:

- confirm `BACKEND_URL` matches the correct host for emulator or device
- confirm backend is running on `0.0.0.0:8000`
- confirm firewall/hotspot/LAN allows access

## Command List Only

```powershell
cd C:\Users\aryan\Desktop\Subjects\Coding\Ann_Yoddha\ann_yoddha_backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

```powershell
curl.exe http://127.0.0.1:8000/health
```

```powershell
curl.exe -X POST http://127.0.0.1:8000/auth/login ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -d "username=farmer_01@annyoddha.com&password=FarmerPassword123!"
```

```powershell
curl.exe -X POST http://127.0.0.1:8000/predict ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -F "image=@C:\full\path\to\test-image.jpg"
```

```powershell
curl.exe http://127.0.0.1:8000/history ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

```powershell
cd C:\Users\aryan\Desktop\Subjects\Coding\Ann_Yoddha\ann-yoddha-mobile
npm install
npx tsc --noEmit
npx expo start
```
