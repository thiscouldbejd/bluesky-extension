const MAX_REQUESTS = 8;
const DELAY = ms => new Promise(resolve => setTimeout(resolve, ms));
const RANDOM = (lower, higher) => Math.random() * (higher - lower) + lower;

var Workbook = function() {
  if (!(this instanceof Workbook)) return new Workbook();
  this.SheetNames = [];
  this.Sheets = {};
};

var Formulas = function(sheet) {
  
  // -- Deal with Formulas -- //
  for(var cell in sheet) {
  
    if (sheet[cell] && sheet[cell].t && sheet[cell].t == "s" &&
      sheet[cell].v && sheet[cell].v.indexOf("=") === 0) {
      
      sheet[cell].f = sheet[cell].v;
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

var export_Observations = function(title, table) {

  if (table) {

    table = $(table);
    var _header_Row = [], _headers = table.find("thead:first-child th");
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
      _rows = table.find("tbody tr"), _total = _rows.length + _values.length, _requests = 0;
    
    var _complete = function() {
      
      var _exportBook = new Workbook();
      var _safeName = {
        "\\": "",
        "/": "",
        "?": "",
        "*": "",
        "[": "",
        "]": "",
        "_": ""
      };

      // -- Add Values to Output -- //
      _exportBook.SheetNames.push("DATA");
      _exportBook.Sheets.DATA = XLSX.utils.aoa_to_sheet(_values && _values.length > 0 ? _values : []);

      // -- Deal with Formulas -- //
      Formulas(_exportBook.Sheets.DATA);
      
      // -- Save Output -- //
      var _title = RegExp.replaceChars(title, _safeName).trim();
      outputAndSave(_exportBook, "xlsx", _title + ".xlsx").then(() => {
        // Stop Spinner
      });  
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
                      _url +  '","' + _link.innerText + '")');
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
            if (_values.length == _total) _complete();
          };
          
          // Parse HTML response from Fetch
          var _parse = function(html) {
            _requests -= 1;
            
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
                var _comment = $(_comments[k]), _details = _comment.find(".message > p")[0].innerText, 
                    _author = _comment.find(".byline > p")[0].innerText, __comment = [];
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
            _requests -= 1;
            console.log("Failed to fetch " + url, e);
           _add();
          };
          
          // Restrict Simultaneous Fetch Requests by delaying
          var _tries = 0, _max_Tries = 10;
          var _try = function() {
            _tries += 1;
            if (_tries <_max_Tries) {
              if (_requests < MAX_REQUESTS) {
                _requests += 1;
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

var export_Journals = function(container) {
  var _return = [], _groupings = container.find("#content > h2");
  for (var i = 0; i < _groupings.length; i++) {
    
    var _grouping = $(_groupings[i]);
    var _person = _grouping.text().trim();
    var _entries = _grouping.nextUntil("h2, div.new_pagination");
    
    for (var j = 0; j < _entries.length; j++) {
      
      var _entry = $(_entries[j]);
      var _date = _entry.find(".journal-shared-index-date").text();
      if (_date) _date = _date.trim();
      var _name;
      var _link = _entry.find("a")[0];
      if (_link) {
        var _url = _link.getAttribute("href");
        _name = '=HYPERLINK("' + (_url.indexOf("/") === 0 ? (location.protocol + "//" + location.hostname) : "") + 
                      _url +  '","' + _link.innerText + '")';
      } else {
        _name = _entry.find("a").text();
      }
      
      var _evidence = (_entry.find("strong.paperclip-2").length == 1);
      var _comments = (_entry.find("strong.comment-2").length == 1);
      
      var _journal = [
        _person, _date, _name,
        _evidence ? "TRUE" : "", _comments ? "TRUE" : ""
      ];
      _return.push(_journal);
    }
    
  }
  return _return;
};

var _execute = function() {

  if (((/(\/view_observation_report)($|\/|\?|\#)/i).test(location.pathname))) {

    // Observation Report, so Add an Export to Spreadsheet Button //
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
          Promise.all([
            inject_Script("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.11.6/xlsx.full.min.js"),
            inject_Script("https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.3/FileSaver.min.js")
          ]).then(() => {
            try {
              var _criteria = $("#report_criteria");
              var __title = "";
              for (var i = 0; i < _title.childNodes.length; ++i) if (_title.childNodes[i].nodeType === 3) 
                __title += (_title.childNodes[i].textContent ? _title.childNodes[i].textContent.trim() : "");
              export_Observations(__title, $("table.report_table").first());
            } catch (e) {
              console.error("Failed to Export Observations", e);
            }
          }).catch(e => console.log("FAILED to Load XLSX/Filesaver for export", e));

        })
      ).insertAfter($(_title).find("span.button"));
    }

  } else if (((/(\/manage\/shared-journals)($|\/|\?|\#)/i).test(location.pathname))) {

    // Shared Journals //
    $("<span />", {
        class: "button"
      }).append(
        $("<a />", {
          class: "injected_handler",
          title: "Export Shared Journals Metadata to Spreadsheet",
          href: "#",
          text: "Export to Spreadsheet",
          style: "margin-left: 1em;"
        }).click(function(e) {
          e.preventDefault();
          Promise.all([
            inject_Script("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.11.6/xlsx.full.min.js"),
            inject_Script("https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.3/FileSaver.min.js")
          ]).then(() => {
            try {
              var _requests = 0, _rows = [["Person", "Date", "Entry Name", "Evidence", "Comments"]];
              _rows = _rows.concat(export_Journals($));

              // == COMPLETION == //
              var _complete = function() {
                // -- Export -- //
                var _exportBook = new Workbook();

                // -- Add Values to Output -- //
                _exportBook.SheetNames.push("DATA");
                _exportBook.Sheets.DATA = XLSX.utils.aoa_to_sheet(_rows);

                Formulas(_exportBook.Sheets.DATA);

                // -- Save Output -- //
                outputAndSave(_exportBook, "xlsx", "Shared Journals.xlsx").then(() => {
                  // Stop Spinner
                });
              };
              // == COMPLETION == //
              
              // == Check Pages == //
              var _first = $("div.new_pagination li.current").first();
              var _last = $("div.new_pagination li a:not(.next_page)").last();
              _first = parseInt(_first[0].innerText, 10);
              var _url = _last[0].getAttribute("href");
              _url = (_url.indexOf("/") === 0 ? (location.protocol + "//" + location.hostname) : "") + _url;
              _last = parseInt(_last[0].innerText, 10);
              _url = _url.replace("&page=" + _last, "").replace("page=" + _last, ""); // Remove Page Number
              
              if (_first >= _last) {
                
                _complete();
              
              } else {
                
                var _total = (_last - _first) + 2, _current = 2;
                
                for (var n = (_first + 1); n <= _last; n++) {
                
                  // Closure to preserve output ordering
                  (function(index, url) {
                    var _tries = 0, _max_Tries = 200;
                    var _try = function() {
                      _tries += 1;
                      if (_tries <_max_Tries) {
                        if (_requests < MAX_REQUESTS) {
                          _requests += 1;

                          silent_Fetch(url).then((html) => {
                            
                            _requests -= 1;
                            var _new = export_Journals($(html));

                            // Add the row to the relevant part of the output, and complete if we are ready!
                            if (_rows.length == index) {
                              _rows = _rows.concat(_new);
                            } else {
                              for (var p = 0; p < _new.length; p++) {
                                _rows.splice(index++, 0, _new[p]);
                              }
                            }
                            _current += 1;
                            if (_current == _total) _complete();

                          }).catch((e) => {
                            _requests -= 1;
                            console.log("Failed to fetch " + url, e);
                          });  
                        } else {
                          DELAY(1000).then(() => _try());
                        }  
                      } else {
                        console.error("Reached Maximum Re-Tries");
                      }
                    };
                    _try();
                  })(_rows.length, _url + (_url.indexOf("?") > 0 ? "&" : "?") + "page=" + n)

                }
                
              }
              // == Check Pages == //

            } catch (e) {
              console.error("Failed to Export Observations", e);
            }
          }).catch(e => console.log("FAILED to Load XLSX/Filesaver for export", e));
          
        })
      ).insertAfter($("fieldset.filters input[type='submit']"));

  } else {

    console.log("No-Wo/man's Land - SHOULDN'T every get here!");

  }

}

if (typeof $ === "undefined") {
  inject_Script("https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js")
    .then(() => _execute()).catch(e => console.log("Failed to Load Query (not present in page)", e));
} else {
  _execute();
}