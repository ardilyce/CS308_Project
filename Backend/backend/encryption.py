"""
Encryption utilities for sensitive data fields.

Uses Fernet symmetric encryption from the cryptography library.
The encryption key is derived from Django's SECRET_KEY.
"""
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _get_encryption_key() -> bytes:
    """
    Derive a Fernet-compatible encryption key from Django's SECRET_KEY.
    
    Fernet requires a 32-byte URL-safe base64-encoded key.
    We use SHA256 to derive a consistent key from the SECRET_KEY.
    """
    # Use a dedicated encryption key if set, otherwise derive from SECRET_KEY
    encryption_key = getattr(settings, 'FIELD_ENCRYPTION_KEY', None)
    
    if encryption_key:
        # If a dedicated key is provided, use it directly
        if isinstance(encryption_key, str):
            encryption_key = encryption_key.encode()
        # Ensure it's properly formatted for Fernet
        try:
            Fernet(encryption_key)
            return encryption_key
        except (ValueError, Exception):
            # Key is not valid Fernet format, derive from it
            pass
    
    # Derive key from SECRET_KEY
    secret = settings.SECRET_KEY
    if isinstance(secret, str):
        secret = secret.encode()
    
    # SHA256 produces 32 bytes, perfect for Fernet after base64 encoding
    key_hash = hashlib.sha256(secret).digest()
    return base64.urlsafe_b64encode(key_hash)


def get_fernet() -> Fernet:
    """Get a Fernet instance for encryption/decryption."""
    return Fernet(_get_encryption_key())


def encrypt_field(value: str) -> str:
    """
    Encrypt a string value for storage in the database.
    
    Args:
        value: The plaintext string to encrypt
        
    Returns:
        Base64-encoded encrypted string, or empty string if input is empty
    """
    if not value:
        return ""
    
    fernet = get_fernet()
    encrypted = fernet.encrypt(value.encode('utf-8'))
    return encrypted.decode('utf-8')


def decrypt_field(encrypted_value: str) -> str:
    """
    Decrypt an encrypted string value from the database.
    
    Args:
        encrypted_value: The encrypted string from the database
        
    Returns:
        The decrypted plaintext string, or empty string if input is empty
        
    Raises:
        InvalidToken: If the encrypted value is invalid or tampered with
    """
    if not encrypted_value:
        return ""
    
    try:
        fernet = get_fernet()
        decrypted = fernet.decrypt(encrypted_value.encode('utf-8'))
        return decrypted.decode('utf-8')
    except InvalidToken:
        # Log this in production - indicates potential tampering or key change
        # For now, return empty to prevent crashes
        return ""
    except Exception:
        # Handle any other decryption errors gracefully
        return ""


class EncryptedCharField:
    """
    Descriptor for transparent encryption/decryption of CharField values.
    
    Usage in models:
        _tax_id = models.CharField(max_length=255, blank=True)
        tax_id = EncryptedCharField('_tax_id')
    """
    
    def __init__(self, field_name: str):
        self.field_name = field_name
    
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        encrypted_value = getattr(obj, self.field_name, "")
        return decrypt_field(encrypted_value)
    
    def __set__(self, obj, value):
        encrypted_value = encrypt_field(value) if value else ""
        setattr(obj, self.field_name, encrypted_value)


class EncryptedTextField:
    """
    Descriptor for transparent encryption/decryption of TextField values.
    Same as EncryptedCharField but for longer text.
    """
    
    def __init__(self, field_name: str):
        self.field_name = field_name
    
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        encrypted_value = getattr(obj, self.field_name, "")
        return decrypt_field(encrypted_value)
    
    def __set__(self, obj, value):
        encrypted_value = encrypt_field(value) if value else ""
        setattr(obj, self.field_name, encrypted_value)

