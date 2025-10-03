from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static


urlpatterns =[
    path('signup/', views.user_signup, name='user_signup'),
    path('login/', views.api_user_login, name='api_user_login'),  # updated to api_user_login
    path('password-reset/', views.password_reset_request, name='password_reset_request'),
    path('password-reset-confirm/<uidb64>/<token>/', views.password_reset_confirm, name='password_reset_confirm'),
    path('social-login/google/', views.google_social_login, name='google_social_login'),
    path('user-profile/', views.user_profile, name="user-profile"),
    path('csrf/', views.csrf),
    path('recommend/<int:user_id>/', views.recommend_view, name='recommend'),
    path('bookings/', views.BookingCreateView.as_view(), name='booking-create'),
    path('user/bookings/', views.user_booking_history, name='user-bookings'),
    path('bookings/<int:booking_id>/cancel/',views.BookingCancelView.as_view(), name='booking-cancel'),
    path('worker/homepage/', views.worker_homepage, name='worker_homepage'),
    path('worker/job/accept/', views.accept_job, name='accept_job'),
    path('worker/job/complete/', views.complete_job, name='complete_job'),
    path('worker/job/tariff/', views.update_tariff, name='update_tariff'),
    path('worker/job/pay/', views.pay_job, name='pay_job'),
    path('worker/availability/', views.update_availability, name='update_availability'),
    path('worker/settings/', views.update_worker_settings, name='update_worker_settings'),
    path('payment/create_order/', views.create_razorpay_order, name='create_razorpay_order'),
    path('payment/verify/', views.verify_payment, name='verify_payment'),
    path('payment/cod/', views.set_cod_payment, name='set_cod_payment'),
    path('user/bookings/<int:booking_id>/', views.get_booking_detail, name='get_booking_detail'),
    path('worker/bookings/send_receipt/', views.send_receipt, name='send_receipt'),
    path('api/worker/job/<int:pk>/', views.job_detail, name='job_detail'),
    path('worker/confirm_cod_payment/', views.confirm_cod_payment, name='confirm_cod_payment'),
    path('rating/submit/', views.submit_or_update_rating, name='submit_or_update_rating'),
]+static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
