# 🧭 여행 기록 (gangjeom-explorer)

여행의 **일정 · 시간 · 비용 · 동선**을 한 화면에서 기록하고, **구글맵**과 연동해 경로를 확인하는 웹 앱입니다.

## 주요 기능

| 기능 | 내용 |
| --- | --- |
| 🗓️ 일정 | 여행 기간을 Day 1, Day 2…로 나누고, 일정마다 시작/종료 시간·분류·메모를 기록 |
| ⏱️ 시간 | 일정별 소요시간, 다음 장소까지 이동시간, **이동시간이 부족하면 경고** + ‘다음 일정 늦추기’ 버튼 |
| 💰 비용 | 일정별 비용 + 별도 지출(항공권 등), 분류별/일자별 합계, 예산 대비 사용률 |
| 🗺️ 동선 | 지도에 번호 마커와 경로선 표시 (일자별 색상), 일자별 총 이동거리·이동시간 |
| 🔗 구글맵 | 장소마다 ‘구글맵’ 링크, 하루 동선 전체를 **구글맵 길찾기**로 바로 열기 |
| ✅ 기록 | ‘다녀옴’ 체크, 메모, JSON 내보내기/가져오기 |

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 에 정적 파일 생성 (Vercel, Netlify, GitHub Pages 등에 배포 가능)
```

## Google 지도 연동

API 키 없이도 동작합니다 (OpenStreetMap 지도 + Nominatim 장소 검색 + 추정 이동시간, ‘구글맵 경로’ 링크는 그대로 작동).

Google 지도를 앱 안에 띄우려면:

1. [Google Cloud 콘솔](https://console.cloud.google.com/google/maps-apis)에서 **Maps JavaScript API**, **Places API (New)**, **Directions API**를 사용 설정
2. API 키를 만들고 HTTP 리퍼러를 배포 도메인으로 제한
3. 앱 우측 상단 **⚙️ 구글맵 연동**에 키 입력 — 또는 `.env`에 `VITE_GOOGLE_MAPS_API_KEY=...` 설정 후 빌드

> 참고: 한국 내 **도보·자동차** 길찾기는 Google이 제공하지 않아 직선거리 기반 추정치(점선)로 표시됩니다. 대중교통 경로와 해외 여행지는 Google 실제 경로(실선)로 표시됩니다.

## 구조

```
src/
  App.tsx              앱 셸, 여행 목록 ↔ 상세 전환, 설정
  types.ts / utils.ts  데이터 모델, 시간·거리·비용 계산, 구글맵 URL 생성
  google.ts            Google Maps 로더, 장소 검색, 경로 조회(캐시)
  storage.ts           localStorage 저장
  sample.ts            제주 2박 3일 샘플 데이터
  components/          TripList, TripView, Timeline, MapView, CostView, StopForm, PlaceSearch …
```

데이터는 브라우저 localStorage에 저장됩니다.
