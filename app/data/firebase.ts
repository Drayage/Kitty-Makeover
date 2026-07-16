import { getApps, initializeApp } from "firebase/app";
import { get, getDatabase, ref, remove, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDnEYQRvb16iW0HZyq4bgrvtnPysDbeFBc",
  authDomain: "frenzy-49857.firebaseapp.com",
  databaseURL: "https://frenzy-49857-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "frenzy-49857",
  storageBucket: "frenzy-49857.firebasestorage.app",
  messagingSenderId: "256453631137",
  appId: "1:256453631137:web:2491ec1d53b065e744a4e0",
};

export const FIREBASE_GAME_ROOT = "games/kitty-makeover";
const DEVICE_ID_KEY = "kitty-makeover-device-id";

export function deviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing && /^[a-zA-Z0-9-]{12,64}$/.test(existing)) return existing;

  const next = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function gameSaveRef() {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  return ref(getDatabase(app), `${FIREBASE_GAME_ROOT}/saves/${deviceId()}`);
}

function roomUrl(code: string) {
  return `${firebaseConfig.databaseURL}/${FIREBASE_GAME_ROOT}/rooms/${code}.json`;
}

export async function saveCloudGame<T extends object>(data: T) {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  await set(gameSaveRef(), data);
  return true;
}

export async function loadCloudGame<T>() {
  if (typeof window === "undefined" || !navigator.onLine) return null;
  const snapshot = await get(gameSaveRef());
  return snapshot.exists() ? (snapshot.val() as T) : null;
}

export async function clearCloudGame() {
  if (typeof window === "undefined" || !navigator.onLine) return;
  await remove(gameSaveRef());
}

export type OnlineRoom<T> = {
  code: string;
  hostId: string;
  updatedAt: number;
  game: T;
};

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export async function saveGameRoom<T extends object>(room: OnlineRoom<T>) {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  const response = await fetch(roomUrl(room.code), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...room, updatedAt: Date.now() }),
  });
  if (!response.ok) throw new Error(`Firebase ${response.status}`);
  return true;
}

export async function loadGameRoom<T>(code: string) {
  if (typeof window === "undefined" || !navigator.onLine) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(normalized)) return null;
  const response = await fetch(roomUrl(normalized), { cache: "no-store" });
  if (!response.ok) throw new Error(`Firebase ${response.status}`);
  return (await response.json()) as OnlineRoom<T> | null;
}

export function subscribeGameRoom<T>(
  code: string,
  callback: (room: OnlineRoom<T> | null) => void,
) {
  const normalized = code.trim().toUpperCase();
  if (typeof window === "undefined" || !/^[A-Z0-9]{4,8}$/.test(normalized)) return () => undefined;
  let active = true;
  const read = async () => {
    try {
      callback(await loadGameRoom<T>(normalized));
    } catch {
      callback(null);
    }
  };
  void read();
  const timer = window.setInterval(() => {
    if (active) void read();
  }, 1000);
  return () => {
    active = false;
    window.clearInterval(timer);
  };
}
