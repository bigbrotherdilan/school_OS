from rest_framework import serializers
from .models import Announcement, DirectMessage, EmailSetting, Notification


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    audience_display = serializers.CharField(source='get_audience_display', read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = '__all__'
        extra_kwargs = {
            'tenant': {'read_only': True},
            'created_by': {'read_only': True},
        }

    def get_is_read(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and request.user.is_authenticated:
            return obj.reads.filter(user=request.user).exists()
        return False


class NotificationSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'category', 'category_display', 'title', 'body', 'link', 'is_read', 'created_at']
        read_only_fields = ['id', 'category', 'category_display', 'title', 'body', 'link', 'created_at']


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



class EmailSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailSetting
        fields = ['id', 'host', 'port', 'use_tls', 'username', 'password', 'from_email', 'is_verified']
        extra_kwargs = {
            'password': {'write_only': True},
        }


class TestEmailSerializer(serializers.Serializer):
    to_email = serializers.EmailField()
    subject = serializers.CharField(default='Test Email from School OS')
    message = serializers.CharField(default='This is a test email to verify your SMTP configuration.')
