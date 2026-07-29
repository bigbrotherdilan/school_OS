"""Audit Middleware — Logs all data-modifying requests to the database."""
import json
import re
import traceback
from datetime import datetime


# Maps endpoint patterns to human-readable descriptions
ENDPOINT_DESCRIPTIONS = {
    # Students
    ('POST', 'students/students'): 'Registered a new student',
    ('PUT', 'students/students'): 'Updated a student record',
    ('PATCH', 'students/students'): 'Updated a student record',
    ('DELETE', 'students/students'): 'Removed a student',
    ('POST', 'students/upload-photo'): 'Uploaded a student photo',
    # Staff / Teachers
    ('POST', 'staff/teachers/onboard'): 'Onboarded a new teacher',
    ('PUT', 'staff/teachers'): 'Updated teacher profile',
    ('PATCH', 'staff/teachers'): 'Updated teacher profile',
    ('DELETE', 'staff/teachers'): 'Removed a teacher',
    # Bursars
    ('POST', 'staff/bursars/onboard'): 'Onboarded a new bursar',
    # Classes
    ('POST', 'academic/classes'): 'Created a new class',
    ('PUT', 'academic/classes'): 'Updated a class',
    ('PATCH', 'academic/classes'): 'Updated a class',
    ('DELETE', 'academic/classes'): 'Deleted a class',
    # Subjects
    ('POST', 'academic/subjects'): 'Added a new subject',
    ('PUT', 'academic/subjects'): 'Updated a subject',
    ('PATCH', 'academic/subjects'): 'Updated a subject',
    ('DELETE', 'academic/subjects'): 'Removed a subject',
    # Terms
    ('POST', 'academic/terms'): 'Created a new term',
    ('PUT', 'academic/terms'): 'Updated a term',
    ('PATCH', 'academic/terms'): 'Updated a term',
    # Attendance
    ('POST', 'attendance/sessions'): 'Recorded attendance',
    ('PUT', 'attendance/sessions'): 'Updated attendance record',
    ('PATCH', 'attendance/sessions'): 'Updated attendance record',
    # Assessments / Marks
    ('POST', 'assessments'): 'Recorded assessment marks',
    ('PUT', 'assessments'): 'Updated assessment marks',
    ('PATCH', 'assessments'): 'Updated assessment marks',
    ('DELETE', 'assessments'): 'Deleted an assessment',
    # Finance
    ('POST', 'finance/transactions'): 'Recorded a payment',
    ('POST', 'finance/expenses'): 'Recorded an expense',
    ('PUT', 'finance/transactions'): 'Updated a transaction',
    ('PATCH', 'finance/transactions'): 'Updated a transaction',
    ('DELETE', 'finance/transactions'): 'Deleted a transaction',
    ('POST', 'finance/invoices'): 'Created an invoice',
    ('PUT', 'finance/invoices'): 'Updated an invoice',
    ('PATCH', 'finance/invoices'): 'Updated an invoice',
    # Fees
    ('POST', 'finance/fees'): 'Created a fee structure',
    ('PUT', 'finance/fees'): 'Updated a fee structure',
    ('PATCH', 'finance/fees'): 'Updated a fee structure',
    ('DELETE', 'finance/fees'): 'Removed a fee structure',
    # Report cards
    ('POST', 'reports/report-cards'): 'Generated report cards',
    ('POST', 'reports/batch-generate'): 'Batch generated report cards',
    # Auth
    ('POST', 'auth/login'): 'Logged in',
    ('POST', 'auth/logout'): 'Logged out',
    ('POST', 'auth/change-password'): 'Changed password',
    ('POST', 'users'): 'Created a new user',
    ('POST', 'users/reset-password'): 'Reset a user password',
    # Timetable
    ('POST', 'timetable'): 'Updated the timetable',
    ('PUT', 'timetable'): 'Updated the timetable',
    ('PATCH', 'timetable'): 'Updated the timetable',
    # Logbook
    ('POST', 'logbook'): 'Added a logbook entry',
    ('PUT', 'logbook'): 'Updated a logbook entry',
    ('PATCH', 'logbook'): 'Updated a logbook entry',
    # Notifications
    ('POST', 'notifications'): 'Sent a notification',
    # Documents
    ('POST', 'documents'): 'Uploaded a document',
    # Announcements
    ('POST', 'communications'): 'Sent a communication',
}


