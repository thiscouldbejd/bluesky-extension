const MAX_REQUESTS = 4;
const DELAY = ms => new Promise(resolve => setTimeout(resolve, ms));
const RANDOM = (lower, higher) => Math.random() * (higher - lower) + lower;
const SPIN = {
	lines: 15,
	length: 28,
	width: 14,
	radius: 42,
	scale: 1,
	corners: 0.6,
	color: "#000",
	opacity: 0.4,
	rotate: 0,
	direction: 1,
	speed: 1,
	trail: 50,
	fps: 20,
	zIndex: 2e9,
	className: "spinner",
	top: "50%",
	left: "50%",
	shadow: false,
	hwaccel: true,
	position: "absolute"
}
var REQUESTS = 0;

var Workbook = function() {
	if (!(this instanceof Workbook)) return new Workbook();
	this.SheetNames = [];
	this.Sheets = {};
};

var Formulas = function(sheet) {

	// -- Deal with Formulas -- //
	for (var cell in sheet) {

		if (sheet[cell] && sheet[cell].t && sheet[cell].t == "s" &&
			sheet[cell].v && sheet[cell].v.indexOf("=") === 0) {

			sheet[cell].f = sheet[cell].v.substr(1);
			delete sheet[cell].v;

		}

	}

};

var inject_Script = function(url) {

	return new Promise((resolve, reject) => {

		var head = document.head || document.getElementsByTagName("head")[0];
		var script = document.createElement("script");
		script.src = url;
		script.type = "text\/javascript";
		script.onerror = function(e) {
			reject(e);
		};
		script.onload = function() {
			resolve(true);
		};
		head.appendChild(script);

	});

};

var silent_Fetch = function(url, fetch_mode, credentials, cache, redirect) {

	return new Promise((resolve, reject) => {

		var request = new Request(url, {
			mode: fetch_mode ? fetch_mode : "same-origin",
			credentials: credentials ? credentials : "same-origin",
			cache: cache ? cache : "no-store",
			redirect: redirect ? redirect : "manual"
		});

		return fetch(request).then(function(response) {
			if (response.status >= 400) {
				throw new Error("40x: Request for " + url.href + " failed with status " + response.statusText);
			} else if (response.status >= 500) {
				throw new Error("50x: Request for " + url.href + " failed with status " + response.statusText);
			}
			try {
				resolve(response.text());
			} catch (e) {
				reject(e);
			}

		}).catch(function(e) {
			if (!fetch_mode) {
				console.error("Failed to fetch (trying no-cors) " + fetch_url.url + ":", e);
				return silent_Fetch(url, "no-cors", credentials, cache, redirect);
			} else {
				console.error("Failed to fetch " + fetch_url.url + ":", e);
				reject(e);
			}

		});

	});

};

var outputAndSave = function(book, type, filename) {

	var _s2ab = function(s) {
		var buf;
		if (typeof ArrayBuffer !== "undefined") {
			buf = new ArrayBuffer(s.length);
			var view = new Uint8Array(buf);
			for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
			return buf;
		} else {
			buf = new Array(s.length);
			for (var j = 0; j != s.length; ++j) buf[j] = s.charCodeAt(j) & 0xFF;
			return buf;
		}
	};

	return new Promise((resolve, reject) => {

		var wbout = XLSX.write(book, {
			bookType: type,
			bookSST: true,
			type: "binary"
		});
		try {
			saveAs(new Blob([_s2ab(wbout)], {
				type: "application/octet-stream"
			}), filename);
			resolve();
		} catch (e) {
			ಠ_ಠ.Flags.error("Google Sheet Export", e);
			reject();
		}
	});

};

var complete_Spreadsheet = function(name, finish) {

	return function(rows) {
		// -- Export -- //
		var _exportBook = new Workbook();

		// -- Add Values to Output -- //
		_exportBook.SheetNames.push("DATA");
		_exportBook.Sheets.DATA = XLSX.utils.aoa_to_sheet(rows);

		Formulas(_exportBook.Sheets.DATA);

		// -- Save Output -- //
		outputAndSave(_exportBook, "xlsx", name).then(() => {
			if (finish) finish();
		});
	};

};

