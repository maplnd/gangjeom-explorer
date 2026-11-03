import { weatherLabel, type DayWeather } from '../weather'
import { fmtDate } from '../utils'

interface Props {
  dates: string[]
  days: string[]
  weather: Record<string, DayWeather>
  selected: string // 'all' | date
  color: (d: string) => string
  onPick: (d: string) => void
}

export function WeatherBar({ dates, days, weather, selected, color, onPick }: Props) {
  const shown = selected === 'all' ? dates : [selected]
  const any = shown.some((d) => weather[d])
  const hasLastYear = shown.some((d) => weather[d]?.kind === 'lastyear')
  if (!shown.length) return null
  return (
    <div className="weather-bar">
      <div className="weather-row">
        {shown.map((d) => {
          const w = weather[d]
          const [icon, label] = w ? weatherLabel(w.code) : ['·', '']
          return (
            <button key={d} className={`wday ${selected === d ? 'on' : ''} ${w?.kind === 'lastyear' ? 'ref' : ''}`}
              style={{ borderTopColor: color(d) }} onClick={() => onPick(d)} title={w ? `${label}${w.kind === 'lastyear' ? ' (작년 같은 날)' : ''}` : ''}>
              <span className="wd">{days.includes(d) ? `Day ${days.indexOf(d) + 1}` : '기간 외'} · {fmtDate(d)}</span>
              {w ? (
                <>
                  <span className="wi">{icon}</span>
                  <span className="wt"><b>{Math.round(w.max)}°</b> / {Math.round(w.min)}°</span>
                  <span className="wr">
                    {w.kind === 'forecast'
                      ? (w.rain != null ? `☔ ${w.rain}%` : label)
                      : `작년 ${w.rainMm ? `· ${w.rainMm.toFixed(0)}mm` : label}`}
                  </span>
                </>
              ) : (
                <span className="wr muted">정보 없음</span>
              )}
            </button>
          )
        })}
      </div>
      {!any ? (
        <p className="muted small">일정에 장소를 넣거나 여행 정보에 여행지를 입력하면 날씨가 표시돼요.</p>
      ) : hasLastYear && (
        <p className="muted small">흐린 카드는 <b>작년 같은 날</b>의 실제 날씨(참고용)예요. 출발 16일 전부터 실제 예보로 바뀝니다.</p>
      )}
    </div>
  )
}
