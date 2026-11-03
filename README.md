# FoodVision AI — Vercel frontend + Python inference API

This deployment adaptation keeps the original FoodVision AI visual direction and reuses the trained EfficientNetB0 model and the same MobileNetV2 ImageNet food-screening heuristic.

## Architecture
- `frontend/`: Next.js 15 frontend. Deploy this folder to Vercel.
- `backend/`: FastAPI + TensorFlow inference API. Deploy this as a Docker service on a Python/container host with enough RAM and disk for TensorFlow and the model.

**Important:** Vercel hosts the Next.js frontend, not the TensorFlow inference process. TensorFlow and the `.keras` model are deliberately kept in the separate backend service because they are too heavy/unreliable for typical Vercel serverless-function limits. This means you will have a Vercel URL and a separate API service URL.

## Before deployment
1. Copy your exact `food_efficientnetb0_finetuned_best.keras` into `backend/`.
2. Copy your exact `class_names.json` into `backend/`.
3. Confirm the model was saved with the same TensorFlow/Keras compatibility as the backend. The pinned TensorFlow version may need adjustment if the model was trained/saved with another version.
4. Keep the original Streamlit project unchanged as your backup.

## Run backend locally
From `backend/`:
```bash
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API health check: `http://localhost:8000/health`

## Run frontend locally
From `frontend/`:
```bash
npm install
```
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```
Then:
```bash
npm run dev
```
Open `http://localhost:3000`.

## Deploy backend
Use a Docker-capable host (for example Render, Railway, or a VM) and set the root directory to `backend`. The included Dockerfile expects the model and labels to be present in that directory. Set:
- `CORS_ORIGINS=https://YOUR-VERCEL-DOMAIN.vercel.app`
- `MODEL_PATH=/app/food_efficientnetb0_finetuned_best.keras`
- `LABELS_PATH=/app/class_names.json`

Choose an instance with sufficient memory for TensorFlow + both models. The first startup downloads ImageNet MobileNetV2 weights. Verify `/health` returns all model flags as true.

## Deploy frontend to Vercel
1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Next.js.
4. Add environment variable `NEXT_PUBLIC_API_URL` with the deployed backend URL (for example `https://YOUR-API.onrender.com`).
5. Deploy.

After Vercel gives you its production domain, update backend `CORS_ORIGINS` to that exact domain and redeploy/restart the backend.

## Behaviour retained
- Multiple JPG/JPEG/PNG uploads (up to 12 in this interface)
- Per-image preview and remove action
- Analyze and Start Over controls
- 11 Food-11 categories
- EfficientNetB0 preprocessing at 224 × 224 with float32 values in 0–255 (no external divide-by-255)
- MobileNetV2 ImageNet first-pass screening using the same keyword heuristic
- Confidence thresholds: below 50% hide category; 50–69% tentative warning; 70%+ stronger prediction
- Top 3 predictions, responsive result cards, and summary stats

## Limitations
The MobileNetV2 food-screening stage is a heuristic, not a dedicated binary food/non-food classifier. It can reject valid food images or pass non-food images. The frontend has not yet been tested against your actual remote backend/model. Do not replace the working Streamlit app until the new version passes local and hosted tests.