var busy = function(spinner_Options, spinner_Target, status_Target, status_Style) {

	var _status = $("<span />", {
		style: status_Style ? status_Style : ""
	}).insertBefore(status_Target);
	return {
		finish: (function(spinner, status, target) {
			target.append(spinner.spin().el)
			return function() {
				status.text("").remove();
				spinner.stop();
			}
		})(new Spinner(spinner_Options), _status, spinner_Target),
		progress: (function(status) {
			return function(message) {
				status.text(message);
			}
		})(_status)
	}

}

var get_Evidence = function(container) {

	var _rows = [],
		_dimensions = container.find("#content_main .evidence-container.dimension, #content .evidence-container.dimension"),
		_max = 0,
		_count = 0,
		_comment_Count = 0;

	for (var i = 0; i < _dimensions.length; i++) {
		var _dimension = $(_dimensions[i]),
			_children = _dimension.children(),
			_title = _dimension.children("h2").text(),
			_subTitle;
		for (var j = 0; j < _children.length; j++) {
			var _child = _children[j];
			if (_child.nodeName.toLowerCase() == "h3") {
				_subTitle = _child.innerText;
				_max += 1;
			} else if (_child.nodeName.toLowerCase() == "div" && _child.classList.contains("evidence-set")) {

				// -- Handle Comments -- //
				var _conversation = $(_child).find(".evidence-comments > h4 + ul.conversation"),
					_comments = [];
				if (_conversation.length > 0) $(_conversation).find("li .message").each(function(i, message) {
					message = $(message);
					var _user = "",
						_date = "";
					var _details = message.find("small em").text();
					if (_details && _details.split(", ").length == 2) {
						_date = _details.split(", ")[0].trim();
						_user = _details.split(", ")[1].trim();
					} else if (_details) {
						_user = _details;
					}
					_comments.push(_user);
					_comments.push(_date);
					var _text = message.children("p").text();
					if (_details) _text = _text.substr(0, _text.length - _details.length);
					_comments.push(_text.trim());
					_comment_Count += 1;
				});

				// -- Handle Evidence -- //
				var _evidence = $(_child).find(".evidence-attachments > h5 + ul");
				if (_evidence.length > 0) _count += 1;
				for (var k = 0; k < _evidence.length; k++) {
					var _list = $(_evidence[k]),
						_type = _list.prev("h5").text();
					if (_type && _type.substring(_type.length - 1, 1) == "s") _type = _type.substring(0, _type.length - 1);
					_list.find("li a").each(function(i, link) {
						var _url = link.getAttribute("href");
						var _name = link.innerText;
						if (_name.indexOf(" Uploaded: ") >= 0) {
							_name = _name.split(" Uploaded: ");
							_rows.push({
								dimension: _title,
								details: _subTitle,
								name: _name[0],
								type: _type,
								link: _url,
								date: _name[1],
								comments: _comments
							});
						} else {
							_rows.push({
								dimension: _title,
								details: _subTitle,
								name: _name,
								type: _type,
								link: _url,
								comments: _comments
							});
						}
					});
				}
			}
		}
	}

	return {
		max: _max,
		count: _count,
		rows: _rows,
		comments: _comment_Count
	};

};

