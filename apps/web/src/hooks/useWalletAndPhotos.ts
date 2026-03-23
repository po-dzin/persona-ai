import { useCallback, useEffect, useRef, useState } from "react";

import { getBalance, getPhotos, type PhotoRecord, type Wallet } from "../utils/api";

const FALLBACK_WALLET: Wallet = {
  free_credit_available: true,
  paid_credits: 0,
};

// Poll faster while a photo is processing, slower when all done
const POLL_FAST_MS = 3000;
const POLL_IDLE_MS = 15000;

export function useWalletAndPhotos(userId: string) {
  const [wallet, setWallet] = useState<Wallet>(FALLBACK_WALLET);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextWallet, nextPhotos] = await Promise.all([
        getBalance(userId),
        getPhotos(userId),
      ]);
      setWallet(nextWallet);
      setPhotos(nextPhotos);
      return nextPhotos;
    } catch {
      // Keep last known state if backend is unavailable
      return null;
    }
  }, [userId]);

  const scheduleNext = useCallback(
    (currentPhotos: PhotoRecord[] | null) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const hasProcessing = currentPhotos?.some(
        (p) => p.status === "processing" || p.status === "queued",
      );
      const delay = hasProcessing ? POLL_FAST_MS : POLL_IDLE_MS;
      intervalRef.current = setInterval(() => {
        void refresh().then(scheduleNext);
      }, delay);
    },
    [refresh],
  );

  useEffect(() => {
    void refresh().then(scheduleNext);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, refresh, scheduleNext]);

  return { wallet, photos, refresh, setWallet, setPhotos };
}
