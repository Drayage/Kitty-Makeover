"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  categories,
  decorationFor,
  makeDeck,
  playerTrackConfig,
  type Card,
  type CategoryId,
} from "../data/gameData";
import {
  acquireRoundEquipment,
  determineRoundWinners,
  emptySlots,
  equipmentGradeRank,
  itemValues,
  nextStarter,
  playerTotal,
  type EquipmentItem,
} from "../core/rules";
import { categoryVisuals, gradeIndex, themeCopy, visualFor } from "../data/visuals";
import { catExpressionImage, catProfileFor, catProfiles } from "../data/catVisuals";
import {
  clearCloudGame,
  deviceId,
  loadCloudGame,
  loadGameRoom,
  makeRoomCode,
  saveCloudGame,
  saveGameRoom,
  subscribeGameRoom,
} from "../data/firebase";
import { publicPath } from "../lib/publicPath";

type Player = {
  id: number;
  name: string;
  ai: boolean;
  playerKey?: string;
  wins: number;
  hand: Card[];
  collection: EquipmentItem[];
};
type GameScreen = "home" | "setup" | "play" | "final";
type RoundResult = ReturnType<typeof determineRoundWinners>;
type SavedCatLook = {
  id: string;
  savedAt: number;
  catId: string;
  playerName: string;
  wins: number;
  equipment: Partial<Record<CategoryId, string>>;
};
type GameSave = {
  schemaVersion: 3;
  updatedAt: number;
  screen: "play" | "final";
  count: number;
  humanCount: number;
  players: Player[];
  round: number;
  starter: number;
  turn: number;
  target: number;
  placed: Record<string, Card[]>;
  result: RoundResult | null;
  catId: string;
  finalPlayerId: number;
  finalEquipped: Record<number, Partial<Record<CategoryId, number>>>;
};
type SyncState = "idle" | "loading" | "syncing" | "synced" | "offline" | "error";
type OnlineSession = {
  code: string;
  hostId: string;
  playerKey: string;
} | null;

const SAVE_KEY = "cat-dress-save";
const ALBUM_KEY = "kitty-makeover-cat-album";
const defaultFinalEquipment = (players: Player[]) =>
  Object.fromEntries(
    players.map((player) => {
      const slots: Partial<Record<CategoryId, number>> = {};
      player.collection.forEach((item, index) => {
        const currentIndex = slots[item.category];
        if (
          currentIndex === undefined ||
          equipmentGradeRank(item.grade) >
            equipmentGradeRank(player.collection[currentIndex].grade)
        ) {
          slots[item.category] = index;
        }
      });
      return [player.id, slots];
    }),
  ) as Record<number, Partial<Record<CategoryId, number>>>;
const normalizeAlbum = (value: unknown): SavedCatLook[] =>
  Array.isArray(value)
    ? value
        .filter(
          (look): look is SavedCatLook =>
            Boolean(
              look &&
                typeof look === "object" &&
                typeof look.id === "string" &&
                typeof look.catId === "string" &&
                look.equipment &&
                typeof look.equipment === "object",
            ),
        )
        .slice(0, 10)
    : [];
const normalizeSave = (value: unknown): GameSave | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<GameSave>;
  if (!Array.isArray(raw.players) || !raw.players.length) return null;
  if (typeof raw.round !== "number" || typeof raw.target !== "number") return null;

  const normalizedPlayers = raw.players.map((player) => ({
    ...player,
    collection: Array.isArray(player.collection) ? player.collection : [],
  }));
  const playerCount = raw.count ?? normalizedPlayers.length;
  return {
    schemaVersion: 3,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
    screen: raw.screen === "final" ? "final" : "play",
    count: Math.min(6, Math.max(2, playerCount)),
    humanCount:
      raw.humanCount ?? Math.max(1, normalizedPlayers.filter((player) => !player.ai).length),
    players: normalizedPlayers,
    round: raw.round,
    starter: raw.starter ?? 0,
    turn: raw.turn ?? 0,
    target: raw.target,
    placed: raw.placed ?? emptySlots(categories),
    result: raw.result ?? null,
    catId: raw.catId ?? "orange",
    finalPlayerId: raw.finalPlayerId ?? 0,
    finalEquipped:
      raw.screen === "final" && raw.schemaVersion !== 3
        ? defaultFinalEquipment(normalizedPlayers)
        : raw.finalEquipped ?? {},
  };
};
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const catFace = (target: number) =>
  target < 15 ? "− ﻌ −" : target < 27 ? "● ﻌ ●" : "✦ ﻌ ✦";
const collectionGradeIndex = equipmentGradeRank;
const layerPath = (category: CategoryId, grade: number) =>
  category === "body" && grade >= 2
    ? publicPath(`/assets/layers-v2/body-${grade}.webp`)
    : publicPath(`/assets/layers/${category}-${grade}.webp`);

function SavedLookCat({ look, className = "" }: { look: SavedCatLook; className?: string }) {
  const cat = catProfileFor(look.catId);
  return (
    <div
      className={`layered-cat saved-look-cat ${className}`}
      style={{ "--cat-image": `url("${cat.image}")` } as React.CSSProperties}
      role="img"
      aria-label={`${look.playerName}의 저장된 고양이 꾸미기`}
    >
      <span className="cat-base-layer" />
      {categories.map(({ id }) => {
        const grade = look.equipment[id];
        return grade ? (
          <img
            className={`worn-piece worn-${id}`}
            src={layerPath(id, collectionGradeIndex(grade))}
            alt=""
            aria-hidden="true"
            key={id}
          />
        ) : null;
      })}
    </div>
  );
}

