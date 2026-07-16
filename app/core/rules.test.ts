import test from "node:test";
import assert from "node:assert/strict";
import { acquireRoundEquipment, determineRoundWinners, nextStarter, playerTotal } from "./rules";
import { makeDeck, playerTrackConfig, type Card } from "../data/gameData";

test("정확히 목표에 도착한 플레이어가 승리한다",()=>assert.deepEqual(determineRoundWinners([{id:0,name:"A",total:18},{id:1,name:"B",total:17}],18).winners.map(x=>x.id),[0]));
test("목표 이하 중 가장 가까운 공동 승리",()=>assert.deepEqual(determineRoundWinners([{id:0,name:"A",total:15},{id:1,name:"B",total:15},{id:2,name:"C",total:19}],18).winners.map(x=>x.id),[0,1]));
test("모두 초과하면 절대 거리가 가장 작은 플레이어",()=>assert.equal(determineRoundWinners([{id:0,name:"A",total:17},{id:1,name:"B",total:18}],15).winners[0].id,0));
test("공동 승리 후 이전 시작 플레이어부터 가장 가까운 승자",()=>assert.equal(nextStarter(2,[0,3],4),3));
test("같은 장식 종류는 가치가 중복 합산된다",()=>{const hand=[{category:"head"},{category:"head"},{category:"neck"}] as Card[];assert.equal(playerTotal(hand,{head:6,neck:4}),16)});
test("5인 게임은 앞발 장난감 7장을 제외한다",()=>{assert.equal(makeDeck(5).length,35);assert.equal(makeDeck(5).some(c=>c.category==="toy"),false)});
for(const n of [2,3,4,5,6]) test(`${n}인 카드 배분은 필요한 카드 배치 수와 일치`,()=>{const t=playerTrackConfig[n][0];assert.equal((t.dealtCards-t.remainingCards)*n,n===5?10:12)});
test("승리 트랙마다 배분 및 잔여 카드가 한 장씩 증가",()=>{for(const n of [2,3,4,5,6]){assert.equal(playerTrackConfig[n][1].dealtCards,playerTrackConfig[n][0].dealtCards+1);assert.equal(playerTrackConfig[n][2].remainingCards,playerTrackConfig[n][0].remainingCards+2)}});
test("목표 이하라면 승패와 무관하게 착용한 장식을 모두 획득한다",()=>{const hand=[{category:"head"},{category:"neck"}] as Card[];const result=acquireRoundEquipment([],hand,{head:7,neck:4},12,18,2);assert.deepEqual(result.acquired.map(x=>x.category),["head","neck"])});
test("목표를 초과하면 장식을 획득하지 않는다",()=>{const hand=[{category:"head"}] as Card[];assert.equal(acquireRoundEquipment([],hand,{head:10},20,18,1).acquired.length,0)});
test("이미 가진 상위 등급 장식은 하위 장식으로 바뀌지 않는다",()=>{const hand=[{category:"head"}] as Card[];const owned=[{category:"head",grade:"화려함",round:1}] as const;const result=acquireRoundEquipment([...owned],hand,{head:4},4,18,2);assert.equal(result.collection[0].grade,"화려함");assert.deepEqual(result.protected,["head"])});
test("더 높은 등급을 얻으면 같은 부위의 낮은 장식을 교체한다",()=>{const hand=[{category:"head"}] as Card[];const result=acquireRoundEquipment([{category:"head",grade:"평범함",round:1}],hand,{head:10},10,18,2);assert.equal(result.collection.length,1);assert.equal(result.collection[0].grade,"화려함")});
