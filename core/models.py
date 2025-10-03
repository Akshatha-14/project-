from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.contrib.postgres.fields import ArrayField
from django.contrib.gis.db import models as gis_models
from django.utils import timezone
from django.db.models import Avg, Count
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from phonenumber_field.modelfields import PhoneNumberField  # Use this for proper phone validation
from django.db.models import Q
# ==============================
# User Management
# ==============================
class AuthenticatedUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    @property
    def role(self):
        user_role, created = UserRole.objects.get_or_create(
            user=self,
            defaults={'role': 'user'}
        )
        return user_role.role
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, password, **extra_fields)


class AuthenticatedUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150, blank=True)  # New name field added
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    phone = PhoneNumberField(blank=True, default="", max_length=30)
    address = models.CharField(max_length=255, blank=True)
    location = gis_models.PointField(geography=True, null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    objects = AuthenticatedUserManager()

    def __str__(self):
        # Show name if set, else email
        return self.name 

    def is_profile_complete(self):
        # Include name in profile completeness check
        return all([self.name, self.phone, self.address, self.location])



class UserRole(models.Model):
    """Defines roles for users: customer, worker, admin, verifier."""
    user = models.ForeignKey(AuthenticatedUser, on_delete=models.CASCADE)
    role = models.CharField(max_length=16, choices=[
        ('customer', 'Customer'),
        ('worker', 'Worker'),
        ('admin', 'Admin'),
        ('verifier', 'Verifier')
    ])
    created_at = models.DateTimeField(auto_now_add=True)


# ==============================
# Services
# ==============================
class Service(models.Model):
    """Types of services offered (e.g., Plumbing, Cleaning) with base cost."""
    service_type = models.CharField(max_length=80)
    description = models.TextField()
    base_coins_cost = models.PositiveIntegerField()

    def __str__(self):
        return self.service_type


# ==============================
# Worker Applications & Profiles
# ==============================
class WorkerApplication(models.Model):
    """Stores worker application details before approval."""
    name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=24)
    address = models.TextField()
    location = gis_models.PointField(geography=True)

    service_categories = ArrayField(models.CharField(max_length=40))
    experience = models.TextField()
    documents = models.JSONField(blank=True, default=dict)
    application_fee_paid = models.BooleanField(default=False)
    verification_stage = models.IntegerField(default=1)
    application_status = models.CharField(max_length=16, choices=[
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], default='pending')
    applied_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.application_status == 'approved':
            # Query user by email in AuthenticatedUser
            try:
                user = AuthenticatedUser.objects.get(email=self.email)
            except AuthenticatedUser.DoesNotExist:
                # Optionally, create the user here or raise an error
                return

            # Assign role 'worker' if not already assigned
            user_role, created = UserRole.objects.get_or_create(
                user=user,
                defaults={'role': 'worker'}
            )

            # Create or update the Worker instance linked to this user
            worker, created = Worker.objects.get_or_create(
                user=user,
                defaults={
                    'application': self,
                    'location': self.location,
                    'is_available': True,
                    'experience_years': 0,  # Set defaults as needed
                }
            )
            if not created:
                # Update application and location if worker already exists
                worker.application = self
                worker.location = self.location or worker.location
                worker.save()

class Worker(models.Model):
    """Approved worker profiles with location, availability, and review stats."""
    user = models.OneToOneField('AuthenticatedUser', on_delete=models.CASCADE, related_name='worker_profile')
    application = models.OneToOneField('WorkerApplication', on_delete=models.CASCADE, null=True, blank=True)
    location = gis_models.PointField(geography=True, null=True, blank=True)
    is_available = models.BooleanField(default=True)
    allows_cod = models.BooleanField(default=False)
    experience_years = models.PositiveIntegerField(default=0)
    profile_image = models.ImageField(upload_to='worker_profiles/', blank=True, null=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    # Review statistics
    average_rating = models.FloatField(default=0.0)
    total_reviews = models.PositiveIntegerField(default=0)
    def active_job(self):
        # Returns the active booking/job assigned to this worker, or None if none exists
        return self.bookings.filter(Q(status='in_progress') | Q(status='active')).first()
    
    @property
    def worker_name(self):
        return self.application.name if self.application else ""

    def update_average_rating(self):
        """Recalculate average rating based on all reviews."""
        reviews = self.userreview_set.filter(rating__isnull=False)
        agg = reviews.aggregate(avg_rating=models.Avg("rating"), total=models.Count("id"))
        self.average_rating = round(agg["avg_rating"] or 0.0, 2)
        self.total_reviews = agg["total"] or 0
        self.save(update_fields=["average_rating", "total_reviews"])

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Automatically create WorkerService entries from application service categories
        if self.application and self.application.service_categories:
            from core.models import Service, WorkerService
            for service_type in self.application.service_categories:
                try:
                    service = Service.objects.get(service_type=service_type)
                    WorkerService.objects.get_or_create(
                        worker=self,
                        service=service,
                        defaults={'charge': service.base_coins_cost},
                    )
                except Service.DoesNotExist:
                    pass

    class Meta:
        db_table = 'workers'
        verbose_name = 'Worker'
        verbose_name_plural = 'Workers'


class WorkerService(models.Model):
    """Link between workers and their offered services with individual pricing."""
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name='services')
    service = models.ForeignKey('core.Service', on_delete=models.CASCADE)
    charge = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('worker', 'service')
        db_table = 'worker_services'
        verbose_name = 'Worker Service'
        verbose_name_plural = 'Worker Services'