var export_Observations = function(title, table, finish, progress) {

	if (table) {

		table = $(table);
		var _header_Row = [],
			_headers = table.find("thead:first-child th");
		var _focus_Index = false,
			_notes_Index = false,
			_evidence_Index = false,
			_links_Index = false,
			_objective_Index = false;
		for (var i = 0; i < _headers.length; i++) {
			var _header = _headers[i].innerText;
			if (_header == "Notes Made") {
				_notes_Index = i;
			} else if (_header == "Focus") {
				_focus_Index = i;
			} else if (_header == "Evidence documents attached?") {
				_evidence_Index = i;
			} else if (_header == "Evidence links attached?") {
				_links_Index = i;
			} else if (_header == "Objective evidence attached?") {
				_objective_Index = i;
			}
			_header_Row.push(_header);
		}

		_header_Row = _header_Row.concat(["Evidence Document Count", "Evidence Link Count", "Comments"]);

		var _values = [_header_Row],
			_rows = table.find("tbody tr"),
			_total = _rows.length + _values.length;

		var _complete = function() {

			var _safeName = {
				"\\": "",
				"/": "",
				"?": "",
				"*": "",
				"[": "",
				"]": "",
				"_": ""
			};

			complete_Spreadsheet(RegExp.replaceChars(title, _safeName).trim() + ".xlsx", finish)(_values);

		}

		for (i = 0; i < _rows.length; i++) {

			// Parse Row
			var _cells = $(_rows[i]).find("td");
			var _focus = _cells[_focus_Index].innerText;
			var _notes = _cells[_notes_Index].innerText;
			var _evidence = _cells[_evidence_Index].innerText;
			var _links = _cells[_links_Index].innerText;
			var _objective = _cells[_objective_Index].innerText;
			var _url = false;

			var _row = [];
			for (var j = 0; j < _cells.length; j++) {

				if (j == _focus_Index) {
					var _cell = $(_cells[j]);
					var _link = _cell.find("a")[0];
					if (_link) {
						_url = _link.getAttribute("href");
						_row.push('=HYPERLINK("' + (_url.indexOf("/") === 0 ? (location.protocol + "//" + location.hostname) : "") +
							_url + '","' + _link.innerText + '")');
					} else {
						_row.push(_cells[j].innerText);
					}
				} else {
					_row.push(_cells[j].innerText);
				}

			}

			if (_url && (_notes == "Yes" || _evidence == "Yes" || _links == "Yes")) {

				// Closure to preserve output ordering
				(function(index, row, url) {

					// Add the row to the relevant part of the output, and complete if we are ready!
					var _add = function() {
						if (_values.length == index) {
							_values.push(row);
						} else {
							_values.splice(index, 0, row);
						}
						if (progress) progress(Math.round((_values.length / _total) * 100) + "% Complete");
						if (_values.length == _total) _complete();
					};

					// Parse HTML response from Fetch
					var _parse = function(html) {
						REQUESTS -= 1;

						var _html = $(html);

						// Document Evidence Count
						var _documents = _html.find(".container h3:contains('Documents') + ul")[0];
						if (_documents) {
							row.push($(_documents).find("li").length);
						} else {
							row.push("");
						}

						// Link Evidence Count
						var _links = _html.find(".container h2:contains('Links') + ul")[0];
						if (_links) {
							row.push($(_links).find("li").length);
						} else {
							row.push("");
						}

						// Comments
						var _comments = _html.find(".notes ul li:not(.reply-form)");
						if (_comments.length > 0) {
							for (var k = 0; k < _comments.length; k++) {
								var _comment = $(_comments[k]),
									_details = _comment.find(".message > p").text(),
									_author = _comment.find(".byline > p").text(),
									__comment = [];
								if (_author) {
									__comment = _author.split(", ");
									var _total = __comment.length;
									for (var m = 0; m < _total; m++) {
										if (__comment[m]) {
											__comment[m] = __comment[m].trim();
										} else {
											__comment.splice(m, 1);
											m -= 1;
											_total -= 1;
										}
									}
									while (__comment.length < 2) __comment.push("");
								} else {
									__comment = ["", ""];
								}
								__comment.push(_details.trim() || "")
								row = row.concat(__comment);
							}
						}

						_add();
					};

					// Handle Fetch Error
					var _error = function(e) {
						REQUESTS -= 1;
						console.log("Failed to fetch " + url, e);
						_add();
					};

					// Restrict Simultaneous Fetch Requests by delaying
					var _tries = 0,
						_max_Tries = 10;
					var _try = function() {
						_tries += 1;
						if (_tries < _max_Tries) {
							if (REQUESTS < MAX_REQUESTS) {
								REQUESTS += 1;
								silent_Fetch(url).then(_parse).catch(_error);
							} else {
								DELAY(2000).then(() => _try())
							}
						} else {
							console.error("Reached Maximum Re-Tries");
							_add();
						}

					};
					_try();

				})(_values.length, _row, _url)

			} else {

				_values.push(_row);
				if (_values.length == _total) _complete();

			}

		}

	}

};

