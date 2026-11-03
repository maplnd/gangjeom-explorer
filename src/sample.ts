import type { Trip } from './types'
import { uid } from './utils'

export function sampleTrip(): Trip {
  const d1 = '2026-11-20'
  const d2 = '2026-11-21'
  const d3 = '2026-11-22'
  const s = (
    date: string, start: string, end: string, title: string, category: Trip['stops'][number]['category'],
    cost: number, name: string, lat: number, lng: number, modeToNext: Trip['stops'][number]['modeToNext'] = 'DRIVING', memo = '',
  ) => ({ id: uid(), date, start, end, title, category, cost, memo, modeToNext, place: { name, lat, lng } })

  return {
    id: uid(),
    title: '제주 2박 3일 (샘플)',
    destination: '제주도',
    checklist: [
      { id: uid(), text: '신분증', category: '서류', done: false, sort: 1 },
      { id: uid(), text: '렌터카 예약 확인 · 운전면허증', category: '서류', done: false, sort: 2 },
      { id: uid(), text: '보조배터리', category: '전자기기', done: false, sort: 3 },
      { id: uid(), text: '바람막이 (해안가 바람)', category: '의류', done: false, sort: 4 },
      { id: uid(), text: '선크림', category: '생활·위생', done: false, sort: 5 },
    ],
    notes: [],
    startDate: d1,
    endDate: d3,
    budget: 800000,
    currency: 'KRW',
    createdAt: Date.now(),
    expenses: [
      { id: uid(), date: d1, label: '왕복 항공권 (김포↔제주)', category: 'transport', amount: 128000 },
      { id: uid(), date: d1, label: '렌터카 3일', category: 'transport', amount: 96000 },
    ],
    stops: [
      s(d1, '09:30', '10:00', '제주공항 도착 · 렌터카 픽업', 'transport', 0, '제주국제공항', 33.5104, 126.4914),
      s(d1, '10:40', '12:00', '애월 한담해안산책로', 'sight', 0, '한담해안산책로', 33.4627, 126.3103, 'DRIVING', '카페거리 산책'),
      s(d1, '12:10', '13:10', '점심 · 고기국수', 'food', 22000, '애월읍', 33.4630, 126.3290),
      s(d1, '14:10', '16:00', '협재해수욕장', 'sight', 0, '협재해수욕장', 33.3940, 126.2397),
      s(d1, '19:00', '20:30', '저녁 · 흑돼지', 'food', 58000, '제주시 흑돼지거리', 33.5070, 126.5300),
      s(d1, '21:00', '23:59', '숙소 체크인', 'lodging', 140000, '제주시 숙소', 33.4996, 126.5312, 'DRIVING'),
      s(d2, '07:00', '08:30', '성산일출봉', 'sight', 5000, '성산일출봉', 33.4581, 126.9425, 'DRIVING', '일출 시간 확인'),
      s(d2, '09:00', '12:30', '우도 투어', 'activity', 32000, '우도', 33.5060, 126.9530),
      s(d2, '13:30', '14:30', '점심 · 해물라면', 'food', 26000, '세화해변', 33.5250, 126.8600),
      s(d2, '15:30', '17:00', '비자림', 'sight', 6000, '비자림', 33.4900, 126.8100),
      s(d2, '18:30', '23:59', '서귀포 숙소', 'lodging', 160000, '서귀포 숙소', 33.2490, 126.5620),
      s(d3, '09:30', '10:30', '천지연폭포', 'sight', 4000, '천지연폭포', 33.2469, 126.5545),
      s(d3, '11:00', '12:00', '올레시장 기념품', 'shopping', 45000, '서귀포매일올레시장', 33.2490, 126.5645),
      s(d3, '13:30', '14:00', '렌터카 반납 · 공항', 'transport', 0, '제주국제공항', 33.5104, 126.4914, 'DRIVING'),
    ],
  }
}
