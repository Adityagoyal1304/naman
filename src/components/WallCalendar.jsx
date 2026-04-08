import { useState, useMemo, useCallback, useRef, useEffect, useReducer } from 'react';
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
const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
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
  const firstDay    = new Date(year, month, 1).getDay(); // 0 is Sun, 1 is Mon
  const firstDayIdx = firstDay === 0 ? 6 : firstDay - 1; // map so Mon=0, Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDayIdx; i++)  cells.push({ type: 'empty' });
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

function HeroPanel({ month, year, prevMonth, isCrossfading, goToPrev, goToNext }) {
  const currentUrl = getHeroUrl(month);
  const prevUrl    = prevMonth !== null ? getHeroUrl(prevMonth) : null;
  return (
    <header className={styles.heroPanel} aria-label="Calendar hero image panel">
      <div className={styles.heroImgWrapper}>
        <img key={month} src={currentUrl} className={styles.heroImg}
          alt={`${MONTH_NAMES[month]} landscape`} draggable="false" />
        {isCrossfading && prevUrl && (
          <img key={`p${prevMonth}`} src={prevUrl}
            className={`${styles.heroImg} ${styles.heroImgFadeOut}`}
            alt="" aria-hidden="true" draggable="false" />
        )}
        
        {/* Geometric overlay at the bottom */}
        <div className={styles.geometricOverlay}>
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" className={styles.geoSvg}>
             <polygon fill="var(--accent)" points="0,20 0,12 35,20 100,0 100,20" />
          </svg>
        </div>
      </div>

      <div className={styles.heroContent}>
        <div className={styles.monthYearBlock}>
           <div className={styles.yearRow}>
             <button onClick={goToPrev} className={styles.navBtnLight} aria-label="Previous month">←</button>
             <span className={styles.yearLabel}>{year}</span>
             <button onClick={goToNext} className={styles.navBtnLight} aria-label="Next month">→</button>
           </div>
           <h1 className={styles.monthName}>{MONTH_NAMES[month].toUpperCase()}</h1>
        </div>
      </div>
    </header>
  );
}

function DayLabelRow() {
  return (
    <div className={styles.dayLabels} role="row">
      {DAY_LABELS.map((label, i) => (
        <div key={label}
          className={`${styles.dayLabel}${i === 5 || i === 6 ? ' ' + styles.dayLabelWeekend : ''}`}
          role="columnheader">
          {label}
        </div>
      ))}
    </div>
  );
}

const RANGE_SWATCHES = ['#C8A96E', '#A3B899', '#9BAFC7', '#C49A9A', '#B8A9C9'];

const initialNotesStore = { monthNotes: {}, dateNotes: {}, rangeNotes: [] };

function notesReducer(state, action) {
  switch (action.type) {
    case 'SET_MONTH_NOTE':  return { ...state, monthNotes: { ...state.monthNotes, [action.key]: action.value } };
    case 'SET_DATE_NOTE':   return { ...state, dateNotes: { ...state.dateNotes, [action.key]: action.value } };
    case 'ADD_RANGE_NOTE':  return { ...state, rangeNotes: [...state.rangeNotes, action.payload] };
    case 'EDIT_RANGE_NOTE': return { ...state, rangeNotes: state.rangeNotes.map(rn => rn.id === action.payload.id ? action.payload : rn) };
    case 'DELETE_RANGE_NOTE': return { ...state, rangeNotes: state.rangeNotes.filter(rn => rn.id !== action.id) };
    default: return state;
  }
}

