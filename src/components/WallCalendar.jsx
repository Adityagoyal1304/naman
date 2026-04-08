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

/* ─────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────── */

/** Sortable date key "YYYY-MM-DD" */
function dk(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

/** "Apr 9, 2026" from a dk key */
function fmtKey(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return `${MONTH_ABBR[m - 1]} ${d}, ${y}`;
}

function buildCalendarCells(year, month) {
  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++)     cells.push({ type: 'empty' });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: 'day', day: d });
  while (cells.length < 42)              cells.push({ type: 'empty' });
  return cells;
}

/* ─────────────────────────────────────────────────
   Static sub-components (no range props needed)
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

function HeroPanel({ monthName, year }) {
  return (
    <aside className={styles.leftPanel} aria-label="Calendar hero image panel">
      <div className={styles.heroImageArea}>
        <div className={styles.imagePlaceholder} role="img" aria-label="Decorative illustration">
          <div className={styles.decorCircle} aria-hidden="true" />
        </div>
        <div className={styles.monthOverlay}>
          <h1 className={styles.monthName}>{monthName}</h1>
          <p className={styles.yearLabel}>{year}</p>
        </div>
      </div>
    </aside>
  );
}

function DayLabelRow() {
  return (
    <div className={styles.dayLabels} role="row">
      {DAY_LABELS.map((label, i) => (
        <div
          key={label}
          className={`${styles.dayLabel}${i === 0 || i === 6 ? ' ' + styles.dayLabelWeekend : ''}`}
          role="columnheader"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function NotesSection({ lineCount = 5 }) {
  return (
    <section className={styles.notesSection} aria-label="Notes area">
      <div className={styles.notesSectionTitle}>Notes</div>
      <div className={styles.noteLines} role="presentation">
        {Array.from({ length: lineCount }).map((_, i) => (
          <div key={i} className={styles.noteLine} aria-hidden="true" />
        ))}
      </div>
    </section>
  );
}

/** Animated info bar showing the selected range */
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
   CalendarGrid — carries all range rendering logic
───────────────────────────────────────────────── */

