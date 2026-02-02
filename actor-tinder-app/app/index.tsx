// app/index.tsx
import axios from "axios";
import React, { useEffect, useState } from "react";
import { Button, Dimensions, Image, ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import Swiper from "react-native-deck-swiper";
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get("window");
const API_URL = process.env.EXPO_PUBLIC_API_URL; // replace with your backend IP
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
  const swiperRef = React.useRef<any>(null);

  // Fetch exactly 30 actors and preload images
  const fetchActors = async () => {
    const batch: Actor[] = [];
    for (let i = 0; i < 30; i++) {
      try {
        const res = await axios.get(`${API_URL}/actor`);
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
    console.log(`Swiped ${likedActor ? "right" : "left"} on ${actor.name}`);
    // Trigger recommendations only after last card
    if (nextIndex === actors.length) {
      onSwipesComplete();
    }
  };

  // Recommendations
  const onSwipesComplete = async () => {
    const payload = { liked_actors: liked, disliked_actors: disliked };
    try {
      const res = await axios.post(`${API_URL}/recommend`, payload);
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
        <Text style={{ color: "#FF6B6B", fontSize: 18 }}>Loading actors...</Text>
      </View>
    );
  }

  // Recommendation screen
  if (recommendations && recommendations.length > 0) {
    const topMovie = recommendations[0];
    return (
      <LinearGradient
        colors={['#FD297B', '#FF5864', '#FF655B']}
        style={styles.gradientContainer}
      >
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
              setActors([]);
              setImagesLoaded(false);
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

  // Swiper
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Watch or Pass</Text>
      </View>

      {/* Cards */}
      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          cards={actors}
          cardIndex={cardIndex}
          renderCard={(actor) => (
            <View style={styles.card}>
              {actor.image && (
                <Image source={{ uri: actor.image }} style={styles.cardImage} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.9)']}
                style={styles.cardGradient}
              >
                <View style={styles.cardInfo}>
                  <Text style={styles.actorName}>{actor.name}</Text>
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
            left: {
              title: 'Pass',
              style: {
                label: {
                  backgroundColor: 'transparent',
                  borderColor: '#FF6B6B',
                  color: '#FF6B6B',
                  borderWidth: 4,
                  fontSize: 40,
                  fontWeight: 'bold',
                  padding: 8,
                  borderRadius: 8,
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 50,
                  marginLeft: -30,
                }
              }
            },
            right: {
              title: 'Watch',
              style: {
                label: {
                  backgroundColor: 'transparent',
                  borderColor: '#4ECDC4',
                  color: '#4ECDC4',
                  borderWidth: 4,
                  fontSize: 40,
                  fontWeight: 'bold',
                  padding: 8,
                  borderRadius: 8,
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 50,
                  marginLeft: 30,
                }
              }
            },
          }}
        />
      </View>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  gradientContainer: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF5864',
  },
  swiperContainer: {
    flex: 1,
    paddingTop: 20,
  },
  card: {
    height: height * 0.7,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    justifyContent: 'flex-end',
    padding: 20,
  },
  cardInfo: {
    marginBottom: 10,
  },
  actorName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  recommendationContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  matchText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  recommendationTitle: {
    fontSize: 22,
    color: 'white',
    marginBottom: 30,
    fontWeight: '600',
  },
  poster: {
    width: 250,
    height: 350,
    borderRadius: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  movieTitle: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  tinderButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  buttonText: {
    color: '#FF5864',
    fontSize: 18,
    fontWeight: 'bold',
  },
});