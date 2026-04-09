import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'complaint_system.settings')
django.setup()

from core.models import User, Category, Complaint
from django.contrib.auth import get_user_model

User = get_user_model()

# Create Categories
categories = ['Facility', 'HR', 'IT Support', 'Security', 'Maintenance', 'General']
for cat_name in categories:
    Category.objects.get_or_create(name=cat_name)

# Create Admin
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123', role='ADMIN')

# Create Employee
if not User.objects.filter(username='employee1').exists():
    User.objects.create_user('employee1', 'employee1@example.com', 'employee123', role='EMPLOYEE')

print("Seeding complete!")