function CalendarGrid({
  cells, todayDay, displayYear, displayMonth, fading,
  startKey, endKey, hoverKey,
  onDayClick, onDayHover, onGridLeave,
}) {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === displayYear && today.getMonth() === displayMonth;

  // Effective end = confirmed endKey, or hoverKey while building range
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
        const key       = dk(displayYear, displayMonth, cell.day);

        /* ── Ordered range endpoints for rendering ── */
        let loKey = null, hiKey = null;
        if (startKey && effectiveEnd && startKey !== effectiveEnd) {
          [loKey, hiKey] = startKey <= effectiveEnd
            ? [startKey, effectiveEnd]
            : [effectiveEnd, startKey];
        }

        const isVisualStart  = !!loKey && key === loKey;
        const isVisualEnd    = !!hiKey && key === hiKey;
        const isInBetween    = !!(loKey && hiKey && key > loKey && key < hiKey);
        const isSinglePoint  = !!(startKey && !effectiveEnd && key === startKey);
        const isSelected     = isVisualStart || isVisualEnd || isSinglePoint;
        // The hover-end is the non-startKey endpoint of a preview range
        const isPreviewEnd   = isPreview && isVisualEnd && key !== startKey;

        /* ── Outer cell: band background (gap:0 grid so bands are flush) ── */
        let bandCls = null;
        if (isInBetween) {
          bandCls = isPreview ? styles.bandPreviewMid : styles.bandMid;
        } else if (isVisualStart && !isSinglePoint) {
          bandCls = isPreview ? styles.bandPreviewStart : styles.bandStart;
        } else if (isVisualEnd) {
          bandCls = isPreview ? styles.bandPreviewEnd : styles.bandEnd;
        }

        /* ── Inner cell: circle / today ring / hover highlight ── */
        let circleCls = null;
        if (isSelected && !isPreviewEnd)  circleCls = styles.circleSelected;
        else if (isPreviewEnd)             circleCls = styles.circlePreview;
        else if (isToday)                  circleCls = styles.circleToday;

        const outerCls = [styles.dayCell, bandCls].filter(Boolean).join(' ');
        const innerCls = [
          styles.cellInner,
          circleCls,
          !isSelected && !isPreviewEnd && !isInBetween && styles.cellHoverable,
        ].filter(Boolean).join(' ');

        return (
          <div
            key={idx}
            className={outerCls}
            role="gridcell"
            aria-label={
              `${MONTH_NAMES[displayMonth]} ${cell.day}` +
              (isToday    ? ', today'     : '') +
              (isSelected ? ', selected'  : '') +
              (hasEvent   ? ', has event' : '')
            }
            aria-current={isToday    ? 'date' : undefined}
            aria-pressed={isSelected ? 'true' : undefined}
            onClick={() => onDayClick(key)}
            onMouseEnter={() => onDayHover(key)}
          >
            <span className={innerCls}>
              <span className={[
                styles.dateNum,
                isWeekend && !isSelected && !isPreviewEnd && styles.dateNumWeekend,
              ].filter(Boolean).join(' ')}>
                {cell.day}
              </span>
              {/* Today underline tick — hidden when selected */}
              {isToday && !isSelected && !isPreviewEnd && (
                <span className={styles.todayTick} aria-hidden="true" />
              )}
              {/* Event dot — hidden inside range */}
              {hasEvent && !isSelected && !isPreviewEnd && !isInBetween && (
                <span className={styles.eventDot} aria-hidden="true" />
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

  /* Range selection state */
  const [startKey, setStartKey] = useState(null);
  const [endKey,   setEndKey]   = useState(null);
  const [hoverKey, setHoverKey] = useState(null);

  const todayDay = now.getDate();
  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  /* Month-change fade animation */
  const triggerFade = useCallback((changeFn) => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setFading(true);
    fadeTimer.current = setTimeout(() => { changeFn(); setFading(false); }, 120);
  }, []);
  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const goToPrev = () => triggerFade(() => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  });
  const goToNext = () => triggerFade(() => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  });

  /* ── Click logic (3-state cycle) ──
     State A: no startKey        → click → set startKey
     State B: startKey, no endKey → click after  → set endKey (done)
                                  → click same   → cancel
                                  → click before → shift startKey
     State C: both set           → click → reset to new startKey          */
  const handleDayClick = useCallback((key) => {
    setHoverKey(null);
    if (!startKey || endKey) {
      setStartKey(key); setEndKey(null);
    } else {
      if (key === startKey) {
        setStartKey(null);
      } else if (key > startKey) {
        setEndKey(key);
      } else {
        setStartKey(key); // shift start earlier
      }
    }
  }, [startKey, endKey]);

  const handleDayHover   = useCallback((key) => {
    if (startKey && !endKey) setHoverKey(key);
  }, [startKey, endKey]);

  const handleGridLeave  = useCallback(() => setHoverKey(null), []);
  const clearRange       = useCallback(() => {
    setStartKey(null); setEndKey(null); setHoverKey(null);
  }, []);

  return (
    <article
      className={styles.calendarWrapper}
      aria-label={`Wall calendar — ${MONTH_NAMES[month]} ${year}`}
    >
      <BindingStrip />

      <div className={styles.calendarBody}>
        <HeroPanel monthName={MONTH_NAMES[month]} year={year} />

        <section className={styles.rightPanel} aria-label="Calendar grid and notes">
          <div className={styles.gridSection}>

            {/* Nav header */}
            <div className={styles.gridHeader}>
              <button className={styles.navBtn} onClick={goToPrev} aria-label="Previous month">←</button>
              <span className={[styles.gridTitle, fading && styles.gridTitleFading].filter(Boolean).join(' ')}>
                {MONTH_NAMES[month]} {year}
              </span>
              <button className={styles.navBtn} onClick={goToNext} aria-label="Next month">→</button>
            </div>

            {/* Range info bar */}
            <RangeBar startKey={startKey} endKey={endKey} onClear={clearRange} />

            <DayLabelRow />

            <CalendarGrid
              cells={cells}
              todayDay={todayDay}
              displayYear={year}
              displayMonth={month}
              fading={fading}
              startKey={startKey}
              endKey={endKey}
              hoverKey={hoverKey}
              onDayClick={handleDayClick}
              onDayHover={handleDayHover}
              onGridLeave={handleGridLeave}
            />
          </div>

          <div className={styles.divider} role="separator" />
          <NotesSection lineCount={5} />
        </section>
      </div>
    </article>
  );
}
