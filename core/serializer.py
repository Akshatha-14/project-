from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import *


class UserSerializer(serializers.ModelSerializer):
    phone = serializers.SerializerMethodField()
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()

    class Meta:
        model = AuthenticatedUser
        fields = ('email', 'name', 'first_name', 'last_name', 'address', 'phone', 'location')

    def get_phone(self, obj):
        return str(obj.phone) if obj.phone else None

    def get_first_name(self, obj):
        if obj.name:
            parts = obj.name.split()
            return parts[0] if parts else ''
        return ''

    def get_last_name(self, obj):
        if obj.name:
            parts = obj.name.split()
            return ' '.join(parts[1:]) if len(parts) > 1 else ''
        return ''


class ServiceSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='service_type', read_only=True)

    class Meta:
        model = Service
        fields = ['id', 'service_type', 'name', 'description']


class WorkerServiceSerializer(serializers.ModelSerializer):
    service = ServiceSerializer(read_only=True)

    class Meta:
        model = WorkerService
        fields = ['id', 'service', 'charge']


class WorkerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    services = WorkerServiceSerializer(many=True, read_only=True)
    cost_per_hour = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    is_available = serializers.BooleanField(read_only=True)  # explicitly expose availability

    class Meta:
        model = Worker
        fields = [
            'id', 'user', 'name', 'services', 'cost_per_hour', 'is_available',
            'allows_cod', 'experience_years', 'profile_image'
        ]

    def get_cost_per_hour(self, obj):
        first_service = obj.services.first()
        return first_service.charge if first_service else 0

    def get_name(self, obj):
        if obj.application and obj.application.name:
            return obj.application.name
        return obj.user.name if obj.user and obj.user.name else f"Worker {obj.id}"

class BookingPhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = BookingPhoto
        fields = ('id', 'image_url')

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


class TariffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tariff
        fields = ('label', 'amount', 'explanation')


class BookingSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    worker = WorkerSerializer(read_only=True)
    service = ServiceSerializer(read_only=True)
    tariffs = TariffSerializer(many=True, read_only=True)
    worker_id = serializers.IntegerField(source='worker.id', read_only=True)
    worker_phone = serializers.CharField(source='worker.user.phone', read_only=True)
    rating = serializers.SerializerMethodField()
    class Meta:
        model = Booking
        fields = ['id', 'user','worker_id', 'worker_phone', 'rating','worker', 'service', 'booking_time', 'status', 'tariffs', 'total','payment_status']
    def get_rating(self, obj):
        review = obj.userreview_set.filter(user=obj.user).first()
        if review:
            print(f"Booking {obj.id} has rating: {review.rating}")
            return review.rating
        else:
            print(f"Booking {obj.id} has no rating")
            return None

class RazorpayPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RazorpayPayment
        fields = ('razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature', 'status')

class BookingDetailSerializer(serializers.ModelSerializer):
    service = ServiceSerializer(read_only=True)
    worker = WorkerSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    photos = BookingPhotoSerializer(many=True, read_only=True)
    tariffs = TariffSerializer(many=True, read_only=True)
    razorpay_payment = RazorpayPaymentSerializer(read_only=True)
    
    rating = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = '__all__'

    def get_rating(self, obj):
        review = obj.userreview_set.filter(user=obj.user).first()
        if review:
            print(f"Booking {obj.id} has rating: {review.rating}")
            return review.rating
        else:
            print(f"Booking {obj.id} has no rating")
            return None


class BookingCreateSerializer(serializers.Serializer):
    userId = serializers.IntegerField()
    workerId = serializers.IntegerField()
    contactDates = serializers.ListField(child=serializers.CharField())
    description = serializers.CharField()
    urgency = serializers.CharField()

    def validate(self, data):
        if not data.get('workerId'):
            raise serializers.ValidationError("workerId is required")
        if not data.get('userId'):
            raise serializers.ValidationError("userId is required")
        return data


