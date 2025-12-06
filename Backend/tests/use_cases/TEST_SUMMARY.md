# Test Suite Summary - E-Commerce Backend

This document provides a comprehensive summary of all test cases implemented in the Backend test suite.

---

## Overview

| Test File | Test Count | Coverage Area |
|-----------|-----------|---------------|
| `test_auth_features.py` | 8 tests | User authentication & authorization |
| `test_cart.py` | 27 tests | Cart operations & checkout |
| `test_homepage_feature.py` | 5 tests | Homepage content & caching |
| `test_orders.py` | 21 tests | Order lifecycle & delivery |
| `test_search_feature.py` | 3 tests | Product search & filtering |
| **Total** | **64 tests** | |

---

## 1. Authentication Features (`test_auth_features.py`)

### Use Cases Tested

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| AUTH-01 | `test_signup_view_creates_user_and_returns_tokens` | New user registration | User is created with normalized email, JWT tokens are returned |
| AUTH-02 | `test_signup_view_rejects_duplicate_email` | Duplicate email registration attempt | Returns 400 error with "Email already registered" message |
| AUTH-03 | `test_token_obtain_pair_view_returns_tokens_for_valid_user` | User login with valid credentials | Access and refresh JWT tokens are returned |
| AUTH-04 | `test_token_obtain_pair_view_rejects_invalid_credentials` | User login with wrong password | Returns 401 Unauthorized with error message |
| AUTH-05 | `test_current_user_view_requires_authentication` | Access user profile without token | Returns 401 Unauthorized |
| AUTH-06 | `test_current_user_view_returns_serialized_user_when_authenticated` | Access user profile with valid token | Returns user id, email, and name |
| AUTH-07 | `test_logout_view_requires_refresh_token` | Logout without providing refresh token | Returns 400 error |
| AUTH-08 | `test_logout_view_blacklists_refresh_token` | Proper logout with refresh token | Token is blacklisted, returns 205 Reset Content |

### Security Features Verified
- ✅ Email normalization (lowercase)
- ✅ Name trimming (whitespace removal)
- ✅ JWT token-based authentication
- ✅ Token blacklisting on logout
- ✅ Duplicate email prevention

---

## 2. Cart & Checkout Features (`test_cart.py`)

### 2.1 Anonymous Browsing Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| CART-01 | `test_unauthenticated_user_can_view_product_list` | Guest browses product catalog | Product list is accessible without login |
| CART-02 | `test_unauthenticated_user_can_view_product_detail` | Guest views product details | Product details (name, stock, price) visible |
| CART-03 | `test_unauthenticated_user_can_search_products` | Guest searches for products | Search returns matching products |
| CART-04 | `test_unauthenticated_user_can_filter_by_category` | Guest filters by category | Category filtering works for guests |
| CART-05 | `test_unauthenticated_user_cannot_access_cart` | Guest tries to access backend cart | Returns 401 Unauthorized |
| CART-06 | `test_unauthenticated_user_cannot_add_to_backend_cart` | Guest tries to add to backend cart | Returns 401 Unauthorized |

### 2.2 Cart Merge Tests (Guest → Authenticated)

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| CART-07 | `test_guest_cart_merged_with_empty_user_cart` | User logs in with guest cart items | Guest items transferred to user cart |
| CART-08 | `test_guest_cart_merged_with_existing_user_cart` | User with existing cart logs in | Quantities from both carts are summed |
| CART-09 | `test_cart_merge_caps_quantity_to_available_stock` | Merge when quantity > stock | Quantity capped to available stock with warning |
| CART-10 | `test_cart_merge_removes_out_of_stock_products` | Merge with out-of-stock items | Out-of-stock items removed with warning |
| CART-11 | `test_cart_merge_removes_non_existent_products` | Merge with deleted product IDs | Non-existent products removed with warning |
| CART-12 | `test_cart_merge_with_empty_guest_cart` | Login with empty guest cart | User cart unchanged |
| CART-13 | `test_cart_merge_requires_authentication` | Merge without authentication | Returns 401 Unauthorized |
| CART-14 | `test_cart_persists_after_merge` | Verify persistence after merge | Cart saved to database correctly |

