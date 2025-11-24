OS := $(shell uname)

run:
ifeq ($(OS),Darwin)
	@echo "Running on macOS..."
	@osascript -e "tell application \"Terminal\" to do script \"cd '$(shell pwd)/Frontend' && npm run dev\""
	@osascript -e "tell application \"Terminal\" to do script \"cd '$(shell pwd)/Backend' && source '../.venv/bin/activate' && python3 manage.py runserver\""
else
	@echo "Running on Windows..."
	@start powershell -NoExit -Command "cd Frontend; npm run dev"
	@start powershell -NoExit -Command "cd Backend; . ../.venv/Scripts/activate; python manage.py runserver"
endif
