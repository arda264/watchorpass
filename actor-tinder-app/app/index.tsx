// app/index.tsx
import axios from "axios";
import React, { useEffect, useState } from "react";
import { Button, Dimensions, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Swiper from "react-native-deck-swiper";

const { width, height } = Dimensions.get("window");
const API_URL = "http://YOUR_PC_IP:8000"; // replace with your backend IP

interface Actor {
  name: string;
  image?: string;
}

export default function Home() {
  const [actors, setActors] = useState<Actor[]>([
    { name: "Tom Hanks" },
    { name: "Scarlett Johansson" },
    { name: "Denzel Washington" },
    { name: "Natalie Portman" },
    { name: "Tilda Swinton" },
  ]);

  const [recommendation, setRecommendation] = useState<{ title: string; poster: string; description: string } | null>(null);

  // Fetch images from Wikimedia
  useEffect(() => {
    async function fetchImages() {
      const updatedActors = await Promise.all(
        actors.map(async (actor) => {
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
      setActors(updatedActors);
    }

    fetchImages();
  }, []);

  const onSwipeRight = (index: number) => {
    console.log("Liked:", actors[index].name);
  };

  const onSwipeLeft = (index: number) => {
    console.log("Disliked:", actors[index].name);
  };

  const onSwipesComplete = () => {
    setRecommendation({
      title: "Buckaroo Banzai",
      poster: "https://upload.wikimedia.org/wikipedia/en/b/ba/Adventures_of_buckaroo_banzai.jpg",
      description: "The Adventures of Buckaroo Banzai Across the 8th Dimension stands as one of the greatest cult films ever made because it defies every genre convention with gleeful confidence. Blending sci-fi, comedy, adventure, and rockn roll, it creates a world so bizarre yet sincere that it feels both absurd and brilliant. Peter Wellers Buckaroo — a neurosurgeon, physicist, and rock star — embodies pure 1980s cool, while the films deadpan humor and wild imagination make it endlessly rewatchable. Its not just a movie; its a celebration of creative chaos and the timeless truth: No matter where you go, there you are. Also, Ian's favorite movie.",
    });
  };

  if (recommendation) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Image source={{ uri: recommendation.poster }} style={styles.poster} />
        <Text style={styles.title}>{recommendation.title}</Text>
        <Text style={styles.description}>{recommendation.description}</Text>
        <Button title="Back to Swipe" onPress={() => setRecommendation(null)} />
      </ScrollView>
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
  alignSelf: "center",

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
  poster: {
    width: 250,
    height: 350,
    borderRadius: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
    color: "#fff",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#fff",
  },
});
