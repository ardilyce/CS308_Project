# 🧩 Backend Setup Guide

## 🔧 Environment Setup

Run the following commands in your terminal **before starting development**:

```bash
python -m venv .venv
.env\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 🧱 Project Structure

- New features should be created under the `features/` directory.  
- The `views.py` file should **only** call these feature functions —  
  the main business logic must be implemented inside the `features/` folder.

---

- A test script should be developed when a new feature is created.
- Make sure that you develop tests under Backend/tests for new features.

## 💡 Notes

- Keep each feature modular and self-contained.  
- Avoid adding logic directly into `views.py`.  
- Update `requirements.txt` after installing new dependencies:

## JWT auth (SimpleJWT)

1. Install new deps after pulling: `pip install -r requirements.txt`
2. Apply migrations so the refresh-token blacklist tables exist: `python manage.py migrate`
3. Important env vars (optional overrides):
   - `JWT_SIGNING_KEY` (defaults to `SECRET_KEY`)
   - `ACCESS_TOKEN_MINUTES` (default `5`)
   - `REFRESH_TOKEN_DAYS` (default `7`)

### Endpoints
| Purpose | Method | Path |
| --- | --- | --- |
| Obtain access + refresh | POST | `/api/auth/token/` |
| Refresh access token | POST | `/api/auth/token/refresh/` |
| Verify JWT | POST | `/api/auth/token/verify/` |
| Signup + immediate tokens | POST | `/api/auth/signup/` |
| Current user profile | GET | `/api/auth/me/` |
| Logout (blacklist refresh) | POST | `/api/auth/logout/` |

`Authorization: Bearer <access>` header is required for protected routes (`/api/auth/me/`, logout, etc).

### Example flow
```bash
# 1) Signup (or use /api/auth/token/ if the user already exists)
curl -X POST http://localhost:8000/api/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Enes","email":"enes@example.com","password":"secret123"}'

# 2) Use the access token to call protected endpoints
curl http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# 3) Rotate tokens
curl -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<REFRESH_TOKEN>"}'

# 4) Logout (blacklists the refresh token)
curl -X POST http://localhost:8000/api/auth/logout/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<REFRESH_TOKEN>"}'
```
### Mutation Testing
- run these commands:
- cosmic-ray init cosmic-ray.toml session.json
- cosmic-ray exec session.json
- cr-report session.json

Run the server via: daphne -b 127.0.0.1 -p 8000 backend.asgi:application