import json
from datetime import date, timedelta

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.utils.text import slugify

from .models import Activity, ActivityResponse, DailyCheckIn
from .serializers import ActivityInputSerializer, ActivitySerializer, CheckInInputSerializer
from .services.streak_calculator import completion_rate, daily_summary, streak_stats


@ensure_csrf_cookie
@require_GET
def csrf_token(request):
    return JsonResponse({"csrfToken": get_token(request)})


@csrf_protect
@require_POST
def login_view(request):
    try:
        payload = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"detail": "Request body must be valid JSON."}, status=400)
    username = payload.get("username")
    password = payload.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        return JsonResponse({"detail": "Username and password are required."}, status=400)
    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Username or password is incorrect."}, status=400)
    login(request, user)
    return JsonResponse({"user": {"id": user.pk, "username": user.get_username()}})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([AllowAny])
def current_user(request):
    if not request.user.is_authenticated:
        return Response({"user": None})
    return Response({"user": {"id": request.user.pk, "username": request.user.get_username()}})


def parse_local_date(value, field_name):
    try:
        parsed = date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({field_name: "Use a valid date in YYYY-MM-DD format."})
    if parsed.isoformat() != value:
        raise ValidationError({field_name: "Use a valid date in YYYY-MM-DD format."})
    return parsed


def get_date_range(request):
    start_value = request.query_params.get("start_date")
    end_value = request.query_params.get("end_date")
    if not start_value or not end_value:
        raise ValidationError({"date_range": "Provide both start_date and end_date."})
    start = parse_local_date(start_value, "start_date")
    end = parse_local_date(end_value, "end_date")
    if start > end:
        raise ValidationError({"date_range": "start_date must not be after end_date."})
    return start, end


def get_checkin(user, local_date):
    try:
        return (
            DailyCheckIn.objects.filter(user=user, local_date=local_date)
            .prefetch_related("responses__activity")
            .get()
        )
    except DailyCheckIn.DoesNotExist:
        return None


def serialize_checkin(checkin):
    responses = list(checkin.responses.all())
    statuses = [response.status for response in responses]
    return {
        "id": checkin.pk,
        "date": checkin.local_date.isoformat(),
        "responses": [
            {
                "activity_id": response.activity_id,
                "activity_slug": response.activity.slug,
                "activity_name": response.activity.name,
                "category": response.activity.category,
                "status": response.status,
                "note": response.optional_note,
            }
            for response in responses
        ],
        "summary": daily_summary(statuses),
    }


class ActivityListView(APIView):
    def get(self, request):
        activities = Activity.objects.all()
        if request.query_params.get("include_inactive") != "true":
            activities = activities.filter(is_active=True)
        return Response(ActivitySerializer(activities, many=True).data)


