function getJIRAFeed(callback, errorCallback){
    var user = document.getElementById("user").value;
    if(user == undefined) return;

    var url = "https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+"+user+"&providers=issues";
    make_request(url, "").then(function(response) {
      // empty response type allows the request.responseXML property to be returned in the makeRequest call
      callback(url, response);
    }, errorCallback);
}
/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {function(string)} callback - Called when the query results have been
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
async function getQueryResults(s, callback, errorCallback) {
    try {
      var response = await make_request(s, "json");
      callback(createHTMLElementResult(response));
    } catch (error) {
      errorCallback(error);
    }
}

function make_request(url, responseType) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = responseType;

    req.onload = function() {
      var response = responseType ? req.response : req.responseXML;
      if(response && response.errorMessages && response.errorMessages.length > 0){
        reject(response.errorMessages[0]);
        return;
      }
      resolve(response);
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    }
    req.onreadystatechange = function() {
      if(req.readyState == 4 && req.status == 401) {
          reject("You must be logged in to JIRA to see this project.");
      }
    }

    // Make the request
    req.send();
  });
}


function loadOptions(){
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, function(items) {
    document.getElementById('project').value = items.project;
    document.getElementById('user').value = items.user;
  });
}

function buildJQL(callback) {
  var callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
  var project = document.getElementById("project").value;
  var status = document.getElementById("statusSelect").value;
  var inStatusFor = document.getElementById("daysPast").value;
  var fullCallbackUrl = callbackBase;
  fullCallbackUrl += `project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100`;
  callback(fullCallbackUrl);
}


function createHTMLElementResult(response){
  var issues = response.issues.map(function(issue){
    return listItemHtml(issue)
  })
  return `<h4 class="main-title">Results: ${response.total}</h4>
          <ul>
            ${issues.join('')}
          </ul>`
}

function listItemHtml(issue) {
  return `<li class="query-result">
            <img src="${issue.fields.status.iconUrl}" />
            <a href="https://jira.secondlife.com/browse/${issue.key}" target="_blank">${issue.key}</a>
            <div class="query-result-title">${issue.fields.summary}</div>
          </li>`
}

// utility
function domify(str){
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

async function checkProjectExists(){
    try {
      return await make_request("https://jira.secondlife.com/rest/api/2/project/SUN", "json");
    } catch (errorMessage) {
      document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
      document.getElementById('status').hidden = false;
    }
}

// Setup
document.addEventListener('DOMContentLoaded', function() {
  // if logged in, setup listeners
    checkProjectExists().then(function() {
      //load saved options
      loadOptions();
      var statusElement = document.getElementById('status')
      // query click handler
      document.getElementById("query").onclick = function(){
        // build query
        buildJQL(function(url) {
          statusElement.innerHTML = 'Performing JIRA search for ' + url;
          statusElement.hidden = false;
          // perform the search
          getQueryResults(url, function(return_val) {
            // render the results
            statusElement.innerHTML = 'Query term: ' + url + '\n';
            statusElement.hidden = false;

            var jsonResultDiv = document.getElementById('query-result');
            jsonResultDiv.innerHTML = return_val;
            jsonResultDiv.hidden = false;

          }, function(errorMessage) {
              statusElement.innerHTML = 'ERROR. ' + errorMessage;
              statusElement.hidden = false;
          });
        });
      }

      // activity feed click handler
      document.getElementById("feed").onclick = function(){
        // get the xml feed
        getJIRAFeed(function(url, xmlDoc) {
          statusElement.innerHTML = 'Activity query: ' + url + '\n';
          statusElement.hidden = false;

          // render result
          var feed = xmlDoc.getElementsByTagName('feed');
          var entries = feed[0].getElementsByTagName("entry");
          var list = document.createElement('ul');

          for (var index = 0; index < entries.length; index++) {
            var html = entries[index].getElementsByTagName("title")[0].innerHTML;
            var updated = entries[index].getElementsByTagName("updated")[0].innerHTML;
            var item = document.createElement('li');
            item.innerHTML = new Date(updated).toLocaleString() + " - " + domify(html);
            list.appendChild(item);
          }

          var feedResultDiv = document.getElementById('query-result');
          if(list.childNodes.length > 0){
            feedResultDiv.innerHTML = list.outerHTML;
          } else {
            statusElement.innerHTML = 'There are no activity results.';
            statusElement.hidden = false;
          }

          feedResultDiv.hidden = false;

        }, function(errorMessage) {
          statusElement.innerHTML = 'ERROR. ' + errorMessage;
          statusElement.hidden = false;
        });
      };

    }).catch(function(errorMessage) {
        statusElement.innerHTML = 'ERROR. ' + errorMessage;
        statusElement.hidden = false;
    });
});
