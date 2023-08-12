.PHONY: transfer-local-files, release
#───────────────────────────────────────────────────────────────────────────────

transfer-local-files:
	workflow_id=$$(basename "$$PWD") && \
	prefs_location=$$(grep "5" "$$HOME/Library/Application Support/Alfred/prefs.json" | cut -d'"' -f4 | sed -e 's|\\/|/|g' -e "s|^~|$$HOME|") && \
	local_workflow="$$prefs_location/Alfred.alfredpreferences/workflows/$$workflow_id" && \
	rsync --archive --delete --exclude-from="$$PWD/.rsync-exclude" "$$local_workflow/" "$$PWD" ; \
	git status --short

release:
	zsh ./build-and-release.sh

ddgr: # update ddgr-dependency
	workflow_id=$$(basename "$$PWD") && \
	prefs_location=$$(grep "5" "$$HOME/Library/Application Support/Alfred/prefs.json" | cut -d'"' -f4 | sed -e 's|\\/|/|g' -e "s|^~|$$HOME|") && \
	local_workflow="$$prefs_location/Alfred.alfredpreferences/workflows/$$workflow_id" && \
	curl -L "https://raw.githubusercontent.com/kometenstaub/ddgr/main/ddgr" -o ./dependencies/ddgr.py && \
	chmod +x ./dependencies/ddgr.py && \
	cp -fv ./dependencies/ddgr.py "$$local_workflow/dependencies/ddgr.py"
