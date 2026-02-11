// app/index.tsx
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to intro page on app launch
    router.replace("/intro");
  }, []);

  return null;
}