var export_Reviews = function(action, container, target, full) {

	return new Promise((resolve, reject) => {

		try {

			var _return = [],
				_groupings = container.find(target + " > h2"),
				_total = container.find(target + " > table tbody tr").length;

			if (_groupings.length > 0 && _total > 0) {

				for (var i = 0; i < _groupings.length; i++) {

					var _grouping = $(_groupings[i]);
					var _group = _grouping.text().trim();
					var _tables = _grouping.nextUntil("h2, div.new_pagination");

					for (var j = 0; j < _tables.length; j++) {

						var _entries = _tables.find("tbody tr");

						for (var k = 0; k < _entries.length; k++) {

							var _review = action(_group, $(_entries[k]));

							var _complete = function(review) {
								_return.push(review);
								if (_return.length == _total) resolve(_return); // Resolve|Complete when we're done
							};

							if (full) {

								// -- Not Yet Implemented -- //
								if (_review) console.log(_review.url);
								if (_review) console.log(_review.evidence_url);

							} else {

								_complete(_review ? _review.data : []);

							}

						}

					}

				}

			} else {

				resolve();

			}

		} catch (e) {

			reject(e);

		}

	});

}

var download_Journal_Entry = function(journal, url, complete) {

	if (url) {

		silent_Fetch(url).then(html => {

			// == PARSE JOURNAL ENTRY == //
			var _details = $(html),
				_content = _details.find("#content_main article.journal-view-entry > p").text();
			journal.push(_content ? _content : "");

			var _comments = _details.find("#comments-box ul.comments li.comment, #comments ul.comments li.comment");

			for (var c = 0; c < _comments.length; c++) {

				var _comment = $(_comments[c]);
				var _date = _comment.find(".comment-block p.timestamp span.time").text(), 
						_username = _comment.find(".comment-block p.timestamp span.username").text(),
						_text = _comment.find(".comment-block > p:not(.timestamp)").text();

				journal.push(_date ? _date : "");
				journal.push(_username ? _username : "");
				journal.push(_text ? _text : "");

			}

			complete(journal);

		}).catch((e) => {
			console.log("Failed to fetch " + url, e);
			complete(journal);
		});

	} else {
		complete(journal);
	}

};

var export_Journals = function(action, container, target, full) {

	return new Promise((resolve, reject) => {

		try {

			var _return = [],
				_groupings = container.find(target + " > h2"),
				_total = container.find(target + " > article.journal-entry").length;

			if (_groupings.length > 0 && _total > 0) {

				for (var i = 0; i < _groupings.length; i++) {

					var _grouping = $(_groupings[i]);
					var _group = _grouping.text().trim();
					var _entries = _grouping.nextUntil("h2, div.new_pagination");

					for (var j = 0; j < _entries.length; j++) {

						var _journal = action(_group, $(_entries[j]));

						var _complete = function(journal) {
							_return.push(journal);
							if (_return.length == _total) resolve(_return); // Resolve|Complete when we're done
						};

						if (full) {

							download_Journal_Entry(_journal.data, _journal.url, _complete);

						} else {

							_complete(_journal.data);

						}

					}

				}

			} else {

				resolve();

			}

		} catch (e) {

			reject(e);

		}

	});

}

var parse_Reviews = function(group, entry) {

	var _cells = entry.children("td"), _profession = _cells[0].innerText;
	var _link = $(_cells[1]).find("a")[0],
		_url = _link.getAttribute("href"),
		_review = '=HYPERLINK("' + (_url.indexOf("/") === 0 ? (location.protocol + "//" + location.hostname) : "") +
		_url + '","' + _link.innerText + '")';
	var _version = _cells[2].innerText, _started = _cells[3].innerText, _responses = _cells[4].innerText;
	var _evidence_Link = $(_cells[5]).find("a")[0],
		_evidence_Url = _evidence_Link.getAttribute("href"),
		_evidence = '=HYPERLINK("' + (_evidence_Url.indexOf("/") === 0 ? (location.protocol + "//" + location.hostname) : "") + _evidence_Url + '","' + _evidence_Link.innerText + '")';

	return {
		url: _url,
		evidence: _evidence_Url,
		data: [
			group, _profession, _review, _version, _started, _responses, _evidence
		]
	};

};

