// app/index.tsx
import axios from "axios";
import React, { useEffect, useState } from "react";
import { Button, Dimensions, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Swiper from "react-native-deck-swiper";

const { width, height } = Dimensions.get("window");
const API = "http://145.118.249.176:8000"; // replace with your backend IP
const TMDB_API_KEY = "118d6406df6cc4311fb96f3c4e44f65c";

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
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [topMoviePoster, setTopMoviePoster] = useState<string | undefined>(undefined);

  // Fetch exactly 30 actors and preload images
  const fetchActors = async () => {
    const batch: Actor[] = [];
    for (let i = 0; i < 30; i++) {
      try {
        const res = await axios.get(`${API}/actor`);
        batch.push({ name: res.data.name });
      } catch (err) {
        console.warn("Failed to fetch actor from backend:", err);
      }
    }

    const actorsWithImages = await Promise.all(
      batch.map(async (actor) => {
        try {
          const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(actor.name)}`;
          const response = await axios.get(searchUrl);
          const result = response.data.results?.[0];

          const image = result?.profile_path
            ? `https://image.tmdb.org/t/p/w500${result.profile_path}` // smaller image
            : undefined;

          return { ...actor, image };
        } catch (err) {
          console.warn(`Could not fetch TMDb image for ${actor.name}`, err);
          return actor;
        }
      })
    );

    // Preload images to prevent flashing
    await Promise.all(
      actorsWithImages.map((actor) =>
        actor.image ? Image.prefetch(actor.image) : Promise.resolve()
      )
    );

    setActors(actorsWithImages);
    setImagesLoaded(true);
  };

  useEffect(() => {
    fetchActors();
  }, []);

  // Swipe handler
  const handleSwipe = (likedActor: boolean) => {
    if (cardIndex >= actors.length) return;

    const actor = actors[cardIndex];
    if (likedActor) setLiked((prev) => [...prev, actor.name]);
    else setDisliked((prev) => [...prev, actor.name]);

    const nextIndex = cardIndex + 1;
    setCardIndex(nextIndex);

    // Trigger recommendations only after last card
    if (nextIndex === actors.length) {
      onSwipesComplete();
    }
  };

  // Recommendations
  const onSwipesComplete = async () => {
    const payload = { liked_actors: liked, disliked_actors: disliked };
    try {
      const res = await axios.post(`${API}/recommend`, payload);
      const recs: Recommendation[] = res.data.recommendations.map((movie: any) => ({
        title: movie.Title,
        Genres: movie.Genres || "",
        Score: movie.Score || 0,
      }));
      setRecommendations(recs);

      if (recs.length > 0) {
        const topMovie = recs[0];
        try {
          const cleanTitle = topMovie.title.replace(/\(\d{4}\)/, "").trim();
          const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`;
          const searchRes = await axios.get(searchUrl);
          const result = searchRes.data.results?.[0];

          if (result?.poster_path) {
            setTopMoviePoster(`https://image.tmdb.org/t/p/w500${result.poster_path}`);
          }
        } catch (err: any) {
          console.warn("Could not fetch top movie poster:", err.response?.data || err);
        }
      }
    } catch (err: any) {
      console.warn("Could not fetch recommendations:", err.response?.data || err);
    }
  };

  // Loading screen
  if (!imagesLoaded) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "white" }}>Loading actors...</Text>
      </View>
    );
  }

  // Recommendation screen
  if (recommendations && recommendations.length > 0) {
    const topMovie = recommendations[0];
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Top Recommended Movie</Text>
        {topMoviePoster && <Image source={{ uri: topMoviePoster }} style={styles.poster} />}
        <Text style={styles.movieTitle}>{topMovie.title}</Text>

        <Button
          title="Swipe Again"
          onPress={() => {
            setRecommendations(null);
            setLiked([]);
            setDisliked([]);
            setCardIndex(0);
            setActors([]);
            setImagesLoaded(false);
            setTopMoviePoster(undefined);
            fetchActors();
          }}
        />
      </ScrollView>
    );
  }

  // Swiper
  return (
    <View style={styles.container}>
      <Swiper
        cards={actors}
        cardIndex={cardIndex}
        renderCard={(actor) => (
          <View style={styles.card}>
            {actor.image && <Image source={{ uri: actor.image }} style={styles.image} />}
            <Text style={styles.name}>{actor.name}</Text>
          </View>
        )}
        onSwipedRight={() => handleSwipe(true)}
        onSwipedLeft={() => handleSwipe(false)}
        stackSize={75}            // Only render current card for Android stability
        disableTopSwipe
        disableBottomSwipe
        backgroundColor="#000"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  card: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  image: { width: "90%", height: "70%", borderRadius: 24, resizeMode: "cover", alignSelf: "center", marginBottom: 40 },
  name: { position: "absolute", bottom: 100, fontSize: 28, fontWeight: "bold", color: "#fff" },
  title: { fontSize: 28, color: "white", marginBottom: 20, fontWeight: "bold" },
  poster: { width: 250, height: 350, borderRadius: 12, marginBottom: 20 },
  movieTitle: { fontSize: 20, color: "white", fontWeight: "bold", textAlign: "center" },
});
