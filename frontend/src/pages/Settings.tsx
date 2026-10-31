import { FormEvent, useEffect, useState } from "react";
import { Archive, Plus, Save } from "lucide-react";
import { api } from "../lib/api";
import type { Activity, Category } from "../types";

const categoryOptions: { value: Category; label: string }[] = [
  { value: "coding", label: "Coding & Development" },
  { value: "career", label: "Career & Communication" },
  { value: "health", label: "Health & Self-Care" },
  { value: "ai", label: "AI Learning & Homework" },
];

export default function Settings() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("coding");
  const [sortOrder, setSortOrder] = useState(120);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadActivities() {
    const result = await api<Activity[]>("/activities/?include_inactive=true");
    setActivities(result);
    setSortOrder(Math.max(100, ...result.map((activity) => activity.sort_order)) + 10);
  }

  useEffect(() => {
    loadActivities()
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api<Activity>("/activities/manage/", {
        method: "POST",
        body: JSON.stringify({ name, description, category, sort_order: sortOrder, is_active: true }),
      });
      setName("");
      setDescription("");
      setMessage("Your new activity is ready for your next check-in.");
      await loadActivities();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Activity could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivity(activity: Activity) {
    setError("");
    setMessage("");
    try {
      await api<Activity>(`/activities/${activity.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !activity.is_active }),
      });
      setActivities((current) => current.map((item) => item.id === activity.id ? { ...item, is_active: !activity.is_active } : item));
      setMessage(activity.is_active ? `${activity.name} was archived. Its saved history is preserved.` : `${activity.name} is active again.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Activity could not be updated.");
    }
  }

  return (
    <div className="page-stack settings-page">
      <section className="streak-heading">
        <div><p className="eyebrow">MAKE IT YOURS</p><h1>Garden settings</h1><p className="muted">Shape the activities you want to nurture.</p></div>
      </section>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {message && <div className="notice notice-success" role="status">{message}</div>}
      <section className="panel settings-panel">
        <div className="panel-heading compact-heading"><div><p className="eyebrow">YOUR ROUTINE</p><h2>Manage activities</h2><p className="muted">Archived activities keep their history and can be restored any time.</p></div></div>
        <form className="activity-form" onSubmit={addActivity}>
          <label className="field-label" htmlFor="activity-name">Activity name</label>
          <input id="activity-name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required />
          <label className="field-label" htmlFor="activity-description">Question or description</label>
          <input id="activity-description" maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} required />
          <div className="form-row">
            <div><label className="field-label" htmlFor="activity-category">Category</label><select id="activity-category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div><label className="field-label" htmlFor="activity-order">Display order</label><input id="activity-order" type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></div>
          </div>
          <button className="button button-primary" disabled={saving}><Plus size={16} /> {saving ? "Adding…" : "Add activity"}</button>
        </form>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading compact-heading"><div><p className="eyebrow">ACTIVITY LIST</p><h2>{activities.length} activities</h2></div></div>
        {loading ? <div className="loading-card"><span className="spinner" /> Loading activities…</div> : (
          <div className="manage-list">{activities.map((activity) => (
            <div className={`manage-row ${activity.is_active ? "" : "inactive"}`} key={activity.id}>
              <div><strong>{activity.name}</strong><span>{categoryOptions.find((option) => option.value === activity.category)?.label} · order {activity.sort_order}</span></div>
              <button className="button button-soft" onClick={() => void toggleActivity(activity)}>{activity.is_active ? <><Archive size={15} /> Archive</> : <><Save size={15} /> Restore</>}</button>
            </div>
          ))}</div>
        )}
      </section>
    </div>
  );
}