var update_Reviews = function(group, entry) {

	(function(tries, max) {
		var _cells = entry.children("td");
		var _evidence_Link = $(_cells[5]).find("a")[0],
			_evidence_Url = _evidence_Link.getAttribute("href");

		if (_evidence_Url) {

			var _try = function() {
				tries += 1;
				if (tries < max) {
					if (REQUESTS < MAX_REQUESTS) {

						REQUESTS += 1; // Increment the Request Total

						silent_Fetch(_evidence_Url).then(html => {

							REQUESTS -= 1; // Decrement the Request Total

							var _evidence = get_Evidence($(html)) // == PARSE EVIDENCE PAGE == //

							if (_evidence && _evidence.rows && _evidence.rows.length > 0) {

								var _rows = _evidence.rows,
									_types = {
										Comments: _evidence.comments
									};
								for (var i = 0; i < _rows.length; i++) {
									if (_rows[i].type) {
										if (!_types[_rows[i].type]) _types[_rows[i].type] = 0;
										_types[_rows[i].type] += 1;
									}
								}

								var _text = "Total: <strong>" + _rows.length + "</strong> (" + _evidence.count + "/" + _evidence.max + " = <strong>" + Math.round((_evidence.count / _evidence.max) * 100) + "%</strong>)";
								for (var type in _types) {
									if (_types[type] > 0) _text += ((_text.length > 0 ? " | " : "") + type + ": <em>" + _types[type] + "</em>");
								}
								$(_cells[5]).append($("<span />", {
									style: "margin-left: 1em;"
								}).html(_text));

							}

						}).catch(e => {
							REQUESTS -= 1;
							_evidence_Link.innerText + " [ERROR]";
							if (e) $(_cells[5]).attr("title", JSON.stringify(e));
						});

					} else {
						DELAY(2000).then(() => _try());
					}
				} else {
					console.error("Reached Maximum Re-Tries");
				}

			};
			_try();

		}
	})(0, 40);

}

var parse_Shared_Journals = function(group, entry) {

	var _date = entry.find(".journal-shared-index-date").text();
	if (_date) _date = _date.trim();
	var _name, _link = entry.find("a")[0],
		_url;
	if (_link) {
		_url = _link.getAttribute("href");
		_name = '=HYPERLINK("' + (_url.indexOf("/") === 0 ? (location.protocol + "//" + location.hostname) : "") +
			_url + '","' + _link.innerText + '")';
	} else {
		_name = entry.find("a").text();
	}

	var _evidence = (entry.find("strong.paperclip-2").length == 1);
	var _comments = (entry.find("strong.comment-2").length == 1);

	return {
		url: _url,
		data: [
			group, _date, _name,
			_evidence ? "TRUE" : "", _comments ? "TRUE" : ""
		]
	};

};

var parse_Personal_Journals = function(group, entry) {

	var _children = entry.find("ul li:not(.journal-notification)");

	var _date = _children[0].innerText;
	if (_date) _date = _date.trim();

	var _name, _link = $(_children[1]).find("a")[0],
		_url;
	if (_link) {
		_url = _link.getAttribute("href");
		_url = (_url.indexOf("/") === 0 ? (location.protocol + "//" + location.hostname) : "") + _url;
		_name = '=HYPERLINK("' + _url + '","' + _link.innerText + '")';
	} else {
		_name = entry.find("a").text();
	}

	var _progress = (entry.find("strong.signal-bars-1").length == 1);
	var _shared = (entry.find("strong.user-2").length == 1);
	var _evidence = (entry.find("strong.paperclip-2").length == 1);
	var _comments = (entry.find("strong.comment-2").length == 1);

	return {
		url: _url,
		data: [
			group, _date, _name,
			_progress ? "TRUE" : "", _shared ? "TRUE" : "",
			_evidence ? "TRUE" : "", _comments ? "TRUE" : ""
		]
	};

};

