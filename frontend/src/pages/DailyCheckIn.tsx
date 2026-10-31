import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronDown, CircleHelp, Flower2, Leaf, PencilLine, Sparkles } from "lucide-react";
import { api, apiPathDate } from "../lib/api";
import { formatReadableDate } from "../lib/dates";
import type { Activity, AnswerValue, CheckIn, CheckInResult, Category, DailySummary } from "../types";

const categories: { key: Category; title: string; caption: string }[] = [
  { key: "coding", title: "Coding & Development", caption: "Build a little, learn a lot." },
  { key: "career", title: "Career & Communication", caption: "Make space for future you." },
  { key: "health", title: "Health & Self-Care", caption: "Care for the person doing the work." },
  { key: "ai", title: "AI Learning & Homework", caption: "Stay curious and keep exploring." },
];

const statusOptions: { value: Exclude<AnswerValue, "">; label: string; short: string }[] = [
  { value: "YES", label: "Yes, completed", short: "Yes" },
  { value: "NO", label: "No, not today", short: "No" },
  { value: "SKIP", label: "Not tracked / Skip", short: "Skip" },
];

const kindWords = [
  "A gentle start is still a start.",
  "Small steps make a lovely path.",
  "Show up as you are; that is enough.",
  "Every little effort belongs here.",
  "Progress grows at its own pace.",
  "Make today yours, one thing at a time.",
];

function countSummary(summary: DailySummary) {
  return summary.completed + summary.not_completed + summary.skipped;
}

