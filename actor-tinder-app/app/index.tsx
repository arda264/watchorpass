// app/index.tsx
import axios from "axios";
import React, { useEffect, useState } from "react";
import { Button, Dimensions, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Swiper from "react-native-deck-swiper";

const { width, height } = Dimensions.get("window");
const API = "http://145.118.239.11:8000"; // replace with your backend IP

interface Actor {
  name: string;
  image?: string;
}

interface Recommendation {
  title: string;
  Genres: string;
  Score: number;
}

export default function Home() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [topMoviePoster, setTopMoviePoster] = useState<string | undefined>(undefined);

  // Fetch 30 actors from backend
  async function fetchBatchActors() {
    const batch: Actor[] = [];
    for (let i = 0; i < 30; i++) {
      const res = await axios.get(`${API}/actor`);
      batch.push({ name: res.data.name });
    }

    //Fetch actor images from Wikipedia
    const actorsWithImages = await Promise.all(
      batch.map(async (actor) => {
        try {
          const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
            actor.name
          )}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
          const response = await axios.get(url);
          const page = Object.values(response.data.query.pages)[0] as any;
          const image = page.thumbnail ? page.thumbnail.source : undefined;
          return { ...actor, image };
        } catch {
          return actor;
        }
      })
    );

    setActors(actorsWithImages);
  }

  useEffect(() => {
    fetchBatchActors();
  }, []);

  // Handle swipes
  const onSwipeRight = (index: number) => {
    setLiked((prev) => [...prev, actors[index].name]);
  };

  const onSwipeLeft = (index: number) => {
    setDisliked((prev) => [...prev, actors[index].name]);
  };

  // When swiping ends → recommend movies + fetch poster
  const onSwipesComplete = async () => {
    const payload = {
      liked_actors: liked,
      disliked_actors: disliked,
    };

    try {
      const res = await axios.post(`${API}/recommend`, payload);

      //Map backend response to Recommendation[]
      const recs: Recommendation[] = res.data.recommendations.map((movie: any) => ({
        title: movie.Title,
        Genres: movie.Genres || "",
        Score: movie.Score || 0,
      }));

      setRecommendations(recs);

      //Fetch poster for top movie immediately
      if (recs.length > 0) {
        const topMovie = recs[0];
        try {
          const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
            topMovie.title + " (film)"
          )}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
          const response = await axios.get(url);
          const page = Object.values(response.data.query.pages)[0] as any;
          if (page.thumbnail) setTopMoviePoster(page.thumbnail.source);
        } catch (err) {
          console.warn("Could not fetch top movie poster:", err);
        }
      }

    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    }
  };

  //Recommendation screen
  if (recommendations && recommendations.length > 0) {
    const topMovie = recommendations[0];

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Top Recommended Movie</Text>

        {topMoviePoster && <Image source={{ uri: topMoviePoster }} style={styles.poster} />}
        <Text style={styles.movieTitle}>{topMovie.title}</Text>
        <Text style={styles.movieInfo}>{topMovie.Genres}</Text>
        <Text style={styles.movieInfo}>Score: {topMovie.Score.toFixed(3)}</Text>

        <Button
          title="Swipe Again"
          onPress={() => {
            setRecommendations(null);
            setLiked([]);
            setDisliked([]);
            setActors([]);
            setTopMoviePoster(undefined);
            fetchBatchActors();
          }}
        />
      </ScrollView>
    );
  }

  //Loading screen while actor images are fetched
  if (actors.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "white" }}>Loading actors...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Swiper
        cards={actors}
        renderCard={(actor) => (
          <View style={styles.card}>
            {actor.image && <Image source={{ uri: actor.image }} style={styles.image} />}
            <Text style={styles.name}>{actor.name}</Text>
          </View>
        )}
        onSwipedRight={onSwipeRight}
        onSwipedLeft={onSwipeLeft}
        onSwipedAll={onSwipesComplete}
        stackSize={3}
        cardVerticalMargin={0}
        backgroundColor="#000"
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  image: {
    width: "90%",
    height: "70%",
    borderRadius: 24,
    resizeMode: "cover",
    alignSelf: "center",
    marginBottom: 40,
  },
  name: {
    position: "absolute",
    bottom: 100,
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  title: {
    fontSize: 28,
    color: "white",
    marginBottom: 20,
    fontWeight: "bold",
  },
  poster: {
    width: 250,
    height: 350,
    borderRadius: 12,
    marginBottom: 20,
  },
  movieTitle: {
    fontSize: 20,
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  movieInfo: {
    color: "#ccc",
    textAlign: "center",
  },
});