class ActivityManageView(APIView):
    def post(self, request):
        serializer = ActivitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"].strip()
        if not name:
            raise ValidationError({"name": "Name cannot be empty."})
        base_slug = slugify(name)[:100] or "activity"
        slug = base_slug
        suffix = 2
        while Activity.objects.filter(slug=slug).exists():
            slug = f"{base_slug[:100 - len(str(suffix)) - 1]}-{suffix}"
            suffix += 1
        activity = serializer.save(name=name, slug=slug, is_active=True)
        return Response(ActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

    def patch(self, request, activity_id):
        try:
            activity = Activity.objects.get(pk=activity_id)
        except Activity.DoesNotExist:
            return Response({"detail": "Activity not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ActivitySerializer(activity, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ActivitySerializer(activity).data)


class TodayCheckInView(APIView):
    def get(self, request):
        today = timezone.localdate()
        checkin = get_checkin(request.user, today)
        return Response({"date": today.isoformat(), "checkin": serialize_checkin(checkin) if checkin else None})


class CheckInDateView(APIView):
    def get(self, request, local_date):
        parsed = parse_local_date(local_date, "date")
        checkin = get_checkin(request.user, parsed)
        return Response({"date": parsed.isoformat(), "checkin": serialize_checkin(checkin) if checkin else None})

    def put(self, request, local_date):
        parsed_date = parse_local_date(local_date, "date")
        if parsed_date > timezone.localdate():
            raise ValidationError({"date": "Check-ins cannot be saved for a future date."})
        serializer = CheckInInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submitted = serializer.validated_data["responses"]

        active_ids = set(Activity.objects.filter(is_active=True).values_list("id", flat=True))
        submitted_ids = {item["activity_id"] for item in submitted}
        if submitted_ids != active_ids:
            missing = len(active_ids - submitted_ids)
            unknown = len(submitted_ids - active_ids)
            details = []
            if missing:
                details.append(f"{missing} active activit{'y is' if missing == 1 else 'ies are'} unanswered.")
            if unknown:
                details.append(f"{unknown} response(s) refer to inactive or unknown activities.")
            raise ValidationError({"responses": details})

        activity_ids = list(submitted_ids)
        activities = {
            activity.pk: activity
            for activity in Activity.objects.filter(id__in=activity_ids, is_active=True)
        }
        with transaction.atomic():
            checkin, created = DailyCheckIn.objects.get_or_create(
                user=request.user, local_date=parsed_date
            )
            if not created:
                checkin.save(update_fields=["updated_at"])
            for answer in submitted:
                ActivityResponse.objects.update_or_create(
                    daily_checkin=checkin,
                    activity=activities[answer["activity_id"]],
                    defaults={
                        "status": answer["status"],
                        "optional_note": answer.get("note", "").strip(),
                    },
                )
            checkin = get_checkin(request.user, parsed_date)
        return Response(serialize_checkin(checkin))


class CheckInHistoryView(APIView):
    def get(self, request):
        queryset = DailyCheckIn.objects.filter(user=request.user).prefetch_related("responses__activity")
        if request.query_params:
            start, end = get_date_range(request)
            queryset = queryset.filter(local_date__range=(start, end))
        return Response([serialize_checkin(checkin) for checkin in queryset])


class StreakSummaryView(APIView):
    def get(self, request):
        today = timezone.localdate()
        checkins = list(
            DailyCheckIn.objects.filter(user=request.user)
            .prefetch_related("responses")
            .order_by("local_date")
        )
        overall_statuses = {}
        activity_statuses = {}
        all_responses = []
        for checkin in checkins:
            responses = list(checkin.responses.all())
            if checkin.local_date > today:
                continue
            all_responses.extend(response.status for response in responses)
            if any(response.status == ActivityResponse.Status.YES for response in responses):
                overall_statuses[checkin.local_date] = "YES"
            else:
                overall_statuses[checkin.local_date] = "NO"
            for response in responses:
                activity_statuses.setdefault(response.activity_id, {})[checkin.local_date] = response.status

        overall = streak_stats(overall_statuses, today)
        activity_stats = [
            {
                "activity_id": activity.pk,
                "slug": activity.slug,
                "name": activity.name,
                "category": activity.category,
                **streak_stats(activity_statuses.get(activity.pk, {}), today),
                "completion_rate": completion_rate(
                    [
                        response.status
                        for checkin in checkins
                        if checkin.local_date <= today
                        for response in checkin.responses.all()
                        if response.activity_id == activity.pk
                    ]
                ),
            }
            for activity in Activity.objects.filter(is_active=True)
        ]
        best_individual = max((item["longest_streak"] for item in activity_stats), default=0)
        return Response(
            {
                "current_active_streak": overall["current_streak"],
                "best_individual_activity_streak": best_individual,
                "total_completed_activity_days": sum(status == "YES" for status in all_responses),
                "overall_completion_rate": completion_rate(all_responses),
                "activities": activity_stats,
                "timezone": timezone.get_current_timezone_name(),
            }
        )


class OverallCalendarView(APIView):
    def get(self, request):
        start, end = get_date_range(request)
        records = (
            DailyCheckIn.objects.filter(user=request.user, local_date__range=(start, end))
            .prefetch_related("responses")
        )
        by_date = {checkin.local_date: list(checkin.responses.all()) for checkin in records}
        result = []
        current = start
        while current <= end:
            responses = by_date.get(current)
            summary = daily_summary([item.status for item in responses]) if responses is not None else None
            completed = summary["completed"] if summary else 0
            result.append(
                {
                    "date": current.isoformat(),
                    "has_checkin": responses is not None,
                    "completed": completed,
                    "not_completed": summary["not_completed"] if summary else 0,
                    "skipped": summary["skipped"] if summary else 0,
                    "completion_rate": summary["completion_rate"] if summary else None,
                    "level": 0 if not completed else 1 if completed <= 2 else 2 if completed <= 5 else 3 if completed <= 8 else 4,
                }
            )
            current += timedelta(days=1)
        return Response(result)


class ActivityCalendarView(APIView):
    def get(self, request, slug):
        start, end = get_date_range(request)
        try:
            activity = Activity.objects.get(slug=slug)
        except Activity.DoesNotExist:
            return Response({"detail": "Activity not found."}, status=status.HTTP_404_NOT_FOUND)
        responses = ActivityResponse.objects.filter(
            daily_checkin__user=request.user,
            daily_checkin__local_date__range=(start, end),
            activity=activity,
        ).select_related("daily_checkin")
        by_date = {
            response.daily_checkin.local_date: response
            for response in responses
        }
        checkin_dates = set(
            DailyCheckIn.objects.filter(
                user=request.user, local_date__range=(start, end)
            ).values_list("local_date", flat=True)
        )
        result = []
        current = start
        while current <= end:
            response = by_date.get(current)
            result.append(
                {
                    "date": current.isoformat(),
                    "has_checkin": current in checkin_dates,
                    "has_response": response is not None,
                    "status": response.status if response else None,
                    "note": response.optional_note if response else "",
                    "level": 4 if response and response.status == "YES" else 0,
                }
            )
            current += timedelta(days=1)
        return Response(result)
