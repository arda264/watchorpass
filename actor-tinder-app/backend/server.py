# server.py - UPDATED CORS CONFIGURATION
import os
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn
import gc
import random

# Import your custom logic
from embeddings3 import get_actor, recommend_movies, bias_correction, all_actors

app = FastAPI(title="WatchOrPass API")

# FIXED CORS CONFIGURATION
# Allow requests from your Vercel domain and localhost for testing
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # During debugging, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... rest of your code stays the same
# 2. DATA MODELS
class RecommendRequest(BaseModel):
    liked_actors: List[str]
    disliked_actors: List[str]

# 3. ROUTES
@app.get("/")
def health_check():
    """Simple endpoint to check if the server is awake."""
    return {"status": "online", "message": "WatchOrPass Backend is Active"}

@app.get("/actor-batch")
def get_actor_batch():
    """Returns 30 random actors in a single call"""
    import random
    from embeddings3 import all_actors
    # Take a random sample of 30
    batch = random.sample(all_actors, 30)
    return {"actors": batch}


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