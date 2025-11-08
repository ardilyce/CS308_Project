import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from features.login import login as login_feature
from features.signup import signup as signup_feature
from features.search_bar import search as search_feature

@csrf_exempt
def login_view(request):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid JSON"}, status=400)

    return login_feature(data)


@csrf_exempt
def signup_view(request):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({"ok": False, "error": "Invalid JSON"}, status=400)

    return signup_feature(data)

@csrf_exempt
def search_view(request):
    if request.method != "GET":
        return JsonResponse({"ok": False, "error": "GET required"}, status=405)
    
    q = request.GET.get("q", "")
    return search_feature({"q": q})