var export_Pages = function(container, action, parse, progress, completion, rows, target, full) {

	// == Check Pages == //
	var _first = container.find("li.current").first();
	var _last = container.find("li a:not(.next_page)").last();
	var _url;
	if (_first.length > 0 && _last.length > 0) {
		_first = parseInt(_first[0].innerText, 10);
		_url = _last[0].getAttribute("href");
		_url = (_url.indexOf("/") === 0 ? (location.protocol + "//" + location.hostname) : "") + _url;
		_last = parseInt(_last[0].innerText, 10);
		_url = _url.replace("&page=" + _last, "").replace("page=" + _last, ""); // Remove Page Number  
	} else {
		_first = 0;
		_last = 0;
	}

	if (_first >= _last) {

		completion(rows);

	} else {

		var _total = (_last - _first) + 2,
			_current = 2;

		for (var n = (_first + 1); n <= _last; n++) {

			// Closure to preserve output ordering
			(function(index, url) {
				var _tries = 0,
					_max_Tries = 500;
				var _try = function() {
					_tries += 1;
					if (_tries < _max_Tries) {
						if (REQUESTS < MAX_REQUESTS) {

							REQUESTS += 1;

							silent_Fetch(url).then(html => {

								action(parse, $(html), target, full).then(new_rows => {

									// Decrement the Request Total
									REQUESTS -= 1;

									// Add the row to the relevant part of the output, and complete if we are ready!
									if (new_rows && new_rows.length > 0) {
										if (rows.length == index) {
											rows = rows.concat(new_rows);
										} else {
											for (var p = 0; p < new_rows.length; p++) {
												rows.splice(index++, 0, new_rows[p]);
											}
										}	
									}

									// Check for completion, update progress and complete if required
									_current += 1;
									progress(Math.round((_current / _total) * 100) + "% Complete");
									if (_current == _total) completion(rows);

								}).catch((e) => {
									// Decrement the Request Total
									REQUESTS -= 1;
									console.log("Failed to action " + url, e);
								});

							}).catch((e) => {
								// Decrement the Request Total
								REQUESTS -= 1;
								console.log("Failed to fetch " + url, e);
							});
						} else {
							DELAY(2000).then(() => _try());
						}
					} else {
						console.error("Reached Maximum Re-Tries");
						_current += 1;
					}
				};
				_try();
			})(rows.length, _url + (_url.indexOf("?") > 0 ? "&" : "?") + "page=" + n)

		}

	}
	// == Check Pages == //

};

var _execute_Observation_Report = function(scripts) {

	var _title = $("h1")[0];
	if (_title) {
		$("<span />", {
			class: "button"
		}).append(
			$("<a />", {
				class: "injected_handler",
				href: "#",
				title: "Export Shared Observations Metadata (including Comments) to Spreadsheet",
				text: "Export to Spreadsheet",
				style: "margin-left: 1em;"
			}).click(function(e) {
				e.preventDefault();

				Promise.all(scripts).then(() => {
					try {
				
						// -- Spinner, Progress & Finish Handler -- //
						var _height = 0;
						$("body > h1, #message").each(function() {
							_height += $(this).outerHeight(true);
						});
						SPIN.top = (($(window).height() - _height) / 2) + "px";
						var _busy = busy(SPIN, $("#content_main"), e.target.parentElement, "margin-left: 1em;");
						// -- Spinner, Progress & Finish Handler -- //
						
						var _criteria = $("#report_criteria");
						var __title = "";
						for (var i = 0; i < _title.childNodes.length; ++i)
							if (_title.childNodes[i].nodeType === 3)
								__title += (_title.childNodes[i].textContent ? _title.childNodes[i].textContent.trim() : "");
						export_Observations(__title, $("table.report_table").first(), _busy.finish, _busy.progress);
					} catch (e) {
						console.error("Failed to Export Observations", e);
						_busy.finish();
					}
				}).catch(e => {
					console.log("FAILED to Load XLSX/Filesaver for export", e);
					_busy.finish();
				});

			})
		).insertAfter($(_title).find("span.button"));
	}

};

