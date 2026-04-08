import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import styles from './WallCalendar.module.css';

/* ─────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────── */
const MONTH_NAMES = [
  'January','February','March','April',
  'May','June','July','August',
  'September','October','November','December',
];
const MONTH_ABBR = MONTH_NAMES.map(m => m.slice(0, 3));
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const PLACEHOLDER_EVENTS = new Set([3, 11, 17, 22, 28]);
const NOTE_MAX = 300;

/** Major holidays — month is 0-indexed */
const HOLIDAYS = [
  { month: 0,  day: 1,  emoji: '🎆', label: "New Year's Day" },
  { month: 1,  day: 14, emoji: '💝', label: "Valentine's Day" },
  { month: 2,  day: 17, emoji: '☘️', label: "St. Patrick's Day" },
  { month: 3,  day: 22, emoji: '🌍', label: 'Earth Day' },
  { month: 4,  day: 11, emoji: '👩', label: "Mother's Day" },
  { month: 6,  day: 4,  emoji: '🎇', label: 'Independence Day' },
  { month: 7,  day: 15, emoji: '🏖️', label: 'Summer Peak' },
  { month: 9,  day: 31, emoji: '🎃', label: 'Halloween' },
  { month: 10, day: 11, emoji: '🎖️', label: 'Veterans Day' },
  { month: 10, day: 27, emoji: '🦃', label: 'Thanksgiving' },
  { month: 11, day: 24, emoji: '🎄', label: 'Christmas Eve' },
  { month: 11, day: 25, emoji: '🎁', label: 'Christmas Day' },
  { month: 11, day: 31, emoji: '🎉', label: "New Year's Eve" },
];

/** Build a Set of "month-day" keys for O(1) holiday lookup */
function buildHolidayMap() {
  const map = {};
  HOLIDAYS.forEach(h => { map[`${h.month}-${h.day}`] = h.emoji; });
  return map;
}
const HOLIDAY_MAP = buildHolidayMap();

/** 12-entry seasonal theme map (index 0 = January) */
const MONTH_THEMES = [
  { keyword: 'snow,winter,frost,ice',        accent: '#6B9AC4' }, // Jan
  { keyword: 'snow,pine,frozen,mountain',    accent: '#8FAEC2' }, // Feb
  { keyword: 'cherry,blossom,sakura,spring', accent: '#C48FA0' }, // Mar
  { keyword: 'spring,flowers,tulip,bloom',   accent: '#7AB87A' }, // Apr
  { keyword: 'meadow,wildflowers,green',     accent: '#5EAA7A' }, // May
  { keyword: 'summer,golden,field,wheat',    accent: '#C4A040' }, // Jun
  { keyword: 'ocean,beach,waves,tropical',   accent: '#4A9EC4' }, // Jul
  { keyword: 'sunset,warm,horizon,dusk',     accent: '#C47A40' }, // Aug
  { keyword: 'autumn,maple,leaves,fall',     accent: '#C4603A' }, // Sep
  { keyword: 'autumn,forest,orange,mist',    accent: '#B85020' }, // Oct
  { keyword: 'fog,mist,november,bare,trees', accent: '#7A9A8A' }, // Nov
  { keyword: 'winter,snow,cozy,cabin,cold',  accent: '#7A9AC4' }, // Dec
];

const HERO_SEEDS = [10,1015,15,28,107,338,192,239,219,142,110,396];
function getHeroUrl(m) { return `https://picsum.photos/seed/${HERO_SEEDS[m]}/800/1200`; }

