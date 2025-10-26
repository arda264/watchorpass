# --- STEP 1: Imports ---
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import ast
from collections import Counter, defaultdict

# --- STEP 2: Load data ---
films = pd.read_csv('final_films.csv')
actors = pd.read_csv('top_1000.csv')

# --- STEP 3: Build actor lookup (robust to header naming) ---
actors.columns = actors.columns.str.strip().str.lower()
id_col = [c for c in actors.columns if 'const' in c or 'id' in c][0]
name_col = [c for c in actors.columns if 'name' in c][0]
actor_map = dict(zip(actors[id_col], actors[name_col]))

# --- STEP 4: Clean and prepare film data ---
def parse_cast(cast_str):
    try:
        ids = ast.literal_eval(cast_str)
        return [actor_map.get(i, "") for i in ids if i in actor_map]
    except Exception:
        return []

films['Actor_Names'] = films['Cast'].apply(parse_cast)

# --- STEP 5: Check for Director column ---
films.columns = films.columns.str.strip()
dir_col = None
for c in films.columns:
    if c.lower() in ['director', 'directors']:
        dir_col = c
        break

if dir_col is None:
    films['Director'] = ""
else:
    films.rename(columns={dir_col: 'Director'}, inplace=True)

# --- STEP 6: Combine metadata into one text field ---
def create_movie_text(row):
    genres = row['Genres'] if isinstance(row['Genres'], str) else ""
    actors = ", ".join(row['Actor_Names'])
    director = row['Director'] if isinstance(row['Director'], str) else ""
    return f"Genres: {genres}. Director: {director}. Actors: {actors}."

films['description'] = films.apply(create_movie_text, axis=1)

# --- STEP 7: Generate embeddings ---
model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = model.encode(films['description'].tolist(), show_progress_bar=True)
embeddings = np.array(embeddings)

# --- STEP 8: Build helper maps for actor-genre/director relationships ---
actor_to_directors = defaultdict(set)
actor_to_genres = defaultdict(list)

for _, row in films.iterrows():
    for actor in row['Actor_Names']:
        if isinstance(row['Director'], str):
            actor_to_directors[actor].add(row['Director'])
        if isinstance(row['Genres'], str):
            for g in [x.strip() for x in row['Genres'].split(",") if x.strip()]:
                actor_to_genres[actor].append(g)

# --- STEP 9: Weighted recommendation function ---
def recommend_movies(liked_actors, disliked_actors, weights, top_k=10):
    """
    liked_actors, disliked_actors: list of actor names
    weights: dict of weights for each category
    """
    # --- Encode base actor preferences ---
    like_actor_text = ", ".join(liked_actors) if liked_actors else ""
    dislike_actor_text = ", ".join(disliked_actors) if disliked_actors else ""

    like_actors_vec = model.encode([f"Movies featuring actors like {like_actor_text}."]) \
        if like_actor_text else np.zeros((1, embeddings.shape[1]))
    dislike_actors_vec = model.encode([f"Movies featuring actors like {dislike_actor_text}."]) \
        if dislike_actor_text else np.zeros((1, embeddings.shape[1]))

    # --- Gather bonus directors ---
    bonus_directors = set()
    for actor in liked_actors:
        bonus_directors.update(actor_to_directors.get(actor, []))

    # --- Gather weighted genre preferences ---
    genre_counter = Counter()
    for actor in liked_actors:
        genre_counter.update(actor_to_genres.get(actor, []))
    total_genres = sum(genre_counter.values()) or 1
    genre_distribution = {g: count / total_genres for g, count in genre_counter.items()}

    # --- Encode bonus directors & genres ---
    directors_text = ", ".join(bonus_directors)
    genres_text = ", ".join(genre_distribution.keys())

    directors_vec = model.encode([f"Movies directed by {directors_text}."]) \
        if directors_text else np.zeros((1, embeddings.shape[1]))
    genres_vec = model.encode([f"Movies in genres like {genres_text}."]) \
        if genres_text else np.zeros((1, embeddings.shape[1]))

    # --- Combine preference vector ---
    preference_vec = (
        weights["liked_actors"] * like_actors_vec
        - weights["disliked_actors"] * dislike_actors_vec
        + weights["directors"] * directors_vec
        + weights["genres"] * genres_vec
    )

    # --- Compute base similarity ---
    sim_scores = cosine_similarity(preference_vec, embeddings)[0]

    # --- Apply fine-grained genre bonuses ---
    bonus_scores = np.zeros_like(sim_scores)
    for i, row in films.iterrows():
        if isinstance(row['Genres'], str):
            for g in [x.strip() for x in row['Genres'].split(",") if x.strip()]:
                bonus_scores[i] += genre_distribution.get(g, 0)
        if row['Director'] in bonus_directors:
            bonus_scores[i] += 0.1  # small director bonus

    # Combine base similarity and bonus adjustments
    final_scores = sim_scores + weights["bonus_genre_director"] * bonus_scores

    similar_indices = np.argsort(final_scores)[::-1][:top_k]
    similar_scores = final_scores[similar_indices]

    recommendations = films.iloc[similar_indices][['Title', 'Genres', 'Director']].copy()
    recommendations['score'] = similar_scores
    return recommendations

# --- STEP 10: Console input ---
print("🎭 Enter up to 5 ACTORS you LIKE (comma-separated):")
liked_actors = [a.strip() for a in input("Actors you like: ").split(",") if a.strip()]

print("\n🚫 Enter up to 5 ACTORS you DISLIKE (comma-separated):")
disliked_actors = [a.strip() for a in input("Actors you dislike: ").split(",") if a.strip()]

# --- STEP 11: Weights configuration ---
weights = {
    "liked_actors": 1.2,
    "disliked_actors": 1.0,
    "genres": 0.8,
    "directors": 0.6,
    "bonus_genre_director": 0.5  # how much the extra bonuses affect score
}

# --- STEP 12: Get recommendations ---
if not (liked_actors or disliked_actors):
    print("⚠️ Please enter at least one preference to generate recommendations.")
else:
    recs = recommend_movies(liked_actors, disliked_actors, weights, top_k=15)
    print("\n🎬 Recommended Movies Based on Weighted Preferences and Bonuses:\n")
    print(recs.to_string(index=False))