var _execute_Shared_Journals = function(scripts) {

	var _handler = function(full) {
		return function(e) {
			e.preventDefault();

			Promise.all(scripts).then(() => {
				try {

					// -- Spinner, Progress & Finish Handler -- //
					var _busy = busy(SPIN, $("div.content-wrapper"), e.target.parentElement, "margin-left: 1em;");
					
					export_Journals(parse_Shared_Journals, $, "#content", full).then(rows => {

						(rows && rows.length > 0) ?
						export_Pages($("div.new_pagination"), export_Journals, parse_Shared_Journals, _busy.progress, complete_Spreadsheet("Shared Journals" + (full ? " [FULL]" : "") + ".xlsx", _busy.finish), [
								["Person", "Date", "Entry Name", "Evidence", "Comments"].concat(full ? ["Details", "Comment Details"] : [])
							].concat(rows), "#content", full):
							_busy.finish();

					}).catch(e => _busy.finish());

				} catch (e) {
					console.error("Failed to Export Shared Journals", e);
					_busy.finish();
				}
			}).catch(e => {
				console.log("FAILED to Load XLSX/Filesaver for export", e);
			});
		}
	}

	$("<span />", {
		class: "button"
	}).append(
		$("<a />", {
			class: "injected_handler",
			title: "Export Shared Journals (including entries) to Spreadsheet",
			href: "#",
			text: "Export Journals",
			style: "margin-left: 1em;"
		}).click(_handler(true))
	).insertAfter($("fieldset.filters input[type='submit']"));

	$("<span />", {
		class: "button"
	}).append(
		$("<a />", {
			class: "injected_handler",
			title: "Export Shared Journals Metadata to Spreadsheet",
			href: "#",
			text: "Export to Spreadsheet",
			style: "margin-left: 1em;"
		}).click(_handler(false))
	).insertAfter($("fieldset.filters input[type='submit']"));

};

var _execute_Personal_Journal = function(scripts) {

	var _handler = function(full) {
		return function(e) {
			e.preventDefault();

			Promise.all(scripts).then(() => {
				try {

					// -- Spinner, Progress & Finish Handler -- //
					var _busy = busy(SPIN, $("#content"), e.target.parentElement);
					
					export_Journals(parse_Personal_Journals, $, "#content_main", true).then(rows => {

						(rows && rows.length > 0) ?
						export_Pages($("div.new_pagination"), export_Journals, parse_Personal_Journals, _busy.progress, complete_Spreadsheet("Personal Journals.xlsx", _busy.finish), [
								["Month", "Date", "Entry Name", "Progress", "Shared", "Evidence", "Comments", "Details", "Comment Details"]
							].concat(rows), "#content_main", true):
							_busy.finish();

					}).catch(e => _busy.finish());

				} catch (e) {
					console.error("Failed to Export Personal Journal", e);
					_busy.finish();
				}
			}).catch(e => {
				console.log("FAILED to Load XLSX/Filesaver for export", e);
			});
		};
	};

	$("<li />", {
		class: "button"
	}).append(
		$("<a />", {
			class: "injected_handler",
			title: "Export Journal Entries to Spreadsheet",
			href: "#",
			text: "Export to Spreadsheet",
			style: "margin-right: 1em;"
		}).click(_handler(true))
	).prependTo($("#content > ul.actions"));

};

var _execute_Evidence_Overview = function(scripts) {

	$("<li />", {
		class: "button"
	}).append(
		$("<a />", {
			class: "injected_handler",
			title: "Export Evidence Tracker to Spreadsheet",
			href: "#",
			text: "Export to Spreadsheet",
			style: "margin-right: 1em;"
		}).click(function(e) {
			e.preventDefault();

			Promise.all(scripts).then(() => {
				try {
					
					// -- Spinner, Progress & Finish Handler -- //
					var _height = 0;
					$("body > header").each(function() {
						_height += $(this).outerHeight(true);
					});
					SPIN.top = (($(window).height() - _height) / 2) + "px";
					var _busy = busy(SPIN, $("#content"), e.target.parentElement, "margin-left: 1em;");
					// -- Spinner, Progress & Finish Handler -- //
					
					// -- CREATE EVIDENCE TRACKER -- //
					var _rows = get_Evidence($).rows;

					var _data = [
						["Title", "Details", "Evidence", "Date", "Comments", "Comment Details"]
					];

					for (var m = 0; m < _rows.length; m++) {
						var _row = [
							_rows[m].dimension, _rows[m].details,
							'=HYPERLINK("' + _rows[m].link + '","' + _rows[m].name + '")',
							_rows[m].date ? _rows[m].date : "", (_rows[m].comments && _rows[m].comments.length > 0) ? "TRUE" : ""
						];
						if (_rows[m].comments && _rows[m].comments.length > 0) _row = _row.concat(_rows[m].comments)
						_data.push(_row);
					}

					// -- Output -- //
					if (_data.length > 1) {
						complete_Spreadsheet("Evidence Tracker.xlsx", _busy.finish)(_data);
					} else {
						_busy.finish();
					}

				} catch (e) {
					console.error("Failed to Export Evidence Tracker", e);
					_busy.finish();
				}

			}).catch(e => {
				console.log("FAILED to Load XLSX/Filesaver for export", e);
			});

		})
	).prependTo($("#content > ul.actions"));

};

