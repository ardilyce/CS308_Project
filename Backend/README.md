# Backend Setup

- Run these commands on the terminal before developing:

python -m venv .venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

- Yeni feature’lar `features/` dizini altında oluşturulur.
- `views.py` yalnızca bu fonksiyonları çağırır; asıl iş mantığı `features/` altında tutulur.