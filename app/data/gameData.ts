export const categories = [
  { id: "head", name: "머리 장식", icon: "♛" },
  { id: "ears", name: "귀 장식", icon: "✦" },
  { id: "neck", name: "목 장식", icon: "●" },
  { id: "face", name: "얼굴 장식", icon: "✿" },
  { id: "body", name: "몸 장식", icon: "◆" },
  { id: "toy", name: "앞발 장난감", icon: "★" },
] as const;

export type CategoryId = typeof categories[number]["id"];
export type Card = { id: string; number: number; category: CategoryId };

// 규칙서의 플레이어 카드 트랙: [받는 카드, 라운드 종료 시 남는 카드]
export const playerTrackConfig: Record<number, Record<number, { dealtCards: number; remainingCards: number }>> = {
  2: { 0:{dealtCards:9,remainingCards:3}, 1:{dealtCards:10,remainingCards:4}, 2:{dealtCards:11,remainingCards:5} },
  3: { 0:{dealtCards:7,remainingCards:3}, 1:{dealtCards:8,remainingCards:4}, 2:{dealtCards:9,remainingCards:5} },
  4: { 0:{dealtCards:6,remainingCards:3}, 1:{dealtCards:7,remainingCards:4}, 2:{dealtCards:8,remainingCards:5} },
  5: { 0:{dealtCards:5,remainingCards:3}, 1:{dealtCards:6,remainingCards:4}, 2:{dealtCards:7,remainingCards:5} },
  6: { 0:{dealtCards:5,remainingCards:3}, 1:{dealtCards:6,remainingCards:4}, 2:{dealtCards:7,remainingCards:5} },
};

export const makeDeck = (count: number): Card[] => categories
  .filter(c => count !== 5 || c.id !== "toy")
  .flatMap((c, ci) => Array.from({ length: 7 }, (_, i) => ({ id: `${c.id}-${i}`, number: (i + ci * 2) % 6, category: c.id })));

export const decorationFor = (value: number) => value >= 10 ? "화려함" : value >= 7 ? "예쁨" : value >= 4 ? "평범함" : "허술함";