export default function DailyCheckIn() {
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get("date");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [date, setDate] = useState("");
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [savedCheckIn, setSavedCheckIn] = useState<CheckIn | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const checkInPath = requestedDate
      ? `/checkins/${apiPathDate(requestedDate)}/`
      : "/checkins/today/";
    Promise.all([api<Activity[]>("/activities/"), api<CheckInResult>(checkInPath)])
      .then(([loadedActivities, result]) => {
        if (!active) return;
        setActivities(loadedActivities);
        setDate(result.date);
        setSavedCheckIn(result.checkin);
        const nextAnswers: Record<number, AnswerValue> = {};
        const nextNotes: Record<number, string> = {};
        loadedActivities.forEach((activity) => {
          nextAnswers[activity.id] = "";
          nextNotes[activity.id] = "";
        });
        result.checkin?.responses.forEach((response) => {
          nextAnswers[response.activity_id] = response.status;
          nextNotes[response.activity_id] = response.note;
        });
        setAnswers(nextAnswers);
        setNotes(nextNotes);
      })
      .catch((caught: Error) => {
        if (active) setError(caught.message || "Your check-in could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [requestedDate]);

  const answered = useMemo(
    () => activities.filter((activity) => answers[activity.id]).length,
    [activities, answers],
  );
  const unanswered = activities.length - answered;
  const completed = activities.filter((activity) => answers[activity.id] === "YES").length;
  const isToday = Boolean(date && !requestedDate);
  const titleDate = date ? formatReadableDate(date) : "";
  const motivationIndex = date ? new Date(`${date}T12:00:00`).getDate() % kindWords.length : 0;

  function choose(activityId: number, answer: Exclude<AnswerValue, "">) {
    setAnswers((current) => ({ ...current, [activityId]: answer }));
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      const result = await api<CheckIn>(`/checkins/${apiPathDate(date)}/`, {
        method: "PUT",
        body: JSON.stringify({
          responses: activities.map((activity) => ({
            activity_id: activity.id,
            status: answers[activity.id],
            note: notes[activity.id] ?? "",
          })),
        }),
      });
      setSavedCheckIn(result);
      setAnswers(Object.fromEntries(result.responses.map((item) => [item.activity_id, item.status])));
      setNotes(Object.fromEntries(result.responses.map((item) => [item.activity_id, item.note])));
      setShowConfirm(false);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Your progress could not be saved.");
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{isToday ? "YOUR DAILY MOMENT" : "CHECK-IN HISTORY"}</p>
          <h1>{isToday ? "Let’s make today count." : "A moment to reflect."}</h1>
          <p className="muted welcome-date">{titleDate || "Loading date…"}</p>
          <p className="motivation"><Sparkles size={16} /> {kindWords[motivationIndex]}</p>
        </div>
       
      </section>

      {loading ? <div className="loading-card"><span className="spinner" /> Gathering your activities…</div> : null}
      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}

      {!loading && !error && (
        <>
          <section className="progress-card" aria-label="Daily completion progress">
            <div className="progress-top">
              <div><span className="progress-number">{completed}</span><span className="progress-total"> of {activities.length} completed</span></div>
              <span className="progress-percent">{activities.length ? Math.round((completed / activities.length) * 100) : 0}%</span>
            </div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${activities.length ? (completed / activities.length) * 100 : 0}%` }} /></div>
            <div className="progress-foot">
              <span>{answered} of {activities.length} answered</span>
              {unanswered > 0 ? <span className="remaining"><CircleHelp size={14} /> {unanswered} still to answer</span> : <span className="all-answered"><Check size={14} /> All answered</span>}
            </div>
          </section>

          {savedCheckIn && (
            <div className="notice notice-success"><Check size={17} />
              <span>Your progress for {titleDate} is saved. You can review or edit it any time.</span>
              <PencilLine size={15} />
            </div>
          )}

          {categories.map((category) => {
            const items = activities.filter((activity) => activity.category === category.key);
            if (!items.length) return null;
            return (
              <section className="activity-section" key={category.key}>
                <div className="section-heading">
                  <div><h2>{category.title}</h2><p>{category.caption}</p></div>
                  <span className="section-count">{items.filter((item) => answers[item.id]).length}/{items.length}</span>
                </div>
                <div className="activity-list">
                  {items.map((activity, index) => (
                    <article className={`activity-item ${answers[activity.id] ? `answer-${answers[activity.id].toLowerCase()}` : ""}`} key={activity.id}>
                      <div className="activity-number">{String(index + 1).padStart(2, "0")}</div>
                      <div className="activity-main">
                        <div className="activity-heading"><h3>{activity.name}</h3>{answers[activity.id] === "YES" && <span className="done-tag"><Check size={12} /> Done</span>}</div>
                        <p>{activity.description}</p>
                        <button
                          className="note-toggle"
                          type="button"
                          aria-expanded={Boolean(expandedNotes[activity.id])}
                          onClick={() => setExpandedNotes((current) => ({ ...current, [activity.id]: !current[activity.id] }))}
                        >
                          <PencilLine size={13} /> {notes[activity.id] ? "Edit note" : "Add a note"} <ChevronDown size={13} />
                        </button>
                        {expandedNotes[activity.id] && (
                          <label className="note-field">
                            <span className="sr-only">Optional note for {activity.name}</span>
                            <textarea
                              rows={2}
                              maxLength={500}
                              placeholder="A little detail to remember…"
                              value={notes[activity.id] ?? ""}
                              onChange={(event) => setNotes((current) => ({ ...current, [activity.id]: event.target.value }))}
                            />
                          </label>
                        )}
                      </div>
                      <div className="answer-group" role="group" aria-label={`Answer for ${activity.name}`}>
                        {statusOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={`answer-option ${answers[activity.id] === option.value ? `selected selected-${option.value.toLowerCase()}` : ""}`}
                            aria-pressed={answers[activity.id] === option.value}
                            aria-label={`${activity.name}: ${option.label}`}
                            onClick={() => choose(activity.id, option.value)}
                          >
                            <span className="answer-indicator">{answers[activity.id] === option.value ? <Check size={12} /> : null}</span>
                            <span>{option.short}</span>
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="save-panel">
            <div className="save-copy"><Leaf size={20} /><div><strong>{unanswered ? `${unanswered} little ${unanswered === 1 ? "answer" : "answers"} left` : "You’ve tended to every question"}</strong><span>{unanswered ? "Choose an answer for each activity before saving." : "Your progress will be saved securely to your account."}</span></div></div>
            <button className="button button-primary save-button" disabled={unanswered > 0 || saving} onClick={() => setShowConfirm(true)}>
              {savedCheckIn ? "Update This Check-in" : isToday ? "Save Today’s Progress" : "Save This Check-in"}
            </button>
          </section>
          {saveError && <div className="notice notice-error" role="alert">{saveError}</div>}

          {savedCheckIn && (
            <section className="result-card">
              <div className="result-title"><div><p className="eyebrow">YOUR DAY, AT A GLANCE</p><h2>A little progress adds up.</h2></div><span className="result-percent">{savedCheckIn.summary.completion_rate === null ? "—" : `${savedCheckIn.summary.completion_rate}%`}<small>completion</small></span></div>
              <div className="result-stats">
                <div><strong>{savedCheckIn.summary.completed}/{countSummary(savedCheckIn.summary)}</strong><span>completed</span></div>
                <div><strong>{savedCheckIn.summary.not_completed}</strong><span>not completed</span></div>
                <div><strong>{savedCheckIn.summary.skipped}</strong><span>skipped</span></div>
              </div>
              {savedCheckIn.summary.completion_rate === null && <p className="muted result-message">No activities tracked today.</p>}
              <div className="result-columns">
                <div><h3><Check size={15} /> Completed</h3><p>{savedCheckIn.responses.filter((item) => item.status === "YES").map((item) => item.activity_name).join(", ") || "Nothing checked off this time, and that’s okay."}</p></div>
                <div><h3><Leaf size={15} /> To return to</h3><p>{savedCheckIn.responses.filter((item) => item.status === "NO").map((item) => item.activity_name).join(", ") || "You made room for everything you tracked."}</p></div>
              </div>
            </section>
          )}
        </>
      )}

      {showConfirm && (
        <div className="modal-backdrop">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="confirm-icon"><Flower2 size={26} /></div>
            <h2 id="confirm-title">{savedCheckIn ? "Update this check-in?" : "Save your progress?"}</h2>
            <p>We’ll save your answers for {titleDate}. You can come back and edit them later.</p>
            <form className="dialog-actions" onSubmit={(event) => { event.preventDefault(); void save(); }}>
              <button type="button" className="button button-soft" disabled={saving} onClick={() => setShowConfirm(false)}>Keep reviewing</button>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Yes, save it"}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
