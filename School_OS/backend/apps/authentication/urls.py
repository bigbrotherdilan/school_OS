from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.authentication.views import (
    SOSLoginView,
    SOSTokenRefreshView,
    logout_view,
    me_view,
    upload_photo_view,
    change_password_view,
    password_reset_request_view,
    password_reset_confirm_view,
    pin_status_view,
    pin_set_view,
    pin_verify_view,
    pin_remove_view,
    UserViewSet,
    confirm_kill_login_view,
    list_sessions_view,
    kill_session_view,
    kill_all_sessions_view,
    create_invitation_view,
    list_invitations_view,
    invite_detail_view,
    redeem_invitation_view,
)

router = DefaultRouter()
router.register('users', UserViewSet, basename='users')

urlpatterns = [
    path('auth/login/', SOSLoginView.as_view(), name='auth-login'),
    path('auth/login/confirm-kill/', confirm_kill_login_view, name='auth-login-confirm-kill'),
    path('auth/refresh/', SOSTokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/logout/', logout_view, name='auth-logout'),
    path('auth/me/', me_view, name='auth-me'),
    path('auth/change-password/', change_password_view, name='auth-change-password'),
    path('auth/upload-photo/', upload_photo_view, name='auth-upload-photo'),
    path('auth/password-reset-request/', password_reset_request_view, name='auth-password-reset-request'),
    path('auth/password-reset-confirm/', password_reset_confirm_view, name='auth-password-reset-confirm'),
    path('auth/pin/', pin_status_view, name='auth-pin-status'),
    path('auth/pin/set/', pin_set_view, name='auth-pin-set'),
    path('auth/pin/verify/', pin_verify_view, name='auth-pin-verify'),
    path('auth/pin/remove/', pin_remove_view, name='auth-pin-remove'),
    path('auth/sessions/', list_sessions_view, name='auth-sessions-list'),
    path('auth/sessions/kill-all/', kill_all_sessions_view, name='auth-sessions-kill-all'),
    path('auth/sessions/<uuid:session_id>/kill/', kill_session_view, name='auth-sessions-kill'),
    path('auth/invite/', create_invitation_view, name='auth-invite-create'),
    path('auth/invitations/', list_invitations_view, name='auth-invitations-list'),
    path('auth/invite/<str:token>/', invite_detail_view, name='auth-invite-detail'),
    path('auth/invite/<str:token>/redeem/', redeem_invitation_view, name='auth-invite-redeem'),
    path('', include(router.urls)),
]
