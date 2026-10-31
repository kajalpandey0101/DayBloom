from datetime import date, timedelta


def consecutive_runs(completed_dates):
    """Return each run of consecutive completed local calendar dates."""
    ordered = sorted(set(completed_dates))
    if not ordered:
        return []

    runs = []
    start = previous = ordered[0]
    for current in ordered[1:]:
        if current != previous + timedelta(days=1):
            runs.append((start, previous))
            start = current
        previous = current
    runs.append((start, previous))
    return runs


def streak_stats(status_by_date, today):
    completed_dates = sorted(
        day
        for day, status in status_by_date.items()
        if status == "YES" and day <= today
    )
    runs = consecutive_runs(completed_dates)
    latest_run = runs[-1] if runs else None
    best_run = max((end - start).days + 1 for start, end in runs) if runs else 0

    current = 0
    today_status = status_by_date.get(today)
    if (
        latest_run
        and today_status not in {"NO", "SKIP"}
        and latest_run[1] >= today - timedelta(days=1)
    ):
        current = (latest_run[1] - latest_run[0]).days + 1

    return {
        "current_streak": current,
        "longest_streak": best_run,
        "latest_streak": (latest_run[1] - latest_run[0]).days + 1 if latest_run else 0,
        "latest_streak_end": latest_run[1].isoformat() if latest_run else None,
        "latest_streak_is_active": current > 0,
        "total_completed_days": len(completed_dates),
        "last_completed_date": completed_dates[-1].isoformat() if completed_dates else None,
    }


def completion_rate(responses):
    tracked = [response for response in responses if response != "SKIP"]
    return round(sum(response == "YES" for response in tracked) / len(tracked) * 100, 1) if tracked else None


def daily_summary(responses):
    completed = sum(response == "YES" for response in responses)
    not_completed = sum(response == "NO" for response in responses)
    skipped = sum(response == "SKIP" for response in responses)
    return {
        "completed": completed,
        "not_completed": not_completed,
        "skipped": skipped,
        "completion_rate": completion_rate(responses),
    }
