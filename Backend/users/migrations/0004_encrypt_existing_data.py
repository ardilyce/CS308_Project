# Data migration to encrypt existing plain-text sensitive data
# This should be run once after the schema migration to encrypt any pre-existing data

from django.db import migrations


def encrypt_existing_data(apps, schema_editor):
    """
    Encrypt any existing plain-text data in sensitive fields.
    This handles data that was stored before encryption was implemented.
    """
    # Import encryption functions
    from backend.encryption import encrypt_field, decrypt_field
    
    UserProfile = apps.get_model('users', 'UserProfile')
    
    for profile in UserProfile.objects.all():
        needs_save = False
        
        # Check and encrypt tax_id if it looks like plain text
        # (encrypted data starts with 'gAAAAA' for Fernet)
        if profile._tax_id_encrypted and not profile._tax_id_encrypted.startswith('gAAAAA'):
            # This is plain text, encrypt it
            profile._tax_id_encrypted = encrypt_field(profile._tax_id_encrypted)
            needs_save = True
        
        # Check and encrypt home_address if it looks like plain text
        if profile._home_address_encrypted and not profile._home_address_encrypted.startswith('gAAAAA'):
            profile._home_address_encrypted = encrypt_field(profile._home_address_encrypted)
            needs_save = True
        
        # Check and encrypt card_number if it looks like plain text
        if profile._card_number_encrypted and not profile._card_number_encrypted.startswith('gAAAAA'):
            profile._card_number_encrypted = encrypt_field(profile._card_number_encrypted)
            needs_save = True
        
        if needs_save:
            profile.save()


def decrypt_existing_data(apps, schema_editor):
    """
    Reverse migration: decrypt data back to plain text.
    WARNING: This removes encryption protection from sensitive data.
    """
    from backend.encryption import decrypt_field
    
    UserProfile = apps.get_model('users', 'UserProfile')
    
    for profile in UserProfile.objects.all():
        needs_save = False
        
        # Decrypt if it looks like encrypted data
        if profile._tax_id_encrypted and profile._tax_id_encrypted.startswith('gAAAAA'):
            profile._tax_id_encrypted = decrypt_field(profile._tax_id_encrypted)
            needs_save = True
        
        if profile._home_address_encrypted and profile._home_address_encrypted.startswith('gAAAAA'):
            profile._home_address_encrypted = decrypt_field(profile._home_address_encrypted)
            needs_save = True
        
        if profile._card_number_encrypted and profile._card_number_encrypted.startswith('gAAAAA'):
            profile._card_number_encrypted = decrypt_field(profile._card_number_encrypted)
            needs_save = True
        
        if needs_save:
            profile.save()


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_encrypt_sensitive_fields"),
    ]

    operations = [
        migrations.RunPython(
            encrypt_existing_data,
            decrypt_existing_data,
        ),
    ]

