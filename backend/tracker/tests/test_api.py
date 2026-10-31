from datetime import date, timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from tracker.models import Activity, ActivityResponse, DailyCheckIn


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="garden", password="test-password")


@pytest.fixture
def client(user):
    api_client = APIClient()
    api_client.force_authenticate(user)
    return api_client


def response_payload(statuses=None):
    statuses = statuses or {}
    return {
        "responses": [
            {
                "activity_id": activity.id,
                "status": statuses.get(activity.slug, "NO"),
                "note": f"Note for {activity.name}" if activity.slug == "leetcode" else "",
            }
            for activity in Activity.objects.filter(is_active=True)
        ]
    }


@pytest.mark.django_db
def test_seed_contains_exactly_the_eleven_default_activities(client):
    response = client.get(reverse("activities"))
    assert response.status_code == 200
    assert [item["slug"] for item in response.data] == [
        "leetcode",
        "github-push",
        "contribution",
        "communication-practice",
        "reel-posting",
        "form-filling",
        "workout",
        "skincare",
        "grok-homework",
        "gemini-homework",
        "chatgpt-homework",
    ]


@pytest.mark.django_db
def test_checkin_create_and_update_reuse_the_same_daily_record(client):
    today = date(2026, 10, 25)
    with patch("tracker.views.timezone.localdate", return_value=today):
        first = client.put(
            reverse("checkin-date", args=[today.isoformat()]),
            response_payload({"leetcode": "YES"}),
            format="json",
        )
        second = client.put(
            reverse("checkin-date", args=[today.isoformat()]),
            response_payload({"leetcode": "NO"}),
            format="json",
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert DailyCheckIn.objects.count() == 1
    assert ActivityResponse.objects.filter(activity__slug="leetcode").get().status == "NO"
    assert second.data["summary"] == {
        "completed": 0,
        "not_completed": 11,
        "skipped": 0,
        "completion_rate": 0,
    }


@pytest.mark.django_db
def test_incomplete_invalid_and_future_checkins_are_rejected(client):
    today = date(2026, 10, 25)
    incomplete = {"responses": response_payload()["responses"][:-1]}
    with patch("tracker.views.timezone.localdate", return_value=today):
        missing_response = client.put(
            reverse("checkin-date", args=[today.isoformat()]), incomplete, format="json"
        )
        invalid = response_payload()
        invalid["responses"][0]["status"] = "MAYBE"
        invalid_response = client.put(
            reverse("checkin-date", args=[today.isoformat()]), invalid, format="json"
        )
        future_response = client.put(
            reverse("checkin-date", args=[(today + timedelta(days=1)).isoformat()]),
            response_payload(),
            format="json",
        )

    assert missing_response.status_code == 400
    assert invalid_response.status_code == 400
    assert future_response.status_code == 400
    assert DailyCheckIn.objects.count() == 0


@pytest.mark.django_db
def test_saved_checkin_is_private_to_authenticated_owner(client):
    today = date(2026, 10, 25)
    with patch("tracker.views.timezone.localdate", return_value=today):
        client.put(reverse("checkin-date", args=[today.isoformat()]), response_payload(), format="json")
    other_client = APIClient()
    other_user = get_user_model().objects.create_user(username="other", password="test-password")
    other_client.force_authenticate(other_user)

    response = other_client.get(reverse("checkin-date", args=[today.isoformat()]))
    history = other_client.get(reverse("checkin-history"))
    assert response.data["checkin"] is None
    assert history.data == []


@pytest.mark.django_db
def test_checkin_around_configured_local_date_and_future_summary(client):
    local_day = date(2026, 10, 25)
    with patch("tracker.views.timezone.localdate", return_value=local_day):
        created = client.put(
            reverse("checkin-date", args=[local_day.isoformat()]),
            response_payload({"leetcode": "YES", "github-push": "SKIP"}),
            format="json",
        )
        summary = client.get(reverse("streak-summary"))
    assert created.status_code == 200
    assert summary.data["total_completed_activity_days"] == 1
    assert summary.data["overall_completion_rate"] == 10


@pytest.mark.django_db
def test_duplicate_responses_are_rejected(client):
    payload = response_payload()
    payload["responses"].append(payload["responses"][0])
    response = client.put(
        reverse("checkin-date", args=["2026-10-25"]), payload, format="json"
    )
    assert response.status_code == 400
    assert DailyCheckIn.objects.count() == 0
