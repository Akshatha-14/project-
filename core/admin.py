from django.contrib import admin
from django.urls import path
from django.shortcuts import render
from django.db.models import Count
from django.db.models.functions import TruncDay
from django.utils.timezone import now
from django.utils.safestring import mark_safe
import json
from datetime import timedelta
from leaflet.admin import LeafletGeoAdmin

# ==============================
# Import Models
# ==============================
from .models import *
# ==============================
# LeafletGeoAdmin for models with locations
# ==============================
class WorkerAdmin(LeafletGeoAdmin):
    list_display = ('user', 'location', 'is_available', 'allows_cod', 'experience_years', 'approved_at')

class AuthenticatedUserAdmin(LeafletGeoAdmin):
    list_display = ('id', 'email', 'is_staff', 'is_active', 'location')
    search_fields = ('email','name')
    list_filter = ('is_staff', 'is_active')

# ==============================
# Normal Admin
# ==============================
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'created_at')
    list_filter = ('role',)

@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("service_type", "description", "base_coins_cost")

class WorkerApplicationAdmin(LeafletGeoAdmin):
    list_display = ('name', 'email', 'application_status', 'applied_at')
    list_filter = ('application_status',)
    default_lon = 77.5946  # Example default longitude
    default_lat = 12.9716  # Example default latitude
    default_zoom = 12
    geom_field = "Location"
@admin.register(WorkerService)
class WorkerServiceAdmin(admin.ModelAdmin):
    list_display = ("worker", "service", "charge")
    search_fields = ("worker__user__email", "service__service_type")

class BookingAdmin(LeafletGeoAdmin):
    list_display = ('user', 'worker', 'service', 'status', 'booking_time', 'payment_method', 'payment_received')
    list_filter = ('status', 'payment_method')
    # Specify which GIS field to show the map for
    default_lon = 77.5946  # Example default longitude
    default_lat = 12.9716  # Example default latitude
    default_zoom = 12
    # Field(s) to show map on
    geom_field = "job_location"
class SessionLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'event_type', 'ip_address', 'created_at')
    search_fields = ('ip_address', 'user__email')
    list_filter = ('event_type',)



class UserReviewAdmin(admin.ModelAdmin):
    list_display = ('user', 'worker', 'booking', 'rating', 'created_at')
    search_fields = ('comment', 'user__email', 'worker__user__email')

class SearchHistoryAdmin(admin.ModelAdmin):
    list_display = ('user', 'query', 'created_at')

# ==============================
# Admin for UserWorkerData (ML Dataset)
# ==============================
@admin.register(UserWorkerData)
class UserWorkerDataAdmin(admin.ModelAdmin):
    list_display = ('worker', 'service_name', 'get_service_type')
    search_fields = ('user__email', 'worker__user__email', 'service_name')
    list_filter = ('worker', 'user', 'service')

    def get_service_type(self, obj):
        return obj.service.service_type if obj.service else ""
    get_service_type.short_description = 'Service Type'
class BookingPhotoAdmin(admin.ModelAdmin):
    list_display = ('booking', 'image', 'uploaded_at')
    readonly_fields = ('uploaded_at',)


class TariffAdmin(admin.ModelAdmin):
    list_display = ('booking', 'label', 'amount', 'explanation')
    list_filter = ('booking',)


class RazorpayPaymentAdmin(admin.ModelAdmin):
    list_display = ('booking', 'razorpay_order_id', 'razorpay_payment_id', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('razorpay_order_id', 'razorpay_payment_id')


class WorkerEarningAdmin(admin.ModelAdmin):
    list_display = ('id', 'worker', 'booking', 'amount', 'created_at')
    list_filter = ('created_at', 'worker')
    search_fields = ('worker__user__name', 'booking__id')
    ordering = ('-created_at',)
# ==============================
# Custom Admin Site with Dashboard
# ==============================
from django.contrib.admin import AdminSite

class CustomAdminSite(AdminSite):
    site_header = "My Admin Dashboard"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [path('dashboard/', self.admin_view(self.dashboard_view), name="dashboard")]
        return custom_urls + urls

    def dashboard_view(self, request):
        today = now().date()
        days_ago = today - timedelta(days=6)
        date_list = [days_ago + timedelta(days=i) for i in range(7)]

        def fill_zeros(queryset):
            counts_map = {item['day'].strftime('%Y-%m-%d'): item['count'] for item in queryset}
            return [counts_map.get(day.strftime('%Y-%m-%d'), 0) for day in date_list]

        user_qs = (
            AuthenticatedUser.objects.filter(date_joined__date__gte=days_ago)
            .annotate(day=TruncDay('date_joined'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        worker_qs = (
            Worker.objects.filter(approved_at__date__gte=days_ago)
            .annotate(day=TruncDay('approved_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        user_growth_dates = [d.strftime('%Y-%m-%d') for d in date_list]
        user_growth_counts = fill_zeros(user_qs)
        worker_growth_dates = user_growth_dates
        worker_growth_counts = fill_zeros(worker_qs)

        context = {
            'total_users': AuthenticatedUser.objects.count(),
            'total_workers': Worker.objects.count(),
            'total_bookings': Booking.objects.count(),
            'user_growth_dates_json': mark_safe(json.dumps(user_growth_dates)),
            'user_growth_counts_json': mark_safe(json.dumps(user_growth_counts)),
            'worker_growth_dates_json': mark_safe(json.dumps(worker_growth_dates)),
            'worker_growth_counts_json': mark_safe(json.dumps(worker_growth_counts)),
        }

        return render(request, "admin/dashboard.html", context)

# ==============================
# Register models to Custom Admin
# ==============================
custom_admin_site = CustomAdminSite(name="custom_admin")
custom_admin_site.register(AuthenticatedUser, AuthenticatedUserAdmin)
custom_admin_site.register(UserRole, UserRoleAdmin)
custom_admin_site.register(Service, ServiceAdmin)
custom_admin_site.register(WorkerApplication, WorkerApplicationAdmin)
custom_admin_site.register(Worker, WorkerAdmin)
custom_admin_site.register(WorkerService, WorkerServiceAdmin)
custom_admin_site.register(Booking, BookingAdmin)
custom_admin_site.register(SessionLog, SessionLogAdmin)
custom_admin_site.register(UserReview, UserReviewAdmin)
custom_admin_site.register(SearchHistory, SearchHistoryAdmin)
custom_admin_site.register(UserWorkerData, UserWorkerDataAdmin)
custom_admin_site.register(BookingPhoto, BookingPhotoAdmin)
custom_admin_site.register(Tariff, TariffAdmin)
custom_admin_site.register(RazorpayPayment, RazorpayPaymentAdmin)
custom_admin_site.register(WorkerEarning, WorkerEarningAdmin)