# ==============================
# Bookings & Transactions
# ==============================
class Booking(models.Model):
    """Tracks service bookings, status, locations, payments."""
    user = models.ForeignKey('AuthenticatedUser', on_delete=models.CASCADE, related_name='bookings')
    worker = models.ForeignKey(
    Worker,
    on_delete=models.SET_NULL,
    null=True,        # Allow null values
    blank=True,
    related_name='bookings'
)

    service = models.ForeignKey('core.Service', on_delete=models.CASCADE)
    booking_time = models.DateTimeField(auto_now_add=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    receipt_sent = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=[
        ('booked', 'Booked'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled')
    ], default='booked')
    payment_status = models.CharField(
    max_length=20,
    choices=[
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed')
    ],
    default='pending'
)

    job_location = gis_models.PointField(geography=True, null=True, blank=True)
    tariff_coins = models.PositiveIntegerField(null=True, blank=True)
    admin_commission_coins = models.PositiveIntegerField(null=True, blank=True)
    payment_method = models.CharField(max_length=10, choices=[
        ('coins', 'Coins'),
        ('cod', 'Cash on Delivery'),
        ('online', 'Online')
    ], default='coins')
    payment_received = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    details = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'bookings' 
        verbose_name = 'Booking'
        verbose_name_plural = 'Bookings'

class BookingPhoto(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='booking_photos/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'booking_photos'
        verbose_name = 'Booking Photo'
        verbose_name_plural = 'Booking Photos'
class Tariff(models.Model):
    booking = models.ForeignKey(Booking, related_name='tariffs', on_delete=models.CASCADE)
    label = models.CharField(max_length=100)
    amount = models.PositiveIntegerField()
    explanation = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "tariffs"

class RazorpayPayment(models.Model):
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='razorpay_payment')
    razorpay_order_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_signature = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('created', 'Created'),
            ('paid', 'Paid'),
            ('failed', 'Failed')
        ],
        default='created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'razorpay_payments'
        verbose_name = 'Razorpay Payment'
        verbose_name_plural = 'Razorpay Payments'
class WorkerEarning(models.Model):
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="earnings")
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE)
    amount = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    user_review = models.OneToOneField(
        UserReview,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="worker_earning"
    )
    class Meta:
        db_table = 'worker_earnings'

# ==============================
# Reviews & ML Dataset
# ==============================
class UserReview(models.Model):
    """User reviews for workers."""
    user = models.ForeignKey('AuthenticatedUser', on_delete=models.CASCADE)
    worker = models.ForeignKey('Worker', on_delete=models.CASCADE)
    booking = models.ForeignKey('Booking', on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self):
        return f"Review by {self.user} for {self.worker} - Rating: {self.rating}"


class UserWorkerData(models.Model):
    """Expanded data for ML: links user, worker, service, review and other metrics."""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(AuthenticatedUser, on_delete=models.CASCADE)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE)
    worker_location = gis_models.PointField()
    service_name = models.CharField(max_length=100)
    worker_experience = models.IntegerField()
    charge = models.IntegerField(default=0)
    num_bookings = models.IntegerField(default=0)
    total_rating = models.FloatField(default=0.0)
    worker_latitude = models.FloatField(null=True, blank=True)
    worker_longitude = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "user_worker_data"
        unique_together = ('user', 'worker', 'service')
    def __str__(self):
        return f"{self.user} → {self.worker} ({self.service_name})"

@receiver(post_save, sender=Booking)
def update_worker_data(sender, instance, **kwargs):
    booking = instance
    service = booking.service
    worker = booking.worker
    user = booking.user

    if worker and service:
        avg_rating = worker.userreview_set.aggregate(avg=Avg('rating'))['avg'] or 0.0

        UserWorkerData.objects.update_or_create(
            worker=worker,                   # Use worker for uniqueness
            defaults={
                "user": user,               # optional, depending on your model and uniqueness
                "service": service,         # optional, if a worker can offer multiple services
                "service_name": service.service_type,
                "worker_location": worker.location,
                "worker_experience": worker.experience_years,
                "charge": booking.tariff_coins or 0,
                "num_bookings": worker.bookings.count(),
                "total_rating": avg_rating,
                "worker_latitude": worker.location.y,   # Latitude from PointField
                "worker_longitude": worker.location.x,  # Longitude from PointField
            }
        )



# ==============================
# Search History & Recommendations
# ==============================
class SearchHistory(models.Model):
    """Tracks user search queries with optional location and filters."""
    user = models.ForeignKey(AuthenticatedUser, on_delete=models.CASCADE)
    query = models.TextField()
    filters = models.JSONField(default=dict, blank=True)
    location = gis_models.PointField(geography=True)
    created_at = models.DateTimeField(auto_now_add=True)


# ==============================
# Session Logs
# ==============================
class SessionLog(models.Model):
    """Tracks user sessions, IPs, events, and device info for auditing or analytics."""
    user = models.ForeignKey(AuthenticatedUser, on_delete=models.SET_NULL, null=True, blank=True)
    ip_address = models.CharField(max_length=45)
    event_type = models.CharField(max_length=50)  # e.g., login, logout, booking
    user_agent = models.TextField(blank=True)     # device/browser info
    additional_info = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.event_type} @ {self.created_at}"
