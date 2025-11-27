import numpy as np
import pandas as pd
import pytest
from unittest.mock import MagicMock, patch
from collections import defaultdict
from embeddings3 import recommend_movies, build_actor_mapping, bias_correction

@pytest.fixture()
def mock_films(monkeypatch):
    """
    Create a small fake films dataframe to use instead of our big dataset
    """
    data = pd.DataFrame({
        "Title": ["Titanic", "Hot Fuzz", "Django Unchained"],
        "Genres": ["Action, Drama", "Comedy", "Action"],
        "Director": ["Cameron", "Wright", "Tarantino"],
        "Actor_Names": [
            ["Leonardo DiCaprio", "Kate Winslet"],
            ["Simon Pegg"],
            ["Leonardo DiCaprio"]
        ],
        "description": ["Sad movie", "Funny movie", "Interesting movie"],
    })

    monkeypatch.setattr("embeddings3.films", data)
    return data

@pytest.fixture()
def mock_embeddings(monkeypatch):
    """
    Create 3 simple mock embeddings manually (not using a built-in package for that)
    """
    embeddings = np.array([
        [1.0, 0.0], # Titanic
        [0.5, 0.5], # Hot Fuzz
        [0.0, 1.0] # Django Unchained
    ])
    monkeypatch.setattr("embeddings3.embeddings", embeddings)
    return embeddings

@pytest.fixture()
def mock_actor_maps(monkeypatch):
    """
    Create mock actor-to-director and actor-to-genre maps
    """
    data = pd.DataFrame({
        "Title": ["Titanic", "Hot Fuzz", "Django Unchained"],
        "Genres": ["Action, Drama", "Comedy", "Action"],
        "Director": ["Cameron", "Wright", "Tarantino"],
        "Actor_Names": [
            ["Leonardo DiCaprio", "Kate Winslet"],
            ["Simon Pegg"],
            ["Leonardo DiCaprio"]
        ],
        "description": ["Sad movie", "Funny movie", "Interesting movie"],
    })
    act_dir, act_gen = build_actor_mapping(data)

    monkeypatch.setattr("embeddings3.actor_to_directors", act_dir)
    monkeypatch.setattr("embeddings3.actor_to_genres", act_gen)

    return act_dir, act_gen

@pytest.fixture()
def mock_model(monkeypatch):
    """
    Mock SentenceTransformer.encode so the real model is not loaded
    """
    mock_model = MagicMock()
    mock_model.encode.return_value = np.array([[1.0, 1.0]])
    monkeypatch.setattr("embeddings3.model", mock_model)
    return mock_model

# Actual testing
def test_recommend_movies_basic(mock_films, mock_embeddings, mock_actor_maps, mock_model):
    """
    Test scenario: general case
    Should output the movies that have the actor a user likes
    """
    weights = {
        "liked_actors": 1.0,
        "disliked_actors": 1.0,
        "genres": 1.0,
        "directors": 1.0,
        "bonus_genre_director": 0.5
    }

    recs = recommend_movies(
        liked_actors=["Leonardo DiCaprio"],
        disliked_actors=[],
        weights=weights,
        top_k=2
    )

    # Should return 2 movies
    assert len(recs) == 2

    # Movies "Titanic" and "Django Unchained" both have Leonardo DiCaprio → they should score highest
    titles = recs["Title"].tolist()
    assert "Titanic" in titles
    assert "Django Unchained" in titles

def test_recommend_movies_empty_input(mock_films, mock_embeddings, mock_actor_maps, mock_model):
    """
    Test scenario: no preferences
    Should output the most "basic" movie (from the perspective of vector embeddings)
    """
    weights = {
        "liked_actors": 1.0,
        "disliked_actors": 1.0,
        "genres": 1.0,
        "directors": 1.0,
        "bonus_genre_director": 1.0
    }

    recs = recommend_movies(
        liked_actors=[],
        disliked_actors=[],
        weights=weights,
        top_k=1
    )

    # With no preferences, highest cosine similarity (vector [1,1]) is "Hot Fuzz" (vector [0.5,0.5])
    titles = recs["Title"].tolist()
    assert len(recs) == 1
    assert "Hot Fuzz" in titles

def test_recommend_movies_zero_weights(mock_films, mock_embeddings, mock_actor_maps, mock_model):
    """
    Test scenario: zero weights
    Should output the movies in reversed index order
    """
    # All weights zero → scores should tie → return first in sorted order
    weights = {
        "liked_actors": 0.0,
        "disliked_actors": 0.0,
        "genres": 0.0,
        "directors": 0.0,
        "bonus_genre_director": 0.0
    }

    recs = recommend_movies(
        liked_actors=["Simon Pegg"],
        disliked_actors=["Leonardo DiCaprio"],
        weights=weights,
        top_k=1
    )

    # Should return "Django Unchained" even though the user dislikes Leonardo DiCaprio and likes Simon Pegg
    titles = recs["Title"].tolist()
    assert len(recs) == 1
    assert "Django Unchained" in titles

def test_bias_correction():
    """
    Test scenario: general case
    Should drop a predefined fraction of actors
    """
    disliked = ["A", "B", "C", "D"]
    corrected = bias_correction(disliked, drop_fraction=0.5)

    # Should drop 2 actors and return 2 remaining
    assert len(corrected) == 2
    # Must be subset of original
    assert set(corrected).issubset(set(disliked))

def test_bias_correction_empty():
    """
    Test scenario: no disliked actors
    Should not drop anything and return an empty list
    """
    assert bias_correction([], 0.5) == []

def test_recommend_movies_missing_fields(monkeypatch, mock_model):
    """
    Test scenario: films dataframe is missing expected fields
    Code should not crash
    """
    df = pd.DataFrame({
        "Title": ["Very bad movie"],
        "Genres": [None],
        "Director": [None],
        "Actor_Names": [["Actor1"]],
        "description": ["disgusting"]
    })
    mock_embeddings = np.array([[0.5, 0.5]])
    mock_actor_to_directors, mock_actor_to_genres = build_actor_mapping(df)
    monkeypatch.setattr("embeddings3.films", df)
    monkeypatch.setattr("embeddings3.embeddings", mock_embeddings)
    monkeypatch.setattr("embeddings3.actor_to_directors", mock_actor_to_directors)
    monkeypatch.setattr("embeddings3.actor_to_genres", mock_actor_to_genres)

    weights = {
        "liked_actors": 1.0,
        "disliked_actors": 1.0,
        "genres": 1.0,
        "directors": 1.0,
        "bonus_genre_director": 1.0
    }

    recs = recommend_movies(["Actor1"], [], weights, 1)

    assert len(recs) == 1
    assert recs.iloc[0]["Title"] == "Very bad movie"

