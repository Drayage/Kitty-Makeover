export const catProfiles = [
  { id: "orange", name: "단풍이", image: "/assets/cat-base.webp", happy: "/assets/cats/orange-happy.webp", upset: "/assets/cats/orange-upset.webp", alt: "주황 줄무늬 고양이" },
  { id: "silver", name: "구름이", image: "/assets/cats/silver.webp", happy: "/assets/cats/silver-happy.webp", upset: "/assets/cats/silver-upset.webp", alt: "은회색 줄무늬 고양이" },
  { id: "tuxedo", name: "양말이", image: "/assets/cats/tuxedo.webp", happy: "/assets/cats/tuxedo-happy.webp", upset: "/assets/cats/tuxedo-upset.webp", alt: "검정과 흰색 턱시도 고양이" },
  { id: "calico", name: "삼색이", image: "/assets/cats/calico.webp", happy: "/assets/cats/calico-happy.webp", upset: "/assets/cats/calico-upset.webp", alt: "주황 검정 흰색 삼색 고양이" },
  { id: "cream", name: "라떼", image: "/assets/cats/cream.webp", happy: "/assets/cats/cream-happy.webp", upset: "/assets/cats/cream-upset.webp", alt: "부드러운 크림색 고양이" },
] as const;

export type CatProfileId = (typeof catProfiles)[number]["id"];

export const catProfileFor = (id: string) =>
  catProfiles.find((cat) => cat.id === id) ?? catProfiles[0];

export const catExpressionImage = (
  cat: (typeof catProfiles)[number],
  reaction: "neutral" | "happy" | "upset",
) => reaction === "happy" ? cat.happy : reaction === "upset" ? cat.upset : cat.image;
