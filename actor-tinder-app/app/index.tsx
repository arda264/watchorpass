// app/index.tsx
import axios from "axios";
import React, { useEffect, useState } from "react";
import { Alert, Button, Dimensions, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Swiper from "react-native-deck-swiper";

const { width, height } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TMDB_API_KEY = "118d6406df6cc4311fb96f3c4e44f65c"

interface Actor {
  name: string;
  image?: string;
}

interface Recommendation {
  Title: string;  // Only Title now
}

export default function Home() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [topMoviePoster, setTopMoviePoster] = useState<string | undefined>(undefined);

  // Fetch exactly 30 actors using the batch endpoint
  const fetchActors = async () => {
    try {
      setImagesLoaded(false);
      
      console.log("=== FETCHING ACTORS ===");
      console.log("API_URL:", API_URL);
      
      if (!API_URL) {
        Alert.alert("Configuration Error", "API_URL is not set. Check your environment variables.");
        return;
      }

      // 1. Get 30 actors in ONE call
      console.log("Fetching actor batch from:", `${API_URL}/actor-batch`);
      const res = await axios.get(`${API_URL}/actor-batch`, {
        timeout: 10000,
      });
      
      console.log("✓ Backend response:", res.data);
      const actorNames = res.data.actors;
      console.log("✓ Got", actorNames.length, "actors");

      // 2. Fetch TMDb images in parallel
      console.log("Fetching TMDB images...");
      const actorsWithImages = await Promise.all(
        actorNames.map(async (name: string) => {
          try {
            const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`;
            const response = await axios.get(searchUrl, { timeout: 5000 });
            const result = response.data.results?.[0];

            const image = result?.profile_path
              ? `https://image.tmdb.org/t/p/w500${result.profile_path}`
              : undefined;

            return { name, image };
          } catch (err) {
            console.warn(`TMDb fetch failed for ${name}:`, err);
            return { name, image: undefined };
          }
        })
      );

      console.log("✓ TMDb fetch complete");

      // 3. Preload images
      console.log("Preloading images...");
      actorsWithImages.forEach(actor => {
        if (actor.image) {
          Image.prefetch(actor.image).catch(() => {});
        }
      });

      setActors(actorsWithImages);
      setImagesLoaded(true);


      console.log("✓ All images preloaded");
      setActors(actorsWithImages);
      setImagesLoaded(true);
      console.log("=== FETCH COMPLETE ===");
      
    } catch (err: any) {
      console.error("❌ FETCH FAILED:");
      console.error("Error:", err.message);
      console.error("Response:", err.response?.data);
      console.error("Status:", err.response?.status);
      
      Alert.alert(
        "Connection Error",
        `Could not fetch actors.\n\nAPI: ${API_URL}\n\nError: ${err.message || "Unknown error"}`
      );
    }
  };

  useEffect(() => {
    fetchActors();
  }, []);

  // Swipe handler
  const handleSwipe = (likedActor: boolean) => {
    if (cardIndex >= actors.length) return;

    const actor = actors[cardIndex];
    const newLiked = likedActor ? [...liked, actor.name] : liked;
    const newDisliked = !likedActor ? [...disliked, actor.name] : disliked;

    if (likedActor) setLiked(newLiked);
    else setDisliked(newDisliked);

    const nextIndex = cardIndex + 1;
    setCardIndex(nextIndex);
    
    console.log(`Swiped ${likedActor ? "right" : "left"} on ${actor.name}`);
    
    // Trigger recommendations only after last card
    if (nextIndex === actors.length) {
      onSwipesComplete(newLiked, newDisliked);
      return;
    }
  };

  // Recommendations - simplified to only use Title
  const onSwipesComplete = async (finalLiked: string[], finalDisliked: string[]) => {
    console.log("=== GENERATING RECOMMENDATIONS ===");
    console.log("Liked:", finalLiked);
    console.log("Disliked:", finalDisliked);
    
    const payload = { liked_actors: finalLiked, disliked_actors: finalDisliked };
    
    try {
      const res = await axios.post(`${API_URL}/recommend`, payload, {
        timeout: 30000,
      });
      
      console.log("✓ Recommendations received:", res.data);
      
      // Simplified - only expecting Title field
      const recs: Recommendation[] = res.data.recommendations.map((movie: any) => ({
        Title: movie.Title,
      }));
      
      setRecommendations(recs);

      if (recs.length > 0) {
        const topMovie = recs[0];
        console.log("Fetching poster for:", topMovie.Title);
        
        try {
          const cleanTitle = topMovie.Title.replace(/\(\d{4}\)/, "").trim();
          const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`;
          const searchRes = await axios.get(searchUrl);
          const result = searchRes.data.results?.[0];

          if (result?.poster_path) {
            setTopMoviePoster(`https://image.tmdb.org/t/p/w500${result.poster_path}`);
          }
        } catch (err: any) {
          console.warn("Could not fetch top movie poster:", err);
        }
      }
    } catch (err: any) {
      console.error("❌ Recommendations failed:", err);
      Alert.alert(
        "Error",
        `Could not get recommendations.\n\nError: ${err.message || "Unknown error"}`
      );
    }
  };

  // Reset function
  const resetApp = () => {
    setRecommendations(null);
    setLiked([]);
    setDisliked([]);
    setCardIndex(0);
    setActors([]);
    setImagesLoaded(false);
    setTopMoviePoster(undefined);
    fetchActors();
  };

  // Loading screen
  if (!imagesLoaded) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "white", fontSize: 18 }}>Loading actors...</Text>
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
        <Text style={styles.movieTitle}>{topMovie.Title}</Text>

        <Button title="Swipe Again" onPress={resetApp} />
      </ScrollView>
    );
  }

  // No recommendations case
  if (recommendations && recommendations.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No matches found 😔</Text>
        <Button title="Try Again" onPress={resetApp} />
      </View>
    );
  }

  // Swiper
  return (
    <View style={styles.container}>
      <Swiper
        cards={actors}
        cardIndex={cardIndex}
        renderCard={(actor) => {
          if (!actor) return <View />;
          
          return (
            <View style={styles.card}>
              {actor.image ? (
                <Image 
                  source={{ uri: actor.image }} 
                  style={styles.image}
                  onError={(e) => console.error(`Image error for ${actor.name}:`, e.nativeEvent.error)}
                />
              ) : (
                <View style={[styles.image, styles.noImage]}>
                  <Text style={styles.noImageIcon}>📷</Text>
                </View>
              )}
              <Text style={styles.name}>{actor.name}</Text>
            </View>
          );
        }}
        onSwipedRight={() => handleSwipe(true)}
        onSwipedLeft={() => handleSwipe(false)}
        stackSize={3}
        disableTopSwipe
        disableBottomSwipe
        backgroundColor="#000"
      />
      
      {/* Progress indicator */}
      <View style={styles.progress}>
        <Text style={styles.progressText}>
          {cardIndex} / {actors.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#000", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  card: { 
    width: "100%", 
    height: "100%", 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#000" 
  },
  image: { 
    width: "90%", 
    height: "70%", 
    borderRadius: 24, 
    resizeMode: "cover", 
    alignSelf: "center", 
    marginBottom: 40 
  },
  noImage: {
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageIcon: {
    fontSize: 60,
  },
  name: { 
    position: "absolute", 
    bottom: 100, 
    fontSize: 28, 
    fontWeight: "bold", 
    color: "#fff" 
  },
  title: { 
    fontSize: 28, 
    color: "white", 
    marginBottom: 20, 
    fontWeight: "bold" 
  },
  poster: { 
    width: 250, 
    height: 350, 
    borderRadius: 12, 
    marginBottom: 20 
  },
  movieTitle: { 
    fontSize: 20, 
    color: "white", 
    fontWeight: "bold", 
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  progress: {
    position: "absolute",
    bottom: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  progressText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});