/* ─────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────── */
function dk(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function fmtKey(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return `${MONTH_ABBR[m - 1]} ${d}, ${y}`;
}
function buildCalendarCells(year, month) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++)     cells.push({ type: 'empty' });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: 'day', day: d });
  while (cells.length < 42)              cells.push({ type: 'empty' });
  return cells;
}
/** "YYYY-MM" key for notes store */
function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2,'0')}`;
}

/* ─────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────── */

function BindingStrip() {
  return (
    <div className={styles.bindingStrip} role="presentation" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={styles.bindingRing} />
      ))}
    </div>
  );
}

function HeroPanel({ month, year, prevMonth, isCrossfading }) {
  const currentUrl = getHeroUrl(month);
  const prevUrl    = prevMonth !== null ? getHeroUrl(prevMonth) : null;
  return (
    <aside className={styles.leftPanel} aria-label="Calendar hero image panel">
      <img key={month} src={currentUrl} className={styles.heroImg}
        alt={`${MONTH_NAMES[month]} landscape`} draggable="false" />
      {isCrossfading && prevUrl && (
        <img key={`p${prevMonth}`} src={prevUrl}
          className={`${styles.heroImg} ${styles.heroImgFadeOut}`}
          alt="" aria-hidden="true" draggable="false" />
      )}
      <div className={styles.monthOverlay}>
        <h1 className={styles.monthName}>{MONTH_NAMES[month]}</h1>
        <p className={styles.yearLabel}>{year}</p>
      </div>
    </aside>
  );
}

function DayLabelRow() {
  return (
    <div className={styles.dayLabels} role="row">
      {DAY_LABELS.map((label, i) => (
        <div key={label}
          className={`${styles.dayLabel}${i === 0 || i === 6 ? ' ' + styles.dayLabelWeekend : ''}`}
          role="columnheader">
          {label}
        </div>
      ))}
    </div>
  );
}

/** Interactive Notes area with lined-paper look and character counter */
function NotesSection({ mKey, monthLabel, notes, onNoteChange, onNoteInsert }) {
  const value  = notes[mKey] || '';
  const pct    = Math.round((value.length / NOTE_MAX) * 100);
  const isNear = pct >= 80;

  return (
    <section className={styles.notesSectionWrap} aria-label={`Notes for ${monthLabel}`}>
      <div className={styles.notesHeader}>
        <span className={styles.notesSectionTitle}>Notes for {monthLabel}</span>
        <span className={`${styles.charCounter} ${isNear ? styles.charCounterWarn : ''}`}>
          {value.length}&thinsp;/&thinsp;{NOTE_MAX}
        </span>
      </div>
      <div className={styles.notesPaperWrap}>
        <textarea
          className={styles.noteTextarea}
          value={value}
          onChange={e => onNoteChange(mKey, e.target.value.slice(0, NOTE_MAX))}
          placeholder={`Jot down your ${monthLabel} thoughts…`}
          rows={5}
          aria-label={`Notes for ${monthLabel}`}
          spellCheck="false"
        />
        {/* paper curl */}
        <span className={styles.paperCurl} aria-hidden="true" />
      </div>
    </section>
  );
}

/** Range info bar */
function RangeBar({ startKey, endKey, onClear }) {
  if (!startKey) return null;
  return (
    <div className={styles.rangeBar} role="status" aria-live="polite">
      <span className={styles.rangeBarText}>
        <span className={styles.rangeBarDot} />
        {fmtKey(startKey)}
        {endKey
          ? <> &rarr; <strong>{fmtKey(endKey)}</strong></>
          : <span className={styles.rangeBarEllipsis}> → …</span>
        }
      </span>
      <button className={styles.rangeBarClear} onClick={onClear} aria-label="Clear selection">✕</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   CalendarGrid
───────────────────────────────────────────────── */

function CalendarGrid({
  cells, todayDay, displayYear, displayMonth, fading,
  startKey, endKey, hoverKey,
  onDayClick, onDayHover, onGridLeave, onDayDoubleClick,
}) {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === displayYear && today.getMonth() === displayMonth;

  const effectiveEnd = endKey || (startKey ? hoverKey : null);
  const isPreview = startKey && !endKey && !!hoverKey;

  return (
    <div
      className={[styles.calGrid, fading && styles.gridFading].filter(Boolean).join(' ')}
      role="grid"
      aria-label="Calendar date grid"
      onMouseLeave={onGridLeave}
    >
      {cells.map((cell, idx) => {
        if (cell.type === 'empty') {
          return <div key={idx} className={styles.cellEmpty} aria-hidden="true" />;
        }

        const colIndex  = idx % 7;
        const isWeekend = colIndex === 0 || colIndex === 6;
        const isToday   = isCurrentMonth && cell.day === todayDay;
        const hasEvent  = PLACEHOLDER_EVENTS.has(cell.day);
        const holiday   = HOLIDAY_MAP[`${displayMonth}-${cell.day}`];
        const key       = dk(displayYear, displayMonth, cell.day);

        let loKey = null, hiKey = null;
        if (startKey && effectiveEnd && startKey !== effectiveEnd) {
          [loKey, hiKey] = startKey <= effectiveEnd
            ? [startKey, effectiveEnd] : [effectiveEnd, startKey];
        }

        const isVisualStart = !!loKey && key === loKey;
        const isVisualEnd   = !!hiKey && key === hiKey;
        const isInBetween   = !!(loKey && hiKey && key > loKey && key < hiKey);
        const isSinglePoint = !!(startKey && !effectiveEnd && key === startKey);
        const isSelected    = isVisualStart || isVisualEnd || isSinglePoint;
        const isPreviewEnd  = isPreview && isVisualEnd && key !== startKey;

        let bandCls = null;
        if (isInBetween) {
          bandCls = isPreview ? styles.bandPreviewMid : styles.bandMid;
        } else if (isVisualStart && !isSinglePoint) {
          bandCls = isPreview ? styles.bandPreviewStart : styles.bandStart;
        } else if (isVisualEnd) {
          bandCls = isPreview ? styles.bandPreviewEnd : styles.bandEnd;
        }

        let circleCls = null;
        if (isSelected && !isPreviewEnd) circleCls = styles.circleSelected;
        else if (isPreviewEnd)           circleCls = styles.circlePreview;
        else if (isToday)                circleCls = styles.circleToday;

        const outerCls = [styles.dayCell, bandCls].filter(Boolean).join(' ');
        const innerCls = [
          styles.cellInner,
          circleCls,
          !isSelected && !isPreviewEnd && !isInBetween && styles.cellHoverable,
        ].filter(Boolean).join(' ');

        return (
          <div key={idx} className={outerCls} role="gridcell"
            aria-label={
              `${MONTH_NAMES[displayMonth]} ${cell.day}` +
              (isToday    ? ', today'     : '') +
              (isSelected ? ', selected'  : '') +
              (hasEvent   ? ', has event' : '') +
              (holiday    ? `, ${HOLIDAYS.find(h => h.month===displayMonth && h.day===cell.day)?.label || ''}` : '')
            }
            aria-current={isToday    ? 'date' : undefined}
            aria-pressed={isSelected ? 'true' : undefined}
            onClick={() => onDayClick(key)}
            onDoubleClick={() => onDayDoubleClick(displayMonth, cell.day)}
            onMouseEnter={() => onDayHover(key)}
          >
            <span className={innerCls}>
              <span className={[
                styles.dateNum,
                isWeekend && !isSelected && !isPreviewEnd && styles.dateNumWeekend,
              ].filter(Boolean).join(' ')}>
                {cell.day}
              </span>
              {isToday && !isSelected && !isPreviewEnd && (
                <span className={styles.todayTick} aria-hidden="true" />
              )}
              {hasEvent && !isSelected && !isPreviewEnd && !isInBetween && (
                <span className={styles.eventDot} aria-hidden="true" />
              )}
              {/* Holiday emoji */}
              {holiday && !isSelected && !isPreviewEnd && (
                <span className={styles.holidayEmoji} title={
                  HOLIDAYS.find(h => h.month===displayMonth && h.day===cell.day)?.label
                }>{holiday}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────── */

export default function WallCalendar({ initialYear, initialMonth } = {}) {
  const now = new Date();
  const [year,  setYear]  = useState(initialYear  ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef(null);

  /* Hero crossfade */
  const [prevMonth,     setPrevMonth]     = useState(null);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const crossfadeTimer = useRef(null);

  /* Range selection */
  const [startKey, setStartKey] = useState(null);
  const [endKey,   setEndKey]   = useState(null);
  const [hoverKey, setHoverKey] = useState(null);

  /* Notes: { "YYYY-MM": string } */
  const [notes, setNotes] = useState({});

  const todayDay = now.getDate();
  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);
  const mKey  = monthKey(year, month);
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  /* Grid fade + hero crossfade on month change */
  const triggerFade = useCallback((changeFn) => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setFading(true);
    fadeTimer.current = setTimeout(() => { changeFn(); setFading(false); }, 180);
  }, []);

  useEffect(() => () => {
    clearTimeout(fadeTimer.current);
    clearTimeout(crossfadeTimer.current);
  }, []);

  const changeMonth = useCallback((changeFn) => {
    const old = month;
    setPrevMonth(old);
    setIsCrossfading(true);
    if (crossfadeTimer.current) clearTimeout(crossfadeTimer.current);
    crossfadeTimer.current = setTimeout(() => {
      setIsCrossfading(false); setPrevMonth(null);
    }, 700);
    triggerFade(changeFn);
  }, [month, triggerFade]);

  const goToPrev = () => changeMonth(() => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  });
  const goToNext = () => changeMonth(() => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  });
  const goToToday = () => {
    const n = now;
    if (n.getFullYear() !== year || n.getMonth() !== month) {
      changeMonth(() => { setYear(n.getFullYear()); setMonth(n.getMonth()); });
    }
  };

  /* Range click logic */
  const handleDayClick = useCallback((key) => {
    setHoverKey(null);
    if (!startKey || endKey) {
      setStartKey(key); setEndKey(null);
    } else {
      if (key === startKey) setStartKey(null);
      else if (key > startKey) setEndKey(key);
      else setStartKey(key);
    }
  }, [startKey, endKey]);

  const handleDayHover  = useCallback((key) => {
    if (startKey && !endKey) setHoverKey(key);
  }, [startKey, endKey]);

  const handleGridLeave = useCallback(() => setHoverKey(null), []);
  const clearRange      = useCallback(() => {
    setStartKey(null); setEndKey(null); setHoverKey(null);
  }, []);

  /** Double-click a date → prepend "Mon DD —\n" to that month's note */
  const handleDayDoubleClick = useCallback((displayMonth, day) => {
    const prefix = `${MONTH_ABBR[displayMonth]} ${day} —\n`;
    setNotes(prev => {
      const current = prev[mKey] || '';
      // Only prepend if not already starting with this exact prefix
      if (current.startsWith(prefix)) return prev;
      const next = (prefix + current).slice(0, NOTE_MAX);
      return { ...prev, [mKey]: next };
    });
  }, [mKey]);

  const handleNoteChange = useCallback((key, value) => {
    setNotes(prev => ({ ...prev, [key]: value }));
  }, []);

  const theme = MONTH_THEMES[month];
  const isOnToday = now.getFullYear() === year && now.getMonth() === month;

  return (
    <article
      className={styles.calendarWrapper}
      aria-label={`Wall calendar — ${monthLabel}`}
      style={{
        '--accent':       theme.accent,
        '--today-ring':   theme.accent,
        '--today-tick':   theme.accent,
        '--accent-light': theme.accent + 'AA',
      }}
    >
      <BindingStrip />

      <div className={styles.calendarBody}>
        <HeroPanel month={month} year={year}
          prevMonth={prevMonth} isCrossfading={isCrossfading} />

        <section className={styles.rightPanel} aria-label="Calendar grid and notes">
          <div className={styles.gridSection}>

            {/* ── Nav header ── */}
            <div className={styles.gridHeader}>
              <button className={styles.navBtn} onClick={goToPrev} aria-label="Previous month">←</button>
              <span className={[styles.gridTitle, fading && styles.gridTitleFading].filter(Boolean).join(' ')}>
                {MONTH_NAMES[month]} {year}
              </span>
              <button className={styles.navBtn} onClick={goToNext} aria-label="Next month">→</button>
            </div>

            {/* Today button */}
            {!isOnToday && (
              <button className={styles.todayBtn} onClick={goToToday} aria-label="Go to current month">
                ⌂ Today
              </button>
            )}

            <RangeBar startKey={startKey} endKey={endKey} onClear={clearRange} />
            <DayLabelRow />

            <CalendarGrid
              cells={cells} todayDay={todayDay}
              displayYear={year} displayMonth={month} fading={fading}
              startKey={startKey} endKey={endKey} hoverKey={hoverKey}
              onDayClick={handleDayClick}
              onDayHover={handleDayHover}
              onGridLeave={handleGridLeave}
              onDayDoubleClick={handleDayDoubleClick}
            />
          </div>

          <div className={styles.divider} role="separator" />

          <NotesSection
            mKey={mKey}
            monthLabel={monthLabel}
            notes={notes}
            onNoteChange={handleNoteChange}
            onNoteInsert={handleDayDoubleClick}
          />
        </section>
      </div>
    </article>
  );
}
