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

function deviceId() {
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
