from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from features.search_bar import search as search_feature
from features.homepage import homepage as homepage_feature

@csrf_exempt
def search_view(request):
    if request.method != "GET":
        return JsonResponse({"ok": False, "error": "GET required"}, status=405)
    
    q = request.GET.get("q", "")
    return search_feature({"q": q})


@csrf_exempt
def homepage_view(request):
    if request.method != "GET":
        return JsonResponse({"ok": False, "error": "GET required"}, status=405)
    return homepage_feature({})
