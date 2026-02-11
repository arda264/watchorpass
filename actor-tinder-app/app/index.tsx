// app/swipe.tsx
import axios from "axios";
import React, { useEffect, useState } from "react";
import { 
  Alert, 
  Dimensions, 
  Image, 
  ScrollView, 
  StyleSheet, 
  Text, 
  View,
  TouchableOpacity,
  StatusBar 
} from "react-native";
import Swiper from "react-native-deck-swiper";
import { useRouter } from "expo-router";
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TMDB_API_KEY = "118d6406df6cc4311fb96f3c4e44f65c"

interface Actor {
  name: string;
  image?: string;
}

interface Recommendation {
  Title: string;
}

export default function Swipe() {
  const router = useRouter();
  const [actors, setActors] = useState<Actor[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [topMoviePoster, setTopMoviePoster] = useState<string | undefined>(undefined);
  
  let swiperRef: any = null;

  useEffect(() => {
    fetchActors();
  }, []);

  const fetchActors = async () => {
    try {
      setImagesLoaded(false);
      
      console.log("=== FETCHING ACTORS ===");
      console.log("API_URL:", API_URL);
      
      if (!API_URL) {
        Alert.alert("Configuration Error", "API_URL is not set. Check your environment variables.");
        return;
      }

      console.log("Fetching actor batch from:", `${API_URL}/actor-batch`);
      const res = await axios.get(`${API_URL}/actor-batch`, {
        timeout: 10000,
      });
      
      console.log("✓ Backend response:", res.data);
      const actorNames = res.data.actors;
      console.log("✓ Got", actorNames.length, "actors");

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

      console.log("Preloading images...");
      actorsWithImages.forEach(actor => {
        if (actor.image) {
          Image.prefetch(actor.image).catch(() => {});
        }
      });

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
    
    if (nextIndex === actors.length) {
      onSwipesComplete(newLiked, newDisliked);
      return;
    }
  };

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

  // Loading screen with Tinder-style animation
  if (!imagesLoaded) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.logoContainer}>
          <Text style={styles.loadingLogo}>🎬</Text>
          <Text style={styles.loadingText}>Loading actors...</Text>
        </View>
      </View>
    );
  }

  // Recommendation screen - Tinder match style
  if (recommendations && recommendations.length > 0) {
    const topMovie = recommendations[0];
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={['#FF655B', '#FD297B']}
          style={styles.matchGradient}
        >
          <ScrollView 
            contentContainerStyle={styles.matchContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>We found your perfect movie</Text>
            
            {topMoviePoster && (
              <View style={styles.posterContainer}>
                <Image 
                  source={{ uri: topMoviePoster }} 
                  style={styles.matchPoster} 
                />
              </View>
            )}
            
            <Text style={styles.matchMovieTitle}>{topMovie.Title}</Text>

            <TouchableOpacity 
              style={styles.matchButton}
              onPress={resetApp}
              activeOpacity={0.8}
            >
              <Text style={styles.matchButtonText}>Swipe Again</Text>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  // No recommendations case
  if (recommendations && recommendations.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.noMatchTitle}>No matches found</Text>
        <Text style={styles.noMatchSubtitle}>Try swiping differently</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={resetApp}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main Swiper - Tinder style
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with logo and progress */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>🎬</Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(cardIndex / actors.length) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.headerProgress}>{cardIndex} / {actors.length}</Text>
      </View>

      {/* Swiper Cards */}
      <Swiper
        ref={(swiper) => { swiperRef = swiper; }}
        cards={actors}
        cardIndex={cardIndex}
        renderCard={(actor) => {
          if (!actor) return <View />;
          
          return (
            <View style={styles.card}>
              <View style={styles.cardInner}>
                {actor.image ? (
                  <Image 
                    source={{ uri: actor.image }} 
                    style={styles.cardImage}
                    onError={(e) => console.error(`Image error for ${actor.name}:`, e.nativeEvent.error)}
                  />
                ) : (
                  <View style={[styles.cardImage, styles.noImage]}>
                    <Text style={styles.noImageIcon}>📷</Text>
                    <Text style={styles.noImageText}>No photo</Text>
                  </View>
                )}
                
                {/* Gradient overlay for text readability */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.9)']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{actor.name}</Text>
                  </View>
                </LinearGradient>
              </View>
            </View>
          );
        }}
        onSwipedRight={() => handleSwipe(true)}
        onSwipedLeft={() => handleSwipe(false)}
        stackSize={3}
        stackScale={10}
        stackSeparation={14}
        disableTopSwipe
        disableBottomSwipe
        backgroundColor="transparent"
        cardVerticalMargin={20}
        cardHorizontalMargin={20}
        animateCardOpacity
        overlayLabels={{
          left: {
            title: 'NOPE',
            style: {
              label: {
                backgroundColor: '#FF6B6B',
                color: 'white',
                fontSize: 32,
                fontWeight: 'bold',
                padding: 10,
                borderRadius: 10,
              },
              wrapper: {
                flexDirection: 'column',
                alignItems: 'flex-end',
                justifyContent: 'flex-start',
                marginTop: 30,
                marginLeft: -30,
              }
            }
          },
          right: {
            title: 'LIKE',
            style: {
              label: {
                backgroundColor: '#4ECDC4',
                color: 'white',
                fontSize: 32,
                fontWeight: 'bold',
                padding: 10,
                borderRadius: 10,
              },
              wrapper: {
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                marginTop: 30,
                marginLeft: 30,
              }
            }
          }
        }}
      />

      {/* Bottom action buttons - Tinder style */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.nopeButton]}
          onPress={() => swiperRef?.swipeLeft()}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => swiperRef?.swipeRight()}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>♥</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f10",
  },

  // Loading
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f0f10",
  },
  loadingLogo: { fontSize: 80, marginBottom: 16 },
  loadingText: { color: "white", fontSize: 16, fontWeight: "600", opacity: 0.9 },

  // Header
  header: {
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  headerLogo: {
    fontSize: 30,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 99,
    marginHorizontal: 14,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FF655B",
    borderRadius: 99,
  },
  headerProgress: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "700",
  },

  /**
   * IMPORTANT:
   * - This creates breathing room under the header
   * - AND reserves space at the bottom so the buttons never cover the face/name
   */
  swiperContainer: {
    flex: 1,
    paddingTop: 55,
    paddingHorizontal: 14,
    paddingBottom: 120, // reserve for actionButtons (absolute)
  },

  // Card
  card: {
    alignSelf: "center",
    width: width - 28,
    height: Math.min(height * 0.82, 720),
    borderRadius: 26,
    backgroundColor: "#1b1b1e",
    marginTop: 50,   // ⬅ cleaner spacing

  },
  cardInner: {
    flex: 1,
    borderRadius: 26,
    overflow: "hidden",
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    // Android shadow
    elevation: 10,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },

  // Fallback for no image
  noImage: {
    flex: 1,
    backgroundColor: "#1b1b1e",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageIcon: { fontSize: 56, marginBottom: 10 },
  noImageText: { color: "rgba(255,255,255,0.55)", fontSize: 15 },

  // Bottom gradient area for text
  cardGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    justifyContent: "flex-end",
    paddingBottom: 10,
  },
  cardInfo: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  cardName: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  // Action buttons (pinned to bottom)
  actionButtons: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 18,
    paddingTop: 6,

    flexDirection: "row",
    justifyContent: "center",   // ⬅ center them
    alignItems: "center",
    gap: 60,                    // ⬅ controls distance between buttons

    backgroundColor: "rgba(15,15,16,0.65)",
    zIndex: 50,
  },


  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    // Android shadow
    elevation: 12,
  },
  nopeButton: {
    backgroundColor: "#FF5A5F",
  },
  likeButton: {
    backgroundColor: "#35D0BA",
  },
  actionIcon: {
    fontSize: 32,
    fontWeight: "900",
    color: "white",
  },

  // Match screen (kept mostly as-is, just slightly cleaner)
  matchGradient: { flex: 1 },
  matchContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 40,
  },
  matchTitle: {
    fontSize: 46,
    fontWeight: "900",
    color: "white",
    marginBottom: 10,
    textAlign: "center",
  },
  matchSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 34,
    textAlign: "center",
  },
  posterContainer: {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.5,
  shadowRadius: 20,
  elevation: 10,
  borderRadius: 20,
  overflow: "hidden", 
  },
  matchPoster: { 
    width: 250, 
    height: 350, 
  },
  matchMovieTitle: {
    fontSize: 22,
    color: "white",
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 18,
  },
  matchButton: {
    backgroundColor: "white",
    paddingHorizontal: 46,
    paddingVertical: 16,
    borderRadius: 999,
  },
  matchButtonText: {
    color: "#FD297B",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  // No match
  noMatchTitle: {
    fontSize: 30,
    color: "white",
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  noMatchSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 30,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#FF655B",
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 999,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
});
