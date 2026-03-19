import { useEffect, useState } from "react";

import { getBalance, getPhotos, type PhotoRecord, type Wallet } from "../utils/api";

const FALLBACK_WALLET: Wallet = {
  free_credit_available: true,
  paid_credits: 47,
};

export function useWalletAndPhotos(userId: string) {
  const [wallet, setWallet] = useState<Wallet>(FALLBACK_WALLET);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);

  const refresh = async () => {
    try {
      const [nextWallet, nextPhotos] = await Promise.all([getBalance(userId), getPhotos(userId)]);
      setWallet(nextWallet);
      setPhotos(nextPhotos);
    } catch {
      // Keep last known state if backend is unavailable.
    }
  };

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(interval);
    // userId is stable for one app session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { wallet, photos, refresh, setWallet, setPhotos };
}
