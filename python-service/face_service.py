from fastapi import FastAPI, UploadFile, File, HTTPException
import numpy as np
import cv2
from insightface.app import FaceAnalysis

app = FastAPI()

# Load model once (IMPORTANT)
model = FaceAnalysis(
    name="buffalo_s",
    providers=["CPUExecutionProvider"]
)
model.prepare(ctx_id=0, det_size=(640, 640))


@app.post("/embed")
async def embed_face(file: UploadFile = File(...)):
    try:
        data = await file.read()

        if not data:
            raise HTTPException(status_code=400, detail="Empty image file")

        img = cv2.imdecode(
            np.frombuffer(data, np.uint8),
            cv2.IMREAD_COLOR
        )

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        faces = model.get(img)

        if len(faces) == 0:
            raise HTTPException(status_code=400, detail="No face detected")

        embedding = faces[0].embedding

        return {
            "embedding": embedding.tolist()
        }

    except HTTPException:
        raise

    except Exception as e:
        print("❌ Python embed error:", e)
        raise HTTPException(status_code=500, detail="Embedding failed")
