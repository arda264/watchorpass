"""
File: test_parsing.py
Author: Alina Gladchenko
Description: this file contains unittests for simpler functions from embeddings3.py module:
parse_cast(), create_movie_text(), get_actor(), mapping actors to directors and genres
"""
import pytest
import embeddings3
import pandas as pd
import importlib
from embeddings3 import parse_cast, create_movie_text, get_actor, actor_to_directors, actor_to_genres


def test_parse_cast_valid_input(monkeypatch):
    """
    Test scenario: input is valid, all IDs are in a database
    Should convert a valid string of actor's IDs into the correct list of actor's names.
    """
    # Creating a temporary dict with actors and their IDs
    mock_actor_map = {101: "Gary Oldman",
                      102: "Christian Bale",
                      103: "Heath Ledger",
                      104: "Natalie Portman",
                      105: "Brad Pitt"}
    # Cast IDs we want to process
    mock_cast_str = "[103,101,102]"
    # Temporarily placing our mock dictionary on the place of a real actors dic
    monkeypatch.setattr(embeddings3, "actor_map", mock_actor_map)
    # Applying the function we want to test
    result = parse_cast(mock_cast_str)

    # Expected output
    assert result == ["Heath Ledger", "Gary Oldman", "Christian Bale"]

def test_parse_cast_invalid_input(monkeypatch):
    """
    Test scenario: input is invalid
    Should return an empty list
    """
    # Creating a temporary dict with actors and their IDs
    mock_actor_map = {101: "Gary Oldman",
                      102: "Christian Bale"}
    # Invalid string we want to process
    mock_cast_str = "The cast consists of 101 and 102"
    # Temporarily placing our mock dictionary on the place of a real actors dic
    monkeypatch.setattr(embeddings3, "actor_map", mock_actor_map)
    # Applying the function we want to test
    result = parse_cast(mock_cast_str)

    # Expected output
    assert result == []

def test_parse_cast_unknown_id(monkeypatch):
    """
    Test scenario: casts includes IDs of actors that are not in the database
    Should return a list of actor's names, excluding the unknown ones
    """
    # Creating a temporary dict with actors and their IDs
    mock_actor_map = {101: "Gary Oldman",
                      102: "Christian Bale",
                      103: "Heath Ledger",
                      104: "Natalie Portman",
                      105: "Brad Pitt"}
    # Cast IDs we want to process, ID 999 and 111 are imposters
    mock_cast_str = "[103,999,102,111]"
    # Temporarily placing our mock dictionary on the place of a real actors dic
    monkeypatch.setattr(embeddings3, "actor_map", mock_actor_map)
    # Applying the function we want to test
    result = parse_cast(mock_cast_str)

    # Expected output
    assert result == ["Heath Ledger", "Christian Bale"]

def test_create_movie_text(monkeypatch):
    """
    Test scenario: a row contains all relevant data in a valid format
    Should return a text field with info on actors, genres and a director
    """
    # Creating a temporary row (allegedly from our film database)
    mock_row = {
        "Genres": "Action, Crime, Drama",
        "Director": "Nolan",
        "Actor_Names": ["Christian Bale", "Gary Oldman"]
    }
    monkeypatch.setattr(embeddings3, "row", mock_row)
    result = create_movie_text(mock_row)

    # Expected result
    assert result == "Genres: Action, Crime, Drama. Director: Nolan. Actors: Christian Bale, Gary Oldman."

def test_create_movie_text_invalid(monkeypatch):
    """
    Test scenario: a row doesn't contain any information on directors and data on genres is not a string
    Should return a text field with info only on actors
    """
    # Creating a temporary row where some data is missing and some data is of a wrong type
    mock_row = {
        "Genres": 123,
        "Director": "",
        "Actor_Names": ["Christian Bale", "Gary Oldman"]
    }
    monkeypatch.setattr(embeddings3, "row", mock_row)
    result = create_movie_text(mock_row)

    # Expected result
    assert result == "Genres: . Director: . Actors: Christian Bale, Gary Oldman."

def test_get_actor(monkeypatch):
    """
    Test scenario: retrieving an actor's name with a valid index
    Should return an actor's name
    """
    # Creating a temporary list of actors
    mock_all_actors = ["Ellen Burstyn", "Jared Leto", "Jennifer Connelly"]
    mock_num_actor = 2
    monkeypatch.setattr(embeddings3, "all_actors", mock_all_actors)
    result = get_actor(mock_num_actor)

    # Expected result
    assert result == "Jennifer Connelly"

def test_get_actor_index_error(monkeypatch):
    """
    Test scenario: retrieving an actor's name with an out-of-range index
    Should raise an IndexError
    """
    # Creating a temporary list of actors with max index == 2
    mock_all_actors = ["Ellen Burstyn", "Jared Leto", "Jennifer Connelly"]
    mock_num_actor = 3
    monkeypatch.setattr(embeddings3, "all_actors", mock_all_actors)

    # If the exception is raised the test is passed
    with pytest.raises(IndexError):
        get_actor(mock_num_actor)


def test_mapping(monkeypatch):
    # TODO
    """
    Test scenario: mapping actors to films and genres based on a valid  films dataset
    Should return correct dictionaries
    """
    pass
#    mock_films = pd.DataFrame({
#        "Actor_Names": [["A"], ["A", "B"]],
#        "Director": ["Dir1", "Dir2"],
#        "Genres": ["Action", "Comedy"]
#    })

#    monkeypatch.setattr(embeddings3, "films", mock_films)
#    importlib.reload(embeddings3)

#    assert embeddings3.actor_to_directors["A"] == {"Dir1", "Dir2"}
#    assert set(embeddings3.actor_to_genres["A"]) == {"Action", "Comedy"}
#    assert embeddings3.actor_to_directors["B"] == {"Dir2"}







