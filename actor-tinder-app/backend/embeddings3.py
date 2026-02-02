"""
File: backend/embeddings3.py
Authors: Alina Gladchenko, Ian Birdsall, Matteo Atzori, Melisa Saldar
Description: this file contains the main recommendation algorithm and functions for parsing the data.
"""
import numpy as np
import pandas as pd  # Manipulate data tables
from sentence_transformers import SentenceTransformer  # Creating text embeddings
from sklearn.metrics.pairwise import cosine_similarity  # Measuring the similarity of the embeddings
import ast  # Converting string representations of Python lists or dictionaries into real Python lists or dictionaries to safely evaluate them
from collections import Counter, defaultdict  # Some functions for working with dictionaries
import random

# Read actor and films databases
films = pd.read_csv('final_films.csv')
actors = pd.read_csv('top_1000.csv')

# Retrieve actors' info (c[0]=Const, c[1]=Name) and store it into actor_map dictionary
actor_map = {}
for c in actors.itertuples(index=False):
    actor_map[c[0]] = c[1]

# Creates a list all_actors with shuffled actor names
all_actors = list(actor_map.values())
random.shuffle(all_actors)

num_actors_to_show = 30

def parse_cast(cast_str):
    """
    Converts actor ID's from strings into Python lists
    param cast_str: a string that consists of 1 or multiple IDs (actor's personal ID numbers)
    return: actor's name
    """
    try:
        ids = ast.literal_eval(cast_str)
        return [actor_map.get(i, "") for i in ids if i in actor_map]
    except Exception:
        return []

# Creates Actor_Names column in the film table with readable actor names (instead of IDs) for the cast
films['Actor_Names'] = films['Cast'].apply(parse_cast)
films.columns = films.columns.str.strip()  # remove empty spaces in columns' names for easier access

def create_movie_text(row):
    """
    Combine metadata into one descriptive text field
    param row: a single row (Code, Title...) from Pandas DataFrame (in our case films table)
    return: a string containing genres and actors' names
    """
    genres = row['Genres'] if isinstance(row['Genres'], str) else ""
    actors = ", ".join(row['Actor_Names'])
    director = row['Director'] if isinstance(row['Director'], str) else ""
    return f"Genres: {genres}. Director: {director}. Actors: {actors}."

# Creates Description column in film table with str information about each film
films['description'] = films.apply(create_movie_text, axis=1)  # specifying axis to address rows of the table

# Generate vectors from movies' descriptions using a pretrained model and store them in embeddings
model = SentenceTransformer('paraphrase-MiniLM-L3-v2')
model.half()
embeddings = model.encode(films['description'].tolist(), show_progress_bar=True)
embeddings = np.array(embeddings)

def build_actor_mapping(database):
    """
    Build mappings from actor names to directors and genres
    :param database: main movie dataset
    :return: 2 dictionaries: actor_to_directors and actor_to_genres
    """
    # Initialize dictionaries for mapping actors to directors and genres
    actor_to_directors = defaultdict(set)  # a set to avoid repeating directors
    actor_to_genres = defaultdict(list)  # a list so that the same genre could appear twice

    # Map actors to directors and genres
    for j, row in database.iterrows():
        for actor in row['Actor_Names']:
            if isinstance(row['Director'], str):
                for d in [director.strip() for director in row['Director'].split(",") if director.strip()]:  # some movies have more than 1 director
                    actor_to_directors[actor].add(d)
            if isinstance(row['Genres'], str):
                for g in [genre.strip() for genre in row['Genres'].split(",") if genre.strip()]:
                    actor_to_genres[actor].append(g)

    return actor_to_directors, actor_to_genres

actor_to_directors, actor_to_genres = build_actor_mapping(films)

def get_actor():
    """
    Retrieve a random actor's name from the shuffled list of all actors.
    return : a string with the name of the actor.
    """
    return all_actors[random.randint(0, len(all_actors) - 1)]

