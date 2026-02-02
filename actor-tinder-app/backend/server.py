import os
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn

# Import your custom logic
# Ensure these files are in the same folder as server.py
from embeddings3 import get_actor, recommend_movies, bias_correction

app = FastAPI(title="WatchOrPass API")

# 1. CORS SETUP
# Replace with your actual frontend URL for better security
origins = [
    "https://watchorpass.app",
    "https://www.watchorpass.app",
    "http://localhost:8081",  # Local Expo testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. DATA MODELS
class RecommendRequest(BaseModel):
    liked_actors: List[str]
    disliked_actors: List[str]

# 3. ROUTES
@app.get("/")
def health_check():
    """Simple endpoint to check if the server is awake."""
    return {"status": "online", "message": "WatchOrPass Backend is Active"}

@app.get("/actor")
def get_random_actor():
    """Return a random actor name."""
    try:
        name = get_actor()
        return {"name": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recommend")
def get_recommendations(payload: RecommendRequest):
    try:
        # 1. Apply bias correction logic
        corrected_disliked = bias_correction(payload.disliked_actors, drop_fraction=0.2)

        # 2. Set recommendation weights
        weights = {
            "liked_actors": 1.8,
            "disliked_actors": 0.6,
            "genres": 0.6,
            "directors": 0.7,
            "bonus_genre_director": 0.1
        }

        # 3. Generate recommendations (returns a DataFrame)
        recs_df = recommend_movies(payload.liked_actors, corrected_disliked, weights, top_k=15)

        # 4. Convert DataFrame to List of Dictionaries for JSON response
        recommendations = recs_df.to_dict(orient="records")
        return {"recommendations": recommendations}
    
    except Exception as e:
        print(f"Error in recommendation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations.")

# 4. RENDER STARTUP
if __name__ == "__main__":
    # Render provides the PORT as an environment variable
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)