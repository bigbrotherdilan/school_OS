from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.conf import settings


class SOSJWTAuthentication(JWTAuthentication):
    """
    Extends SimpleJWT authentication to check password_changed_at.
    If the user changed their password after the token was issued,
    the token is rejected and the user must log in again.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)

        token_iat = validated_token.get('iat')
        if token_iat and user.password_changed_at:
            token_issued = timezone.datetime.fromtimestamp(
                token_iat, tz=timezone.get_current_timezone()
            )
            if user.password_changed_at > token_issued:
                raise AuthenticationFailed(
                    'Password has been changed. Please log in again.',
                    code='password_changed',
                )

        return user
