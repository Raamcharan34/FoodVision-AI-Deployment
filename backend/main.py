import io, json, os
from pathlib import Path
from typing import List
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, decode_predictions, preprocess_input

BASE = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv('MODEL_PATH', str(BASE / 'food_efficientnetb0_finetuned_best.keras')))
LABELS_PATH = Path(os.getenv('LABELS_PATH', str(BASE / 'class_names.json')))
IMAGE_SIZE = (224, 224)
FOOD_LABEL_KEYWORDS = {
    'banana','lemon','orange','fig','pineapple','strawberry','custard','ice_cream','ice cream','ice_lolly','pretzel',
    'cheeseburger','hotdog','hot_dog','mashed_potato','cabbage','broccoli','cauliflower','zucchini','spaghetti',
    'carbonara','meat_loaf','pizza','potpie','burrito','espresso','coffee','chocolate_sauce','bagel','guacamole',
    'pomegranate','artichoke','bell_pepper','mushroom','granny_smith','corn','acorn_squash','butternut_squash',
    'cucumber','trifle','consomme','hot_pot','soup'
}
app = FastAPI(title='FoodVision AI API', version='1.0.0')
origins = [x.strip() for x in os.getenv('CORS_ORIGINS', '*').split(',') if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=['*'], allow_headers=['*'])
model = None
class_names = None
screening_model = None

@app.on_event('startup')
def load_models():
    global model, class_names, screening_model
    if not MODEL_PATH.exists(): raise RuntimeError(f'Model file not found: {MODEL_PATH}')
    if not LABELS_PATH.exists(): raise RuntimeError(f'Labels file not found: {LABELS_PATH}')
    class_names = json.loads(LABELS_PATH.read_text(encoding='utf-8'))
    if not isinstance(class_names, list) or len(class_names) != 11: raise RuntimeError('class_names.json must contain exactly 11 labels')
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    if model.output_shape[-1] != len(class_names): raise RuntimeError('Model output count does not match class labels')
    screening_model = MobileNetV2(weights='imagenet', include_top=True)

def screen_food_image(image: Image.Image) -> bool:
    image = ImageOps.exif_transpose(image).convert('RGB').resize(IMAGE_SIZE, Image.Resampling.LANCZOS)
    arr = preprocess_input(np.expand_dims(np.asarray(image, dtype=np.float32), axis=0))
    decoded = decode_predictions(screening_model.predict(arr, verbose=0), top=10)[0]
    hits = []
    for _, label, score in decoded:
        normalized = label.lower().replace('-', '_').replace(' ', '_')
        if any(keyword in normalized for keyword in FOOD_LABEL_KEYWORDS): hits.append(float(score))
    return bool(hits and max(hits) >= 0.01)

def predict_food(image: Image.Image):
    image = ImageOps.exif_transpose(image).convert('RGB').resize(IMAGE_SIZE, Image.Resampling.LANCZOS)
    # Keep 0–255 pixels: EfficientNetB0 in this trained model applies its own rescaling.
    arr = np.expand_dims(np.asarray(image, dtype=np.float32), axis=0)
    probs = model.predict(arr, verbose=0)[0]
    indices = np.argsort(probs)[::-1][:3]
    return [{'label': class_names[int(i)], 'probability': float(probs[i])} for i in indices]

@app.get('/')
def root(): return {'service': 'FoodVision AI API', 'status': 'running'}
@app.get('/health')
def health(): return {'status': 'ok', 'model_loaded': model is not None, 'screening_model_loaded': screening_model is not None}
@app.post('/predict')
async def predict(files: List[UploadFile] = File(...)):
    if len(files) > 12: raise HTTPException(400, 'Please upload no more than 12 images at once.')
    results = []
    for upload in files:
        name = upload.filename or 'uploaded-image'
        content = await upload.read()
        if len(content) > 12 * 1024 * 1024: raise HTTPException(413, f'{name} exceeds the 12 MB per-image limit.')
        try:
            image = Image.open(io.BytesIO(content)); image.load()
        except (UnidentifiedImageError, OSError, ValueError):
            results.append({'filename': name, 'is_food_candidate': False, 'predictions': [], 'error': 'Invalid image file'})
            continue
        try:
            is_food = screen_food_image(image)
            predictions = predict_food(image) if is_food else []
            results.append({'filename': name, 'is_food_candidate': is_food, 'predictions': predictions})
        except Exception as exc:
            raise HTTPException(500, f'Prediction failed for {name}: {str(exc)}')
    return {'results': results}
