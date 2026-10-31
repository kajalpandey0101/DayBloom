import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


ACTIVITIES = [
    ("LeetCode", "leetcode", "Did I solve at least one LeetCode problem today?", "coding", 10),
    ("GitHub Push", "github-push", "Did I push my code to GitHub today?", "coding", 20),
    ("Contribution", "contribution", "Did I make a meaningful contribution to a project today?", "coding", 30),
    ("Communication Practice", "communication-practice", "Did I practice my communication skills today?", "career", 40),
    ("Reel Posting", "reel-posting", "Did I post a reel today?", "career", 50),
    ("Form Filling", "form-filling", "Did I fill out at least one relevant application, internship, or opportunity form today?", "career", 60),
    ("Workout", "workout", "Did I complete my workout today?", "health", 70),
    ("Skincare", "skincare", "Did I complete my skincare routine today?", "health", 80),
    ("Grok Homework", "grok-homework", "Did I complete my Grok homework today?", "ai", 90),
    ("Gemini Homework", "gemini-homework", "Did I complete my Gemini homework today?", "ai", 100),
    ("ChatGPT Homework", "chatgpt-homework", "Did I complete my ChatGPT homework today?", "ai", 110),
]


def seed_activities(apps, schema_editor):
    Activity = apps.get_model("tracker", "Activity")
    for name, slug, description, category, sort_order in ACTIVITIES:
        Activity.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": description,
                "category": category,
                "sort_order": sort_order,
                "is_active": True,
            },
        )


def unseed_activities(apps, schema_editor):
    Activity = apps.get_model("tracker", "Activity")
    Activity.objects.filter(slug__in=[row[1] for row in ACTIVITIES]).delete()


class Migration(migrations.Migration):
    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="Activity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("slug", models.SlugField(max_length=110, unique=True)),
                ("description", models.CharField(max_length=240)),
                ("category", models.CharField(choices=[("coding", "Coding & Development"), ("career", "Career & Communication"), ("health", "Health & Self-Care"), ("ai", "AI Learning & Homework")], max_length=20)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="DailyCheckIn",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("local_date", models.DateField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="daily_checkins", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-local_date"]},
        ),
        migrations.CreateModel(
            name="ActivityResponse",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("YES", "Yes"), ("NO", "No"), ("SKIP", "Skip")], max_length=4)),
                ("optional_note", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("activity", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="responses", to="tracker.activity")),
                ("daily_checkin", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="responses", to="tracker.dailycheckin")),
            ],
            options={"ordering": ["activity__sort_order", "activity_id"]},
        ),
        migrations.AddConstraint(
            model_name="dailycheckin",
            constraint=models.UniqueConstraint(fields=("user", "local_date"), name="unique_user_checkin_date"),
        ),
        migrations.AddIndex(
            model_name="dailycheckin",
            index=models.Index(fields=["user", "local_date"], name="day_user_date_idx"),
        ),
        migrations.AddConstraint(
            model_name="activityresponse",
            constraint=models.UniqueConstraint(fields=("daily_checkin", "activity"), name="unique_checkin_activity_response"),
        ),
        migrations.AddIndex(
            model_name="activityresponse",
            index=models.Index(fields=["activity", "status"], name="response_act_status_idx"),
        ),
        migrations.AddIndex(
            model_name="activity",
            index=models.Index(fields=["is_active", "sort_order"], name="act_active_sort_idx"),
        ),
        migrations.RunPython(seed_activities, unseed_activities),
    ]
