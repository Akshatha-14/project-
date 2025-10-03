import os
import django
import random
from datetime import timedelta
from django.utils import timezone
from faker import Faker
from django.contrib.gis.geos import Point

# Setup Django environment (adjust 'your_project' accordingly)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from core.models import (
    AuthenticatedUser, UserRole, Service, WorkerApplication, Worker,
    WorkerService, Booking, UserReview
)

fake = Faker()
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = "Populate database with fake data for testing"

    def handle(self, *args, **options):
        populate_data()
        self.stdout.write(self.style.SUCCESS("Fake data population completed"))

# Helper to create a random Point within a bounding box (e.g., specific region)
def random_point(lat_range=(12.0, 13.0), lon_range=(75.0, 76.0)):
    lat = random.uniform(*lat_range)
    lon = random.uniform(*lon_range)
    return Point(lon, lat)

def create_services(n=10):
    services = []
    for _ in range(n):
        s = Service.objects.create(
            service_type=fake.job(),
            description=fake.text(max_nb_chars=100),
            base_coins_cost=random.randint(50, 500),
        )
        services.append(s)
    return services

def create_users(n=50):
    users = []
    for _ in range(n):
        email = fake.unique.email()
        user = AuthenticatedUser.objects.create_user(
            email=email,
            name=fake.name(),
            phone=fake.phone_number(),
            address=fake.address(),
            location=random_point()
        )
        users.append(user)
    return users

def create_worker_applications(users, services, n=30):
    applications = []
    for _ in range(n):
        user = random.choice(users)
        cat_services = random.sample([s.service_type for s in services], k=random.randint(1,3))
        app = WorkerApplication.objects.create(
            name=user.name,
            email=user.email,
            phone=user.phone,
            address=user.address,
            location=user.location,
            service_categories=cat_services,
            experience=fake.text(max_nb_chars=200),
            documents={},  # Empty dict for now
            application_fee_paid=True,
            verification_stage=3,
            application_status='approved',
            applied_at=timezone.now(),
            verified_at=timezone.now()
        )
        applications.append(app)
    return applications

def create_workers(applications, users):
    workers = []
    for app in applications:
        # Find matching user
        user = next((u for u in users if u.email == app.email), None)
        if user:
            # Skip if Worker for this user already exists
            if Worker.objects.filter(user=user).exists():
                continue
            w = Worker.objects.create(
                user=user,
                application=app,
                location=app.location,
                is_available=random.choice([True, False]),
                allows_cod=random.choice([True, False]),
                experience_years=random.randint(0, 15),
                approved_at=timezone.now(),
                created_at=timezone.now()
            )
            workers.append(w)
    return workers


def create_worker_services(workers, services):
    for worker in workers:
        # Assign 1-3 services from worker application categories if possible
        cat_names = worker.application.service_categories
        assigned_services = [s for s in services if s.service_type in cat_names]
        assigned_sample = random.sample(assigned_services, k=min(len(assigned_services), random.randint(1,3)))
        for svc in assigned_sample:
            WorkerService.objects.create(
                worker=worker,
                service=svc,
                charge=random.randint(svc.base_coins_cost, svc.base_coins_cost + 200),
            )

def create_bookings(users, workers, services, n=100):
    for _ in range(n):
        user = random.choice(users)
        worker = random.choice(workers)
        # Pick a service from worker's services
        w_services = WorkerService.objects.filter(worker=worker)
        if not w_services.exists():
            continue
        svc = random.choice(w_services).service

        booking = Booking.objects.create(
            user=user,
            worker=worker,
            service=svc,
            booking_time=timezone.now() - timedelta(days=random.randint(0, 180)),
            status=random.choice(['booked', 'in_progress', 'completed', 'cancelled']),
            job_location=random_point(),
            tariff_coins=random.randint(svc.base_coins_cost, svc.base_coins_cost + 300),
            admin_commission_coins=random.randint(10, 50),
            payment_method=random.choice(['coins', 'cod']),
            payment_received=random.choice([True, False]),
            completed_at=timezone.now() - timedelta(days=random.randint(0, 150)) if random.choice([True, False]) else None
        )

def create_reviews(bookings):
    for booking in bookings:
        # Only completed bookings get reviews
        if booking.status == 'completed':
            UserReview.objects.create(
                user=booking.user,
                worker=booking.worker,
                booking=booking,
                rating=random.randint(1, 5),
                comment=fake.sentence(nb_words=15),
                sentiment_score=random.randint(1, 5),
                created_at=booking.completed_at or timezone.now()
            )

def populate_data():
    print("Creating services...")
    services = create_services(20)
    print(f"Created {len(services)} services.")
    print("Creating users...")
    users = create_users(100)
    print(f"Created {len(users)} users.")
    print("Creating worker applications...")
    applications = create_worker_applications(users, services, 60)
    print(f"Created {len(applications)} worker applications.")
    print("Creating workers...")
    workers = create_workers(applications, users)
    print(f"Created {len(workers)} workers.")
    print("Assigning worker services...")
    create_worker_services(workers, services)
    print("Creating bookings...")
    create_bookings(users, workers, services, 300)
    print("Creating reviews for completed bookings...")
    bookings = Booking.objects.filter(status='completed')
    create_reviews(bookings)
    print("Data population complete.")

if __name__ == "__main__":
    populate_data()