class UserProfileSerializer(GeoFeatureModelSerializer):
    phone = serializers.SerializerMethodField()

    class Meta:
        model = AuthenticatedUser
        geo_field = 'location'
        fields = ('email', 'name', 'address', 'phone', 'location')

    def get_phone(self, obj):
        return str(obj.phone) if obj.phone else None


class JobSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    worker = WorkerSerializer(read_only=True, allow_null=True)
    service = ServiceSerializer(read_only=True)
    notes = serializers.CharField(source='details', allow_blank=True, default='')
    tariffs = TariffSerializer(many=True)
    photos = BookingPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'user', 'worker', 'service', 'booking_time', 'notes', 'tariffs', 'status',
            'photos', 'job_location', 'tariff_coins', 'payment_method', 'payment_received'
        ]

    def to_representation(self, instance):
        repr = super().to_representation(instance)
        if not instance.worker:
            repr['worker'] = {
                'name': 'Unassigned',
                'id': None,
            }
        return repr



class WorkerSettingsSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Worker
        fields = ['id', 'user', 'is_available', 'profile_image', 'allows_cod', 'experience_years']
        read_only_fields = ['id', 'user']


class EarningsSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    service = ServiceSerializer(read_only=True)
    tarif = TariffSerializer(many=True, source='tariffs')
    date = serializers.DateTimeField(source='booking_time', read_only=True)
    address = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'user', 'service', 'date', 'address', 'rating', 'tarif',
            'tariff_coins', 'payment_method', 'payment_received', 'status'
        ]

    def get_address(self, obj):
        return obj.user.address if obj.user else 'N/A'

    def get_rating(self, obj):
        review = obj.userreview_set.first()
        return review.rating if review and review.rating else None
from rest_framework import serializers
import logging

logger = logging.getLogger(__name__)

class WorkerEarningSerializer(serializers.ModelSerializer):
    service = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    tarif = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = WorkerEarning
        fields = ['id', 'amount', 'created_at', 'service', 'customer', 'date', 'address', 'tarif', 'rating', 'payment_status']

    def get_service(self, obj):
        service = getattr(obj.booking, 'service', None)
        result = getattr(service, 'service_type', '') or getattr(service, 'name', '') if service else ''
        logger.debug(f"Service: {result}")
        return result

    def get_customer(self, obj):
        user = getattr(obj.booking, 'user', None)
        if user:
            logger.debug(f"User found: {user.username}")
            return user.username
        logger.debug("User not found")
        return "Unknown Customer"



    def get_date(self, obj):
        booking_time = getattr(obj.booking, 'booking_time', None)
        if booking_time:
            result = booking_time.strftime('%Y-%m-%d %H:%M:%S')
        else:
            result = None
        logger.debug(f"Date: {result}")
        return result

    def get_address(self, obj):
        job_location = getattr(obj.booking, 'job_location', None)
        if job_location:
            result = f"Lat: {job_location.y}, Lng: {job_location.x}"
        else:
            result = "Address not available"
        logger.debug(f"Address: {result}")
        return result

    def get_tarif(self, obj):
        tariffs = getattr(obj.booking, 'tariffs', None)
        if tariffs:
            result = [{'label': t.label, 'amount': t.amount} for t in tariffs.all()]
        else:
            result = []
        logger.debug(f"Tarif: {result}")
        return result

    def get_rating(self, obj):
        worker = getattr(obj, 'worker', None)
        if worker:
            reviews = worker.userreview_set.filter(rating__isnull=False)
            avg_rating = reviews.aggregate(avg=serializers.Avg('rating'))['avg']
            result = round(avg_rating, 2) if avg_rating else "—"
        else:
            result = "—"
        logger.debug(f"Rating: {result}")
        return result

    def get_payment_status(self, obj):
        if obj.booking:
            result = getattr(obj.booking, 'payment_status', None)
        else:
            result = None
        logger.debug(f"Payment Status: {result}")
        return result
class UserReviewRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserReview
        fields = ['booking', 'rating']  # only necessary fields

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value
