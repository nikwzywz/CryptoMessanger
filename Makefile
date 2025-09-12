# CryptoMessenger Makefile

# Компиляция
.PHONY: build
build:
	forge build

# Тестирование
.PHONY: test
test:
	forge test

.PHONY: test-verbose
test-verbose:
	forge test -vvv

.PHONY: test-gas
test-gas:
	forge test --gas-report

# Линтинг и форматирование
.PHONY: fmt
fmt:
	forge fmt

.PHONY: lint
lint:
	forge fmt --check

# Развертывание
.PHONY: deploy-base
deploy-base:
	@echo "Deploying to Base Mainnet..."
	@./deploy-base.sh
	@echo "Updating ABI in config.js..."
	@node pwa/scripts/update-abi.js

.PHONY: deploy-sepolia
deploy-sepolia:
	@echo "Deploying to Base Sepolia..."
	@source .env && forge script contracts/script/Deploy.s.sol --rpc-url baseSepolia --broadcast --verify --etherscan-api-key $$ETHERSCAN_API_KEY --chain 84532

.PHONY: deploy-local
deploy-local:
	@echo "Deploying to local network..."
	@source .env && forge script contracts/script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Установка зависимостей
.PHONY: install
install:
	forge install

# Очистка
.PHONY: clean
clean:
	forge clean

# Создание документации
.PHONY: doc
doc:
	forge doc --build

# Проверка покрытия
.PHONY: coverage
coverage:
	forge coverage

# Создание gas snapshot
.PHONY: snapshot
snapshot:
	forge snapshot

# Проверка конфигурации
.PHONY: config
config:
	forge config

# Обновление ABI
.PHONY: update-abi
update-abi:
	@echo "Updating ABI from Basescan..."
	@node pwa/scripts/update-abi.js

# Заполнение контракта тестовыми данными
.PHONY: populate-contract
populate-contract:
	@echo "Populating contract with test data..."
	@node pwa/scripts/populate-contract-test-data.js

# Помощь
.PHONY: help
help:
	@echo "Доступные команды:"
	@echo "  build          - Компиляция контрактов"
	@echo "  test           - Запуск тестов"
	@echo "  test-verbose   - Запуск тестов с подробным выводом"
	@echo "  test-gas       - Запуск тестов с отчетом по газу"
	@echo "  fmt            - Форматирование кода"
	@echo "  lint           - Проверка форматирования"
	@echo "  deploy-base    - Развертывание в Base mainnet"
	@echo "  deploy-sepolia - Развертывание в Base Sepolia"
	@echo "  deploy-local   - Развертывание в локальную сеть"
	@echo "  install        - Установка зависимостей"
	@echo "  clean          - Очистка артефактов"
	@echo "  doc            - Создание документации"
	@echo "  coverage       - Проверка покрытия тестами"
	@echo "  snapshot       - Создание gas snapshot"
	@echo "  config         - Показать конфигурацию"
	@echo "  update-abi     - Обновить ABI из Basescan"
	@echo "  populate-contract - Заполнить контракт тестовыми данными"
	@echo "  help           - Показать эту справку"
