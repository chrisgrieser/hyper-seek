#!/usr/bin/env osascript -l JavaScript
ObjC.import("stdlib");
ObjC.import("Foundation");
const app = Application.currentApplication();
app.includeStandardAdditions = true;

//──────────────────────────────────────────────────────────────────────────────

/** @typedef {Object} ddgrResponse (of the fork)
 * @property {string} instant_answer
 * @property {ddgrResult[]} results
 * @property {string?} query (manually added by this workflow for the cache)
 */

/** @typedef {Object} ddgrResult
 * @property {string} title
 * @property {string} abstract
 * @property {string} url
 */

//──────────────────────────────────────────────────────────────────────────────

/** @param {string} path */
function readFile(path) {
	const data = $.NSFileManager.defaultManager.contentsAtPath(path);
	const str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
	return ObjC.unwrap(str);
}

/** @param {string} filepath @param {string} text */
function writeToFile(filepath, text) {
	const str = $.NSString.alloc.initWithUTF8String(text);
	str.writeToFileAtomicallyEncodingError(filepath, true, $.NSUTF8StringEncoding, null);
}

/** searches for any `.plist` more recently modified than the cache to determine
 * if the cache is outdated. Cannot use the workflow folder's mdate, since it
 * is too far up, and macOS does only changes the mdate of enclosing folders,
 * but not of their parents.
 * - Considers the possibility of the cache not existing
 * - Considers the user potentially having set a custom preferences location, by
 *   simply searching for the `.plist` files relative to this workflow's folder.
 * @param {string} cachePath
 */
function keywordCacheIsOutdated(cachePath) {
	const cacheObj = Application("System Events").aliases[cachePath];
	if (!cacheObj.exists()) return true;
	const cacheAgeMins = ((+new Date() - cacheObj.creationDate()) / 1000 / 60).toFixed(0);
	const workflowConfigChanges = app.doShellScript(
		`find .. -depth 2 -name "*.plist" -mtime -${cacheAgeMins}m`,
	);
	const webSearchConfigChanges = app.doShellScript(
		`find ../../preferences/features/websearch -name "prefs.plist" -mtime -${cacheAgeMins}m`,
	);
	return webSearchConfigChanges || workflowConfigChanges;
}