function NotesTabs({ activeNotesTab, setActiveNotesTab }) {
  const tabs = [
    { id: 'month', label: 'Month' },
    { id: 'date',  label: 'Date' },
    { id: 'range', label: 'Range' }
  ];
  return (
    <div className={styles.notesTabs}>
      {tabs.map(t => (
        <button key={t.id} type="button"
          className={`${styles.tabBtn} ${activeNotesTab === t.id ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveNotesTab(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function MonthNotesTab({ mKey, monthLabel, notesStore, dispatch }) {
  const value  = notesStore.monthNotes[mKey] || '';
  const isNear = (value.length / NOTE_MAX) >= 0.8;
  return (
    <div className={styles.tabContentFade}>
      <div className={styles.notesHeader}>
        <span className={styles.notesSectionTitle}>Notes for {monthLabel}</span>
        <span className={`${styles.charCounter} ${isNear ? styles.charCounterWarn : ''}`}>
          {value.length}&thinsp;/&thinsp;{NOTE_MAX}
        </span>
      </div>
      <div className={styles.notesPaperWrap}>
        <textarea className={styles.noteTextarea} value={value}
          onChange={e => dispatch({ type: 'SET_MONTH_NOTE', key: mKey, value: e.target.value.slice(0, NOTE_MAX) })}
          placeholder={`Jot down your ${monthLabel} thoughts…`} rows={5} spellCheck="false" />
        <span className={styles.paperCurl} aria-hidden="true" />
      </div>
    </div>
  );
}

function DateNotesTab({ startKey, endKey, notesStore, dispatch }) {
  const isSingle = startKey && !endKey;
  if (!isSingle) {
    return <div className={`${styles.tabContentFade} ${styles.emptyText}`}><i>Click a date to add a note</i></div>;
  }
  const value  = notesStore.dateNotes[startKey] || '';
  const isNear = (value.length / NOTE_MAX) >= 0.8;
  return (
    <div className={styles.tabContentFade}>
      <div className={styles.notesHeader}>
        <span className={styles.notesSectionTitle}>Note for {fmtKey(startKey)}</span>
        <span className={`${styles.charCounter} ${isNear ? styles.charCounterWarn : ''}`}>{value.length}&thinsp;/&thinsp;{NOTE_MAX}</span>
      </div>
      <div className={styles.notesPaperWrap}>
        <textarea className={styles.noteTextarea} value={value}
          onChange={e => dispatch({ type: 'SET_DATE_NOTE', key: startKey, value: e.target.value.slice(0, NOTE_MAX) })}
          placeholder="Write a note for this specific date..." rows={5} spellCheck="false" />
        <span className={styles.paperCurl} aria-hidden="true" />
      </div>
    </div>
  );
}

function RangeNotesTab({ mKey, startKey, endKey, notesStore, dispatch }) {
  const hasRange = startKey && endKey;
  const currentMonthRanges = notesStore.rangeNotes.filter(rn => rn.start.startsWith(mKey) || rn.end.startsWith(mKey));
  
  const [form, setForm] = useState({ id: null, label: '', note: '', color: RANGE_SWATCHES[0] });
  
  const handleSave = (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    if (form.id) {
       dispatch({ type: 'EDIT_RANGE_NOTE', payload: form });
    } else {
       dispatch({ type: 'ADD_RANGE_NOTE', payload: { ...form, id: 'rn-' + Date.now(), start: startKey, end: endKey } });
    }
    setForm({ id: null, label: '', note: '', color: RANGE_SWATCHES[0] });
  };
  
  const handleEdit = (rn) => setForm(rn);
  const handleDel  = (id) => dispatch({ type: 'DELETE_RANGE_NOTE', id });

  return (
    <div className={styles.tabContentFade}>
      {(hasRange || form.id) ? (
        <form className={styles.rangeForm} onSubmit={handleSave}>
          <div className={styles.notesHeader}>
            <span className={styles.notesSectionTitle}>
              {form.id ? 'Edit Range Note' : `${fmtKey(startKey)} → ${fmtKey(endKey)}`}
            </span>
          </div>
          <input type="text" className={styles.rangeInput} placeholder="Label (e.g. Vacation)" 
                 value={form.label} onChange={e => setForm({...form, label: e.target.value})} required />
          <div className={`${styles.notesPaperWrap} ${styles.rangePaper}`}>
             <textarea className={styles.noteTextarea} placeholder="Note content..." value={form.note} onChange={e => setForm({...form, note: e.target.value})} rows={2} spellCheck="false" />
          </div>
          <div className={styles.rangeFormActions}>
            <div className={styles.swatchRow}>
               {RANGE_SWATCHES.map(c => (
                 <button type="button" key={c} style={{background: c}} 
                         className={`${styles.swatch} ${form.color===c ? styles.swatchActive : ''}`} 
                         onClick={() => setForm({...form, color: c})} aria-label="Select color" />
               ))}
            </div>
            <button type="submit" className={styles.saveBtn}>{form.id ? 'Save Changes' : 'Save Range Note'}</button>
            {form.id && <button type="button" className={styles.cancelBtn} onClick={() => setForm({id:null, label:'', note:'', color:RANGE_SWATCHES[0]})}>Cancel</button>}
          </div>
        </form>
      ) : (
        <div className={styles.emptyText}>Select a start and end date to attach a note</div>
      )}

      <div className={styles.rangeList}>
        {currentMonthRanges.length === 0 ? (
           <div className={styles.emptyText}>No range notes for this month yet</div>
        ) : (
           currentMonthRanges.map(rn => <RangeCard key={rn.id} rn={rn} onEdit={handleEdit} onDel={handleDel} />)
        )}
      </div>
    </div>
  );
}

function RangeCard({ rn, onEdit, onDel }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={styles.rangeCard} style={{ borderLeftColor: rn.color }}>
       <div className={styles.rangeCardMain}>
         <div className={styles.rangeCardTitle}><strong>{rn.label}</strong> <span>{fmtKey(rn.start)} → {fmtKey(rn.end)}</span></div>
         {rn.note && <div className={styles.rangeCardNote}>{rn.note.slice(0,60)}{rn.note.length>60?'...':''}</div>}
       </div>
       {confirm ? (
         <div className={styles.rangeConfirm}>
           <span className={styles.confirmText}>Are you sure?</span>
           <button onClick={()=>onDel(rn.id)} className={styles.btnYes}>Yes</button>
           <button onClick={()=>setConfirm(false)} className={styles.btnCan}>Cancel</button>
         </div>
       ) : (
         <div className={styles.rangeActions}>
           <button onClick={()=>onEdit(rn)} title="Edit">✏️</button>
           <button onClick={()=>setConfirm(true)} title="Delete">🗑️</button>
         </div>
       )}
    </div>
  );
}

function NotesSection({ mKey, monthLabel, notesStore, dispatch, activeNotesTab, setActiveNotesTab, startKey, endKey }) {
  return (
    <section className={styles.notesSectionWrap} aria-label="Notes Panel">
      <NotesTabs activeNotesTab={activeNotesTab} setActiveNotesTab={setActiveNotesTab} />
      <div className={styles.notesTabBody}>
        {activeNotesTab === 'month' && <MonthNotesTab mKey={mKey} monthLabel={monthLabel} notesStore={notesStore} dispatch={dispatch} />}
        {activeNotesTab === 'date'  && <DateNotesTab startKey={startKey} endKey={endKey} notesStore={notesStore} dispatch={dispatch} />}
        {activeNotesTab === 'range' && <RangeNotesTab mKey={mKey} startKey={startKey} endKey={endKey} notesStore={notesStore} dispatch={dispatch} />}
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
  dateNotes, rangeNotes,
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
        const isWeekend = colIndex === 5 || colIndex === 6;
        const isToday   = isCurrentMonth && cell.day === todayDay;
        const hasEvent  = PLACEHOLDER_EVENTS.has(cell.day);
        const holiday   = HOLIDAY_MAP[`${displayMonth}-${cell.day}`];
        const key       = dk(displayYear, displayMonth, cell.day);
        const hasDateNote = !!dateNotes[key];
        const cellRanges  = rangeNotes.filter(rn => key >= rn.start && key <= rn.end);

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
              {holiday && !isSelected && !isPreviewEnd && (
                <span className={styles.holidayEmoji} title={
                  HOLIDAYS.find(h => h.month===displayMonth && h.day===cell.day)?.label
                }>{holiday}</span>
              )}
              {hasDateNote && !isSelected && !isPreviewEnd && (
                <span className={styles.dateNoteIndicator} aria-hidden="true" />
              )}
            </span>
            {cellRanges.length > 0 && (
              <div className={styles.rangeBarsContainer}>
                {cellRanges.slice(0, 3).map(rn => (
                  <div key={rn.id} className={styles.rangeStackedBar} style={{ backgroundColor: rn.color }} title={rn.label} />
                ))}
              </div>
            )}
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

  /* Notes State */
  const [notesStore, dispatch] = useReducer(notesReducer, initialNotesStore);
  const [activeNotesTab, setActiveNotesTab] = useState('month');

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
    setActiveNotesTab('month');
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
      setActiveNotesTab('date');
    } else {
      if (key === startKey) {
         setStartKey(null);
      } else if (key > startKey) {
         setEndKey(key);
         setActiveNotesTab('range');
      } else {
         setStartKey(key);
         setActiveNotesTab('date');
      }
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
    const current = notesStore.monthNotes[mKey] || '';
    if (current.startsWith(prefix)) return;
    dispatch({ type: 'SET_MONTH_NOTE', key: mKey, value: (prefix + current).slice(0, NOTE_MAX) });
    setActiveNotesTab('month');
  }, [mKey, notesStore.monthNotes]);

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

      <HeroPanel month={month} year={year}
        prevMonth={prevMonth} isCrossfading={isCrossfading}
        goToPrev={goToPrev} goToNext={goToNext} />

      <div className={styles.bottomSection}>
        <aside className={styles.notesSidebar}>
          <NotesSection
            mKey={mKey} monthLabel={monthLabel}
            notesStore={notesStore} dispatch={dispatch}
            activeNotesTab={activeNotesTab} setActiveNotesTab={setActiveNotesTab}
            startKey={startKey} endKey={endKey}
          />
        </aside>

        <section className={styles.gridArea} aria-label="Calendar grid">
          {/* Today button */}
          {!isOnToday && (
             <div className={styles.todayRow}>
               <button className={styles.todayBtn} onClick={goToToday} aria-label="Go to current month">
                 ⌂ Today
               </button>
             </div>
          )}

          <RangeBar startKey={startKey} endKey={endKey} onClear={clearRange} />
          <DayLabelRow />

          <CalendarGrid
            cells={cells} todayDay={todayDay}
            displayYear={year} displayMonth={month} fading={fading}
            startKey={startKey} endKey={endKey} hoverKey={hoverKey}
            dateNotes={notesStore.dateNotes} rangeNotes={notesStore.rangeNotes}
            onDayClick={handleDayClick}
            onDayHover={handleDayHover}
            onGridLeave={handleGridLeave}
            onDayDoubleClick={handleDayDoubleClick}
          />
        </section>
      </div>

    </article>
  );
}
