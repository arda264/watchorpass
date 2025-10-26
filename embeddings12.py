import numpy as np 
import pandas as pd # Manipulate data tables
from sentence_transformers import SentenceTransformer # Creating text embeddings
from sklearn.metrics.pairwise import cosine_similarity # Measuring the similarity of the embeddings
import ast # Converting string representations of Python lists or dictionaries into real Python lists or dictionaries to safely evaluate them

# Read actor and films databases
films = pd.read_csv('final_films.csv')
actors = pd.read_csv('top_1000.csv')

# Retrieve actors' info (c[1]=Const, c[5]=Name)and store it into actor_map dict
actor_map = {}
for c in actors.itertuples(index=False):
    actor_map[c[1]] = c[5]

def parse_cast(cast_str):
    # Converts actor ID's from strings into Python lists
    try:
        ids = ast.literal_eval(cast_str)
        return [actor_map.get(i, "") for i in ids if i in actor_map]
    except Exception:
        return []

# Creates Actor_Names column in film table with readable actor names (instead o ids) for the cast
films['Actor_Names'] = films['Cast'].apply(parse_cast)


# Combine metadata into one descriptive text field
def create_movie_text(row):
    genres = row['Genres'] if isinstance(row['Genres'], str) else ""
    actors = ", ".join(row['Actor_Names'])
    return f"Genres: {genres}. Actors: {actors}."


films['description'] = films.apply(create_movie_text, axis=1)


# Generate all vectors from movies' descriptions and store them in embeddings
model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = model.encode(films['description'].tolist(), show_progress_bar=True)
embeddings = np.array(embeddings)


# Define recommendation function
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


# Testing the code
print("Please enter 5 actor names separated by commas (e.g. 'Tom Cruise, Emily Blunt, Brad Pitt'):")
actor_input = input("Actors: ").strip()
actor_list = [a.strip() for a in actor_input.split(",") if a.strip()]

if len(actor_list) == 0:
    print("No actors entered.")
else:
    recs = recommend_by_actors(actor_list, top_k=5)
    print("Recommended movies:\n")
    print(recs.to_string(index=False))
