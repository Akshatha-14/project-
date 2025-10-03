from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

UserModel = get_user_model()

class EmailBackend(ModelBackend):
    def authenticate(self, request, email=None, password=None, **kwargs):
        print(f"Attempt login for email: '{email}'")
        try:
            user = UserModel.objects.get(email=email)
            print(f"User found: {user.email}, active: {user.is_active}")
        except UserModel.DoesNotExist:
            print("User not found")
            return None
        valid = user.check_password(password)
        print(f"Password valid: {valid}")
        if valid and self.user_can_authenticate(user):
            return user
        return None
