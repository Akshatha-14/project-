from django.contrib.auth import get_user_model, authenticate, login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions
from .models import *
from datetime import timedelta
from rest_framework.decorators import api_view, permission_classes,action
from rest_framework.permissions import IsAuthenticated,AllowAny
from rest_framework.response import Response
from django.contrib.gis.geos import Point as GEOSPoint
from .serializer import *
from django.http import JsonResponse
from .data_prep import *# load_df returns DataFrame
from shapely.geometry import Point
from django.conf import settings
import pandas as pd
from sqlalchemy import create_engine
from core.ml_model import recommendation_model  # Your pre-loaded LightGBM model
from core.utils import haversine_vector
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework import status,viewsets
from django.shortcuts import get_object_or_404
import os
import json
import base64
from Crypto.Cipher import AES, PKCS1_OAEP
from Crypto.Util.Padding import unpad
import hashlib
from Crypto.PublicKey import RSA
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.files.base import ContentFile
from django.views.decorators.csrf import csrf_exempt
import razorpay
import hmac
from decimal import Decimal

User = get_user_model()

# Load RSA private key securely (store private.pem safely on your server)
PRIVATE_KEY_PATH = os.path.join(settings.BASE_DIR, 'private.pem')
with open(PRIVATE_KEY_PATH, 'rb') as key_file:
    PRIVATE_KEY = RSA.import_key(key_file.read())

def decrypt_rsa(encrypted_b64):
    try:
        encrypted_data = base64.b64decode(encrypted_b64)
        cipher_rsa = PKCS1_OAEP.new(PRIVATE_KEY)
        decrypted = cipher_rsa.decrypt(encrypted_data)
        return decrypted  # bytes representing AES key
    except Exception:
        return None

def decrypt_aes(encrypted_b64, aes_key):
    try:
        encrypted_data = base64.b64decode(encrypted_b64)
        iv = encrypted_data[:16]
        ciphertext = encrypted_data[16:]
        cipher_aes = AES.new(aes_key, AES.MODE_CBC, iv)
        decrypted_data = unpad(cipher_aes.decrypt(ciphertext), AES.block_size)
        return decrypted_data.decode('utf-8')
    except Exception:
        return None


@api_view(['POST'])
@permission_classes([AllowAny])
def user_signup(request):
    try:
        payload = request.data
        key_enc = payload.get('key')
        data_enc = payload.get('data')
        if not key_enc or not data_enc:
            return Response({"error": "Missing encryption data."}, status=400)

        aes_key = decrypt_rsa(key_enc)
        if not aes_key:
            return Response({"error": "Invalid encrypted key."}, status=400)

        decrypted = {}
        for field in ['name', 'email', 'password']:
            val = decrypt_aes(data_enc.get(field), aes_key)
            if val is None:
                return Response({"error": f"Failed to decrypt {field}."}, status=400)
            decrypted[field] = val

        email, password, name = decrypted.get('email'), decrypted.get('password'), decrypted.get('name')
        if not all([email, password, name]):
            return Response({"error": "Missing required information."}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already registered."}, status=400)

        try:
            validate_password(password)
        except Exception as e:
            return Response({"error": getattr(e, 'messages', str(e))}, status=400)

        user = User.objects.create_user(email=email, password=password, name=name, is_active=True)
        return Response({"message": "User registered successfully."}, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"detail": "CSRF cookie set"})



@api_view(['POST'])
@permission_classes([AllowAny])
def api_user_login(request):
    try:
        payload = request.data
        key_enc = payload.get('key')
        data_enc = payload.get('data')

        if not key_enc or not data_enc:
            return Response({"error": "Missing encryption data."}, status=400)

        # Decrypt RSA-encrypted AES key
        aes_key = decrypt_rsa(key_enc)
        if not aes_key:
            return Response({"error": "Invalid encrypted key."}, status=400)

        print(f"Decrypted AES Key length: {len(aes_key)} bytes")

        # Extract encrypted email and password from data
        encrypted_email = data_enc.get('email')
        encrypted_password = data_enc.get('password')

        if not encrypted_email or not encrypted_password:
            return Response({"error": "Missing encrypted email or password."}, status=400)

        # Decrypt email and password using AES key
        email = decrypt_aes(encrypted_email, aes_key)
        password = decrypt_aes(encrypted_password, aes_key)

        if email is None:
            return Response({"error": "Failed to decrypt email."}, status=400)

        if password is None:
            return Response({"error": "Failed to decrypt password."}, status=400)

        # Debug logs to inspect decrypted values and their lengths
        print(f"Decrypted email (repr): {repr(email)} length: {len(email)}")
        print(f"Decrypted password (repr): {repr(password)} length: {len(password)}")

        # Trim decrypted values to ensure no trailing/leading whitespace
        email = email.strip()
        password = password.strip()

        if not email or not password:
            return Response({"error": "Email or password is empty after decryption."}, status=400)

        # Authenticate user using decrypted credentials
        user = authenticate(request, email=email, password=password)
        if not user:
            print(f"Authentication failed for email: {email}")
            return Response({"error": "Invalid credentials."}, status=401)

        # Successfully authenticate and login user
        login(request, user)

        # Get the user's role from UserRole model
        user_role = UserRole.objects.filter(user=user).first()
        role = user_role.role if user_role else ("admin" if user.is_staff else "user")

        profile_complete = all([user.phone, user.address, user.location])

        return Response({"message": "Login successful", "role": role, "profile_complete": profile_complete})

    except Exception as e:
        print(f"Exception in login: {str(e)}")
        return Response({"error": "Internal server error during login."}, status=500)



