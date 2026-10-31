import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Flame, Leaf, Sparkles, Trophy } from "lucide-react";
import Heatmap from "../components/Heatmap";
import { api, apiPathDate } from "../lib/api";
import { formatReadableDate, shiftDate } from "../lib/dates";
import type {
  Activity,
  ActivityCalendarDay,
  ActivityStats,
  CalendarDay,
  CheckInResult,
  CheckIn,
  Category,
  StreakSummary,
} from "../types";

const categoryLabels: Record<Category, string> = {
  coding: "Coding & Development",
  career: "Career & Communication",
  health: "Health & Self-Care",
  ai: " Learning & Homework",
};
const filters: { value: "all" | Category; label: string }[] = [
  { value: "all", label: "All activities" },
  { value: "coding", label: "Coding & Development" },
  { value: "career", label: "Career & Communication" },
  { value: "health", label: "Health & Self-Care" },
  { value: "ai", label: " Learning & Homework" },
];

function percentage(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function dateRange(endDate: string) {
  return { start: shiftDate(endDate, -364), end: endDate };
}

interface SelectedOverall {
  date: string;
  checkin: CheckIn | null;
}

interface SelectedActivity {
  date: string;
  name: string;
  status: string | null;
  note: string;
  hasCheckIn: boolean;
}

export default function MyStreaks() {
  const [summary, setSummary] = useState<StreakSummary | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [activityCalendars, setActivityCalendars] = useState<Record<string, ActivityCalendarDay[]>>({});
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [endDate, setEndDate] = useState("");
  const [today, setToday] = useState("");
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [selectedOverall, setSelectedOverall] = useState<SelectedOverall | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<SelectedActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api<StreakSummary>("/streaks/summary/"),
      api<Activity[]>("/activities/"),
      api<CheckInResult>("/checkins/today/"),
    ])
      .then(async ([loadedSummary, loadedActivities, todayResult]) => {
        if (!active) return;
        const date = todayResult.date;
        setSummary(loadedSummary);
        setActivities(loadedActivities);
        setToday(date);
        setEndDate(date);
        await loadPeriod(date, loadedActivities, active);
      })
      .catch((caught: Error) => {
        if (active) setError(caught.message || "Your streak history could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function loadPeriod(periodEnd: string, activityList = activities, active = true) {
    const { start, end } = dateRange(periodEnd);
    const query = `?start_date=${start}&end_date=${end}`;
    const [days, records, ...perActivity] = await Promise.all([
      api<CalendarDay[]>(`/streaks/calendar/${query}`),
      api<CheckIn[]>(`/checkins/${query}`),
      ...activityList.map((activity) =>
        api<ActivityCalendarDay[]>(
          `/streaks/activities/${encodeURIComponent(activity.slug)}/calendar/${query}`,
        ),
      ),
    ]);
    if (!active) return;
    setCalendar(days);
    setHistory(records);
    setActivityCalendars(
      Object.fromEntries(activityList.map((activity, index) => [activity.slug, perActivity[index]])),
    );
  }

  async function changePeriod(nextEndDate: string) {
    setEndDate(nextEndDate);
    setSelectedOverall(null);
    setSelectedActivity(null);
    setLoading(true);
    setError("");
    try {
      await loadPeriod(nextEndDate);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This calendar period could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function selectOverall(day: CalendarDay) {
    setSelectedActivity(null);
    try {
      const result = await api<CheckInResult>(`/checkins/${apiPathDate(day.date)}/`);
      setSelectedOverall({ date: day.date, checkin: result.checkin });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The selected date could not be loaded.");
    }
  }

  function selectActivity(day: ActivityCalendarDay, activity: Activity) {
    setSelectedOverall(null);
    setSelectedActivity({
      date: day.date,
      name: activity.name,
      status: day.status,
      note: day.note,
      hasCheckIn: day.has_checkin,
    });
  }

  const visibleStats = useMemo(
    () => summary?.activities.filter((item) => filter === "all" || item.category === filter) ?? [],
    [filter, summary],
  );
  const mostConsistent = [...(summary?.activities ?? [])]
    .sort((left, right) => right.current_streak - left.current_streak || right.longest_streak - left.longest_streak)
    .slice(0, 3);
  const { start, end } = endDate ? dateRange(endDate) : { start: "", end: "" };
  const recentHistory = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  return (
    <div className="page-stack streak-page">
      <section className="streak-heading">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> YOUR GROWTH, OVER TIME</p>
          <h1>My Consistency Garden</h1>
          <p className="muted">Small steps, repeated daily.</p>
        </div>
        <div className="heading-flower" aria-hidden="true"><Leaf size={27} /><span>keep<br />growing</span></div>
      </section>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {loading && <div className="loading-card"><span className="spinner" /> Gathering your garden…</div>}

      {!loading && summary && (
        <>
          <section className="stat-grid" aria-label="Streak summary">
            <article className="stat-card"><span className="stat-icon stat-purple"><Flame size={18} /></span><strong>{summary.current_active_streak} days</strong><span>Current active streak</span><small>Consecutive days with at least one completed activity, through today or yesterday.</small></article>
            <article className="stat-card"><span className="stat-icon stat-pink"><Trophy size={18} /></span><strong>{summary.best_individual_activity_streak} days</strong><span>Best activity streak</span><small>Your longest consecutive Yes streak for any one activity.</small></article>
            <article className="stat-card"><span className="stat-icon stat-green"><Check size={18} /></span><strong>{summary.total_completed_activity_days}</strong><span>Completed activity-days</span><small>Every saved Yes response counts once.</small></article>
            <article className="stat-card"><span className="stat-icon stat-peach"><CalendarDays size={18} /></span><strong>{percentage(summary.overall_completion_rate)}</strong><span>Overall completion rate</span><small>Yes answers divided by all saved Yes and No answers; skips are excluded.</small></article>
          </section>

          {mostConsistent.length > 0 && (
            <section className="consistent-strip">
              <span className="consistent-label">Growing steadily</span>
              {mostConsistent.map((item) => <span className="consistent-pill" key={item.slug}>{item.name}<strong>{item.current_streak}d</strong></span>)}
            </section>
          )}

          <section className="panel overall-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">A YEAR IN LITTLE WINS</p><h2>Overall activity</h2><p className="muted">Shade reflects completed activities on each saved day. Empty cells are unrecorded, not missed.</p></div>
              <div className="period-controls">
                <button className="icon-button" aria-label="Previous 365 days" disabled={!start} onClick={() => void changePeriod(shiftDate(endDate, -365))}><ArrowLeft size={17} /></button>
                <label className="date-picker-label"><span className="sr-only">Calendar end date</span><input aria-label="Calendar end date" type="date" max={today} value={endDate} onChange={(event) => event.target.value && void changePeriod(event.target.value)} /></label>
                <button className="icon-button" aria-label="Next 365 days" disabled={!endDate || endDate >= today} onClick={() => void changePeriod(shiftDate(endDate, 365) > today ? today : shiftDate(endDate, 365))}><ArrowRight size={17} /></button>
              </div>
            </div>
            <div className="calendar-period">{start && `${formatReadableDate(start, { day: undefined })} — ${formatReadableDate(end)}`}</div>
            <div className="calendar-scroll">
              {calendar.length > 0 && <Heatmap days={calendar} selectedDate={selectedOverall?.date} onSelect={(day) => void selectOverall(day)} />}
            </div>
            <div className="heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i className={`heatmap-cell level-${level}`} key={level} />)}<span>More</span><span className="legend-note">1–2 · 3–5 · 6–8 · 9–11 completed</span></div>
            {selectedOverall && (
              <div className="selected-detail">
                <div className="detail-heading"><div><p className="eyebrow">DAY DETAILS</p><h3>{formatReadableDate(selectedOverall.date)}</h3></div><button className="text-button" onClick={() => setSelectedOverall(null)}>Close</button></div>
                {!selectedOverall.checkin ? <p className="muted">No check-in recorded for this date.</p> : (
                  <>
                    <div className="detail-summary"><span>{selectedOverall.checkin.summary.completed} completed</span><span>{selectedOverall.checkin.summary.not_completed} not completed</span><span>{selectedOverall.checkin.summary.skipped} skipped</span><span>{percentage(selectedOverall.checkin.summary.completion_rate)} completion</span></div>
                    <div className="response-detail-list">
                      {selectedOverall.checkin.responses.map((response) => (
                        <div className="response-detail" key={response.activity_id}><span>{response.activity_name}</span><strong className={`status-text status-${response.status.toLowerCase()}`}>{response.status === "YES" ? "Completed" : response.status === "NO" ? "Not completed" : "Skipped"}</strong>{response.note && <small>{response.note}</small>}</div>
                      ))}
                    </div>
                    <Link className="button button-soft edit-link" to={`/daily-checkin?date=${encodeURIComponent(selectedOverall.date)}`}>Edit this check-in</Link>
                  </>
                )}
              </div>
            )}
            {selectedActivity && (
              <div className="selected-detail">
                <div className="detail-heading"><div><p className="eyebrow">{selectedActivity.name.toUpperCase()}</p><h3>{formatReadableDate(selectedActivity.date)}</h3></div><button className="text-button" onClick={() => setSelectedActivity(null)}>Close</button></div>
                {!selectedActivity.hasCheckIn ? <p className="muted">No check-in recorded for this date.</p> : selectedActivity.status ? <div><strong className={`status-text status-${selectedActivity.status.toLowerCase()}`}>{selectedActivity.status === "YES" ? "Completed" : selectedActivity.status === "NO" ? "Not completed" : "Skipped"}</strong>{selectedActivity.note && <p className="activity-note-detail">{selectedActivity.note}</p>}<p className="muted detail-hint">Open the day details to see your other answers.</p></div> : <p className="muted">No answer was recorded for this activity on that date.</p>}
              </div>
            )}
          </section>

          <section className="history-panel panel">
            <div className="panel-heading compact-heading"><div><p className="eyebrow">SAVED DAYS</p><h2>Recent history</h2></div><span className="muted">{history.length} check-ins in this period</span></div>
            {recentHistory.length ? <div className="history-list">{recentHistory.map((checkin) => (
              <button className="history-row" key={checkin.id} onClick={() => void selectOverall({ date: checkin.date, has_checkin: true, completed: checkin.summary.completed, not_completed: checkin.summary.not_completed, skipped: checkin.summary.skipped, completion_rate: checkin.summary.completion_rate, level: 0 })}>
                <span className="history-date">{formatReadableDate(checkin.date, { weekday: "short", year: undefined })}</span><span>{checkin.summary.completed} completed</span><span>{checkin.summary.skipped} skipped</span><strong>{percentage(checkin.summary.completion_rate)}</strong>
              </button>
            ))}</div> : <div className="empty-history"><CalendarDays size={21} /><p>No saved check-ins in this period yet.</p></div>}
          </section>

          <section className="activity-analytics">
            <div className="section-heading analytics-heading"><div><p className="eyebrow">ONE HABIT AT A TIME</p><h2>Your activity gardens</h2><p>Each calendar is calculated from that activity’s saved answers.</p></div></div>
            <div className="filter-row" role="group" aria-label="Filter activities by category">
              {filters.map((item) => <button key={item.value} className={`filter-chip ${filter === item.value ? "selected" : ""}`} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
            </div>
            <div className="activity-analytics-grid">
              {visibleStats.map((stats) => {
                const activity = activities.find((item) => item.slug === stats.slug);
                if (!activity) return null;
                return <ActivityCard
                  key={stats.slug}
                  activity={activity}
                  stats={stats}
                  days={activityCalendars[stats.slug] ?? []}
                  rangeStart={start}
                  onSelect={(day) => selectActivity(day, activity)}
                />;
              })}
            </div>
          </section>
          {visibleStats.length === 0 && <div className="empty-history">No activities in this category yet.</div>}
          <p className="timezone-note">Calendar dates and streaks use your configured timezone: <strong>{summary.timezone}</strong>.</p>
        </>
      )}
    </div>
  );
}

interface ActivityCardProps {
  activity: Activity;
  stats: ActivityStats;
  days: ActivityCalendarDay[];
  rangeStart: string;
  onSelect: (day: ActivityCalendarDay) => void;
}

function ActivityCard({ activity, stats, days, rangeStart, onSelect }: ActivityCardProps) {
  const recentDays = days.slice(-91).map((day) => ({
    ...day,
    completed: day.status === "YES" ? 1 : 0,
    not_completed: day.status === "NO" ? 1 : 0,
    skipped: day.status === "SKIP" ? 1 : 0,
    completion_rate: day.status === "YES" ? 100 : day.status === "NO" ? 0 : null,
    level: day.status === "YES" ? 4 : 0,
  }));
  return (
    <details className="activity-analytics-card">
      <summary>
        <div className="activity-card-title"><span className="activity-dot" /><div><h3>{activity.name}</h3><small>{categoryLabels[activity.category]}</small></div></div>
        <div className="activity-card-stats"><span><strong>{stats.current_streak}</strong> current</span><span><strong>{stats.longest_streak}</strong> best</span><span><strong>{stats.total_completed_days}</strong> done</span></div>
        <span className="expand-label">View calendar</span>
      </summary>
      <div className="activity-card-body">
        <div className="activity-metrics"><span><strong>{percentage(stats.completion_rate)}</strong> completion rate</span><span><strong>{stats.last_completed_date ? formatReadableDate(stats.last_completed_date, { year: undefined }) : "—"}</strong> last completed</span></div>
        {stats.current_streak === 0 && stats.latest_streak > 0 && (
          <p className="ended-streak">Latest streak: {stats.latest_streak} days, ended {stats.latest_streak_end ? formatReadableDate(stats.latest_streak_end) : ""}. Missing or No/Skip dates break a streak.</p>
        )}
        <div className="mini-calendar-label">Recent 13 weeks <span className="muted"> · select a day for details</span></div>
        <div className="calendar-scroll"><Heatmap days={recentDays} onSelect={onSelect} compact /></div>
        <details className="full-calendar-disclosure">
          <summary>View all 365 days in this period{rangeStart ? ` from ${formatReadableDate(rangeStart)}` : ""}</summary>
          <div className="calendar-scroll full-activity-calendar"><Heatmap days={days.map((day) => ({
            ...day,
            completed: day.status === "YES" ? 1 : 0,
            not_completed: day.status === "NO" ? 1 : 0,
            skipped: day.status === "SKIP" ? 1 : 0,
            completion_rate: day.status === "YES" ? 100 : day.status === "NO" ? 0 : null,
            level: day.status === "YES" ? 4 : 0,
          }))} onSelect={onSelect} /></div>
        </details>
      </div>
    </details>
  );
}
