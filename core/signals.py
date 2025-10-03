from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import UserReview

@receiver([post_save, post_delete], sender=UserReview)
def update_worker_avg_rating(sender, instance, **kwargs):
    """Keep worker's average rating and review count updated whenever reviews change"""
    if instance.worker:
        instance.worker.update_average_rating()
