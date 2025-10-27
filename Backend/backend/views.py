import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from features.login import login as login_feature

@csrf_exempt
def login_view(request):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid JSON"}, status=400)

    return login_feature(data)