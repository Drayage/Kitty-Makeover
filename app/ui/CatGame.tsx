"use client";
import { useEffect, useMemo, useState } from "react";
import {
  categories,
  decorationFor,
  makeDeck,
  playerTrackConfig,
  type Card,
  type CategoryId,
} from "../data/gameData";
import {
  determineRoundWinners,
  emptySlots,
  itemValues,
  nextStarter,
  playerTotal,
} from "../core/rules";
import { categoryVisuals, gradeIndex, themeCopy, visualFor } from "../data/visuals";
import { catExpressionImage, catProfileFor, catProfiles } from "../data/catVisuals";
import { clearCloudGame, loadCloudGame, saveCloudGame } from "../data/firebase";
import { publicPath } from "../lib/publicPath";

type Player = {
  id: number;
  name: string;
  ai: boolean;
  wins: number;
  hand: Card[];
  collection: { category: CategoryId; grade: string; round?: number }[];
};
type GameScreen = "home" | "setup" | "play" | "final";
type RoundResult = ReturnType<typeof determineRoundWinners>;
type GameSave = {
  schemaVersion: 2;
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

const SAVE_KEY = "cat-dress-save";
const normalizeSave = (value: unknown): GameSave | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<GameSave>;
  if (!Array.isArray(raw.players) || !raw.players.length) return null;
  if (typeof raw.round !== "number" || typeof raw.target !== "number") return null;

  const playerCount = raw.count ?? raw.players.length;
  return {
    schemaVersion: 2,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
    screen: raw.screen === "final" ? "final" : "play",
    count: Math.min(6, Math.max(2, playerCount)),
    humanCount:
      raw.humanCount ?? Math.max(1, raw.players.filter((player) => !player.ai).length),
    players: raw.players,
    round: raw.round,
    starter: raw.starter ?? 0,
    turn: raw.turn ?? 0,
    target: raw.target,
    placed: raw.placed ?? emptySlots(categories),
    result: raw.result ?? null,
    catId: raw.catId ?? "orange",
    finalPlayerId: raw.finalPlayerId ?? 0,
    finalEquipped: raw.finalEquipped ?? {},
  };
};
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const catFace = (target: number) =>
  target < 15 ? "− ﻌ −" : target < 27 ? "● ﻌ ●" : "✦ ﻌ ✦";
const collectionGradeIndex = (grade: string) =>
  grade === "화려함" ? 3 : grade === "예쁨" ? 2 : grade === "평범함" ? 1 : 0;
const layerPath = (category: CategoryId, grade: number) =>
  category === "body" && grade >= 2
    ? publicPath(`/assets/layers-v2/body-${grade}.webp`)
    : publicPath(`/assets/layers/${category}-${grade}.webp`);

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
  const [catId, setCatId] = useState("orange");
  const [resumeSave, setResumeSave] = useState<GameSave | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const currentCat = catProfileFor(catId);
  const catStyle = {
    "--cat-image": `url("${currentCat.image}")`,
  } as React.CSSProperties;
  useEffect(() => {
    const saved = localStorage.getItem("cat-hand-sort");
    if (saved === "number" || saved === "category") setSortMode(saved);

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
  const totalPlaced = Object.values(placed).reduce((n, a) => n + a.length, 0);
  const needed = activeCats.length * 2;
  const currentId = (starter + turn) % Math.max(count, 1);
  const current = players[currentId];
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

  const place = (cat: CategoryId) => {
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
    if (screen !== "play" || !current?.ai || totalPlaced >= needed || result)
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
    const values = itemValues(placed);
    const rows = players.map((p) => ({
      id: p.id,
      name: p.name,
      total: playerTotal(p.hand, values),
    }));
    const r = determineRoundWinners(rows, target);
    setResult(r);
    setPlayers((ps) =>
      ps.map((p) =>
        r.winners.some((w) => w.id === p.id)
          ? {
              ...p,
              wins: p.wins + 1,
              collection: [
                ...p.collection,
                {
                  category: p.hand[0]?.category ?? "head",
                  grade: decorationFor(values[p.hand[0]?.category] ?? 0),
                  round,
                },
              ],
            }
          : p,
      ),
    );
  };
  useEffect(() => {
    if (totalPlaced === needed && !result) {
      setMessage("모든 슬롯이 찼어요. 꾸미기 강도를 계산해 볼까요?");
    }
  }, [totalPlaced, needed, result]);
  const nextRound = () => {
    const ids = result!.winners.map((w) => w.id);
    const updated = players;
    if (round >= 7 || updated.some((p) => p.wins >= 3)) {
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

    const save: GameSave = {
      schemaVersion: 2,
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
      void saveCloudGame(save)
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
            <span className={`sync-status ${syncState}`} aria-live="polite">
              {syncState === "loading" && "저장 확인 중"}
              {syncState === "syncing" && "클라우드 저장 중"}
              {syncState === "synced" && "클라우드 저장됨"}
              {syncState === "offline" && "기기에 안전하게 저장됨"}
              {syncState === "error" && "기기 저장 사용 중"}
            </span>
          </nav>
        </div>
        <div className="hero-stage" aria-label="리본과 방울로 꾸민 대표 고양이">
          <span className="float deco-ribbon">⋈</span>
          <span className="float deco-star">✦</span>
          <span className="float deco-ball">●</span>
          <img className="consistent-cat hero-consistent-cat" src={publicPath("/assets/cat-base.webp")} alt="오늘도 냥꾸의 주황색 고양이" />
          <div className="fabric-shadow" />
        </div>
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
            <p className="wardrobe-rule">라운드 승자의 남은 첫 카드 종류를 획득하며, 그 장식의 이번 가치로 등급이 정해져요.</p>
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
                    <small>{x.grade} · {x.round ? `${x.round}라운드 승리 보상` : "승리 보상"}</small>
                  </span>
                </button>
              ))
            ) : (
              <p className="empty-note">획득한 장식이 없어요.</p>
            )}
            <button className="compare" onClick={() => setShowFinalCompare((shown) => !shown)}>
              {showFinalCompare ? "비교 닫기" : "◫ 모두 비교하기"}
            </button>
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
      {!result && totalPlaced < needed && current && !current.ai && (
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
      {!result && totalPlaced === needed && (
        <button className="floating primary" onClick={score}>
          ✦ 꾸미기 결과 계산
        </button>
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
              </article>;
            })}
          </div>
          <div className="reward">🎁 승리한 집사는 새 장식을 획득했어요</div>
          <button className="primary" onClick={nextRound}>
            {round >= 7 || players.some((p) => p.wins >= 3)
              ? "최종 꾸미기 보기"
              : "다음 라운드 →"}
          </button>
        </div>
      )}
    </main>
  );
}
