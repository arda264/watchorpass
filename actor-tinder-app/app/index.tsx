// app/index.tsx
// app/index.tsx
import axios from "axios";
import React, { useEffect, useState, useRef } from "react";
import { Dimensions, Image, ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import Swiper from "react-native-deck-swiper";
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL;
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
  const swiperRef = useRef<any>(null);

  const fetchActors = async () => {
    try {
      setImagesLoaded(false);
      // 1. Get 30 random actor names in ONE batch call
      const res = await axios.get(`${API_URL}/actor-batch`);
      const actorNames = res.data.actors;

      // 2. Fetch all TMDb images at once in parallel
      const actorsWithImages = await Promise.all(
        actorNames.map(async (name: string) => {
          try {
            const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`;
            const response = await axios.get(searchUrl);
            const result = response.data.results?.[0];
            const image = result?.profile_path
              ? `https://image.tmdb.org/t/p/w500${result.profile_path}`
              : undefined;
            return { name, image };
          } catch (err) {
            return { name, image: undefined };
          }
        })
      );

      // 3. Preload images
      await Promise.all(
        actorsWithImages.map((actor) =>
          actor.image ? Image.prefetch(actor.image) : Promise.resolve()
        )
      );

      setActors(actorsWithImages);
      setImagesLoaded(true);
    } catch (err) {
      console.error("Failed to fetch actor batch:", err);
      Alert.alert("Connection Error", "Could not reach the backend server.");
    }
  };

  useEffect(() => {
    fetchActors();
  }, []);

  // NEW: Refactored to pass current lists directly to handle React's async state
  const handleSwipe = (likedActor: boolean) => {
    if (cardIndex >= actors.length) return;

    const actor = actors[cardIndex];
    const newLiked = likedActor ? [...liked, actor.name] : liked;
    const newDisliked = !likedActor ? [...disliked, actor.name] : disliked;

    if (likedActor) setLiked(newLiked);
    else setDisliked(newDisliked);

    const nextIndex = cardIndex + 1;
    setCardIndex(nextIndex);

    // If it's the last card, trigger recommendations with the NEWLY updated lists
    if (nextIndex === actors.length) {
      onSwipesComplete(newLiked, newDisliked);
    }
  };

  const onSwipesComplete = async (finalLiked: string[], finalDisliked: string[]) => {
    const payload = { liked_actors: finalLiked, disliked_actors: finalDisliked };
    try {
      const res = await axios.post(`${API_URL}/recommend`, payload);
      
      // Ensure backend keys match (e.g., movie.Title vs movie.title)
      const recs: Recommendation[] = res.data.recommendations.map((movie: any) => ({
        title: movie.Title || movie.title,
        Genres: movie.Genres || "",
        Score: movie.Score || 0,
      }));
      
      setRecommendations(recs);

      if (recs.length > 0) {
        fetchTopMoviePoster(recs[0].title);
      }
    } catch (err: any) {
      console.warn("Could not fetch recommendations:", err.response?.data || err);
    }
  };

  const fetchTopMoviePoster = async (title: string) => {
    try {
      const cleanTitle = title.replace(/\(\d{4}\)/, "").trim();
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`;
      const searchRes = await axios.get(searchUrl);
      const result = searchRes.data.results?.[0];

      if (result?.poster_path) {
        setTopMoviePoster(`https://image.tmdb.org/t/p/w500${result.poster_path}`);
      }
    } catch (err) {
      console.warn("Poster fetch failed:", err);
    }
  };

  if (!imagesLoaded) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "#FF6B6B", fontSize: 18 }}>Loading actors...</Text>
      </View>
    );
  }

  if (recommendations && recommendations.length > 0) {
    const topMovie = recommendations[0];
    return (
      <LinearGradient colors={['#FD297B', '#FF5864', '#FF655B']} style={styles.gradientContainer}>
        <ScrollView contentContainerStyle={styles.recommendationContainer}>
          <Text style={styles.matchText}>It's a Match!</Text>
          <Text style={styles.recommendationTitle}>Your Top Movie</Text>
          {topMoviePoster && <Image source={{ uri: topMoviePoster }} style={styles.poster} />}
          <Text style={styles.movieTitle}>{topMovie.title}</Text>
          
          <TouchableOpacity
            style={styles.tinderButton}
            onPress={() => {
              setRecommendations(null);
              setLiked([]);
              setDisliked([]);
              setCardIndex(0);
              setTopMoviePoster(undefined);
              fetchActors();
            }}
          >
            <Text style={styles.buttonText}>Keep Swiping</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Watch or Pass</Text>
      </View>

      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          cards={actors}
          cardIndex={cardIndex}
          renderCard={(actor) => (
            <View style={styles.card}>
              {actor?.image && <Image source={{ uri: actor.image }} style={styles.cardImage} />}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.cardGradient}>
                <View style={styles.cardInfo}>
                  <Text style={styles.actorName}>{actor?.name}</Text>
                </View>
              </LinearGradient>
            </View>
          )}
          onSwipedRight={() => handleSwipe(true)}
          onSwipedLeft={() => handleSwipe(false)}
          stackSize={3}
          disableTopSwipe
          disableBottomSwipe
          backgroundColor="transparent"
          cardVerticalMargin={0}
          cardHorizontalMargin={20}
          animateCardOpacity
          overlayLabels={{
            left: { title: 'Pass', style: { label: styles.overlayLabelLeft, wrapper: styles.overlayWrapperLeft } },
            right: { title: 'Watch', style: { label: styles.overlayLabelRight, wrapper: styles.overlayWrapperRight } }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' },
  gradientContainer: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 10, backgroundColor: 'white', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E8E8E8', width: '100%' },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#FF5864' },
  swiperContainer: { flex: 1, paddingTop: 20, width: '100%' },
  card: { height: height * 0.7, borderRadius: 20, overflow: 'hidden', backgroundColor: 'white', elevation: 8 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', justifyContent: 'flex-end', padding: 20 },
  cardInfo: { marginBottom: 10 },
  actorName: { fontSize: 32, fontWeight: 'bold', color: 'white' },
  recommendationContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  matchText: { fontSize: 48, fontWeight: 'bold', color: 'white' },
  recommendationTitle: { fontSize: 22, color: 'white', marginBottom: 30 },
  poster: { width: 250, height: 350, borderRadius: 20, marginBottom: 30 },
  movieTitle: { fontSize: 24, color: 'white', fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  tinderButton: { backgroundColor: 'white', paddingVertical: 16, paddingHorizontal: 60, borderRadius: 30 },
  buttonText: { color: '#FF5864', fontSize: 18, fontWeight: 'bold' },
  overlayLabelLeft: { borderColor: '#FF6B6B', color: '#FF6B6B', borderWidth: 4, fontSize: 40, fontWeight: 'bold', padding: 8, borderRadius: 8 },
  overlayWrapperLeft: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: 50, marginLeft: -30 },
  overlayLabelRight: { borderColor: '#4ECDC4', color: '#4ECDC4', borderWidth: 4, fontSize: 40, fontWeight: 'bold', padding: 8, borderRadius: 8 },
  overlayWrapperRight: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 50, marginLeft: 30 },
});