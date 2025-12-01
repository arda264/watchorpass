# server.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from embeddings5 import get_actor, recommend_movies, bias_correction

#fastapi setup
app = FastAPI()

#Allow requests from React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins; you can restrict this to your frontend URL later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#requests
class RecommendRequest(BaseModel):
    liked_actors: List[str]
    disliked_actors: List[str]

class Recommendation(BaseModel):
    title: str
    Genres: str
    Score: float


#routes
@app.get("/actor")
def get_random_actor():
    """Return a random actor name."""
    name = get_actor()
    return {"name": name}

@app.post("/recommend")
@app.post("/recommend")
def get_recommendations(payload: RecommendRequest):
    corrected_disliked = bias_correction(payload.disliked_actors, drop_fraction=0.2)

    weights = {
        "liked_actors": 1.2,
        "disliked_actors": 1.0,
        "genres": 0.8,
        "directors": 0.6,
        "bonus_genre_director": 0.5
    }

    recs_df = recommend_movies(payload.liked_actors, corrected_disliked, weights, top_k=15)


    # If Score column doesn't exist, fill it with 0
    if 'Score' not in recs_df.columns:
        recs_df['Score'] = 0.0
    # ------------------

    recommendations = recs_df.to_dict(orient="records")
    return {"recommendations": recommendations}


