import type { Card, CategoryId } from "../data/gameData";

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