### 2.3 Checkout Authentication Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| CART-15 | `test_unauthenticated_user_cannot_place_order` | Guest tries to checkout | Returns 401 Unauthorized |
| CART-16 | `test_authenticated_user_can_place_order` | Logged-in user places order | Order created with invoice |

### 2.4 Payment Processing Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| CART-17 | `test_payment_approved_for_normal_card` | Valid card number submitted | Payment approved, transaction ID generated |
| CART-18 | `test_payment_declined_for_test_card_ending_0000` | Declined test card used | Returns 400 with payment error |
| CART-19 | `test_order_not_created_on_payment_failure` | Payment fails | No order created in database |
| CART-20 | `test_payment_stores_last_four_digits` | Payment processed | Only last 4 digits stored |

### 2.5 Invoice Email Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| CART-21 | `test_invoice_created_on_successful_order` | Order placed successfully | Invoice record created |
| CART-22 | `test_invoice_returned_in_order_response` | Order creation response | Invoice details included in response |
| CART-23 | `test_invoice_email_sent_automatically` | Order completed | Email sent to customer email |
| CART-24 | `test_invoice_email_has_pdf_attachment` | Invoice email sent | PDF attachment present (valid PDF format) |
| CART-25 | `test_order_succeeds_even_if_email_fails` | Email server error | Order still created, email failure handled gracefully |
| CART-26 | `test_no_email_sent_if_user_has_no_email` | User without email | Order created, no email attempted |
| CART-27 | `test_invoice_contains_correct_order_details` | Invoice validation | Correct invoice number, total, date |

---

## 3. Homepage Features (`test_homepage_feature.py`)

### Use Cases Tested

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| HOME-01 | `test_homepage_builds_sections_from_models_and_caches_payload` | Homepage data generation | Returns featured categories (6), products (12), trending brands |
| HOME-02 | `test_homepage_limits_trending_brands_and_skips_blanks` | Trending brands generation | Max 10 unique brands, no empty strings |
| HOME-03 | `test_homepage_returns_cached_payload_immediately` | Homepage caching | Returns cached data without DB query |
| HOME-04 | `test_homepage_view_rejects_non_get_requests` | POST to homepage endpoint | Returns 405 Method Not Allowed |
| HOME-05 | `test_homepage_view_returns_feature_payload` | GET homepage endpoint | Returns homepage sections |

### Data Structures Verified
- Featured Categories: `[{id, name, slug}]` (max 6)
- Featured Products: `[{id, name, brand, price, stock, category}]` (max 12)
- Trending Brands: `[string]` (max 10, unique, non-empty)
- Cache timeout: 60 seconds

---

## 4. Order Features (`test_orders.py`)

### 4.1 Stock Management Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| ORD-01 | `test_product_stock_displayed_in_product_detail` | View product details | Stock quantity shown |
| ORD-02 | `test_product_stock_displayed_in_product_list` | View product listing | Stock shown in list |
| ORD-03 | `test_low_stock_product_display` | Product with low stock | Correct low stock quantity shown |
| ORD-04 | `test_out_of_stock_product_display` | Out-of-stock product | Shows 0 stock |

### 4.2 Order Creation & Stock Deduction Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| ORD-05 | `test_stock_decreased_after_order_creation` | Place order | Stock decreased by ordered quantity |
| ORD-06 | `test_stock_decreased_for_multiple_items` | Multi-product order | All product stocks decreased correctly |
| ORD-07 | `test_stock_does_not_go_negative` | Order > available stock | Stock set to 0 (no negative values) |

