import numpy as np 
import pandas as pd # Manipulate data tables
from sentence_transformers import SentenceTransformer # Creating text embeddings
from sklearn.metrics.pairwise import cosine_similarity # Measuring the similarity of the embeddings
import ast # Converting string representations of Python lists or dictionaries into real Python lists or dictionaries to safely evaluate them

# Read actor and films databases
films = pd.read_csv('final_films.csv')
actors = pd.read_csv('top_1000.csv')

# Retrieve actors' info (c[1]=Const, c[5]=Name) and store it into actor_map dictionary
# variable Const is an actor's personal ID number, later referred as ID
actor_map = {}
for c in actors.itertuples(index=False):
    actor_map[c[1]] = c[5]

def parse_cast(cast_str):
    """
    Convert actor ID's from strings into Python lists
    param cast_str: a string that consists of 1 or multiple IDs (actor's personal ID numbers)
    return: actor's name
    """
    try:
        ids = ast.literal_eval(cast_str)
        return [actor_map.get(i, "") for i in ids if i in actor_map]
    except Exception:
        return []

# Creates Actor_Names column in film table with readable actor names (instead of IDs) for the cast
films['Actor_Names'] = films['Cast'].apply(parse_cast)

def create_movie_text(row):
    """
    Combine metadata into one descriptive text field
    param row: a single row (Code, Title...) from Pandas DataFrame (in our case films table)
    return: a string containing genres and actors' names
    """
    genres = row['Genres'] if isinstance(row['Genres'], str) else ""
    actors = ", ".join(row['Actor_Names'])
    return f"Genres: {genres}. Actors: {actors}."

# Creates Description column in film table with str information about each film
films['Description'] = films.apply(create_movie_text, axis=1) # specifying axis to address rows of the table

# Generate vectors from movies' descriptions using a pretrained model and store them in embeddings
model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = model.encode(films['Description'].tolist(), show_progress_bar=True) # providing text descriptions
embeddings = np.array(embeddings)

def recommend_by_actors(actor_names, top_k=5):
    """
    Give a personal recommendation based on the actors user likes
    param actor_names: a list of actors' names (user imput)
    param top_k: a number of movies to recommend
    return: a Pandas DataFrame containing the info on recommended movies (Title, Genres, Similarity_Score)
    """
    # Create a text query from actor names
    actor_text = ", ".join(actor_names)
    query = f"Movies featuring actors like {actor_text}."

    # Encode the query
    query_vec = model.encode([query])

    # Compute cosine similarity between query and all movie embeddings
    similarity_scores = cosine_similarity(query_vec, embeddings)[0]

    # Get top K similar movies
    similar_indices = np.argsort(similarity_scores)[::-1][:top_k]
    similar_scores = similarity_scores[similar_indices]

    # Give the final recommendation
    recommendations = films.iloc[similar_indices][['Title', 'Genres']].copy()
    recommendations['Similarity_Score'] = similar_scores
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
