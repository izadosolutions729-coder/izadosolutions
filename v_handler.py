import os
import sys

# Add the backend directory to the sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Import the WSGI application
from complaint_system.wsgi import application

app = application
