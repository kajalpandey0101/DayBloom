from django.urls import path

from . import views


urlpatterns = [
    path("auth/csrf/", views.csrf_token, name="csrf-token"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.current_user, name="current-user"),
    path("activities/", views.ActivityListView.as_view(), name="activities"),
    path("activities/manage/", views.ActivityManageView.as_view(), name="activity-create"),
    path(
        "activities/<int:activity_id>/",
        views.ActivityManageView.as_view(),
        name="activity-update",
    ),
    path("checkins/today/", views.TodayCheckInView.as_view(), name="today-checkin"),
    path("checkins/", views.CheckInHistoryView.as_view(), name="checkin-history"),
    path("checkins/<str:local_date>/", views.CheckInDateView.as_view(), name="checkin-date"),
    path("streaks/summary/", views.StreakSummaryView.as_view(), name="streak-summary"),
    path("streaks/calendar/", views.OverallCalendarView.as_view(), name="overall-calendar"),
    path(
        "streaks/activities/<slug:slug>/calendar/",
        views.ActivityCalendarView.as_view(),
        name="activity-calendar",
    ),
]
