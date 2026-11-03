import { useState } from 'react'
import { envKey, type GoogleStatus } from '../google'
import { Modal } from './Modal'

export function Settings({ apiKey, status, onSave, onClose }: { apiKey: string; status: GoogleStatus; onSave: (k: string) => void; onClose: () => void }) {
  const [key, setKey] = useState(apiKey)
  const label = { none: '연동 안 됨 (OpenStreetMap 사용 중)', loading: '불러오는 중…', ready: '✅ 연결됨', error: '⚠️ 오류 — 키 또는 허용 도메인을 확인하세요' }[status]
  return (
    <Modal
      title="Google 지도 연동"
      onClose={onClose}
      footer={
        <>
          {apiKey && <button className="btn ghost danger" onClick={() => onSave('')}>키 삭제</button>}
          <button className="btn ghost" onClick={onClose}>취소</button>
          <button className="btn primary" onClick={() => onSave(key.trim())}>저장 후 새로고침</button>
        </>
      }
    >
      <p>상태: <b>{label}</b></p>
      <label className="field">
        <span>Google Maps API 키</span>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza..." spellCheck={false} />
      </label>
      {envKey && !apiKey && <p className="hint">환경변수(VITE_GOOGLE_MAPS_API_KEY)의 키를 사용 중입니다.</p>}
      <div className="hint">
        <b>키 발급 방법</b>
        <ol>
          <li><a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noreferrer">Google Cloud 콘솔</a>에서 프로젝트를 만들고 결제를 연결합니다.</li>
          <li><b>Maps JavaScript API</b>, <b>Places API (New)</b>, <b>Directions API</b>를 사용 설정합니다.</li>
          <li>사용자 인증 정보 → API 키 생성 후, <b>HTTP 리퍼러</b>를 이 사이트 주소로 제한하세요.</li>
        </ol>
        키 없이도 앱은 동작합니다 — 지도는 OpenStreetMap, 장소 검색은 Nominatim, 이동시간은 추정치를 사용하며 ‘구글맵 경로’ 버튼은 그대로 구글맵 길찾기로 연결됩니다.
        <br />키는 이 브라우저에만 저장됩니다.
      </div>
    </Modal>
  )
}
