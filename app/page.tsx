"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onboardingStore } from "@/store/onboardingStore";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (onboardingStore.completed) {
      router.replace("/dashboard");
    } else {
      router.replace("/welcome");
    }
  }, [router]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-daw-bg text-gray-400">
      Loading...
    </div>
  );
}