def _generate_description(method, path):
    """Generate a human-readable description from the HTTP method and path."""
    # Normalize path: strip leading /api/v1/ and trailing slashes/IDs
    clean = path.lstrip('/')
    for prefix in ('api/v1/', 'api/'):
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
            break

    # Strip trailing UUIDs/IDs like /uuid/ or /123/
    clean = re.sub(r'/[0-9a-f-]{36}/?$', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'/\d+/?$', '', clean)
    clean = clean.strip('/')

    # Try exact match first, then prefix match
    for (m, endpoint_pattern), desc in ENDPOINT_DESCRIPTIONS.items():
        if method == m and (clean == endpoint_pattern or clean.startswith(endpoint_pattern)):
            return desc

    # Fallback: generate something readable from the path
    parts = clean.split('/')
    resource = parts[0].replace('-', ' ').title() if parts else 'System'
    action_map = {
        'POST': 'Modified',
        'PUT': 'Updated',
        'PATCH': 'Updated',
        'DELETE': 'Removed',
    }
    verb = action_map.get(method, 'Modified')
    return f"{verb} {resource}"


class AuditMiddleware:
    """
    Captures all POST/PUT/PATCH/DELETE requests for audit logging.
    Stores: user, tenant, action, endpoint, timestamp, status_code.
    """

    # Paths to exclude from audit logging
    EXCLUDED_PATHS = (
        '/api/v1/health/',
        '/admin/jsi18n/',
        '/static/',
        '/media/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only audit data-modifying requests
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            # Skip excluded paths
            if any(request.path.startswith(p) for p in self.EXCLUDED_PATHS):
                return response

            if hasattr(request, 'user') and request.user.is_authenticated:
                try:
                    from apps.audit.models import AuditLog

                    # Determine action type
                    action_map = {
                        'POST': AuditLog.ActionType.CREATE,
                        'PUT': AuditLog.ActionType.UPDATE,
                        'PATCH': AuditLog.ActionType.UPDATE,
                        'DELETE': AuditLog.ActionType.DELETE,
                    }
                    action = action_map.get(request.method, AuditLog.ActionType.UPDATE)

                    # Determine module from path
                    module = AuditLog.Module.SYSTEM
                    path = request.path.lower()
                    module_map = {
                        'students': AuditLog.Module.STUDENT,
                        'staff': AuditLog.Module.STAFF,
                        'academic': AuditLog.Module.ACADEMIC,
                        'assessments': AuditLog.Module.ASSESSMENT,
                        'finance': AuditLog.Module.FINANCE,
                        'attendance': AuditLog.Module.ATTENDANCE,
                        'timetable': AuditLog.Module.TIMETABLE,
                        'reports': AuditLog.Module.REPORT,
                        'logbook': AuditLog.Module.LOGBOOK,
                        'notifications': AuditLog.Module.NOTIFICATION,
                        'documents': AuditLog.Module.DOCUMENT,
                        'gov': AuditLog.Module.GOVERNMENT,
                        'auth': AuditLog.Module.AUTH,
                        'tenants': AuditLog.Module.SYSTEM,
                    }
                    for key, mod in module_map.items():
                        if key in path:
                            module = mod
                            break

                    # Get client IP
                    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                    ip_address = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR')

                    # Get tenant ID from header
                    tenant_id = None
                    tenant_header = request.headers.get('X-Tenant-ID')
                    if tenant_header:
                        try:
                            import uuid
                            tenant_id = uuid.UUID(tenant_header)
                        except (ValueError, AttributeError):
                            pass

                    # Try to extract object info from request body
                    object_type = ''
                    object_id = ''
                    try:
                        body = json.loads(request.body) if request.body else {}
                        if 'first_name' in body and 'last_name' in body:
                            object_type = f"{body.get('first_name', '')} {body.get('last_name', '')}".strip()
                        elif 'name' in body:
                            object_type = body['name']
                        elif 'title' in body:
                            object_type = body['title']
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        pass

                    # Extract ID from URL
                    id_match = re.search(r'/([0-9a-f-]{36})/', request.path, re.IGNORECASE)
                    if not id_match:
                        id_match = re.search(r'/(\d+)/', request.path)
                    if id_match:
                        object_id = id_match.group(1)

                    description = _generate_description(request.method, request.path)
                    if object_type:
                        description = f"{description}: {object_type}"

                    AuditLog.objects.create(
                        user=request.user,
                        tenant_id=tenant_id,
                        action=action,
                        module=module,
                        object_type=object_type,
                        object_id=object_id,
                        description=description,
                        endpoint=request.path,
                        method=request.method,
                        status_code=response.status_code,
                        ip_address=ip_address,
                    )
                except Exception:
                    # Never let audit logging break the request
                    pass

        return response
