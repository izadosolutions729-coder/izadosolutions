from rest_framework import serializers
from .models import User, Category, Complaint, Response

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ResponseSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = Response
        fields = ['id', 'complaint', 'user', 'user_name', 'user_role', 'message', 'created_at']
        read_only_fields = ['user']

class ComplaintSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    responses = ResponseSerializer(many=True, read_only=True)

    class Meta:
        model = Complaint
        fields = '__all__'
        read_only_fields = ['user', 'status']

class ComplaintUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ['status', 'priority']
