from rest_framework import serializers

from .models import Activity


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "sort_order",
            "is_active",
        ]
        read_only_fields = ["id", "slug"]

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name cannot be empty.")
        return name


class ActivityInputSerializer(serializers.Serializer):
    activity_id = serializers.IntegerField(min_value=1)
    status = serializers.ChoiceField(choices=["YES", "NO", "SKIP"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class CheckInInputSerializer(serializers.Serializer):
    responses = ActivityInputSerializer(many=True, allow_empty=False)

    def validate_responses(self, responses):
        ids = [item["activity_id"] for item in responses]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Each activity can only appear once.")
        return responses
