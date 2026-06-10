'use client';
import { useEffect, useState } from 'react';
import { Onboarding } from '@/components/Onboarding';
import { Dashboard } from '@/components/Dashboard';
import { isOnboardingComplete } from '@/lib/storage';

export default function Home() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    setOnboarded(isOnboardingComplete());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return <Dashboard />;
}
