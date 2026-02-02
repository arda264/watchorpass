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
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
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
      Alert.alert("Connection Error", "Could not reach the backend server. Please check your connection.");
    }
  };

  useEffect(() => {
    // Validate API_URL is configured
    if (!API_URL) {
      Alert.alert(
        "Configuration Error", 
        "API URL is not configured. Please check your .env file and ensure EXPO_PUBLIC_API_URL is set."
      );
      return;
    }
    fetchActors();
  }, []);

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
      return; // Prevent further execution
    }
  };

  const onSwipesComplete = async (finalLiked: string[], finalDisliked: string[]) => {
    setIsLoadingRecs(true);
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
      Alert.alert(
        "Error", 
        "Failed to get recommendations. Please try again.",
        [
          {
            text: "Retry",
            onPress: () => {
              setRecommendations(null);
              setLiked([]);
              setDisliked([]);
              setCardIndex(0);
              fetchActors();
            }
          }
        ]
      );
    } finally {
      setIsLoadingRecs(false);
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

  const resetApp = () => {
    setRecommendations(null);
    setLiked([]);
    setDisliked([]);
    setCardIndex(0);
    setTopMoviePoster(undefined);
    fetchActors();
  };

  // Loading state
  if (!imagesLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading actors...</Text>
      </View>
    );
  }

  // Loading recommendations
  if (isLoadingRecs) {
    return (
      <LinearGradient colors={['#FD297B', '#FF5864', '#FF655B']} style={styles.gradientContainer}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingRecsText}>Finding your perfect match...</Text>
        </View>
      </LinearGradient>
    );
  }

  // Show recommendations if available
  if (recommendations && recommendations.length > 0) {
    const topMovie = recommendations[0];
    return (
      <LinearGradient colors={['#FD297B', '#FF5864', '#FF655B']} style={styles.gradientContainer}>
        <ScrollView contentContainerStyle={styles.recommendationContainer}>
          <Text style={styles.matchText}>It's a Match!</Text>
          <Text style={styles.recommendationTitle}>Your Top Movie</Text>
          {topMoviePoster && <Image source={{ uri: topMoviePoster }} style={styles.poster} />}
          <Text style={styles.movieTitle}>{topMovie.title}</Text>
          <Text style={styles.genreText}>{topMovie.Genres}</Text>
          
          <TouchableOpacity style={styles.tinderButton} onPress={resetApp}>
            <Text style={styles.buttonText}>Keep Swiping</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  // Handle empty recommendations
  if (recommendations && recommendations.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noMatchText}>No matches found 😔</Text>
        <Text style={styles.noMatchSubtext}>Try swiping on different actors!</Text>
        <TouchableOpacity style={[styles.tinderButton, { backgroundColor: '#FF5864' }]} onPress={resetApp}>
          <Text style={[styles.buttonText, { color: 'white' }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main swiper view
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
          renderCard={(actor) => {
            // Safety check for undefined actors
            if (!actor) return <View />;
            
            return (
              <View style={styles.card}>
                {actor.image && <Image source={{ uri: actor.image }} style={styles.cardImage} />}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.cardGradient}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.actorName}>{actor.name}</Text>
                  </View>
                </LinearGradient>
              </View>
            );
          }}
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
            left: { 
              title: 'PASS', 
              style: { 
                label: styles.overlayLabelLeft, 
                wrapper: styles.overlayWrapperLeft 
              } 
            },
            right: { 
              title: 'WATCH', 
              style: { 
                label: styles.overlayLabelRight, 
                wrapper: styles.overlayWrapperRight 
              } 
            }
          }}
        />
      </View>

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
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
    backgroundColor: '#FAFAFA', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  gradientContainer: { 
    flex: 1 
  },
  header: { 
    paddingTop: 50, 
    paddingBottom: 10, 
    backgroundColor: 'white', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E8E8E8', 
    width: '100%' 
  },
  logo: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#FF5864' 
  },
  swiperContainer: { 
    flex: 1, 
    paddingTop: 20, 
    width: '100%' 
  },
  card: { 
    height: height * 0.7, 
    borderRadius: 20, 
    overflow: 'hidden', 
    backgroundColor: 'white', 
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardImage: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },
  cardGradient: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    height: '40%', 
    justifyContent: 'flex-end', 
    padding: 20 
  },
  cardInfo: { 
    marginBottom: 10 
  },
  actorName: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: 'white' 
  },
  recommendationContainer: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 30 
  },
  matchText: { 
    fontSize: 48, 
    fontWeight: 'bold', 
    color: 'white',
    marginBottom: 10
  },
  recommendationTitle: { 
    fontSize: 22, 
    color: 'white', 
    marginBottom: 30,
    opacity: 0.9
  },
  poster: { 
    width: 250, 
    height: 350, 
    borderRadius: 20, 
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  movieTitle: { 
    fontSize: 24, 
    color: 'white', 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginBottom: 10,
    paddingHorizontal: 20
  },
  genreText: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20
  },
  tinderButton: { 
    backgroundColor: 'white', 
    paddingVertical: 16, 
    paddingHorizontal: 60, 
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: { 
    color: '#FF5864', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  overlayLabelLeft: { 
    borderColor: '#FF6B6B', 
    color: '#FF6B6B', 
    borderWidth: 4, 
    fontSize: 40, 
    fontWeight: 'bold', 
    padding: 8, 
    borderRadius: 8 
  },
  overlayWrapperLeft: { 
    flexDirection: 'column', 
    alignItems: 'flex-end', 
    justifyContent: 'flex-start', 
    marginTop: 50, 
    marginLeft: -30 
  },
  overlayLabelRight: { 
    borderColor: '#4ECDC4', 
    color: '#4ECDC4', 
    borderWidth: 4, 
    fontSize: 40, 
    fontWeight: 'bold', 
    padding: 8, 
    borderRadius: 8 
  },
  overlayWrapperRight: { 
    flexDirection: 'column', 
    alignItems: 'flex-start', 
    justifyContent: 'flex-start', 
    marginTop: 50, 
    marginLeft: 30 
  },
  progressContainer: {
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  progressText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600'
  },
  loadingText: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '600'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingRecsText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 40
  },
  noMatchText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 10,
    textAlign: 'center'
  },
  noMatchSubtext: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    paddingHorizontal: 40
  }
});