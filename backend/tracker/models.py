from django.conf import settings
from django.db import models


class Activity(models.Model):
    class Category(models.TextChoices):
        CODING = "coding", "Coding & Development"
        CAREER = "career", "Career & Communication"
        HEALTH = "health", "Health & Self-Care"
        AI = "ai", "AI Learning & Homework"

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=110, unique=True)
    description = models.CharField(max_length=240)
    category = models.CharField(max_length=20, choices=Category.choices)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(
                fields=["is_active", "sort_order"], name="act_active_sort_idx"
            )
        ]

    def __str__(self):
        return self.name


class DailyCheckIn(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_checkins"
    )
    local_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-local_date"]
        constraints = [
            models.UniqueConstraint(fields=["user", "local_date"], name="unique_user_checkin_date")
        ]
        indexes = [
            models.Index(fields=["user", "local_date"], name="day_user_date_idx")
        ]

    def __str__(self):
        return f"{self.user_id}: {self.local_date}"


class ActivityResponse(models.Model):
    class Status(models.TextChoices):
        YES = "YES", "Yes"
        NO = "NO", "No"
        SKIP = "SKIP", "Skip"

    daily_checkin = models.ForeignKey(
        DailyCheckIn, on_delete=models.CASCADE, related_name="responses"
    )
    activity = models.ForeignKey(Activity, on_delete=models.PROTECT, related_name="responses")
    status = models.CharField(max_length=4, choices=Status.choices)
    optional_note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["activity__sort_order", "activity_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["daily_checkin", "activity"], name="unique_checkin_activity_response"
            )
        ]
        indexes = [
            models.Index(fields=["activity", "status"], name="response_act_status_idx")
        ]

    def __str__(self):
        return f"{self.activity}: {self.status} on {self.daily_checkin.local_date}"