@api_view(['POST'])
def password_reset_request(request):
    email = request.data.get('email')
    if not email:
        return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({"error": "User with this email does not exist."}, status=status.HTTP_400_BAD_REQUEST)

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    reset_link = f"http://localhost:3000/reset-password/{uid}/{token}"

    subject = "Password Reset Request"
    message = (
        f"Hi,\n\n"
        f"Click the link below to reset your password:\n{reset_link}\n\n"
        f"If you didn't request this, please ignore this email."
    )

    send_mail(subject, message, 'no-reply@yourdomain.com', [email], fail_silently=False)

    return Response({"message": "Password reset link sent to your email."})
@api_view(['POST'])
def password_reset_confirm(request, uidb64, token):
    payload = request.data
    key_enc = payload.get('key')
    data_enc = payload.get('data')
    if not key_enc or not data_enc:
        return Response({"error": "Missing encryption data."}, status=400)

    # Decrypt AES key with RSA private key
    aes_key = decrypt_rsa(key_enc)
    if not aes_key:
        return Response({"error": "Invalid encrypted key."}, status=400)

    # Decrypt password with AES key
    encrypted_password = data_enc.get('password')
    new_password = decrypt_aes(encrypted_password, aes_key)
    if not new_password:
        return Response({"error": "Failed to decrypt password."}, status=400)

    new_password = new_password.strip()

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({"error": "Invalid reset link."}, status=400)

    if not default_token_generator.check_token(user, token):
        return Response({"error": "Token is invalid or expired."}, status=400)

    try:
        validate_password(new_password, user=user)
    except Exception as e:
        return Response({"error": e.messages}, status=400)

    user.set_password(new_password)
    user.save()

    is_valid = user.check_password(new_password)
    print(f"Password saved and checked: {is_valid}")

    return Response({"message": "Password has been reset successfully."})


