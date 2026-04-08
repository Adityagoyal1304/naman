import { useState, useMemo } from 'react';
import styles from './WallCalendar.module.css';

/* ──────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────── */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Placeholder event days — simulate some dots */
const PLACEHOLDER_EVENTS = new Set([3, 11, 17, 22, 28]);

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

/**
 * Build the cell array for a given month.
 * Returns an array of 42 items (6 rows × 7 cols):
 *   null  → empty leading/trailing cell
 *   number → day number in the current month
 */
function buildCalendarCells(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) cells.push({ type: 'empty', day: null });

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ type: 'day', day: d });
  }

  // Trailing empty cells (fill to 42)
  while (cells.length < 42) cells.push({ type: 'empty', day: null });

  return cells;
}

/* ──────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────── */

/** The binding strip with ring holes */
function BindingStrip() {
  const rings = Array.from({ length: 9 });
  return (
    <div className={styles.bindingStrip} role="presentation" aria-hidden="true">
      {rings.map((_, i) => (
        <span key={i} className={styles.bindingRing} />
      ))}
    </div>
  );
}

/** Left decorative hero panel */
function HeroPanel({ monthName, year }) {
  return (
    <aside className={styles.leftPanel} aria-label="Calendar hero image panel">
      <div className={styles.heroImageArea}>
        {/* Placeholder image area — swap with <img> or background later */}
        <div className={styles.imagePlaceholder} role="img" aria-label="Decorative calendar illustration">
          <div className={styles.decorCircle} aria-hidden="true" />
        </div>

        {/* Month / Year overlay */}
        <div className={styles.monthOverlay}>
          <h1 className={styles.monthName}>{monthName}</h1>
          <p className={styles.yearLabel}>{year}</p>
        </div>
      </div>
    </aside>
  );
}

/** Day-of-week header row */
function DayLabelRow() {
  return (
    <div className={styles.dayLabels} role="row">
      {DAY_LABELS.map((label, i) => (
        <div
          key={label}
          className={`${styles.dayLabel} ${i === 0 || i === 6 ? styles.weekend : ''}`}
          role="columnheader"
          aria-label={label}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

/** Individual day cell */
function DayCell({ cell, isToday }) {
  if (cell.type === 'empty') {
    return <div className={styles.dayCell + ' ' + styles.empty} aria-hidden="true" />;
  }

  const colIndex = (cell.day + /* offset already baked into position */ 0) % 7; // simplified
  // Determine weekend by cell index position in the weekly grid
  const isWeekend = false; // computed below in CalendarGrid with real col index
  const hasEvent = PLACEHOLDER_EVENTS.has(cell.day);

  return (
    <div
      className={[
        styles.dayCell,
        isToday && styles.today,
        hasEvent && styles.hasEvent,
      ].filter(Boolean).join(' ')}
      role="gridcell"
      aria-label={`Day ${cell.day}${isToday ? ', today' : ''}${hasEvent ? ', has event' : ''}`}
      aria-current={isToday ? 'date' : undefined}
    >
      {cell.day}
    </div>
  );
}

/** Full calendar grid (day labels + cells) */
function CalendarGrid({ cells, todayDay, displayYear, displayMonth }) {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === displayYear && today.getMonth() === displayMonth;

  return (
    <div className={styles.calGrid} role="grid" aria-label="Calendar date grid">
      {cells.map((cell, idx) => {
        const colIndex = idx % 7;
        const isWeekend = colIndex === 0 || colIndex === 6;
        const isToday = isCurrentMonth && cell.type === 'day' && cell.day === todayDay;
        const hasEvent = cell.type === 'day' && PLACEHOLDER_EVENTS.has(cell.day);

        if (cell.type === 'empty') {
          return <div key={idx} className={`${styles.dayCell} ${styles.empty}`} aria-hidden="true" />;
        }

        return (
          <div
            key={idx}
            className={[
              styles.dayCell,
              isWeekend && styles.weekend,
              isToday && styles.today,
              hasEvent && styles.hasEvent,
            ].filter(Boolean).join(' ')}
            role="gridcell"
            aria-label={`${MONTH_NAMES[displayMonth]} ${cell.day}${isToday ? ', today' : ''}${hasEvent ? ', event' : ''}`}
            aria-current={isToday ? 'date' : undefined}
          >
            {cell.day}
          </div>
        );
      })}
    </div>
  );
}

/** The lined notes section */
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

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */

/**
 * WallCalendar
 *
 * A two-panel wall-calendar component built with React hooks and CSS Modules.
 * No external UI libraries required.
 *
 * @param {object}  props
 * @param {number}  [props.initialYear]   – override starting year
 * @param {number}  [props.initialMonth]  – override starting month (0-indexed)
 */
export default function WallCalendar({ initialYear, initialMonth } = {}) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());

  const todayDay = now.getDate();

  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const goToPrev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goToNext = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <article className={styles.calendarWrapper} aria-label={`Wall calendar — ${MONTH_NAMES[month]} ${year}`}>

      {/* ── Binding strip ── */}
      <BindingStrip />

      {/* ── Two-panel body ── */}
      <div className={styles.calendarBody}>

        {/* ── LEFT: Hero / image ── */}
        <HeroPanel monthName={MONTH_NAMES[month]} year={year} />

        {/* ── RIGHT: Grid + Notes ── */}
        <section className={styles.rightPanel} aria-label="Calendar grid and notes">

          {/* Grid header with nav */}
          <div className={styles.gridSection}>
            <div className={styles.gridHeader}>
              <button
                className={styles.navBtn}
                onClick={goToPrev}
                aria-label="Previous month"
                title="Previous month"
              >
                ‹
              </button>
              <span className={styles.gridTitle}>
                {MONTH_NAMES[month].slice(0, 3).toUpperCase()} · {year}
              </span>
              <button
                className={styles.navBtn}
                onClick={goToNext}
                aria-label="Next month"
                title="Next month"
              >
                ›
              </button>
            </div>

            {/* Day-of-week labels */}
            <DayLabelRow />

            {/* Date grid */}
            <CalendarGrid
              cells={cells}
              todayDay={todayDay}
              displayYear={year}
              displayMonth={month}
            />
          </div>

          {/* Divider */}
          <div className={styles.divider} role="separator" />

          {/* Notes section */}
          <NotesSection lineCount={5} />

        </section>
      </div>
    </article>
  );
}