def recommend_movies(liked_actors, disliked_actors, weights, top_k):
    """
    param liked_actors, disliked_actors: list of actor names the user likes or dislikes
    weights: dictionary of weights for each category
    param top_k: number of top recommendations to return

    """
    # Create 2 text queries from actor names
    like_actor_text = ", ".join(liked_actors) if liked_actors else ""
    dislike_actor_text = ", ".join(disliked_actors) if disliked_actors else ""

    # Special case — no preferences at all
    if not liked_actors and not disliked_actors:
        # Neutral embedding
        preference_vec = model.encode(["generic movie query"])
        similarity_scores = cosine_similarity(preference_vec, embeddings)[0]
        similar_indices = np.argsort(similarity_scores)[::-1][:top_k]

        return films.iloc[similar_indices][['Title']]

    # Encode the actors related queries
    like_actors_vec = model.encode([f"Movies featuring actors like {like_actor_text}."]) \
        if like_actor_text else np.zeros((1, embeddings.shape[1]))
    dislike_actors_vec = model.encode([f"Movies featuring actors like {dislike_actor_text}."]) \
        if dislike_actor_text else np.zeros((1, embeddings.shape[1]))

    # Get directors that have worked with the actor the user likes
    bonus_directors = set()
    for actor in liked_actors:
        bonus_directors.update(actor_to_directors.get(actor, []))

    # Get genres related to actors (with counting) and create a distribution
    genre_counter = Counter()
    for act in liked_actors:
        genre_counter.update(actor_to_genres.get(act, []))
    total_genres = sum(genre_counter.values()) or 1  # avoid division by 0 if no liked_actors input or they are not in the actors_to_genres dict
    genre_distribution = {genre: count / total_genres for genre, count in genre_counter.items()}  # distribution of genre related preferences based on liked actors' film history

    directors_text = ", ".join(bonus_directors)
    genres_text = ", ".join(genre_distribution.keys())

    # Encode directors and genres related queries into vectors
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

    # Compute cosine similarity between query and all movie embeddings
    similarity_scores = cosine_similarity(preference_vec, embeddings)[0]

    # Add small score bonuses for directors and genres
    bonus_scores = np.zeros_like(similarity_scores)  # zero vector, same size as similarity_scores vector
    for i, row in films.iterrows():
        if isinstance(row['Genres'], str):
            for g in [x.strip() for x in row['Genres'].split(",") if x.strip()]:
                bonus_scores[i] += genre_distribution.get(g, 0)  # bonus equals to the distribution value of the genre
        if row['Director'] in bonus_directors:
            bonus_scores[i] += 0.1  # small director bonus

    # Combine base similarity and bonus adjustments
    final_scores = similarity_scores + weights["bonus_genre_director"] * bonus_scores

    # Compute final scores and gets top k similar movies
    similar_indices = np.argsort(final_scores)[::-1][:top_k]

    # Give the final recommendation
    recommendations = films.iloc[similar_indices][['Title']].copy()
    return recommendations

if __name__ == "__main__":
    liked_actors = []
    disliked_actors = []

    print("Respond to the following actors with:")
    print(" y = like or n = dislike\n")

    # Retrieve num_actors_to_show(int) actors from shuffled all_actors list
    # User will swipe on them one by one
    for i in range(num_actors_to_show) :
        actor = get_actor()

        while True:
            response = input(f"{actor}? (y/n): ").strip().lower()
            if response in ['y', 'n']:
                break
            else:
                print("Please respond with 'y' or 'n'")

        # The liked actors will be added to the liked_actors and the disliked actors will be added to disliked_actors
        if response == 'y':
            liked_actors.append(actor)
        elif response == 'n':
            disliked_actors.append(actor)


    print("\nYou've finished rating actors.")
    print(f"Liked actors ({len(liked_actors)}): {', '.join(liked_actors)}")
    print(f"Disliked actors ({len(disliked_actors)}): {', '.join(disliked_actors)}")

    # Weights values
    weights = {
        "liked_actors": 1.8,
        "disliked_actors": 0.5,
        "genres": 0.6,
        "directors": 0.7,
        "bonus_genre_director": 0.1  # how much the extra bonuses affect score
    }

def bias_correction(disliked_actors, drop_fraction=0.5):
    """
    Randomly ignores a fraction of disliked actors to reduce bias from unknown actors.
    Returns a filtered list of disliked actors that will actually affect recommendations.

    param disliked_actors: list of actors the user disliked
    param drop_fraction: fraction of disliked actors to ignore
    return: filtered list of disliked actors
    """
    if not disliked_actors:
        return disliked_actors  # nothing to do

    num_to_drop = int(len(disliked_actors) * drop_fraction)
    # Randomly choose actors to ignore
    ignored = set(random.sample(disliked_actors, num_to_drop))
    corrected_list = []
    for actor in disliked_actors:
        if actor not in ignored:
            corrected_list.append(actor)

    print(f"\nBias correction applied: Ignoring {num_to_drop} disliked actors -> {', '.join(ignored)}")
    return corrected_list

if __name__ == "__main__":
    # Apply bias correction to disliked actors
    disliked_actors = bias_correction(disliked_actors, drop_fraction=0.2)

    # Generate recommendations
    recs = recommend_movies(liked_actors, disliked_actors, weights, top_k=4)
    print("\nRecommended Movies Based on Weighted Preferences and Bonuses:\n")
    print(recs.to_string(index=False))


