import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'complaint_system.settings')
django.setup()

from core.models import User, Category, Complaint
from django.contrib.auth import get_user_model

User = get_user_model()

# Remove Housekeeping if it was previously seeded
Category.objects.filter(name='Housekeeping').delete()

# Create Categories
categories = ['Facility', 'HR', 'IT Support', 'Security', 'Maintenance', 'General']
for cat_name in categories:
    Category.objects.get_or_create(name=cat_name)

# Create Admin — bound to official Izado Gmail for OTP delivery
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser(
        username='admin',
        email='izadosolutions729@gmail.com',  # Real Gmail — OTP will be sent here
        password='admin123',
        role='ADMIN'
    )
else:
    # Update existing admin email if it's still the placeholder
    admin = User.objects.get(username='admin')
    if admin.email == 'admin@example.com' or admin.email == '':
        admin.email = 'izadosolutions729@gmail.com'
        admin.save()
        print("Updated admin email to izadosolutions729@gmail.com")

# Create Employee
if not User.objects.filter(username='employee1').exists():
    User.objects.create_user(
        username='employee1',
        email='employee1@example.com',
        password='employee123',
        role='EMPLOYEE'
    )

print("Seeding complete!")