var _execute_Reviews = function(scripts) {

	$("<span />", {
		class: "button"
	}).append(
		$("<a />", {
			class: "injected_handler",
			title: "Export Reviews Metadata to Spreadsheet",
			href: "#",
			text: "Export to Spreadsheet",
			style: "margin-left: 1em;"
		}).click(function(e) {
			e.preventDefault();

			Promise.all(scripts).then(() => {
				try {

					// -- Spinner, Progress & Finish Handler -- //
					var _busy = busy(SPIN, $("#content"), e.target.parentElement);
					
					export_Reviews(parse_Reviews, $, "#content_main", false).then(new_rows => {

						(new_rows && new_rows.length > 0) ?
						export_Pages($("div.new_pagination"), export_Reviews, parse_Reviews, _busy.progress, complete_Spreadsheet("Reviews.xlsx", _busy.finish), [
								["Person", "Profession", "Review", "Version", "Started", "Responses", "Evidence"]
							].concat(new_rows), "#content_main", false):
							_busy.finish();

					}).catch(e => _busy.finish());

				} catch (e) {
					console.error("Failed to Export Reviews", e);
					_busy.finish();
				}
				
			}).catch(e => {
				console.log("FAILED to Load XLSX/Filesaver for export", e);
			});

		})
	).insertAfter($("fieldset.filters input[type='submit']"));

	$("<span />", {
		class: "button"
	}).append(
		$("<a />", {
			class: "injected_handler",
			title: "Update Detailed Evidence Counts / Percentages",
			href: "#",
			text: "Check Evidence",
			style: "margin-left: 1em;"
		}).click(function(e) {
			e.preventDefault();

			try {
				export_Reviews(update_Reviews, $, "#content_main", false).then(() => console.log("FINISHED"));
			} catch (e) {
				console.error("Failed to Update Evidence Counts", e);
			}

		})
	).insertAfter($("fieldset.filters input[type='submit']"));

};

var _execute = function() {

	// -- Reset Request Count -- //
	REQUESTS = 0;

	var _scripts = [
		inject_Script("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.11.6/xlsx.full.min.js"),
		inject_Script("https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.3/FileSaver.min.js"),
		inject_Script("https://cdnjs.cloudflare.com/ajax/libs/spin.js/2.3.2/spin.min.js")
	];

	if (((/(\/view_observation_report)($|\/|\?|\#)/i).test(location.pathname))) {

		// Observation Report, so Add an Export to Spreadsheet Button //
		_execute_Observation_Report(_scripts);

	} else if (((/(\/shared-journals)($|\/|\?|\#)/i).test(location.pathname))) {

		// Shared Journals //
		_execute_Shared_Journals(_scripts);

	} else if (((/(\/journal)($|\/|\?|\#)/i).test(location.pathname))) {

		// Personal Journal //
		_execute_Personal_Journal(_scripts);

	} else if (((/(\/evidence_overview)($|\/|\?|\#)/i).test(location.pathname))) {

		// Evidence Overview //
		_execute_Evidence_Overview(_scripts);

	} else if (((/(\/reviews\/index)($|\/|\?|\#)/i).test(location.pathname))) {

		// Reviews //
		_execute_Reviews(_scripts);

	} else {

		console.log("No-Wo/man's Land - SHOULDN'T every get here!");

	}

}

// -- Start Here -- //
if (typeof $ === "undefined") {
	inject_Script("https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js")
		.then(() => _execute()).catch(e => console.log("Failed to Load Query (not present in page)", e));
} else {
	_execute();
}
// -- Start Here -- //