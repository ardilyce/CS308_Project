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
