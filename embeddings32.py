import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import ast
from collections import Counter, defaultdict
import random

films = pd.read_csv('final_films.csv')
actors = pd.read_csv('top_1000.csv')


# Retrieve actors' information and create a dictionary with it
"""actors.columns = actors.columns.str.strip().str.lower()
id_col = [c for c in actors.columns if 'const' in c][0]
name_col = [c for c in actors.columns if 'name' in c][0]
actors_dict = dict(zip(actors[id_col], actors[name_col]))"""

actors_dict = {}
for c in actors.itertuples(index=False):
    actors_dict[c[1]] = c[5]

print(actors_dict)

def parse_cast(cast_str):
    """Converts actor ID's from strings into Python lists"""
    try:
        ids = ast.literal_eval(cast_str)
        return [actors_dict.get(i, "") for i in ids if i in actors_dict]
    except Exception:
        return []

# Creates Actor_Names column in film table with readable actor names for the cast
films['Actor_Names'] = films['Cast'].apply(parse_cast)

# Normalize Column names
films.columns = films.columns.str.strip()


def create_movie_text(row):
    """Creates description for every movie, with all important information."""
    genres = row['Genres'] if isinstance(row['Genres'], str) else ""
    actors = ", ".join(row['Actor_Names'])
    director = row['Director'] if isinstance(row['Director'], str) else ""
    return f"Genres: {genres}. Director: {director}. Actors: {actors}."

films['description'] = films.apply(create_movie_text, axis=1)

# Generate all vectors from movies' descriptions and store them in embeddings
model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = model.encode(films['description'].tolist(), show_progress_bar=True)
embeddings = np.array(embeddings)

# Map actors to directors and genres
actor_to_directors = defaultdict(set)
actor_to_genres = defaultdict(list)

# Loop through all films linking actors to directors and genres
for _, row in films.iterrows():
    for actor in row['Actor_Names']:
        if isinstance(row['Director'], str):
            actor_to_directors[actor].add(row['Director'])
        if isinstance(row['Genres'], str):
            for g in [x.strip() for x in row['Genres'].split(",") if x.strip()]:
                actor_to_genres[actor].append(g)


def recommend_movies(liked_actors, disliked_actors, weights, top_k=10):
    """
    liked_actors, disliked_actors: list of actor names the user likes or dislikes
    weights: dictionary of weights for each category
    top_k: number of top recommendations to return
    """
    # Convert lists of liked and disliked actors into strings
    like_actor_text = ", ".join(liked_actors) if liked_actors else ""
    dislike_actor_text = ", ".join(disliked_actors) if disliked_actors else ""

    # Turn liked and disliked into vectors
    like_actors_vec = model.encode([f"Movies featuring actors like {like_actor_text}."]) \
        if like_actor_text else np.zeros((1, embeddings.shape[1]))
    dislike_actors_vec = model.encode([f"Movies featuring actors like {dislike_actor_text}."]) \
        if dislike_actor_text else np.zeros((1, embeddings.shape[1]))

    # Get directors that have worked with the actor
    bonus_directors = set()
    for actor in liked_actors:
        bonus_directors.update(actor_to_directors.get(actor, []))

    # Get genres related to actors and make a distribution
    genre_counter = Counter()
    for actor in liked_actors:
        genre_counter.update(actor_to_genres.get(actor, []))
    total_genres = sum(genre_counter.values()) or 1
    genre_distribution = {g: count / total_genres for g, count in genre_counter.items()}

    directors_text = ", ".join(bonus_directors)
    genres_text = ", ".join(genre_distribution.keys())

    directors_vec = model.encode([f"Movies directed by {directors_text}."]) \
        if directors_text else np.zeros((1, embeddings.shape[1]))
    genres_vec = model.encode([f"Movies in genres like {genres_text}."]) \
        if genres_text else np.zeros((1, embeddings.shape[1]))

    # Combine preference vectors into one single vector
    preference_vec = (
        weights["liked_actors"] * like_actors_vec
        - weights["disliked_actors"] * dislike_actors_vec
        + weights["directors"] * directors_vec
        + weights["genres"] * genres_vec
    )

    # Compute cosine similarity between user preferences and all movies
    sim_scores = cosine_similarity(preference_vec, embeddings)[0]

    # Add small score bonuses for directors and genres
    bonus_scores = np.zeros_like(sim_scores)
    for i, row in films.iterrows():
        if isinstance(row['Genres'], str):
            for g in [x.strip() for x in row['Genres'].split(",") if x.strip()]:
                bonus_scores[i] += genre_distribution.get(g, 0)
        if row['Director'] in bonus_directors:
            bonus_scores[i] += 0.1  # small director bonus

    # Compute final scores and gets top k movies based on highest scores
    final_scores = sim_scores + weights["bonus_genre_director"] * bonus_scores
    similar_indices = np.argsort(final_scores)[::-1][:top_k]
    similar_scores = final_scores[similar_indices]

    # Prepare a dataframe with recommendations and return it
    recommendations = films.iloc[similar_indices][['Title', 'Genres']].copy()
    recommendations['score'] = similar_scores
    return recommendations


# Testing
num_actors_to_show = 30
all_actors = list(actors_dict.values())
random.shuffle(all_actors)

liked_actors = []
disliked_actors = []

print("Respond to the following actors with:")
print(" y = like, n = dislike, i = don't know / skip\n")

for actor in all_actors[:num_actors_to_show]:
    while True:
        response = input(f"{actor}? (y/n/i): ").strip().lower()
        if response in ['y', 'n', 'i']:
            break
        else:
            print("Please respond with 'y', 'n', or 'i'.")

    if response == 'y':
        liked_actors.append(actor)
    elif response == 'n':
        disliked_actors.append(actor)
    # 'i' means we do nothing

print("\nYou've finished rating actors.")
print(f"Liked actors ({len(liked_actors)}): {', '.join(liked_actors)}")
print(f"Disliked actors ({len(disliked_actors)}): {', '.join(disliked_actors)}")

# Weights values
weights = {
    "liked_actors": 1.2,
    "disliked_actors": 1.0,
    "genres": 0.8,
    "directors": 0.6,
    "bonus_genre_director": 0.5
}

# Generate recommendations
if not (liked_actors or disliked_actors):
    print("You didn't like or dislike any actors. No recommendations possible.")
else:
    recs = recommend_movies(liked_actors, disliked_actors, weights, top_k=15)
    print("\nRecommended Movies Based on Your Actor Feedback:\n")
    print(recs.to_string(index=False))