export default function CatGame() {
  const [screen, setScreen] = useState<GameScreen>("home");
  const [count, setCount] = useState(3);
  const [humanCount, setHumanCount] = useState(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState(1);
  const [starter, setStarter] = useState(0);
  const [turn, setTurn] = useState(0);
  const [target, setTarget] = useState(18);
  const activeCats = useMemo(
    () => categories.filter((c) => count !== 5 || c.id !== "toy"),
    [count],
  );
  const [placed, setPlaced] = useState<Record<string, Card[]>>(() =>
    emptySlots(categories),
  );
  const [selected, setSelected] = useState<Card | null>(null);
  const [message, setMessage] = useState(
    "카드 한 장을 골라 장식 슬롯에 놓아 주세요.",
  );
  const [result, setResult] = useState<RoundResult | null>(null);
  const [fast, setFast] = useState(false);
  const [sortMode, setSortMode] = useState<"number" | "category">("number");
  const [finalPlayerId, setFinalPlayerId] = useState(0);
  const [finalEquipped, setFinalEquipped] = useState<
    Record<number, Partial<Record<CategoryId, number>>>
  >({});
  const [showFinalCompare, setShowFinalCompare] = useState(false);
  const [album, setAlbum] = useState<SavedCatLook[]>([]);
  const [featuredLook, setFeaturedLook] = useState<SavedCatLook | null>(null);
  const [showAlbum, setShowAlbum] = useState(false);
  const [albumNotice, setAlbumNotice] = useState("");
  const [catId, setCatId] = useState("orange");
  const [resumeSave, setResumeSave] = useState<GameSave | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [onlineSession, setOnlineSession] = useState<OnlineSession>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomNotice, setRoomNotice] = useState("");
  const [roomBusy, setRoomBusy] = useState(false);
  const applyingRemote = useRef(false);
  const currentCat = catProfileFor(catId);
  const catStyle = {
    "--cat-image": `url("${currentCat.image}")`,
  } as React.CSSProperties;
  useEffect(() => {
    const saved = localStorage.getItem("cat-hand-sort");
    if (saved === "number" || saved === "category") setSortMode(saved);

    const savedAlbum = localStorage.getItem(ALBUM_KEY);
    if (savedAlbum) {
      try {
        const looks = normalizeAlbum(JSON.parse(savedAlbum));
        setAlbum(looks);
        if (looks.length) setFeaturedLook(looks[Math.floor(Math.random() * looks.length)]);
      } catch {
        localStorage.removeItem(ALBUM_KEY);
      }
    }

    const local = localStorage.getItem(SAVE_KEY);
    let localSave: GameSave | null = null;
    if (local) {
      try {
        localSave = normalizeSave(JSON.parse(local));
        if (localSave) setResumeSave(localSave);
      } catch {
        localStorage.removeItem(SAVE_KEY);
      }
    }

    let cancelled = false;
    setSyncState(navigator.onLine ? "loading" : "offline");
    void loadCloudGame<GameSave>()
      .then((cloudValue) => {
        if (cancelled) return;
        const cloudSave = normalizeSave(cloudValue);
        if (cloudSave && (!localSave || cloudSave.updatedAt > localSave.updatedAt)) {
          setResumeSave(cloudSave);
          localStorage.setItem(SAVE_KEY, JSON.stringify(cloudSave));
        }
        setSyncState(navigator.onLine ? "synced" : "offline");
      })
      .catch(() => {
        if (!cancelled) setSyncState(navigator.onLine ? "error" : "offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!onlineSession) return;
    setSyncState(navigator.onLine ? "syncing" : "offline");
    const unsubscribe = subscribeGameRoom<GameSave>(onlineSession.code, (room) => {
      if (!room?.game) {
        setRoomNotice("온라인 방을 찾을 수 없어요.");
        setSyncState("error");
        return;
      }
      applyingRemote.current = true;
      resumeGame(normalizeSave(room.game) ?? room.game);
      setSyncState("synced");
      window.setTimeout(() => {
        applyingRemote.current = false;
      }, 0);
    });
    return unsubscribe;
  }, [onlineSession?.code]);
  const totalPlaced = Object.values(placed).reduce((n, a) => n + a.length, 0);
  const needed = activeCats.length * 2;
  const currentId = (starter + turn) % Math.max(count, 1);
  const current = players[currentId];
  const localPlayerKey = onlineSession?.playerKey;
  const localPlayer = localPlayerKey
    ? players.find((player) => player.playerKey === localPlayerKey)
    : null;
  const isHost = Boolean(onlineSession && onlineSession.hostId === localPlayerKey);
  const isOnlineTurn =
    !onlineSession || Boolean(localPlayerKey && current?.playerKey === localPlayerKey);
  const canControlTurn = !onlineSession || Boolean(localPlayerKey && current?.playerKey === localPlayerKey);
  const canAdvanceSharedStep = !onlineSession || isHost;
  const visibleHand = useMemo(
    () =>
      [...(current?.hand ?? [])].sort((a, b) =>
        sortMode === "number"
          ? a.number - b.number || a.category.localeCompare(b.category)
          : activeCats.findIndex((c) => c.id === a.category) -
              activeCats.findIndex((c) => c.id === b.category) || a.number - b.number,
      ),
    [current?.hand, sortMode, activeCats],
  );
  const changeSort = (mode: "number" | "category") => {
    setSortMode(mode);
    localStorage.setItem("cat-hand-sort", mode);
  };

  const resumeGame = (save: GameSave) => {
    setCount(save.count);
    setHumanCount(save.humanCount);
    setPlayers(save.players);
    setRound(save.round);
    setStarter(save.starter);
    setTurn(save.turn);
    setTarget(save.target);
    setPlaced(save.placed);
    setResult(save.result);
    setCatId(save.catId);
    setFinalPlayerId(save.finalPlayerId);
    setFinalEquipped(save.finalEquipped);
    setSelected(null);
    setScreen(save.screen);
  };

  const deal = (ps: Player[]) => {
    const deck = shuffle(makeDeck(count));
    let p = 0;
    return ps.map((x) => {
      const n = playerTrackConfig[count][Math.min(x.wins, 2)].dealtCards;
      const hand = deck.slice(p, p + n);
      p += n;
      return { ...x, hand };
    });
  };
  const startGame = () => {
    setOnlineSession(null);
    const gameCat = catProfiles[Math.floor(Math.random() * catProfiles.length)];
    const ps = Array.from({ length: count }, (_, i) => ({
      id: i,
      name: i < humanCount ? `집사 ${i + 1}` : `AI ${i - humanCount + 1}`,
      ai: i >= humanCount,
      wins: 0,
      hand: [],
      collection: [],
    }));
    setPlayers(deal(ps));
    setRound(1);
    setStarter(0);
    setTurn(0);
    setTarget(12 + Math.floor(Math.random() * 19));
    setPlaced(emptySlots(activeCats));
    setResult(null);
    setFinalPlayerId(0);
    setFinalEquipped({});
    setShowFinalCompare(false);
    setCatId(gameCat.id);
    setMessage(`이번 게임의 고양이는 ${gameCat.name}! 꾸미기 카드를 골라주세요.`);
    setScreen("play");
  };

  const createOnlineGame = async () => {
    if (!navigator.onLine) {
      setRoomNotice("온라인 상태에서만 방을 만들 수 있어요.");
      return;
    }
    setRoomBusy(true);
    setRoomNotice("온라인 방 만드는 중...");
    try {
      const playerKey = deviceId();
      const code = makeRoomCode();
      const gameCat = catProfiles[Math.floor(Math.random() * catProfiles.length)];
      const firstTarget = 12 + Math.floor(Math.random() * 19);
      const onlinePlayers: Player[] = Array.from({ length: count }, (_, i) => ({
        id: i,
        name:
          i < humanCount
            ? i === 0
              ? `집사 ${i + 1}`
              : `대기중 ${i + 1}`
            : `AI ${i - humanCount + 1}`,
        ai: i >= humanCount,
        playerKey: i === 0 ? playerKey : undefined,
        wins: 0,
        hand: [],
        collection: [],
      }));
      const save: GameSave = {
        schemaVersion: 3,
        updatedAt: Date.now(),
        screen: "play",
        count,
        humanCount,
        players: deal(onlinePlayers),
        round: 1,
        starter: 0,
        turn: 0,
        target: firstTarget,
        placed: emptySlots(activeCats),
        result: null,
        catId: gameCat.id,
        finalPlayerId: 0,
        finalEquipped: {},
      };
      await saveGameRoom<GameSave>({ code, hostId: playerKey, updatedAt: Date.now(), game: save });
      setOnlineSession({ code, hostId: playerKey, playerKey });
      setRoomNotice(`온라인 방 ${code} 생성됨`);
      window.alert(`온라인 방이 만들어졌어요.\n방 코드: ${code}`);
      resumeGame(save);
    } catch (error) {
      setRoomNotice(`방 만들기 실패: ${error instanceof Error ? error.message : "Firebase 연결을 확인해 주세요."}`);
    } finally {
      setRoomBusy(false);
    }
  };

  const joinOnlineGame = async () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setRoomNotice("방 코드를 입력해 주세요.");
      return;
    }
    setRoomBusy(true);
    setRoomNotice("온라인 방 찾는 중...");
    try {
      const room = await loadGameRoom<GameSave>(code);
      const save = normalizeSave(room?.game);
      if (!room || !save) {
        setRoomNotice("방을 찾을 수 없어요.");
        return;
      }
      const playerKey = deviceId();
      const alreadyJoined = save.players.some((player) => player.playerKey === playerKey);
      let joined = alreadyJoined;
      const playersWithSeat = save.players.map((player) => {
        if (joined || player.ai || player.playerKey) return player;
        joined = true;
        return { ...player, name: `집사 ${player.id + 1}`, playerKey };
      });
      if (!joined) {
        setRoomNotice("참가 가능한 사람 슬롯이 없어요.");
        return;
      }
      const nextSave = { ...save, players: playersWithSeat, updatedAt: Date.now() };
      await saveGameRoom<GameSave>({ ...room, game: nextSave });
      setOnlineSession({ code: room.code, hostId: room.hostId, playerKey });
      setRoomNotice(`온라인 방 ${room.code} 참가됨`);
      resumeGame(nextSave);
    } catch (error) {
      setRoomNotice(`참가 실패: ${error instanceof Error ? error.message : "Firebase 연결을 확인해 주세요."}`);
    } finally {
      setRoomBusy(false);
    }
  };

  const place = (cat: CategoryId) => {
    if (!canControlTurn) return;
    if (!selected || placed[cat].length >= 2) return;
    const ps = players.map((p, i) =>
      i === currentId
        ? { ...p, hand: p.hand.filter((c) => c.id !== selected.id) }
        : p,
    );
    setPlayers(ps);
    setPlaced({ ...placed, [cat]: [...placed[cat], selected] });
    setSelected(null);
    setTurn((t) => t + 1);
    setMessage("다음 집사의 차례예요.");
  };
  useEffect(() => {
    if (screen !== "play" || !current?.ai || (onlineSession && !isHost) || totalPlaced >= needed || result)
      return;
    const timer = setTimeout(() => {
      const card = current.hand[0];
      const open = activeCats.filter((c) => placed[c.id].length < 2);
      if (card && open.length) {
        setSelected(card);
        setTimeout(() => {
          const cat = open.reduce((a, b) =>
            Math.abs(
              placed[a.id].reduce((s, c) => s + c.number, 0) +
                card.number -
                target,
            ) <
            Math.abs(
              placed[b.id].reduce((s, c) => s + c.number, 0) +
                card.number -
                target,
            )
              ? a
              : b,
          ).id;
          setPlayers((ps) =>
            ps.map((p, i) =>
              i === currentId
                ? { ...p, hand: p.hand.filter((c) => c.id !== card.id) }
                : p,
            ),
          );
          setPlaced((v) => ({ ...v, [cat]: [...v[cat], card] }));
          setSelected(null);
          setTurn((t) => t + 1);
        }, 350);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [screen, currentId, totalPlaced, result]);

  const score = () => {
    if (!canAdvanceSharedStep) return;
    const values = itemValues(placed);
    const rows = players.map((p) => ({
      id: p.id,
      name: p.name,
      total: playerTotal(p.hand, values),
    }));
    const r = determineRoundWinners(rows, target);
    setResult(r);
    setPlayers((ps) =>
      ps.map((p) => {
        const playerRow = rows.find((row) => row.id === p.id)!;
        const equipment = acquireRoundEquipment(
          p.collection,
          p.hand,
          values,
          playerRow.total,
          target,
          round,
        );
        return {
          ...p,
          wins: p.wins + (r.winners.some((winner) => winner.id === p.id) ? 1 : 0),
          collection: equipment.collection,
        };
      }),
    );
  };
  useEffect(() => {
    if (totalPlaced === needed && !result) {
      setMessage("모든 슬롯이 찼어요. 꾸미기 강도를 계산해 볼까요?");
    }
  }, [totalPlaced, needed, result]);
  const nextRound = () => {
    if (!canAdvanceSharedStep) return;
    const ids = result!.winners.map((w) => w.id);
    const updated = players;
    if (round >= 7 || updated.some((p) => p.wins >= 3)) {
      setFinalPlayerId(updated.find((player) => !player.ai)?.id ?? updated[0]?.id ?? 0);
      setFinalEquipped(defaultFinalEquipment(updated));
      setScreen("final");
      return;
    }
    setStarter(nextStarter(starter, ids, count));
    setRound((r) => r + 1);
    setTurn(0);
    setTarget(12 + Math.floor(Math.random() * 19));
    setPlaced(emptySlots(activeCats));
    setPlayers(deal(updated));
    setResult(null);
    setMessage("새로운 고양이의 기분이 공개됐어요!");
  };
  const reset = () => {
    localStorage.removeItem(SAVE_KEY);
    setResumeSave(null);
    void clearCloudGame()
      .catch(() => undefined)
      .finally(() => location.reload());
  };
  useEffect(() => {
    if ((screen !== "play" && screen !== "final") || !players.length) return;
    if (applyingRemote.current) return;

    const save: GameSave = {
      schemaVersion: 3,
      updatedAt: Date.now(),
      screen,
      count,
      humanCount,
      players,
      round,
      starter,
      turn,
      target,
      placed,
      result,
      catId,
      finalPlayerId,
      finalEquipped,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    setResumeSave(save);
    setSyncState(navigator.onLine ? "syncing" : "offline");
    const timer = window.setTimeout(() => {
      const sync = onlineSession
        ? saveGameRoom<GameSave>({
            code: onlineSession.code,
            hostId: onlineSession.hostId,
            updatedAt: Date.now(),
            game: save,
          })
        : saveCloudGame(save);
      void sync
        .then((saved) => setSyncState(saved ? "synced" : "offline"))
        .catch(() => setSyncState(navigator.onLine ? "error" : "offline"));
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    screen,
    count,
    humanCount,
    players,
    round,
    starter,
    turn,
    target,
    placed,
    result,
    catId,
    finalPlayerId,
    finalEquipped,
    onlineSession,
  ]);

  if (screen === "home")
    return (
      <main className="landing">
        <div className="paw-bg" aria-hidden>
          · · ·
        </div>
        <div className="logo">
          <span>✦</span> 오늘도 <b>냥꾸</b>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">A COZY CAT DRESS-UP GAME</p>
          <h1>
            오늘 기분에 딱 맞게,
            <br />
            <em>우리 고양이</em>를 꾸며 주세요.
          </h1>
          <p>
            장식의 화려함을 조절해 고양이의 마음을 사로잡는
            <br />
            2–6인 로컬 보드게임
          </p>
          <div className="home-actions">
            <button
              className="primary chunky"
              onClick={() => setScreen("setup")}
            >
              <span className="btn-icon">▶</span>
              <span>
                <small>새로운 꾸미기</small>새 게임 시작
              </span>
              <b>→</b>
            </button>
            <button
              className="secondary chunky"
              onClick={() =>
                resumeSave ? resumeGame(resumeSave) : alert("저장된 게임이 아직 없어요.")
              }
              disabled={!resumeSave && syncState !== "loading"}
            >
              <span className="btn-icon">↻</span>
              <span>
                <small>지난 게임</small>이어하기
              </span>
            </button>
          </div>
          <div className="online-join">
            <label htmlFor="room-code">온라인 방 코드</label>
            <div>
              <input
                id="room-code"
                value={roomCodeInput}
                onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                placeholder="예: A7K2Q"
                maxLength={8}
              />
              <button onClick={joinOnlineGame} disabled={roomBusy}>
                {roomBusy ? "확인 중" : "참가"}
              </button>
            </div>
            {roomNotice && <small aria-live="polite">{roomNotice}</small>}
          </div>
          <nav>
            <button
              onClick={() =>
                alert(
                  "카드 숫자로 장식 가치를 높이고, 손에 남긴 장식 종류의 가치를 합쳐 목표에 가장 가깝게 맞추세요.",
                )
              }
            >
              ▤ 규칙 보기
            </button>
            <button onClick={() => setFast((v) => !v)}>
              ⚙ {fast ? "빠른 연출" : "설정"}
            </button>
            <button onClick={() => setShowAlbum(true)}>
              ▦ 내 냥꾸 도감 {album.length}/10
            </button>
            <span className={`sync-status ${syncState}`} aria-live="polite">
              {syncState === "loading" && "저장 확인 중"}
              {syncState === "syncing" && "클라우드 저장 중"}
              {syncState === "synced" && "클라우드 저장됨"}
              {syncState === "offline" && "기기에 안전하게 저장됨"}
              {syncState === "error" && "기기 저장 사용 중"}
            </span>
          </nav>
        </div>
        <div className="hero-stage" aria-label={featuredLook ? "내 냥꾸 도감에서 고른 대표 고양이" : "리본과 방울로 꾸민 대표 고양이"}>
          <span className="float deco-ribbon">⋈</span>
          <span className="float deco-star">✦</span>
          <span className="float deco-ball">●</span>
          {featuredLook ? (
            <>
              <SavedLookCat look={featuredLook} className="hero-saved-cat" />
              <span className="featured-look-label">내 도감에서 찾아온 {featuredLook.playerName}의 고양이</span>
            </>
          ) : (
            <img className="consistent-cat hero-consistent-cat" src={publicPath("/assets/cat-base.webp")} alt="오늘도 냥꾸의 주황색 고양이" />
          )}
          <div className="fabric-shadow" />
        </div>
        {showAlbum && (
          <div className="album-backdrop" role="presentation" onMouseDown={() => setShowAlbum(false)}>
            <section
              className="album-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="album-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="album-heading">
                <div>
                  <p className="eyebrow">MY CAT COLLECTION</p>
                  <h2 id="album-title">나의 냥꾸 도감</h2>
                </div>
                <button className="album-close" onClick={() => setShowAlbum(false)} aria-label="도감 닫기">×</button>
              </div>
              <p className="album-guide">파이널 드레싱룸에서 저장한 고양이를 최신순으로 10마리까지 간직해요.</p>
              {album.length ? (
                <div className="album-grid">
                  {album.map((look, index) => (
                    <article key={look.id}>
                      <span className="album-number">NO. {String(album.length - index).padStart(2, "0")}</span>
                      <SavedLookCat look={look} />
                      <strong>{catProfileFor(look.catId).name}</strong>
                      <small>{look.playerName} · 만족도 {look.wins} · 장식 {Object.keys(look.equipment).length}개</small>
                      <button
                        className="album-feature"
                        onClick={() => {
                          setFeaturedLook(look);
                          setShowAlbum(false);
                        }}
                      >
                        타이틀에 보여주기
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="album-empty">
                  <span aria-hidden="true">♡</span>
                  <strong>아직 저장한 고양이가 없어요.</strong>
                  <p>게임을 끝낸 뒤 내 고양이를 도감에 저장해 보세요.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    );
  if (screen === "setup")
    return (
      <main className="setup">
        <button className="back" onClick={() => setScreen("home")}>
          ←
        </button>
        <p className="eyebrow">GAME SETUP</p>
        <h1>
          함께 꾸밀 집사를
          <br />
          초대해 주세요.
        </h1>
        <section>
          <label>
            전체 플레이어 <b>{count}명</b>
          </label>
          <input
            type="range"
            min="2"
            max="6"
            value={count}
            onChange={(e) => {
              setCount(+e.target.value);
              setHumanCount((h) => Math.min(h, +e.target.value));
            }}
          />
        </section>
        <section>
          <label>
            사람 플레이어 <b>{humanCount}명</b>
          </label>
          <div className="stepper">
            <button onClick={() => setHumanCount(Math.max(1, humanCount - 1))}>
              −
            </button>
            <strong>{humanCount}</strong>
            <button
              onClick={() => setHumanCount(Math.min(count, humanCount + 1))}
            >
              ＋
            </button>
          </div>
          <small>나머지 {count - humanCount}명은 AI 집사가 참여해요.</small>
        </section>
        <button className="primary" onClick={startGame}>
          고양이 만나러 가기 →
        </button>
        <button className="secondary online-create" onClick={createOnlineGame} disabled={roomBusy}>
          {roomBusy ? "방 만드는 중..." : "온라인 방 만들기"}
        </button>
        {roomNotice && <p className="room-notice" aria-live="polite">{roomNotice}</p>}
      </main>
    );
  if (screen === "final") {
    const max = Math.max(...players.map((p) => p.wins));
    const finalPlayer = players.find((p) => p.id === finalPlayerId) ?? players[0];
    const equippedFor = (player: Player) =>
      Object.values(finalEquipped[player.id] ?? {})
        .filter((index): index is number => typeof index === "number")
        .map((index) => player.collection[index])
        .filter(Boolean);
    const toggleFinalItem = (player: Player, category: CategoryId, index: number) => {
      setFinalEquipped((previous) => {
        const nextSlots = { ...(previous[player.id] ?? {}) };
        if (nextSlots[category] === index) delete nextSlots[category];
        else nextSlots[category] = index;
        return { ...previous, [player.id]: nextSlots };
      });
    };
    const saveFinalLook = () => {
      if (finalPlayer.ai) {
        setAlbumNotice("사람 플레이어의 고양이만 내 도감에 저장할 수 있어요.");
        return;
      }
      const equipment = Object.fromEntries(
        equippedFor(finalPlayer).map((item) => [item.category, item.grade]),
      ) as Partial<Record<CategoryId, string>>;
      const look: SavedCatLook = {
        id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${finalPlayer.id}`,
        savedAt: Date.now(),
        catId,
        playerName: finalPlayer.name,
        wins: finalPlayer.wins,
        equipment,
      };
      const nextAlbum = [look, ...album].slice(0, 10);
      localStorage.setItem(ALBUM_KEY, JSON.stringify(nextAlbum));
      setAlbum(nextAlbum);
      setFeaturedLook(look);
      setAlbumNotice(`도감에 저장했어요. ${nextAlbum.length}/10`);
    };
    return (
      <main className="final" style={catStyle}>
        <p className="eyebrow">FINAL DRESSING ROOM</p>
        <h1>오늘의 냥꾸 완성!</h1>
        <div className="dresser">
          <div className="player-tabs">
            {players.map((p) => (
              <button
                key={p.id}
                className={p.id === finalPlayer.id ? "active" : ""}
                onClick={() => setFinalPlayerId(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="final-cat-stage">
            <div className="layered-cat final-layered-cat" role="img" aria-label={`${finalPlayer.name}의 장식 미리보기`}>
              <span className="cat-base-layer" />
              {equippedFor(finalPlayer).map((item) => (
                <img
                  className={`worn-piece worn-${item.category}`}
                  src={layerPath(item.category, collectionGradeIndex(item.grade))}
                  alt=""
                  aria-hidden="true"
                  key={item.category}
                />
              ))}
            </div>
            <p>장식을 탭해 장착·해제하세요. 같은 위치는 자동 교체돼요.</p>
          </div>
          <div className="wardrobe">
            <h2>획득한 장식</h2>
            <p className="wardrobe-rule">목표를 초과하지 않은 라운드에서 손에 남겨 착용한 장식을 얻어요. 같은 부위는 가장 높은 등급만 남아요.</p>
            {finalPlayer.collection.length ? (
              finalPlayer.collection.map((x, i) => (
                <button
                  className={`item-chip ${finalEquipped[finalPlayer.id]?.[x.category] === i ? "active" : ""}`}
                  key={`${x.category}-${i}`}
                  onClick={() => toggleFinalItem(finalPlayer, x.category, i)}
                  aria-pressed={finalEquipped[finalPlayer.id]?.[x.category] === i}
                >
                  <b>{categoryVisuals[x.category].icon}</b>
                  <span>
                    {categoryVisuals[x.category].names[collectionGradeIndex(x.grade)]}
                    <small>{x.grade} · {x.round ? `${x.round}라운드 획득` : "이전 게임 획득"}</small>
                  </span>
                </button>
              ))
            ) : (
              <p className="empty-note">획득한 장식이 없어요.</p>
            )}
            <button className="compare" onClick={() => setShowFinalCompare((shown) => !shown)}>
              {showFinalCompare ? "비교 닫기" : "◫ 모두 비교하기"}
            </button>
            <button className="save-look" onClick={saveFinalLook} disabled={finalPlayer.ai}>
              ♡ 이 모습 도감에 저장
            </button>
            {albumNotice && <span className="album-notice" aria-live="polite">{albumNotice}</span>}
          </div>
        </div>
        {showFinalCompare && <div className="final-grid">
          {[...players]
            .sort((a, b) => b.wins - a.wins)
            .map((p, rank) => (
              <article className={p.wins === max ? "winner" : ""} key={p.id}>
                <span className="rank">{rank + 1}</span>
                <div className="layered-cat final-rank-cat" role="img" aria-label={`${p.name}의 최종 꾸미기`}>
                  <span className="cat-base-layer" />
                  {equippedFor(p).map((item) => (
                    <img
                      className={`worn-piece worn-${item.category}`}
                      src={layerPath(item.category, collectionGradeIndex(item.grade))}
                      alt=""
                      aria-hidden="true"
                      key={item.category}
                    />
                  ))}
                </div>
                <h2>{p.name}</h2>
                <p aria-label={`만족도 ${p.wins}`}>
                  {"♥".repeat(p.wins)}
                  {"♡".repeat(3 - p.wins)}
                </p>
              </article>
            ))}
        </div>}
        <button className="primary" onClick={reset}>
          새 게임 시작
        </button>
      </main>
    );
  }
  const values = itemValues(placed);
  const projectedScore = current ? playerTotal(current.hand, values) : 0;
  const scoreBreakdown = current
    ? activeCats
        .map((cat) => ({
          cat,
          count: current.hand.filter((card) => card.category === cat.id).length,
          value: values[cat.id] ?? 0,
        }))
        .filter((row) => row.count > 0)
    : [];
  const mood =
    target < 15
      ? themeCopy.moods.low
      : target < 27
        ? themeCopy.moods.mid
        : themeCopy.moods.high;
  return (
    <main className="game" style={catStyle}>
      <header>
        <div className="round-pill">
          <b>ROUND {round}</b>
          <span> / 7</span>
        </div>
        <div className="turn-head">
          <span>🐾</span>
          <strong>{current?.name}의 차례</strong>
          <small>
            {selected ? themeCopy.actions.place : themeCopy.actions.pick}
          </small>
        </div>
        <button
          aria-label="게임 메뉴"
          onClick={() => confirm("게임을 처음부터 시작할까요?") && reset()}
        >
          •••
        </button>
      </header>
      {onlineSession && (
        <section className="online-room-bar" aria-live="polite">
          <strong>온라인 방 {onlineSession.code}</strong>
          <span>
            내 슬롯: {localPlayer?.name ?? "관전"} · {isHost ? "방장" : "참가자"}
          </span>
          {!isOnlineTurn && <em>{current?.name}의 선택을 기다리는 중</em>}
        </section>
      )}
      <section className="table-layout">
        <aside className="mood-panel">
          <div className="mood-cat">
            <img className="consistent-cat mood-consistent-cat" src={currentCat.image} alt={`${mood.name} 기분의 ${currentCat.alt}`} />
            <div className="speech">“{mood.bubble}”</div>
          </div>
          <p><small className="game-cat-label">이번 고양이 · {currentCat.name}</small>{mood.name}</p>
          <div className="target-number">
            <span>꾸미기 허용치</span>
            <strong>{target}</strong>
          </div>
          <div className="pretty-track" aria-label={`꾸미기 허용치 ${target}`}>
            <span>수수함</span>
            <i
              style={
                {
                  "--target": `${(Math.min(target, 40) / 40) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span>화려함</span>
          </div>
        </aside>
        <section className="board">
          <div className="board-title">
            <span>고양이의 드레스룸</span>
            <small>카드를 놓을 장식을 선택하세요</small>
          </div>
          <div className="board-center-note">
            <span>✦</span>
            <strong>장식 카드를 놓아<br />가치를 완성하세요</strong>
            <small>{totalPlaced} / {needed}장 배치됨</small>
          </div>
          <div className="slots">
            {activeCats.map((cat, index) => {
              const v = values[cat.id] || 0;
              const vis = visualFor(cat.id, v);
              return (
                <button
                  aria-label={`${cat.name}, 현재 가치 ${v}, 빈 슬롯 ${2 - placed[cat.id].length}`}
                  key={cat.id}
                  className={`decor-slot pos-${index} grade-${vis.grade} ${placed[cat.id].length === 2 ? "full" : ""} ${selected && placed[cat.id].length < 2 ? "available" : ""}`}
                  onClick={() => place(cat.id)}
                  style={
                    {
                      "--cat": vis.color,
                      "--soft": vis.soft,
                      "--value-scale": `${1 + Math.min(v, 12) * 0.012}`,
                    } as React.CSSProperties
                  }
                >
                  <span className="quality">{"✦".repeat(vis.grade)}</span>
                    <div className="slot-icon">
                      <img className={`slot-grade-image slot-grade-${cat.id}`} src={layerPath(cat.id, vis.grade)} alt="" aria-hidden="true" />
                    </div>
                  <div>
                    <h3>{cat.name}</h3>
                    <small>{vis.name}</small>
                  </div>
                  <strong>{v}</strong>
                  <div className="cards">
                    {placed[cat.id].map((c) => (
                      <span key={c.id}>{c.number}</span>
                    ))}
                    {Array.from(
                      { length: 2 - placed[cat.id].length },
                      (_, i) => (
                        <span className="empty" key={i}>
                          ＋
                        </span>
                      ),
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="player-panel">
          <h2>집사 현황</h2>
          {players.map((p, i) => (
            <article className={i === currentId ? "active" : ""} key={p.id}>
              <div className="avatar">{p.ai ? "⌁" : "●"}</div>
              <div>
                <strong>
                  {i === currentId && "🐾 "}
                  {p.name}
                </strong>
                <small>
                  {p.ai ? "AI 집사" : "사람 집사"} · 카드 {p.hand.length}장
                </small>
              </div>
              <b aria-label={`${p.wins}승`}>
                {"♥".repeat(p.wins)}
                {"♡".repeat(3 - p.wins)}
              </b>
            </article>
          ))}
        </aside>
      </section>
      {!result && totalPlaced < needed && current && !current.ai && canControlTurn && (
        <footer>
          <div className="action-copy">
            <b>
              {selected
                ? "이 장식을 어디에 놓을까요?"
                : "꾸미기 카드 한 장을 골라주세요."}
            </b>
            <span>
              {selected
                ? "빛나는 장식 슬롯을 선택하면 바로 놓여요."
                : "숫자가 장식의 가치를 높여요."}
            </span>
            <div className="projected-score" title="손에 남은 카드의 장식 종류를 현재 장식 가치로 계산한 점수입니다.">
              <span>현재 예상 점수</span><strong>{projectedScore}</strong>
              <small>{scoreBreakdown.length ? scoreBreakdown.map(({ cat, count, value }) => `${cat.name} ${value}×${count}`).join(" + ") : "계산할 장식이 없어요"}</small>
            </div>
            <div className="sort-controls" aria-label="손패 정렬">
              <button className={sortMode === "number" ? "active" : ""} onClick={() => changeSort("number")}>123 숫자순</button>
              <button className={sortMode === "category" ? "active" : ""} onClick={() => changeSort("category")}>▦ 종류순</button>
            </div>
          </div>
          <div className="hand">
            {visibleHand.map((c) => {
              const vis = categoryVisuals[c.category];
              const centralValue = values[c.category] ?? 0;
              const cardGrade = gradeIndex(centralValue);
              return (
                <button
                  aria-label={`${categories.find((x) => x.id === c.category)?.name} 카드, 숫자 ${c.number}, 중앙 가치 ${centralValue}, ${vis.names[cardGrade]}`}
                  title={`${categories.find((x) => x.id === c.category)?.name} · 카드 숫자 ${c.number} · 중앙 가치 ${centralValue}`}
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={selected?.id === c.id ? "selected" : ""}
                  style={
                    {
                      "--cat": vis.color,
                      "--soft": vis.soft,
                      "--card-value-scale": `${0.82 + Math.min(centralValue, 12) * 0.025}`,
                    } as React.CSSProperties
                  }
                >
                  <small>
                    {categories.find((x) => x.id === c.category)?.name}
                  </small>
                  <strong>{c.number}</strong>
                    <img className={`card-asset card-asset-${c.category} card-value-grade-${cardGrade}`} src={layerPath(c.category, cardGrade)} alt="" aria-hidden="true" />
                  <em>{vis.names[cardGrade]}</em>
                </button>
              );
            })}
          </div>
        </footer>
      )}
      {!result && totalPlaced === needed && canAdvanceSharedStep && (
        <button className="floating primary" onClick={score}>
          ✦ 꾸미기 결과 계산
        </button>
      )}
      {!result && totalPlaced === needed && !canAdvanceSharedStep && (
        <div className="floating wait-chip">방장이 결과를 계산하는 중</div>
      )}
      {result && (
        <div
          className={`result ${result.reason}`}
          role="dialog"
          aria-modal="true"
        >
          <div className="result-spark">✦</div>
          <p>
            {result.reason === "perfect"
              ? "완벽한 꾸미기!"
              : result.reason === "closest-under"
                ? "딱 부담스럽지 않을 만큼 예뻐!"
                : "조금 과했지만 가장 가까워요"}
          </p>
          <h2>{result.winners.map((w) => w.name).join(", ")} 승리</h2>
          <div className="round-looks">
            {result.details.map((d) => {
              const p = players.find((x) => x.id === d.id)!;
              const won = result.winners.some((w) => w.id === d.id);
              const reaction = d.exceeded ? "upset" : won ? "happy" : "neutral";
              const wornCategories = [...new Set(p.hand.map((card) => card.category))];
              const acquiredThisRound = p.collection.filter((item) => item.round === round);
              return <article className={won ? "won" : ""} key={d.id}>
                <div className={`layered-cat reaction-${reaction} ${d.exceeded ? "over" : ""}`} role="img" aria-label={`${d.name}의 완성 꾸미기, ${reaction === "happy" ? "기쁜" : reaction === "upset" ? "불편한" : "편안한"} 표정`}>
                  <span className="cat-base-layer" style={{ backgroundImage: `url("${catExpressionImage(currentCat, reaction)}")` }} />
                  {wornCategories.map((id) => {
                    const grade = gradeIndex(values[id] ?? 0);
                    return <img className={`worn-piece worn-${id}`} src={layerPath(id, grade)} alt={`${categories.find((c) => c.id === id)?.name}, ${decorationFor(values[id] ?? 0)} 등급`} key={id} />;
                  })}
                </div>
                <strong>{d.name}</strong>
                <span className="look-score">꾸미기 강도 {d.total}</span>
                <span className={`reaction-copy ${reaction}`}>{reaction === "happy" ? "기분 최고!" : reaction === "upset" ? "조금 부담스러워…" : "편안해 보여요"}</span>
                <small>목표와 {d.distance} 차이 {d.exceeded ? "· 조금 과함" : "· 부담 없음"}</small>
                <span className={`round-acquire ${d.exceeded ? "none" : ""}`}>
                  {d.exceeded
                    ? "장식 획득 없음"
                    : acquiredThisRound.length
                      ? `획득: ${acquiredThisRound.map((item) => categoryVisuals[item.category].names[collectionGradeIndex(item.grade)]).join(", ")}`
                      : "보유 장식이 같거나 더 높은 등급이에요"}
                </span>
              </article>;
            })}
          </div>
          <div className="reward">🎁 승패와 관계없이 목표를 넘지 않은 집사는 착용 장식을 획득해요</div>
          {canAdvanceSharedStep ? (
            <button className="primary" onClick={nextRound}>
              {round >= 7 || players.some((p) => p.wins >= 3)
                ? "최종 꾸미기 보기"
                : "다음 라운드 →"}
            </button>
          ) : (
            <div className="wait-chip">방장이 다음 단계로 넘기는 중</div>
          )}
        </div>
      )}
    </main>
  );
}