// get the Alfred keywords and write them to the cachePath
// PERF Saving keywords in a cache saves ~250ms for me (50+ workflows, 180+ keywords)
/** @param {string} cachePath */
function refreshKeywordCache(cachePath) {
	console.log("Refreshing keyword cache…");
	const timelogStart = +new Date();

	const workflowKeywords = app
		// $alfred_workflow_uid is identical with this workflow's foldername, which
		// is excluded from the results, since this workflows keywords do not need
		// to be removed
		.doShellScript(
			'grep -A1 "<key>keyword" ../**/info.plist | grep "<string>" | grep -v "$alfred_workflow_uid" || true',
		)
		.split("\r")
		.reduce((keywords, line) => {
			const value = line.split(">")[1].split("<")[0];

			// DOCS ALFRED KEYWORDS https://www.alfredapp.com/help/workflows/advanced/keywords/
			// CASE 1: `{var:alfred_var}` -> configurable keywords
			if (value.startsWith("{var:")) {
				const varName = value.split("{var:")[1].split("}")[0];
				const workflowPath = line.split("/info.plist")[0];
				// CASE 1a: user-set keywords
				// (wrapped in try, since `plutil` will fail, as the value isn't saved in prefs.plist)
				try {
					// `..` is already the Alfred preferences directory, so no need to `cd` there
					const userKeyword = app.doShellScript(
						`plutil -extract "${varName}" raw -o - "${workflowPath}/prefs.plist"`,
					);
					keywords.push(userKeyword.toLowerCase()); // in case user enters non-lowercase value
				} catch (_error) {
					// CASE 1b: keywords where user kept the default value
					try {
						const workflowConfig = JSON.parse(
							app.doShellScript(
								`plutil -extract "userconfigurationconfig" json -o - "${workflowPath}/info.plist"`,
							),
						);
						const defaultValue = workflowConfig.find(
							(/** @type {{ variable: string; }} */ option) => option.variable === varName,
						).config.default;
						console.log("🪓 defaultValue:", defaultValue);
						keywords.push(defaultValue);
					} catch (_error) {}
				}
			}
			// CASE 2: `||` -> multiple keyword alternatives
			else if (value.includes("||")) {
				const multiKeyword = value.split("||");
				keywords.push(...multiKeyword);
			}
			// CASE 3: regular keyword
			keywords.push(value);

			return keywords;
		}, []);

	// CASE 5: Pre-installed Searches
	const preinstalledSearches = app.doShellScript(
		"grep --files-without-match 'disabled' ../../preferences/features/websearch/**/prefs.plist | " +
			"xargs -I {} grep -A1 '<key>keyword' '{}' | grep '<string>' || true",
	);
	// check for the possibility of user having all searches disabled
	const preinstallKeywords = [];
	if (preinstalledSearches) {
		for (const line of preinstalledSearches.split("\r")) {
			const searchKeyword = line.split(">")[1].split("<")[0];
			preinstallKeywords.push(searchKeyword);
		}
	}

	// CASE 6: User Searches
	const userSearches = JSON.parse(
		app.doShellScript("plutil -convert json ../../preferences/features/websearch/prefs.plist -o - || true") ||
			"{}",
	).customSites;
	const userSearchKeywords = [];
	if (userSearches) {
		for (const uuid in Object.keys(userSearches)) {
			const searchObj = userSearches[uuid];
			if (searchObj?.enabled) userSearchKeywords.push(searchObj.keyword);
		}
	}

	// CASE 7: Keywords from this workflow
	// (not covered by earlier cases, since the workflow folder is excluded to
	// prevent the addition of the pseudo-keywords "a, b, c, …" in the list of
	// ignored keywords.)
	const thisWorkflowKeywords = app
		.doShellScript('grep -A1 "<key>keyword" ./info.plist | grep "<string>" || true')
		.split("\r")
		.reduce((acc, line) => {
			const value = line.split(">")[1].split("<")[0];
			if (value.startsWith(":") || value.startsWith("a||b")) return acc;
			acc.push(value);
			return acc;
		}, []);

	// FILTER IRRELEVANT KEYWORDS
	// - only the first word of a keyword matters
	// - only keywords with letter as first char matter
	// - unique keywords
	const allKeywords = [
		...workflowKeywords,
		...thisWorkflowKeywords,
		...preinstallKeywords,
		...userSearchKeywords,
	];
	const relevantKeywords = allKeywords.reduce((acc, keyword) => {
		const firstWord = keyword.split(" ")[0];
		if (firstWord.match(/^[a-z]/)) acc.push(firstWord);
		return acc;
	}, []);
	const uniqueKeywords = [...new Set(relevantKeywords)];

	// WRITING & LOGGING
	writeToFile(cachePath, JSON.stringify(uniqueKeywords));
	const durationTotalSecs = (+new Date() - timelogStart) / 1000;
	console.log(`Rebuilt keyword cache (${uniqueKeywords.length} keywords) in ${durationTotalSecs}s`);
}

const fileExists = (/** @type {string} */ filePath) => Application("Finder").exists(Path(filePath));

/** @param {string} topDomain where to get the favicon from */
function getFavicon(topDomain) {
	const durationLogStart = +new Date();

	let targetFile = `${$.getenv("alfred_workflow_cache")}/${topDomain}.ico`;
	const useFaviconSetting = $.getenv("use_favicons") === "1";

	if (!fileExists(targetFile)) {
		if (useFaviconSetting) {
			// Normally, `curl` does exit 0 even when the website reports 404.
			// With `curl --fail`, it will exit non-zero instead. However,
			// errors make `doShellScript` fail, so we need to use `try/catch`
			try {
				// PERF use favicon instead of touchicon (also more often available)
				// const imageUrl = `https://${topDomain}/apple-touch-icon.png`;
				const imageUrl = `https://${topDomain}/favicon.ico`;
				app.doShellScript(`curl --location --fail "${imageUrl}" --output "${targetFile}"`);
			} catch (_error) {
				targetFile = ""; // = not found -> use default icon
			}
		} else {
			targetFile = "";
		}
	}

	const durationMs = +new Date() - durationLogStart;
	return { iconPath: targetFile, faviconMs: durationMs };
}

function ensureCacheFolder() {
	const finder = Application("Finder");
	const cacheDir = $.getenv("alfred_workflow_cache");
	if (!finder.exists(Path(cacheDir))) {
		console.log("Cache Dir does not exist and is created.");
		const cacheDirBasename = $.getenv("alfred_workflow_bundleid");
		const cacheDirParent = cacheDir.slice(0, -cacheDirBasename.length);
		finder.make({
			new: "folder",
			at: Path(cacheDirParent),
			withProperties: { name: cacheDirBasename },
		});
	}
}

