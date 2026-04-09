from rest_framework import viewsets, permissions, status
from rest_framework.response import Response as DRFResponse
from rest_framework.views import APIView
from rest_framework.decorators import action
from .models import User, Category, Complaint, Response
from .serializers import UserSerializer, CategorySerializer, ComplaintSerializer, ResponseSerializer, ComplaintUpdateSerializer
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Admins see everyone, employees see no one (or just themselves if needed)
        if self.request.user.role == 'ADMIN':
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'ADMIN':
            return DRFResponse({"error": "Only admins can delete users."}, status=status.HTTP_403_FORBIDDEN)
        
        user_to_delete = self.get_object()
        if user_to_delete == request.user:
            return DRFResponse({"error": "You cannot delete your own account."}, status=status.HTTP_400_BAD_REQUEST)
            
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return DRFResponse(serializer.data)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]

class ComplaintViewSet(viewsets.ModelViewSet):
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        status_filter = self.request.query_params.get('status')
        
        if user.role == 'ADMIN':
            queryset = Complaint.objects.all()
        else:
            queryset = Complaint.objects.filter(user=user)
            
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        complaint = self.get_object()
        if request.user.role != 'ADMIN':
            return DRFResponse({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = ComplaintUpdateSerializer(complaint, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return DRFResponse(serializer.data)
        return DRFResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ResponseViewSet(viewsets.ModelViewSet):
    serializer_class = ResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        complaint_id = self.request.query_params.get('complaint')
        if complaint_id:
            try:
                complaint = Complaint.objects.get(id=complaint_id)
                # Check if user has access to this complaint
                if self.request.user.role == 'ADMIN' or complaint.user == self.request.user:
                    return Response.objects.filter(complaint_id=complaint_id).order_by('created_at')
            except Complaint.DoesNotExist:
                return Response.objects.none()
        return Response.objects.none()

    def perform_create(self, serializer):
        complaint = serializer.validated_data['complaint']
        # Only admins or the owner can respond
        if self.request.user.role == 'ADMIN' or complaint.user == self.request.user:
            serializer.save(user=self.request.user)
        else:
            raise permissions.exceptions.PermissionDenied("You cannot respond to this complaint.")

class CustomObtainAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return DRFResponse({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email,
            'username': user.username,
            'role': user.role
        })

class RegisterEmployeeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # If the request is from an authenticated user, they MUST be an ADMIN.
        if request.user and request.user.is_authenticated:
            if request.user.role != 'ADMIN':
                return DRFResponse({"error": "Only admins can register employees from the dashboard."}, status=status.HTTP_403_FORBIDDEN)

        
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')
        
        # Security: Force 'EMPLOYEE' role unless requester is an existing ADMIN
        requested_role = request.data.get('role', 'EMPLOYEE')
        role = 'EMPLOYEE'
        if request.user and request.user.is_authenticated and request.user.role == 'ADMIN':
            role = requested_role

        if not username or not password:
            return DRFResponse({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=username).exists():
            return DRFResponse({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password, email=email, role=role)
        return DRFResponse({"message": "User registered successfully.", "id": user.id}, status=status.HTTP_201_CREATED)

import random
from django.utils import timezone
import datetime

class RequestOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email_or_user = request.data.get('email')
        if not email_or_user:
            return DRFResponse({"error": "Email/Username is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.filter(email=email_or_user).first() or User.objects.filter(username=email_or_user).first()
        if not user:
            return DRFResponse({"message": "If this account exists, an email has been sent."}, status=status.HTTP_200_OK) # generic success to prevent sniffing
        
        otp = str(random.randint(100000, 999999))
        user.otp_code = otp
        user.otp_created_at = timezone.now()
        user.save()
        
        from django.core.mail import send_mail
        from django.conf import settings
        
        try:
            send_mail(
                subject='Izado Solutions - Password Reset OTP',
                message=f'Your OTP for resetting your password is: {otp}\nIt is valid for strictly 2 minutes.\n\n- Izado Solutions Pvt Ltd',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            return DRFResponse({"message": "OTP has been successfully sent to your email inbox."}, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            print(f"[EMAIL ERROR] Failed to send OTP to {user.email}: {e}")
            print(traceback.format_exc())
            return DRFResponse({"error": f"Email delivery failed: {str(e)}. Please verify your email address is correct or contact admin."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email_or_user = request.data.get('email')
        otp = request.data.get('otp')
        if not all([email_or_user, otp]):
            return DRFResponse({"error": "Email and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(email=email_or_user).first() or User.objects.filter(username=email_or_user).first()
        if not user or user.otp_code != str(otp):
            return DRFResponse({"error": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)
        if user.otp_created_at and (timezone.now() - user.otp_created_at) > datetime.timedelta(minutes=2):
            return DRFResponse({"error": "OTP has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
        return DRFResponse({"message": "OTP Verified Successfully."}, status=status.HTTP_200_OK)

class ResetPasswordOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email_or_user = request.data.get('email')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')
        
        if not all([email_or_user, otp, new_password]):
            return DRFResponse({"error": "Email, OTP, and new password are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.filter(email=email_or_user).first() or User.objects.filter(username=email_or_user).first()
        if not user or user.otp_code != str(otp):
            return DRFResponse({"error": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)
            
        if user.otp_created_at and (timezone.now() - user.otp_created_at) > datetime.timedelta(minutes=2):
            return DRFResponse({"error": "OTP has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.otp_code = None
        user.otp_created_at = None
        user.save()
        
        return DRFResponse({"message": "Password has been successfully recovered."}, status=status.HTTP_200_OK)

import csv
import io

class BulkRegisterEmployeesView(APIView):
    # Restrict to Admins in production, but match current RegisterEmployeeView for now
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != 'ADMIN':
            return DRFResponse({"error": "Only admins can perform bulk registration."}, status=status.HTTP_403_FORBIDDEN)

        file = request.FILES.get('file')
        if not file:
            return DRFResponse({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        if not file.name.endswith('.csv'):
            return DRFResponse({"error": "Only CSV files are supported currently."}, status=status.HTTP_400_BAD_REQUEST)

        decoded_file = file.read().decode('utf-8')
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)

        success_count = 0
        failed_entries = []

        for row in reader:
            username = row.get('username')
            password = row.get('password')
            email = row.get('email', '')
            role = row.get('role', 'EMPLOYEE')

            if not username or not password:
                failed_entries.append({"username": username or "N/A", "reason": "Missing username/password"})
                continue

            if User.objects.filter(username=username).exists():
                failed_entries.append({"username": username, "reason": "Username already exists"})
                continue

            try:
                User.objects.create_user(username=username, password=password, email=email, role=role)
                success_count += 1
            except Exception as e:
                failed_entries.append({"username": username, "reason": str(e)})

        return DRFResponse({
            "message": f"Successfully registered {success_count} employees.",
            "success_count": success_count,
            "failed_entries": failed_entries
        }, status=status.HTTP_201_CREATED)