@api_view(['POST'])
def google_social_login(request):
    token = request.data.get('token')
    if not token:
        return Response({"error": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        id_info = id_token.verify_oauth2_token(token, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
    except ValueError:
        return Response({"error": "Invalid Google token."}, status=status.HTTP_400_BAD_REQUEST)

    email = id_info.get('email')
    if not email:
        return Response({"error": "Google account does not have an email."}, status=status.HTTP_400_BAD_REQUEST)

    user, created = User.objects.get_or_create(email=email, defaults={'is_active': True})
    if created:
        user.set_unusable_password()
        user.save()

    login(request, user, backend=settings.AUTHENTICATION_BACKENDS[0])

    return Response({
        "message": "Successfully logged in with Google.",
        "email": user.email,
        "is_new_user": created,
    })


def build_user_locs_dict(engine):
    user_locs = pd.read_sql("""
        SELECT id,
               ST_Y(location::geometry) AS lat,
               ST_X(location::geometry) AS lon
        FROM core_authenticateduser
        WHERE location IS NOT NULL;
    """, engine)
    return {row["id"]: Point(row["lon"], row["lat"]) for _, row in user_locs.iterrows()}

def user_has_single_worker_repeated(user_id, engine, threshold=3):
    query = """
        SELECT worker_id
        FROM bookings
        WHERE user_id = %s
        ORDER BY id DESC
        LIMIT %s;
    """
    bookings = pd.read_sql(query, engine, params=(user_id, threshold))
    return bookings['worker_id'].nunique() == 1 if not bookings.empty else False

import pandas as pd
import numpy as np
from .utils import haversine_vector  # Make sure this exists in core/utils.py

def recommend_top_n_for_user(user_id, model, engine, top_n=5):
    """
    Recommend top N workers for a user:
    - New user: location, rating, bookings, charge
    - Existing user: combination of
        1. Workers offering past services (familiar)
        2. Nearby high-rated workers not offering past services (exploration)
    """
    user_locs_dict = build_user_locs_dict(engine)
    user_point = user_locs_dict.get(user_id)
    if not user_point:
        return []

    # Load all bookings
    df = load_df(engine)

    # Check if user is new
    user_bookings_count = pd.read_sql(
        "SELECT COUNT(*) AS cnt FROM bookings WHERE user_id = %s",
        engine,
        params=(user_id,)
    )
    is_new_user = True
    if not user_bookings_count.empty and user_bookings_count.iloc[0]['cnt'] > 0:
        is_new_user = False

    if is_new_user:
        return recommend_top_n_for_user_new(user_id, engine, user_point, top_n)

    # Existing user
    past_services = df[df["user_id"] == user_id]["service_id"].unique().tolist()
    if not past_services:
        return recommend_top_n_for_user_new(user_id, engine, user_point, top_n)

    # --- 1️⃣ Workers offering past services ---
    familiar_df = pd.read_sql(f"""
        SELECT w.id AS worker_id,
               wu.name AS worker_name,
               s.id AS service_id,
               s.service_type AS service_name,
               ST_Y(w.location::geometry) AS worker_lat,
               ST_X(w.location::geometry) AS worker_lon,
               COALESCE(b.total_bookings,0) AS num_bookings,
               w.average_rating AS total_rating,
               ws.charge,
               w.is_available,
               1 AS service_match
        FROM workers w
        LEFT JOIN worker_services ws ON w.id = ws.worker_id
        LEFT JOIN core_service s ON ws.service_id = s.id
        LEFT JOIN core_authenticateduser wu ON w.user_id = wu.id
        LEFT JOIN (
            SELECT worker_id, COUNT(*) AS total_bookings
            FROM bookings
            WHERE status = 'completed'
            GROUP BY worker_id
        ) b ON w.id = b.worker_id
        WHERE w.is_available = TRUE AND w.location IS NOT NULL
          AND s.id IN ({','.join([str(s) for s in past_services])})
    """, engine)

    # --- 2️⃣ Nearby workers not offering past services (exploration) ---
    explore_df = pd.read_sql(f"""
        SELECT w.id AS worker_id,
               wu.name AS worker_name,
               s.id AS service_id,
               s.service_type AS service_name,
               ST_Y(w.location::geometry) AS worker_lat,
               ST_X(w.location::geometry) AS worker_lon,
               COALESCE(b.total_bookings,0) AS num_bookings,
               w.average_rating AS total_rating,
               ws.charge,
               w.is_available,
               0 AS service_match
        FROM workers w
        LEFT JOIN worker_services ws ON w.id = ws.worker_id
        LEFT JOIN core_service s ON ws.service_id = s.id
        LEFT JOIN core_authenticateduser wu ON w.user_id = wu.id
        LEFT JOIN (
            SELECT worker_id, COUNT(*) AS total_bookings
            FROM bookings
            WHERE status = 'completed'
            GROUP BY worker_id
        ) b ON w.id = b.worker_id
        WHERE w.is_available = TRUE AND w.location IS NOT NULL
          AND s.id NOT IN ({','.join([str(s) for s in past_services])})
    """, engine)

    # --- Filter out empty DataFrames to avoid concat warning ---
    frames = [df for df in [familiar_df, explore_df] if not df.empty]
    if not frames:
        return recommend_top_n_for_user_new(user_id, engine, user_point, top_n)
    cand_df = pd.concat(frames, ignore_index=True)

    # Fill nulls with explicit dtypes to avoid downcasting warnings
    cand_df["total_rating"] = cand_df["total_rating"].fillna(0.0).astype(float)
    cand_df["charge"] = cand_df["charge"].fillna(0.0).astype(float)
    cand_df["num_bookings"] = cand_df["num_bookings"].fillna(0).astype(int)

    # Distance from user
    cand_df['distance_km'] = haversine_vector(
        user_point.y, user_point.x,
        cand_df['worker_lat'], cand_df['worker_lon']
    )

    # Score formula
    cand_df['score'] = (
        (-1 * cand_df['distance_km']) +
        cand_df['total_rating'] * 1.0 +
        cand_df['num_bookings'] * 0.5 +
        cand_df['service_match'] * 1.0 -   # bonus if familiar service
        cand_df['charge'] * 0.2
    )

    # Aggregate workers (avoid duplicates)
    cand_df = cand_df.groupby('worker_id', as_index=False).agg({
        'worker_name': 'first',
        'service_name': 'first',
        'worker_lat': 'first',
        'worker_lon': 'first',
        'charge': 'mean',
        'num_bookings': 'sum',
        'total_rating': 'mean',
        'is_available': 'first',
        'distance_km': 'min',
        'service_match': 'max',
        'score': 'max'
    })

    # Sort and return top N
    top_workers = cand_df.sort_values('score', ascending=False).head(top_n)
    return top_workers.to_dict(orient='records')


def recommend_top_n_for_user_new(user_id, engine, user_point, top_n=5):
    """
    Fallback / new user recommendations
    """
    cand_df = pd.read_sql("""
        SELECT w.id AS worker_id,
               wu.name AS worker_name,
               s.service_type AS service_name,
               ST_Y(w.location::geometry) AS worker_lat,
               ST_X(w.location::geometry) AS worker_lon,
               COALESCE(b.total_bookings,0) AS num_bookings,
               w.average_rating AS total_rating,
               ws.charge,
               w.is_available
        FROM workers w
        LEFT JOIN core_authenticateduser wu ON w.user_id = wu.id
        LEFT JOIN worker_services ws ON w.id = ws.worker_id
        LEFT JOIN core_service s ON ws.service_id = s.id
        LEFT JOIN (
            SELECT worker_id, COUNT(*) AS total_bookings
            FROM bookings
            WHERE status = 'completed'
            GROUP BY worker_id
        ) b ON w.id = b.worker_id
        WHERE w.is_available = TRUE AND w.location IS NOT NULL
    """, engine)

    if cand_df.empty:
        return []

    # Fill nulls with explicit dtypes
    cand_df["num_bookings"] = cand_df["num_bookings"].fillna(0).astype(int)
    cand_df["total_rating"] = cand_df["total_rating"].fillna(0.0).astype(float)
    cand_df["charge"] = cand_df["charge"].fillna(0.0).astype(float)

    # Distance
    cand_df['distance_km'] = haversine_vector(
        user_point.y, user_point.x,
        cand_df['worker_lat'], cand_df['worker_lon']
    )

    # Score
    cand_df['score'] = (
        (-1 * cand_df['distance_km']) +
        cand_df['num_bookings'] * 0.5 +
        cand_df['total_rating'] * 1.0 -
        cand_df['charge'] * 0.2
    )

    cand_df = cand_df.groupby('worker_id', as_index=False).agg({
        'worker_name': 'first',
        'service_name': 'first',
        'worker_lat': 'first',
        'worker_lon': 'first',
        'charge': 'mean',
        'num_bookings': 'sum',
        'total_rating': 'mean',
        'is_available': 'first',
        'distance_km': 'min',
        'score': 'max'
    })

    top_workers = cand_df.sort_values('score', ascending=False).head(top_n)
    return top_workers.to_dict(orient='records')


@api_view(['GET'])
def recommend_view(request, user_id):
    db_settings = settings.DATABASES['default']
    user = db_settings['USER']
    password = db_settings['PASSWORD']
    host = db_settings['HOST']
    port = db_settings['PORT']
    dbname = db_settings['NAME']

    conn_str = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(conn_str)

    model = recommendation_model

    recommendations = recommend_top_n_for_user(int(user_id), model, engine)

    return Response({'user_id': user_id, 'recommendations': recommendations or []})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    user = request.user
    if request.method == 'GET':
        loc = user.location
        loc_json = {"type": "Point", "coordinates": [loc.x, loc.y]} if loc else None
        return Response({
            "id": user.id,
            "email": user.email,
            "username": user.name or user.email.split("@")[0],
            "address": user.address,
            "phone": str(user.phone) if user.phone else None,
            "location": loc_json,
            "profile_complete": all([user.phone, user.address, user.location]),
        })


    elif request.method == 'POST':
        payload = request.data
        key_enc = payload.get('key')
        data_enc = payload.get('data')
        if not key_enc or not data_enc:
            return Response({"error": "Missing encryption data."}, status=400)

        aes_key = decrypt_rsa(key_enc)
        if not aes_key:
            return Response({"error": "Invalid encrypted key."}, status=400)

        decrypted = {}
        for field in ['name', 'address', 'phone', 'location']:
            val_enc = data_enc.get(field)
            if val_enc:
                val = decrypt_aes(val_enc, aes_key)
                if val is None:
                    return Response({"error": f"Failed to decrypt {field}."}, status=400)
                if field == 'location':
                    try:
                        val = json.loads(val)
                    except Exception:
                        return Response({"error": "Invalid location JSON."}, status=400)
                decrypted[field] = val

        if 'name' in decrypted:
            user.name = decrypted['name']
        if 'address' in decrypted:
            user.address = decrypted['address']
        if 'phone' in decrypted:
            user.phone = decrypted['phone']
        if 'location' in decrypted:
            loc = decrypted['location']
            if isinstance(loc, dict) and loc.get('type') == 'Point':
                coords = loc.get('coordinates')
                if isinstance(coords, list) and len(coords) == 2 and all(isinstance(c, (int, float)) for c in coords):
                    user.location = GEOSPoint(coords[0], coords[1])
                else:
                    return Response({"error": "Invalid location coords."}, status=400)
            else:
                return Response({"error": "Invalid location format."}, status=400)
        user.save()
        return Response({"message": "Profile updated"})


class BookingCreateView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BookingSerializer

    def decrypt_aes(self, encrypted_bytes: bytes, aes_key: bytes) -> bytes:
        """
        Decrypt AES-CBC encrypted data (with first 16 bytes as IV).
        Handles padding issues by stripping null bytes if unpad fails.
        """
        if len(encrypted_bytes) < 16:
            raise ValueError("Invalid encrypted data length")

        iv = encrypted_bytes[:16]
        ciphertext = encrypted_bytes[16:]

        remainder = len(ciphertext) % 16
        if remainder != 0:
            ciphertext += b'\x00' * (16 - remainder)

        cipher = AES.new(aes_key, AES.MODE_CBC, iv)
        decrypted_padded = cipher.decrypt(ciphertext)

        try:
            decrypted = unpad(decrypted_padded, AES.block_size)
        except ValueError:
            decrypted = decrypted_padded.rstrip(b'\x00')
        return decrypted

    def post(self, request):
        try:
            payload = request.data
            encrypted_key = payload.get("key")
            encrypted_data_str = payload.get("data")

            if not encrypted_key or not encrypted_data_str:
                return Response({"error": "Missing encryption data."}, status=400)

            aes_key = decrypt_rsa(encrypted_key)
            if not aes_key:
                return Response({"error": "Invalid encryption key."}, status=400)

            encrypted_data = json.loads(encrypted_data_str)
            decrypted_map = {}
            for field in ["userId", "workerId", "contactDates", "description", "urgency"]:
                enc_field = encrypted_data.get(field)
                if enc_field:
                    enc_bytes = base64.b64decode(enc_field)
                    decrypted_map[field] = self.decrypt_aes(enc_bytes, aes_key).decode("utf-8")

            serializer = BookingCreateSerializer(data={
                "userId": int(decrypted_map["userId"]),
                "workerId": int(decrypted_map["workerId"]),
                "contactDates": json.loads(decrypted_map["contactDates"]),
                "description": decrypted_map["description"],
                "urgency": decrypted_map["urgency"],
            })
            serializer.is_valid(raise_exception=True)

            user = get_object_or_404(AuthenticatedUser, id=serializer.validated_data["userId"])
            worker = get_object_or_404(Worker, id=serializer.validated_data["workerId"])
            service = worker.services.first().service if worker.services.exists() else None
            if not service:
                return Response({"error": "Worker has no associated service"}, status=400)

            booking = Booking.objects.create(
                user=user,
                worker=worker,
                service=service,
                status="booked",
                job_location=worker.location,
                payment_method="coins",
                details=f"Urgency: {serializer.validated_data['urgency']}\n"
                        f"Contact Dates: {', '.join(serializer.validated_data['contactDates'])}\n"
                        f"Description: {serializer.validated_data['description']}",
            )

            # Save photos directly without decrypting
            photos = request.FILES.getlist("photos")
            for photo in photos:
                BookingPhoto.objects.create(booking=booking, image=photo)

            return Response({"message": "Booking created successfully"}, status=201)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_booking_history(request):
    user = request.user
    bookings = Booking.objects.filter(user=user, status__in=['booked', 'in_progress', 'completed'])\
              .prefetch_related('tariffs', 'photos').order_by('-booking_time')
    serializer = BookingDetailSerializer(bookings, many=True, context={'request': request})
    return Response(serializer.data)


class BookingCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, id=booking_id, user=request.user)
        if timezone.now() - booking.booking_time > timedelta(minutes=5):
            return Response({"error": "Cancellation period expired."}, status=400)
        booking.status = "cancelled"
        booking.save()
        return Response({"message": "Booking cancelled."})
    

from django.db.models import Avg

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def worker_homepage(request):
    try:
        worker = request.user.worker_profile
        active_job = Booking.objects.filter(worker=worker, status='in_progress').first()
        earnings = Booking.objects.filter(worker=worker, status='completed').order_by('-booking_time')
        pending_requests = Booking.objects.filter(worker=worker, status='booked').order_by('-booking_time')

        active_job_data = JobSerializer(active_job).data if active_job else None
        earnings_data = JobSerializer(earnings, many=True).data
        pending_requests_data = JobSerializer(pending_requests, many=True).data
        settings_data = WorkerSerializer(worker).data

        # Compute average rating from related UserReview
        avg_rating = worker.userreview_set.aggregate(avg=Avg('rating'))['avg'] or 0.0

        data = {
            'activeJob': active_job_data,
            'earnings': earnings_data,
            'pendingRequests': pending_requests_data,
            'settings': settings_data,
            'available': worker.is_available,
            'paymentStatus': active_job.payment_status if active_job else 'pending',
            'average_rating': avg_rating,
        }

        return Response(data)
    except Worker.DoesNotExist:
        logger.error("Worker profile not found for user %s", request.user.email)
        return Response({'detail': 'Worker not found'}, status=404)
    except Exception as e:
        logger.exception("Unexpected error in worker_homepage: %s", e)
        return Response({'detail': 'Error loading worker homepage'}, status=500)

import logging

logger = logging.getLogger(__name__)
from django.db import transaction
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def accept_job(request):
    user = request.user
    job_id = request.data.get('jobId')
    try:
        worker = Worker.objects.get(user=user)
        logger.debug(f'Worker found: {worker.id}')
        if worker.active_job():
            logger.debug('Worker already has an active job.')
            return Response({'detail': 'You already have an active job.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Lock the booking row for update to prevent concurrent accepts
        job = Booking.objects.select_for_update().get(pk=job_id, status='booked')
        logger.debug(f'Booking found: {job.id} with status {job.status}')
        
        job.worker = worker
        job.status = 'in_progress'
        job.save()
        
        worker.is_available = False
        worker.save()
        
        serializer = JobSerializer(job)
        logger.debug(f'Job accepted and updated for worker {worker.id}')
        return Response(serializer.data)
    except Booking.DoesNotExist:
        logger.debug('Booking not found or not available')
        return Response({'detail': 'Job not found or not available'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f'Unexpected error in accept_job: {e}')
        return Response({'detail': 'Error processing request'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


from django.core.exceptions import ObjectDoesNotExist
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from decimal import Decimal
from .models import Booking, Tariff
from .serializer import BookingDetailSerializer, BookingSerializer

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_tariff(request):
    logger = logging.getLogger(__name__)
    logger.debug(f"Received data: {request.data}")
    user = request.user
    job_id = request.data.get('jobId')
    new_tariffs = request.data.get('tariff', [])

    if not job_id:
        return Response({'detail': 'JobId is required'}, status=400)

    if not isinstance(new_tariffs, list):
        return Response({'detail': 'tariff must be a list'}, status=400)

    try:
        booking = Booking.objects.get(id=job_id, worker__user=user)
    except Booking.DoesNotExist:
        return Response({'detail': 'Booking not found'}, status=404)

    existing_tariffs = {t.id: t for t in booking.tariffs.all()}
    total_amount = Decimal('0')

    for item in new_tariffs:
        tariff_id = item.get('id')
        label = item.get('label', '')
        explanation = item.get('explanation', '')
        amount_val = item.get('amount', 0)

        try:
            amount = Decimal(str(amount_val))
        except Exception:
            amount = Decimal('0')

        total_amount += amount

        if tariff_id and tariff_id in existing_tariffs:
            tariff = existing_tariffs.pop(tariff_id)
            tariff.label = label
            tariff.amount = int(amount)
            tariff.explanation = explanation
            tariff.save()
        else:
            Tariff.objects.create(
                booking=booking,
                label=label,
                amount=int(amount),
                explanation=explanation,
            )

    # Remove tariffs not in new list
    for tariff_to_delete in existing_tariffs.values():
        tariff_to_delete.delete()

    booking.total = total_amount
    booking.tariff_coins = int(total_amount)
    booking.save(update_fields=['total', 'tariff_coins'])

    serializer = BookingDetailSerializer(booking, context={'request': request})
    return Response(serializer.data)

from .models import UserRole

def user_has_worker_role(user):
    try:
        user_role = UserRole.objects.get(user=user)
        return user_role.role == 'worker'
    except UserRole.DoesNotExist:
        return False
@api_view(['GET'])
def job_detail(request, pk):
    try:
        job = Booking.objects.get(pk=pk)
    except Booking.DoesNotExist:
        return Response({"error": "Job not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = JobSerializer(job)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_receipt(request):
    booking_id = request.data.get('bookingId')
    try:
        if user_has_worker_role(request.user):
            booking = Booking.objects.get(id=booking_id, worker__user=request.user)
        else:
            booking = Booking.objects.get(id=booking_id, user=request.user)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found'}, status=404)

    if booking.receipt_sent:
        return Response({'detail': 'Receipt already sent. Cannot resend.'}, status=400)

    booking.receipt_sent = True
    booking.save(update_fields=['receipt_sent'])

    serializer = BookingSerializer(booking, context={'request': request})
    data = serializer.data
    data['message'] = "Receipt sent successfully."

    return Response(data)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pay_job(request):
    # Your existing pay_job implementation
    # Ensure we parse JSON
    job_id = request.data.get('jobId')
    if not job_id:
        return Response(
            {'error': 'jobId is required in request body.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        booking = Booking.objects.get(id=job_id, user=request.user)
    except Booking.DoesNotExist:
        return Response(
            {'error': f'Booking {job_id} not found for this user.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Ensure tariff lines exist
    if not booking.tariffs.exists():
        return Response(
            {'error': 'No tariff lines set for this booking.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Ensure total is set
    if booking.total is None:
        return Response(
            {'error': 'Total amount is not set for this booking.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Process payment
    booking.payment_status = 'paid'
    booking.payment_received = True
    if booking.status == 'booked':
        booking.status = 'in_progress'
    booking.save(update_fields=['payment_received', 'status'])

    return Response(
        {'message': 'Payment recorded successfully.'},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_availability(request):
    user = request.user
    available = request.data.get('available')
    try:
        worker = Worker.objects.get(user=user)
        worker.is_available = available
        worker.save()
        return Response({'available': worker.is_available})
    except Worker.DoesNotExist:
        return Response({'detail': 'Worker not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def update_worker_settings(request):
    user = request.user
    try:
        worker = Worker.objects.get(user=user)
        data = request.data
        # For avatar, handle file uploads if necessary
        for field in ['name', 'email', 'contactNo', 'notifyEmail', 'notifySMS']:
            if field in data:
                setattr(worker, field, data[field])
        if 'avatar' in request.FILES:
            worker.avatar = request.FILES['avatar']
        worker.save()
        serializer = WorkerSerializer(worker)
        return Response(serializer.data)
    except Worker.DoesNotExist:
        return Response({'detail': 'Worker not found'}, status=status.HTTP_404_NOT_FOUND)
    



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_booking_detail(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id, user=request.user)
        serializer = BookingDetailSerializer(booking, context={'request': request})
        return Response(serializer.data)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found'}, status=404)


client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_razorpay_order(request):
    booking_id = request.data.get('bookingId')
    try:
        booking = Booking.objects.get(id=booking_id, user=request.user)
        if booking.payment_received:
            return Response({'error': 'Already paid'}, status=400)
        if booking.total is None or booking.total <= 0:
            return Response({'error': 'Invalid total amount for payment'}, status=400)

        amount_paise = int(booking.total * 100)
        razorpay_order = client.order.create(dict(
            amount=amount_paise,
            currency="INR",
            payment_capture=1,
            notes={
                "booking_id": str(booking.id),
                "user_id": str(request.user.id),
            }
        ))

        # Create or update RazorpayPayment linked to booking
        razorpay_payment, created = RazorpayPayment.objects.get_or_create(booking=booking)
        razorpay_payment.razorpay_order_id = razorpay_order['id']
        razorpay_payment.status = 'created'
        razorpay_payment.save()

        booking.payment_method = 'online'
        booking.payment_status = 'pending'
        booking.save(update_fields=['payment_method', 'payment_status'])
        booking.status = "progress"  # update the status here
        booking.save(update_fields=['payment_received', 'payment_status', 'status'])
        return Response({
            'order_id': razorpay_order['id'],
            'amount': amount_paise,
            'currency': 'INR',
            'key': settings.RAZORPAY_KEY_ID,
            'receipt': f'Booking_{booking.id}_Receipt'
        })

    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found'}, status=404)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_payment(request):
    data = request.data
    razorpay_order_id = data.get('razorpay_order_id')
    razorpay_payment_id = data.get('razorpay_payment_id')
    razorpay_signature = data.get('razorpay_signature')
    booking_id = data.get('bookingId')

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id]):
        return Response({"error": "Missing payment parameters"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        booking = Booking.objects.get(id=booking_id, user=request.user)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)

    msg = razorpay_order_id + "|" + razorpay_payment_id
    expected_signature = hmac.new(
        key=bytes(settings.RAZORPAY_KEY_SECRET, 'utf-8'),
        msg=bytes(msg, 'utf-8'),
        digestmod=hashlib.sha256
    ).hexdigest()

    if expected_signature != razorpay_signature:
        return Response({"error": "Invalid signature"}, status=status.HTTP_400_BAD_REQUEST)

    RazorpayPayment.objects.update_or_create(
        booking=booking,
        defaults={
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
            "status": "paid",
        },
    )

    booking.payment_method = 'online'
    booking.payment_received = True
    booking.payment_status = 'paid'
    booking.status = 'in_progress'  # Update status as needed
    booking.save(update_fields=['payment_method', 'payment_received', 'payment_status', 'status'])

    return Response({"message": "Payment verified successfully"})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_cod_payment(request):
    booking_id = request.data.get('bookingId')
    try:
        booking = Booking.objects.get(id=booking_id, user=request.user)
        booking.payment_method = 'cod'
        booking.payment_status = 'pending'
        booking.payment_received = False
        booking.save(update_fields=['payment_method', 'payment_status', 'payment_received'])
        return Response({'message': 'COD payment method set. Please pay during service.'})
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_cod_payment(request):
    booking_id = request.data.get('bookingId')
    try:
        worker = Worker.objects.get(user=request.user)  # get Worker from user
        booking = Booking.objects.get(id=booking_id, worker=worker)
        if booking.payment_method != 'cod':
            return Response({'error': 'Booking is not COD type'}, status=status.HTTP_400_BAD_REQUEST)
        booking.payment_status = 'paid'
        booking.payment_received = True
        booking.status = 'completed'  # Change status to completed on payment confirm
        booking.save(update_fields=['payment_status', 'payment_received', 'status'])
        return Response({'detail': 'COD payment confirmed and job completed'})
    except Worker.DoesNotExist:
        return Response({'error': 'Worker profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_job(request):
    user = request.user
    job_id = request.data.get('jobId')
    try:
        job = Booking.objects.get(id=job_id, worker__user=user, status='in_progress')
        job.status = 'completed'
        job.completed_at = timezone.now()
        job.save(update_fields=['status', 'completed_at'])

        WorkerEarning.objects.create(
            worker=job.worker,
            booking=job,
            amount=job.total,
        )

        # Optionally update worker availability
        worker = job.worker
        worker.is_available = True
        worker.save(update_fields=['is_available'])

        return Response({'detail': 'Job marked as complete.'})
    except Booking.DoesNotExist:
        return Response({'detail': 'Active job not found'}, status=status.HTTP_404_NOT_FOUND)
    
from django.core.exceptions import ObjectDoesNotExist

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def worker_earnings_list(request):
    try:
        worker = request.user.worker_profile
    except ObjectDoesNotExist:
        return Response({'error': 'User is not a worker.'}, status=400)

    earnings = WorkerEarning.objects.filter(worker=worker).select_related('booking', 'booking__service', 'booking__user')
    serializer = WorkerEarningSerializer(earnings, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_or_update_rating(request):
    user = request.user
    booking_id = request.data.get('booking')
    rating_value = request.data.get('rating')

    if not booking_id or rating_value is None:
        return Response({'error': 'booking and rating fields are required.'}, status=status.HTTP_400_BAD_REQUEST)


    try:
        rating_value = int(rating_value)
        if not (1 <= rating_value <= 5):
            return Response({'error': 'Rating must be between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError:
        return Response({'error': 'Rating must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

    booking = get_object_or_404(Booking, id=booking_id, user=user)

    if booking.payment_status != 'paid':
        return Response({'error': 'Rating is allowed only after successful payment.'}, status=status.HTTP_403_FORBIDDEN)

    review, created = UserReview.objects.update_or_create(
        user=user,
        booking=booking,
        defaults={
            'worker': booking.worker,
            'rating': rating_value,
        }
    )


    serializer = UserReviewRatingSerializer(review)
    if created:
        return Response({'message': 'Rating submitted successfully.', 'review': serializer.data}, status=status.HTTP_201_CREATED)
    else:
        return Response({'message': 'Rating updated successfully.', 'review': serializer.data}, status=status.HTTP_200_OK)