import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import ast

# read actor and films databases
films = pd.read_csv('final_films.csv')
actors = pd.read_csv('top_1000.csv')

# retrieve actors' info and store it into actor_map dict
actors_dict = {}
for c in actors.itertuples(index=False):
    actors_dict[c[1]] = c[5]

def parse_cast(cast_str):
    """ """
    try:
        ids = ast.literal_eval(cast_str)
        return [actor_map.get(i, "") for i in ids if i in actor_map]
    except Exception:
        return []

# creates Actor_Names column in film table with
films['Actor_Names'] = films['Cast'].apply(parse_cast)


# Combine metadata into one text field
def create_movie_text(row):
    genres = row['Genres'] if isinstance(row['Genres'], str) else ""
    actors = ", ".join(row['Actor_Names'])
    return f"Genres: {genres}. Actors: {actors}."


films['description'] = films.apply(create_movie_text, axis=1)

# --- STEP 5: Generate embeddings ---
model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = model.encode(films['description'].tolist(), show_progress_bar=True)
embeddings = np.array(embeddings)


# --- STEP 6: Define recommendation function (actor-based) ---
def recommend_by_actors(actor_names, top_k=5):
    """
    actor_names: list of actor names input by the user
    top_k: number of movies to return
    """
    # Create a text query from actor names
    actor_text = ", ".join(actor_names)
    query = f"Movies featuring actors like {actor_text}."

    # Encode the query
    query_vec = model.encode([query])

    # Compute cosine similarity between query and all movie embeddings
    sim_scores = cosine_similarity(query_vec, embeddings)[0]

    # Get top K similar movies
    similar_indices = np.argsort(sim_scores)[::-1][:top_k]
    similar_scores = sim_scores[similar_indices]

    recommendations = films.iloc[similar_indices][['Title', 'Genres']].copy()
    recommendations['similarity_score'] = similar_scores
    return recommendations


# code testing
print("Please enter 5 actor names separated by commas (e.g. 'Tom Cruise, Emily Blunt, Brad Pitt'):")
actor_input = input("Actors: ").strip()
actor_list = [a.strip() for a in actor_input.split(",") if a.strip()]

if len(actor_list) == 0:
    print("No actors entered.")
else:
    recs = recommend_by_actors(actor_list, top_k=5)
    print("Recommended movies:\n")
    print(recs.to_string(index=False))
