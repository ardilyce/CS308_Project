# Data migration to encrypt existing plain-text delivery addresses
# This handles data stored before encryption was implemented

from django.db import migrations


def encrypt_existing_data(apps, schema_editor):
    """
    Encrypt any existing plain-text delivery addresses.
    """
    from backend.encryption import encrypt_field
    
    Order = apps.get_model('orders', 'Order')
    Delivery = apps.get_model('orders', 'Delivery')
    
    # Encrypt Order delivery addresses
    for order in Order.objects.all():
        if order._delivery_address_encrypted and not order._delivery_address_encrypted.startswith('gAAAAA'):
            order._delivery_address_encrypted = encrypt_field(order._delivery_address_encrypted)
            order.save(update_fields=['_delivery_address_encrypted'])
    
    # Encrypt Delivery delivery addresses
    for delivery in Delivery.objects.all():
        if delivery._delivery_address_encrypted and not delivery._delivery_address_encrypted.startswith('gAAAAA'):
            delivery._delivery_address_encrypted = encrypt_field(delivery._delivery_address_encrypted)
            delivery.save(update_fields=['_delivery_address_encrypted'])


def decrypt_existing_data(apps, schema_editor):
    """
    Reverse migration: decrypt addresses back to plain text.
    WARNING: This removes encryption protection.
    """
    from backend.encryption import decrypt_field
    
    Order = apps.get_model('orders', 'Order')
    Delivery = apps.get_model('orders', 'Delivery')
    
    for order in Order.objects.all():
        if order._delivery_address_encrypted and order._delivery_address_encrypted.startswith('gAAAAA'):
            order._delivery_address_encrypted = decrypt_field(order._delivery_address_encrypted)
            order.save(update_fields=['_delivery_address_encrypted'])
    
    for delivery in Delivery.objects.all():
        if delivery._delivery_address_encrypted and delivery._delivery_address_encrypted.startswith('gAAAAA'):
            delivery._delivery_address_encrypted = decrypt_field(delivery._delivery_address_encrypted)
            delivery.save(update_fields=['_delivery_address_encrypted'])


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0004_encrypt_delivery_address"),
    ]

    operations = [
        migrations.RunPython(
            encrypt_existing_data,
            decrypt_existing_data,
        ),
    ]

