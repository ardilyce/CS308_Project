OSFLAG := $(OS)
UNAME_S := $(shell uname 2>/dev/null)

ifeq ($(OSFLAG),Windows_NT)
run:
	@echo "Running on Windows..."
	@powershell -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd Frontend; npm run dev'"
	@powershell -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd Backend; . ../.venv/Scripts/activate; python manage.py runserver'"
else ifeq ($(UNAME_S),Darwin)
run:
	@echo "Running on macOS..."
	@osascript -e "tell application \"Terminal\" to do script \"cd '$(shell pwd)/Frontend' && npm run dev\""
	@osascript -e "tell application \"Terminal\" to do script \"cd '$(shell pwd)/Backend' && source '../venv/bin/activate' && python3 manage.py runserver\""
else
run:
	@echo "Unsupported OS"
endif
