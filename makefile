SOURCE_DIR := $(realpath $(dir $(realpath $(firstword $(MAKEFILE_LIST)))))

.PHONY: all lint test serve

all: dist/bundle.js

lint:
	npm run lint

serve: dist/bundle.js
	npm run serve

test: dist/bundle.js
	npm run test

dist/bundle.js: .linted $(wildcard $(SOURCE_DIR)/src/*) webpack.config.js package.json
	npm run build

.linted: $(wildcard $(SOURCE_DIR)/src/*)
	npx eslint --fix $?
	touch $@
