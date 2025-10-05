// app/index.tsx
import axios from "axios";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { Button, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Swiper from "react-native-deck-swiper";

const API_URL = "http://YOUR_PC_IP:8000"; // replace with your backend IP

export default function Home() {
  const [actors, setActors] = useState([
    {
      name: "Tom Hanks",
      image: "https://media.gettyimages.com/id/1720836528/photo/actor-tom-hanks-backstage-at-the-shrine-auditorium-during-the-67th-annual-academy-awards.jpg?s=612x612&w=gi&k=20&c=oClFQmaakeFjOArIFcm4BouLnvU1xN15TFOBuIDUV8Q="
    },
    {
      name: "Scarlett Johansson",
      image: "https://upload.wikimedia.org/wikipedia/commons/8/87/Scarlett_Johansson_in_Kuwait_01b.jpg"
    }
  ]);

  const [recommendation, setRecommendation] = useState<{ title: string; poster: string; description: string } | null>(null);

  const onSwipeRight = async (cardIndex: number) => {
    const actor = actors[cardIndex];
    await axios.post(`${API_URL}/like`, { actor: actor.name });
  };

  const onSwipeLeft = async (cardIndex: number) => {
    const actor = actors[cardIndex];
    await axios.post(`${API_URL}/dislike`, { actor: actor.name });
  };

  const onSwipesComplete = async () => {
    try {
      const response = await axios.get(`${API_URL}/recommendation`);
      setRecommendation(response.data);
    } catch (error) {
      console.error("Failed to fetch recommendation", error);
    }
  };

  if (recommendation) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />
        <Image source={{ uri: recommendation.poster }} style={styles.poster} />
        <Text style={styles.title}>{recommendation.title}</Text>
        <Text style={styles.description}>{recommendation.description}</Text>
        <Button title="Back to Swipe" onPress={() => {
          setRecommendation(null);
          setActors([...actors]);
        }} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />
      <Swiper
        cards={actors}
        renderCard={(actor) => (
          <View style={styles.card}>
            <Image source={{ uri: actor.image }} style={styles.image} />
            <Text style={styles.name}>{actor.name}</Text>
          </View>
        )}
        onSwipedRight={onSwipeRight}
        onSwipedLeft={onSwipeLeft}
        onSwipedAll={onSwipesComplete}
        stackSize={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, alignItems: "center" },
  image: { width: 300, height: 400, borderRadius: 12 },
  name: { marginTop: 10, fontSize: 22, fontWeight: "bold" },
  poster: { width: 250, height: 350, borderRadius: 12, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10, textAlign: "center", color: "#fff" },
  description: { fontSize: 16, textAlign: "center", marginBottom: 20, color: "#fff" },
});
