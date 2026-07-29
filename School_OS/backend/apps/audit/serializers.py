from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True, default='System')
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'user_name', 'tenant_id', 'action',
            'module', 'object_type', 'object_id', 'description', 'endpoint',
            'method', 'status_code', 'ip_address', 'metadata', 'created_at',
        ]

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return 'System'
