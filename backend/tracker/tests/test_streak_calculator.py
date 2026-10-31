from datetime import date, timedelta

from tracker.services.streak_calculator import completion_rate, daily_summary, streak_stats


def test_three_consecutive_days_make_a_three_day_streak():
    today = date(2026, 10, 25)
    stats = streak_stats(
        {
            today - timedelta(days=2): "YES",
            today - timedelta(days=1): "YES",
            today: "YES",
        },
        today,
    )

    assert stats["current_streak"] == 3
    assert stats["longest_streak"] == 3
    assert stats["latest_streak_is_active"] is True


def test_no_and_skipped_answers_break_a_streak():
    today = date(2026, 10, 25)
    stats = streak_stats(
        {
            today - timedelta(days=3): "YES",
            today - timedelta(days=2): "YES",
            today - timedelta(days=1): "NO",
            today: "YES",
        },
        today,
    )

    assert stats["current_streak"] == 1
    assert stats["longest_streak"] == 2

    skipped = streak_stats(
        {today - timedelta(days=1): "YES", today: "SKIP"},
        today,
    )
    assert skipped["current_streak"] == 0


def test_missing_past_date_breaks_continuity_and_ended_run_is_not_active():
    today = date(2026, 10, 25)
    stats = streak_stats(
        {
            today - timedelta(days=5): "YES",
            today - timedelta(days=4): "YES",
            today - timedelta(days=2): "YES",
        },
        today,
    )

    assert stats["current_streak"] == 0
    assert stats["longest_streak"] == 2
    assert stats["latest_streak"] == 1
    assert stats["latest_streak_is_active"] is False


def test_future_yes_answers_do_not_count_and_historical_edits_recalculate():
    today = date(2026, 10, 25)
    before_edit = {
        today - timedelta(days=2): "YES",
        today - timedelta(days=1): "NO",
        today: "YES",
        today + timedelta(days=1): "YES",
    }
    assert streak_stats(before_edit, today)["longest_streak"] == 1

    after_edit = {**before_edit, today - timedelta(days=1): "YES"}
    assert streak_stats(after_edit, today)["current_streak"] == 3
    assert streak_stats(after_edit, today)["longest_streak"] == 3


def test_completion_rate_excludes_skips_and_handles_all_skipped():
    assert completion_rate(["YES", "NO", "SKIP"]) == 50
    assert completion_rate(["SKIP"]) is None
    assert daily_summary(["YES", "NO", "SKIP"]) == {
        "completed": 1,
        "not_completed": 1,
        "skipped": 1,
        "completion_rate": 50,
    }
