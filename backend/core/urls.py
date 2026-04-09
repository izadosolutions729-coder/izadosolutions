from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ComplaintViewSet, ResponseViewSet, UserViewSet, CustomObtainAuthToken, RegisterEmployeeView, RequestOTPView, ResetPasswordOTPView, VerifyOTPView, BulkRegisterEmployeesView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'complaints', ComplaintViewSet, basename='complaint')
router.register(r'responses', ResponseViewSet, basename='response')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', CustomObtainAuthToken.as_view(), name='api_login'),
    path('auth/register/', RegisterEmployeeView.as_view(), name='api_register'),
    path('auth/bulk-register/', BulkRegisterEmployeesView.as_view(), name='api_bulk_register'),
    path('auth/request-otp/', RequestOTPView.as_view(), name='api_request_otp'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='api_verify_otp'),
    path('auth/reset-password/', ResetPasswordOTPView.as_view(), name='api_reset_password'),
]
