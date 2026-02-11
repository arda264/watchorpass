// app/intro.tsx
import React, { useState, useEffect } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

export default function Intro() {
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleStart = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      router.push("/swipe");
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.logo}>🎬</Text>
      <Text style={styles.title}>WatchOrPass</Text>
      
      <View style={styles.tagline}>
        <Text style={styles.taglineText}>Swipe on actors.</Text>
        <Text style={styles.taglineText}>Discover movies.</Text>
      </View>
      
      <View style={styles.instructions}>
        <View style={styles.instructionRow}>
          <Text style={styles.instructionEmoji}>👉</Text>
          <Text style={styles.instructionText}>Like</Text>
        </View>
        <View style={styles.instructionRow}>
          <Text style={styles.instructionEmoji}>👈</Text>
          <Text style={styles.instructionText}>Pass</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.startButton}
        onPress={handleStart}
        activeOpacity={0.8}
      >
        <Text style={styles.startButtonText}>Get Started</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Swipe through 30 actors</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#e50914",
    marginBottom: 20,
    letterSpacing: 2,
  },
  tagline: {
    marginBottom: 60,
  },
  taglineText: {
    fontSize: 20,
    color: "#fff",
    textAlign: "center",
    marginVertical: 5,
    opacity: 0.9,
  },
  instructions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 60,
    paddingHorizontal: 40,
  },
  instructionRow: {
    alignItems: "center",
  },
  instructionEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  startButton: {
    backgroundColor: "#e50914",
    paddingHorizontal: 50,
    paddingVertical: 18,
    borderRadius: 30,
    marginBottom: 30,
    elevation: 5,
    shadowColor: "#e50914",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  footer: {
    fontSize: 14,
    color: "#999",
    position: "absolute",
    bottom: 40,
  },
});