from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import UserProfile

User = get_user_model()


class Command(BaseCommand):
    help = 'Create a support agent user with specified email and password'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='support_agent',
            help='Email address for the support agent (default: support_agent)',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='support123',
            help='Password for the support agent (default: support123)',
        )
        parser.add_argument(
            '--name',
            type=str,
            default='Support Agent',
            help='Full name for the support agent (default: Support Agent)',
        )

    def handle(self, *args, **options):
        email = options['email'].lower().strip()
        password = options['password']
        name = options['name']

        # Check if user already exists
        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write(
                self.style.WARNING(f'User with email "{email}" already exists.')
            )
            # Update existing user
            user = User.objects.get(email__iexact=email)
            user.set_password(password)
            user.first_name = name
            user.save()
            
            # Update or create profile with support_agent role
            profile, created = UserProfile.objects.get_or_create(user=user)
            profile.role = UserProfile.Role.SUPPORT_AGENT
            profile.save()
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully updated user "{email}" and created profile with support_agent role.'
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully updated user "{email}" and set role to support_agent.'
                    )
                )
        else:
            # Create new user
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                first_name=name,
            )
            
            # Update profile role (profile is auto-created by signal)
            profile = user.profile
            profile.role = UserProfile.Role.SUPPORT_AGENT
            profile.save()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created support agent user:\n'
                    f'  Email: {email}\n'
                    f'  Password: {password}\n'
                    f'  Name: {name}\n'
                    f'  Role: support_agent'
                )
            )

