import type { CategoryId } from "./gameData";

export const themeCopy = {
  moods: {
    low: { name: "느긋한 오후", face: "− ﻌ −", bubble: "오늘은 가볍게만 꾸며줘." },
    mid: { name: "기분 좋은 산책", face: "● ﻌ ●", bubble: "조금 더 예쁘게 해도 좋아." },
    high: { name: "특별한 날", face: "✦ ﻌ ✦", bubble: "오늘은 화려하게 꾸미고 싶어!" },
  },
  actions: {
    pick: "꾸미기 카드 한 장을 골라주세요.",
    place: "카드를 놓을 장식 슬롯을 선택해주세요.",
    waiting: "다음 집사에게 화면을 넘겨주세요.",
  },
};

export const categoryVisuals: Record<CategoryId, { color:string; soft:string; icon:string; names:string[]; slot:string }> = {
  head:{color:"#c96f63",soft:"#fae5df",icon:"♛",names:["종이 왕관","체크 리본","꽃 머리띠","보석 왕관"],slot:"head"},
  ears:{color:"#8f79b5",soft:"#eee8f7",icon:"✦",names:["실핀","작은 리본","별 귀걸이","달빛 티아라"],slot:"ears"},
  neck:{color:"#498f83",soft:"#ddf0eb",icon:"●",names:["늘어난 끈","손수건","방울 목걸이","보석 초커"],slot:"neck"},
  face:{color:"#dc8b55",soft:"#f9eadb",icon:"✿",names:["낙서 점","볼 스티커","꽃 페이스참","반짝 메이크업"],slot:"face"},
  body:{color:"#6485ad",soft:"#e2ebf6",icon:"◆",names:["헌 천","줄무늬 조끼","프릴 케이프","왕실 망토"],slot:"body"},
  toy:{color:"#b38645",soft:"#f5ecd8",icon:"★",names:["실뭉치","깃털 낚싯대","별 쿠션","황금 물고기"],slot:"paw"},
};

export const gradeIndex=(value:number)=>value>=10?3:value>=7?2:value>=4?1:0;
export const visualFor=(id:CategoryId,value:number)=>({ ...categoryVisuals[id], grade:gradeIndex(value), name:categoryVisuals[id].names[gradeIndex(value)] });

// 실제 에셋 연결 지점. 값이 비어 있으면 CSS 고양이/장식 플레이스홀더를 사용한다.
export const assetPaths = { cats:{default:""}, decorations:{} as Record<string,string> };
