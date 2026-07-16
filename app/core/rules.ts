import { decorationFor, type Card, type CategoryId } from "../data/gameData";

export type EquipmentItem = {
  category: CategoryId;
  grade: string;
  round?: number;
};

export const equipmentGradeRank = (grade: string) =>
  grade === "화려함" ? 3 : grade === "예쁨" ? 2 : grade === "평범함" ? 1 : 0;

export function acquireRoundEquipment(
  collection: EquipmentItem[],
  hand: Card[],
  values: Record<string, number>,
  total: number,
  target: number,
  round: number,
) {
  if (total > target) {
    return { collection, acquired: [] as EquipmentItem[], protected: [] as CategoryId[] };
  }

  let next = [...collection];
  const acquired: EquipmentItem[] = [];
  const protectedCategories: CategoryId[] = [];
  const wornCategories = [...new Set(hand.map((card) => card.category))];

  for (const category of wornCategories) {
    const candidate: EquipmentItem = {
      category,
      grade: decorationFor(values[category] ?? 0),
      round,
    };
    const owned = next.filter((item) => item.category === category);
    const ownedBest = Math.max(-1, ...owned.map((item) => equipmentGradeRank(item.grade)));

    if (ownedBest >= equipmentGradeRank(candidate.grade)) {
      protectedCategories.push(category);
      continue;
    }

    next = next.filter((item) => item.category !== category);
    next.push(candidate);
    acquired.push(candidate);
  }

  return { collection: next, acquired, protected: protectedCategories };
}

export type PlayerResult = { id: number; name: string; total: number };
export function determineRoundWinners(players: PlayerResult[], target: number) {
  const exact = players.filter(p => p.total === target);
  const safe = players.filter(p => p.total < target);
  const pool = exact.length ? exact : safe.length ? safe : players;
  const best = Math.min(...pool.map(p => Math.abs(target - p.total)));
  const winners = pool.filter(p => Math.abs(target - p.total) === best);
  return { winners, reason: exact.length ? "perfect" : safe.length ? "closest-under" : "least-over", details: players.map(p => ({...p, distance: Math.abs(target-p.total), exceeded:p.total>target})) };
}

export function itemValues(placed: Record<string, Card[]>) {
  return Object.fromEntries(Object.entries(placed).map(([id, cards]) => [id, cards.reduce((a,c)=>a+c.number,0)]));
}

export function playerTotal(hand: Card[], values: Record<string, number>) {
  return hand.reduce((sum, card) => sum + (values[card.category] ?? 0), 0);
}

export function nextStarter(oldStarter: number, winnerIds: number[], playerCount: number) {
  for (let n=0; n<playerCount; n++) { const id=(oldStarter+n)%playerCount; if(winnerIds.includes(id)) return id; }
  return oldStarter;
}

export const emptySlots = (ids: readonly {id:CategoryId}[]) => Object.fromEntries(ids.map(c=>[c.id, [] as Card[]]));