/**
 * @param {string} bufferPath
 * @param {string} instantAnswer
 */
function writeInstantAnswer(bufferPath, instantAnswer) {
	let infoText, source;
	try {
		[, infoText, source] = instantAnswer.match(/(.*)\s+More at (.*?)$/);
	} catch (_error) {
		infoText = instantAnswer;
	}
	const answerAsHtml = `
		<style>
		:root { font-size: 2em }
		cite { margin-left: 70% }
		blockquote p {
			padding: 1em;
			background: #eee;
			border-radius: 5px;
		}
		</style>
		<blockquote>
		<p>${infoText}</p>
		<cite>– ${source}</cite>
		</blockquote>
	`;
	writeToFile(bufferPath, answerAsHtml);
}

//──────────────────────────────────────────────────────────────────────────────
//──────────────────────────────────────────────────────────────────────────────

/** @type {AlfredRun} */
// biome-ignore lint/correctness/noUnusedVariables: Alfred run
// biome-ignore lint/nursery/noExcessiveComplexity: <explanation>
function run(argv) {
	const timelogStart = +new Date();
	let favIconTotalMs = 0;

	//───────────────────────────────────────────────────────────────────────────
	// CONFIG
	let resultsToFetch = parseInt($.getenv("inline_results_to_fetch")) || 5;
	if (resultsToFetch < 1) resultsToFetch = 1;
	else if (resultsToFetch > 25) resultsToFetch = 25; // maximum supported by `ddgr`

	let minQueryLength = parseInt($.getenv("minimum_query_length")) || 3;
	if (minQueryLength < 0) minQueryLength = 0;
	else if (minQueryLength > 10) minQueryLength = 10; // prevent accidental high values

	const includeUnsafe = $.getenv("include_unsafe") === "1" ? "--unsafe" : "";
	const ignoreAlfredKeywordsEnabled = $.getenv("ignore_alfred_keywords") === "1";

	// https://duckduckgo.com/duckduckgo-help-pages/settings/params/
	const searchRegion = $.getenv("region") === "none" ? "" : "--reg=" + $.getenv("region");

	//───────────────────────────────────────────────────────────────────────────

	/** @type{"fallback"|"default"} */
	const mode = $.NSProcessInfo.processInfo.environment.objectForKey("mode").js || "default";

	// HACK script filter is triggered with any letter of the roman alphabet, and
	// then prepended here, to trigger this workflow with any search term
	const scriptFilterKeyword =
		$.NSProcessInfo.processInfo.environment.objectForKey("alfred_workflow_keyword").js || "";
	const query = (scriptFilterKeyword + argv[0]).trim();
	ensureCacheFolder();

	// GUARD CLAUSE 1: query is URL or too short
	if (query.match(/^\w+:/) && mode !== "fallback") {
		console.log("Ignored (URL)");
		return;
	} else if (query.length < minQueryLength && mode !== "fallback") {
		console.log("Ignored (Min Query Length)");
		return;
	}

	// GUARD CLAUSE 2: extra ignore keywords
	const ignoreExtraWordsStr = $.getenv("ignore_extra_words");
	if (ignoreExtraWordsStr !== "" && mode !== "fallback") {
		const ignoreExtraWords = ignoreExtraWordsStr.split(/ ?, ?/);
		const queryFirstWord = query.split(" ")[0];
		if (ignoreExtraWords.includes(queryFirstWord)) {
			console.log("Ignored (extra ignore word)");
			return;
		}
	}

	// GUARD CLAUSE 3: first word of query is Alfred keyword
	// (guard clause is ignored when doing fallback search
	// since in that case we know we do not need to ignore anything.)
	if (ignoreAlfredKeywordsEnabled && mode !== "fallback") {
		const keywordCachePath = $.getenv("alfred_workflow_cache") + "/alfred_keywords.json";
		if (keywordCacheIsOutdated(keywordCachePath)) refreshKeywordCache(keywordCachePath);
		const alfredKeywords = JSON.parse(readFile(keywordCachePath));
		const queryFirstWord = query.split(" ")[0];
		if (alfredKeywords.includes(queryFirstWord)) {
			console.log(`Ignored (Alfred keyword: ${queryFirstWord})`);
			return;
		}
	}

	// GUARD CLAUSE 4: use old results
	// -> get values from previous run
	const oldQuery = $.NSProcessInfo.processInfo.environment.objectForKey("oldQuery").js;
	const oldResults = $.NSProcessInfo.processInfo.environment.objectForKey("oldResults").js || "[]";

	const querySearchUrl = $.getenv("search_site") + encodeURIComponent(query).replaceAll("'", "%27");
	/** @type AlfredItem */
	const searchForQuery = {
		title: `"${query}"`,
		uid: query,
		arg: querySearchUrl,
	};

	// PERF & HACK If the user is typing, return early to guarantee the top entry
	// is the currently typed query. If we waited for `ddgr`, a fast typer would
	// search for an incomplete query.
	const userIsTyping = query !== oldQuery;
	if (userIsTyping) {
		searchForQuery.subtitle = "Loading Inline Results…";
		return JSON.stringify({
			rerun: 0.1,
			skipknowledge: true,
			variables: { oldResults: oldResults, oldQuery: query },
			items: [searchForQuery].concat(JSON.parse(oldResults)),
		});
	}

	//───────────────────────────────────────────────────────────────────────────
	// MAIN: request NEW results

	// PERF cache `ddgr` response so that re-opening Alfred does not re-fetch results
	const responseCachePath = $.getenv("alfred_workflow_cache") + "/reponseCache.json";
	const responseCache = JSON.parse(readFile(responseCachePath) || "{}");
	/** @type{ddgrResponse} */
	let response;

	if (responseCache.query === query) {
		response = responseCache;
	} else {
		// NOTE using a fork of ddgr which includes the instant_answer when using `--json`
		// https://github.com/kometenstaub
		// PERF the number of results fetched has basically no effect on the speed
		// (less than 40ms difference between 1 and 25 results), so there is no use
		// in restricting the number of results for performance. (Except for 25 being
		// ddgr's maximum)
		const escapedQuery = query.replaceAll('"', '\\"');
		const ddgr = "python3 ./dependencies/ddgr.py";
		const ddgrCmd = `${ddgr} --noua --json ${includeUnsafe} --num=${resultsToFetch} ${searchRegion} "${escapedQuery}"`;
		response = JSON.parse(app.doShellScript(ddgrCmd));
		response.query = query;
		writeToFile(responseCachePath, JSON.stringify(response));
	}

	// RESULTS
	/** @type AlfredItem[] */
	const newResults = response.results.map((item) => {
		const topDomain = item.url.split("/")[2];

		let { iconPath, faviconMs } = getFavicon(topDomain);
		favIconTotalMs += faviconMs;
		if (!iconPath) iconPath = "icons/fallback_for_no_favicon.png";

		return {
			title: item.title,
			subtitle: topDomain,
			uid: item.url,
			arg: item.url,
			icon: { path: iconPath },
			mods: {
				shift: { subtitle: item.abstract },
				alt: { subtitle: `⌥: Copy  ➙  ${item.url}` }, // also makes holding alt show the full URL
			},
		};
	});

	// INSTANT ANSWER: searchForQuery
	if (response.instant_answer) {
		searchForQuery.subtitle = "ℹ️ " + response.instant_answer;

		// buffer instant answer for quicklook
		const instantAnswerBuffer = $.getenv("alfred_workflow_cache") + "/instantAnswerBuffer.html";
		writeInstantAnswer(instantAnswerBuffer, response.instant_answer);
		searchForQuery.quicklookurl = instantAnswerBuffer;
	}

	//───────────────────────────────────────────────────────────────────────────

	// Pass to Alfred
	const alfredInput = JSON.stringify({
		variables: { oldResults: JSON.stringify(newResults), oldQuery: query },
		items: [searchForQuery].concat(newResults),
	});

	// LOGGING
	const durationTotalSecs = (+new Date() - timelogStart) / 1000;
	let log;
	let time = `${durationTotalSecs}s`;
	const useFaviconSetting = $.getenv("use_favicons") === "1";
	if (useFaviconSetting) time += `, favicons: ${favIconTotalMs / 1000}s`;
	if (mode === "default") {
		log = `Total: ${time}, "${query}"`;
	} else {
		log = `Total: ${time}, "${query}" (${mode})`;
	}

	console.log(log);
	return alfredInput;
}
