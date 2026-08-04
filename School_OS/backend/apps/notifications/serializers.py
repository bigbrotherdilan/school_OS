from rest_framework import serializers
from .models import Announcement, DirectMessage


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    audience_display = serializers.CharField(source='get_audience_display', read_only=True)

    class Meta:
        model = Announcement
        fields = '__all__'
        extra_kwargs = {
            'tenant': {'read_only': True},
            'created_by': {'read_only': True},
        }


class DirectMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.full_name', read_only=True)

    class Meta:
        model = DirectMessage
        fields = '__all__'
        extra_kwargs = {
            'tenant': {'read_only': True},
            'sender': {'read_only': True},
        }
