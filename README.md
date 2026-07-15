# 오늘도 냥꾸

고양이의 기분에 맞춰 장식 카드를 배치하고, 목표 수치에 가장 가깝게 꾸미는 모바일 우선 웹 보드게임입니다.

## 주요 기능

- 1인 + AI 또는 여러 플레이어 로컬 플레이
- 고양이 5종과 기분별 표정 연출
- 장식 가치 단계에 따라 달라지는 카드·중앙 보드·착용 모습
- 숫자순/종류순 손패 정렬과 현재 예상 점수 표시
- 라운드 결과와 최종 드레싱룸
- 설치 가능한 PWA, 첫 방문 이후 오프라인 실행 지원
- 브라우저 로컬 저장과 Firebase Realtime Database 동기화

## 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
```

검증용 명령은 다음과 같습니다.

```bash
npm run build
npm test
```

## Firebase 데이터 경로

이 저장소는 같은 Firebase 프로젝트의 다른 게임 데이터를 건드리지 않도록 모든 클라우드 저장을 아래 경로로 한정합니다.

```text
games/kitty-makeover/saves/{deviceId}
```

루트 `games` 또는 다른 게임의 하위 경로에는 쓰지 않습니다. 현재 제공된 Realtime Database 규칙은 `games` 전체에 공개 읽기·쓰기를 허용하므로, 공개 서비스에서 사용자별 보안이 필요하다면 Firebase Authentication과 더 제한적인 규칙을 추가해야 합니다.

## PWA

- 매니페스트: `public/manifest.webmanifest`
- 서비스 워커: `public/sw.js`
- 앱 아이콘: `public/icons/`

지원 브라우저에서는 화면의 설치 버튼을 사용할 수 있습니다. iOS Safari에서는 공유 메뉴의 **홈 화면에 추가**를 사용하세요.

## 프로젝트 구조

- `app/core/`: 게임 규칙과 점수 계산
- `app/data/`: 카드·장식·고양이 시각 데이터와 Firebase 연결
- `app/ui/`: 게임 화면과 PWA 클라이언트 UI
- `public/cats/`: 고양이와 장식 이미지 자산
- `tests/`: 렌더링, PWA, Firebase 경로 검증