### 4.3 Delivery Processing Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| ORD-08 | `test_delivery_records_created_on_order` | Order placed | Delivery record created automatically |
| ORD-09 | `test_multiple_delivery_records_for_multiple_products` | Multi-product order | Separate delivery record per product |
| ORD-10 | `test_delivery_has_correct_price_information` | Delivery record validation | Correct total price calculation |

### 4.4 Order Status & History Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| ORD-11 | `test_order_starts_with_processing_status` | New order created | Status = PROCESSING, Payment = APPROVED |
| ORD-12 | `test_order_status_can_be_updated_to_shipped` | Order shipped | Status transitions to SHIPPED |
| ORD-13 | `test_order_status_can_be_updated_to_delivered` | Order delivered | Status transitions to DELIVERED |
| ORD-14 | `test_order_history_shows_all_user_orders` | View order history | All user orders displayed |
| ORD-15 | `test_order_history_shows_correct_status` | Order history status | Each order shows correct status |
| ORD-16 | `test_order_detail_shows_status` | View single order | Status included in response |
| ORD-17 | `test_order_history_only_shows_user_own_orders` | Order privacy | Users only see their own orders |

### 4.5 Order Lifecycle Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| ORD-18 | `test_complete_order_lifecycle` | Full order flow | PROCESSING → SHIPPED → DELIVERED |
| ORD-19 | `test_order_with_delivery_tracking` | Delivery completion | Delivery marked complete with timestamp |

### 4.6 Invoice Generation Tests

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| ORD-20 | `test_invoice_created_on_order` | Order placed | Invoice created (INV-{order_id}) |
| ORD-21 | `test_invoice_returned_in_order_detail` | View order detail | Invoice info included |

---

## 5. Search Features (`test_search_feature.py`)

### Use Cases Tested

| ID | Test Name | Use Case Description | Expected Behavior |
|----|-----------|---------------------|-------------------|
| SRCH-01 | `test_filters_metadata_is_always_available` | Any search request | Returns available categories, distributors, price range |
| SRCH-02 | `test_can_filter_by_category_and_price_without_query` | Category + price filter | Returns matching products only |
| SRCH-03 | `test_sorting_and_stock_filtering` | Sort by price + in-stock filter | Returns in-stock items sorted by price ascending |

### Filter Options Verified
- Category filtering
- Price range filtering (min_price, max_price)
- Stock availability filtering (in_stock)
- Sorting (price_asc)

---

## Test Quality Assessment

### ✅ Strengths
1. **Comprehensive Coverage**: All major features have dedicated test cases
2. **Edge Case Handling**: Tests cover error scenarios (invalid credentials, out-of-stock, payment failures)
3. **Fixture Reuse**: Well-organized pytest fixtures reduce code duplication
4. **Documentation**: Clear docstrings explain each test's purpose
5. **Authentication Testing**: Both authenticated and unauthenticated scenarios tested
6. **Data Validation**: Response structures and data integrity verified

### ⚠️ Areas for Improvement
1. **Password Validation**: No tests for password complexity requirements
2. **Password Reset**: Password reset flow not tested
3. **Admin Features**: Product manager/admin role permissions not tested
4. **Order Cancellation**: No tests for canceling orders
5. **Refund Processing**: Refund workflow not tested
6. **Rate Limiting**: API rate limiting not tested
7. **Pagination**: Limited pagination edge case testing

---

## Running Tests

```bash
# Run all tests
pytest Backend/tests/

# Run specific test file
pytest Backend/tests/test_auth_features.py

# Run with coverage
pytest Backend/tests/ --cov=Backend --cov-report=html

# Run specific test class
pytest Backend/tests/test_cart.py::TestCartMergeOnLogin

# Run with verbose output
pytest Backend/tests/ -v
```

---

## Test Configuration

Tests are configured with:
- `pytestmark = pytest.mark.django_db` - Database access enabled
- `APIRequestFactory` / `APIClient` - REST framework test utilities
- `force_authenticate` - Simulated authentication for protected endpoints
- Django test email backend - Captures sent emails for assertion

---

*Last Updated: December 2024*

