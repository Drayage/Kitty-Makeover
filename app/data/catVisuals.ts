import { publicPath } from "../lib/publicPath";

export const catProfiles = [
  { id: "orange", name: "단풍이", image: publicPath("/assets/cat-base.webp"), happy: publicPath("/assets/cats/orange-happy.webp"), upset: publicPath("/assets/cats/orange-upset.webp"), alt: "주황 줄무늬 고양이" },
  { id: "silver", name: "구름이", image: publicPath("/assets/cats/silver.webp"), happy: publicPath("/assets/cats/silver-happy.webp"), upset: publicPath("/assets/cats/silver-upset.webp"), alt: "은회색 줄무늬 고양이" },
  { id: "tuxedo", name: "양말이", image: publicPath("/assets/cats/tuxedo.webp"), happy: publicPath("/assets/cats/tuxedo-happy.webp"), upset: publicPath("/assets/cats/tuxedo-upset.webp"), alt: "검정과 흰색 턱시도 고양이" },
  { id: "calico", name: "삼색이", image: publicPath("/assets/cats/calico.webp"), happy: publicPath("/assets/cats/calico-happy.webp"), upset: publicPath("/assets/cats/calico-upset.webp"), alt: "주황 검정 흰색 삼색 고양이" },
  { id: "cream", name: "라떼", image: publicPath("/assets/cats/cream.webp"), happy: publicPath("/assets/cats/cream-happy.webp"), upset: publicPath("/assets/cats/cream-upset.webp"), alt: "부드러운 크림색 고양이" },
] as const;

export type CatProfileId = (typeof catProfiles)[number]["id"];

export const catProfileFor = (id: string) =>
  catProfiles.find((cat) => cat.id === id) ?? catProfiles[0];

export const catExpressionImage = (
  cat: (typeof catProfiles)[number],
  reaction: "neutral" | "happy" | "upset",
) => reaction === "happy" ? cat.happy : reaction === "upset" ? cat.upset : cat.image;
