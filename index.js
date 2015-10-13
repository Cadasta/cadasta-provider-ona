/***
 *
 *The ONA Provider is responsible for validating and parsing incoming ONA API (.json) files.
 *
 * @constructor
 */

var jsonfile = require('jsonfile');
var http = require('http');
var pg = require('../cadasta-data-transformer/src/controllers/data_access.js');
var settings = null;

var ONA =  {

}

/***
 * Register is used to link up each provider with the base ingestion engine instance.
 * This is required in order for this to work properly
 * @param ingestion_engine - an instance of the cadasta-ingestion-engine
 */
ONA.register = function(ingestion_engine, pSettings){
    ingestion_engine.providers["ona"] = ONA;
    settings = pSettings;
}


/***
 * Take in a json file and parse it.
 * Optionally accept a Survey ID.  If it exists, then the structure already exists in the DB. If so, just insert the data.
 */
ONA.load = function(path_to_file, callback) {

  var _self = this;

  //Take the file and parse with json library.  Pass the result to parse
  //Simulate a form upload with a file attachment
  jsonfile.readFile(path_to_file, function (err, obj) {

    //Exit if errors
    if (err) {
      callback(err, {});
      return;
    }

    _self.validate(obj, function (err, json) {

      if (err) {
        callback(err, null);
        return;
      }

      //Parse data - at this point, we have an json object with properties containing key/value pairs.
      //Need to a little more to make it match the cjf-data spec.
      _self.parse(json, {cadasta_data: ""}, function (err, cjf) {

        if (err) {
          callback(err, null);
          return;
        }

        callback(err, cjf);

      })

    })

  });

}



/***
 *
 * @param input
 */
ONA.validate = function(input, cb) {

  //Ideally would return an object with a status, plus the reason that validation failed.

  //Check for _geolocation field

  //use Array.filter to return an array of objects WITHOUT the _geolocation property
  //_geolocation can be null, but it needs to be there.
  var filtered = input.filter(function (item) {

    if (item.hasOwnProperty("_geolocation")) return false;

    return true;
  });

  if (filtered.length > 0) {
    //There are some objects missing the required _geolocation property
    cb({"error": "There are " + filtered.length + " rows missing the _geolocation property. Fix and try again."}, input);
    return;
  }

  //TODO: Check for other required fields


  //A-OK
  cb(null, input);

}


/***
 *
 * @param input - an array of json objects containing key/value pairs.
 * @param cadasta_data - an object containing cadasta-specific ids
 */
ONA.parse = function(input, cadasta_data, cb) {

  //Loop thru featurecollection
  if (input) {

    //For each geolocation property, replace it with valid geojson snippet
    input.forEach(function(item){
      if(item._geolocation){
        item._geolocation = replaceYXWithGeoJSON(item._geolocation);
      }
    });

    var cjf = {
      version: 1.0,
      cadasta_id: "12345", //this should be submitted or forwaded from CKAN API wrapper
      operation: "create", //create, update, delete...need to sort this out
      survey_id: null, //survey ID if it exists already.  If not exists, need to create survey first, and then load the data
      data: input
    };

    //callback with the cjf
    cb(null, cjf);
  }
  else {
    var err = {err: "No rows were passed to the parser."};
    cb(err, null);
  }

}






ONA.getFormFromOna = function(cadastaProjectId, formId) {

}


ONA.registerTriggerForForm = function(formId, cb) {

    if (typeof settings.ona !== 'object') {
        cb({status: "ERROR", msg: "You must enter your Ona settings and credentials in your settings.js file in cadasta-api/settings/environment-settings.js."});
    }

    // Documentation on creating a trigger on Ona can be found here:
    //    https://api.ona.io/static/docs/restservices.html

    // Example of a post that works:
    //    https://www.dropbox.com/s/iy3an89yuvigji8/Screenshot%202015-10-09%2014.09.54.png?dl=0
    //    https://www.dropbox.com/s/q4od3h8vvexg5os/Screenshot%202015-10-09%2014.11.12.png?dl=0

    var triggerUrl = httpOrHttps(settings.port) + settings.hostIp + ":" + settings.apiPort + "/providers/ona/trigger/" + formId;

    // Build the post string from an object
    var postData = JSON.stringify({
        "xform": formId,
        "service_url": triggerUrl,
        "name": "generic_json"
    });

    // An object of options to indicate where to post to
    var postOptions = {
        host: settings.ona.host,
        port: settings.ona.port,
        path: '/api/v1/restservices',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Token ' + settings.ona.apiToken
        }
    };

    // Set up the request
    var postReq = http.request(postOptions, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            var onaResponse = JSON.parse(chunk);
            var status = "OK";
            if (!onaResponse.id) {
                status = "ERROR";
            }
            cb({
                status: status,
                ona: onaResponse
            });
        });
    });

    postReq.write(postData);
    postReq.end();
}


/**
 * Please note, we are getting the complete data.json end point
 * for a given form every time this trigger is hit. This is a
 * temporary solution that will not scale.
 *
 * Unfortunately, Ona returns paginated data in an arbitrary order,
 * and the dataviews end point is broken.
 *
 * https://github.com/Cadasta/cadasta-provider-ona/issues/1
 *
 * @param formId
 */
ONA.trigger = function(formId) {
    fetchUUIDsForForm(formId, function (uuidHash) {
        fetchDataFromOna(formId, function(onaData) {
            var filteredCJF = filterFreshDataToCJF(uuidHash, onaData);
        });
    });
}

/**
 * The creates a hash from the db of all of the uuids
 * for a given form. We feed a JSON Object to the cb
 * callback that can key to each uuid we have for
 * quick search.
 *
 * @param formId
 * @param cb
 */
function fetchUUIDsForForm(formId, cb) {
    // Get all of the UUIDs for each instance of the form.
    var sql = "select respondent.uuid from respondent join field_data on respondent.field_data_id = field_data.id where field_data.form_id = " + formId + ";";
    pg.query(sql, function (err, data) {
        if (err) {
            console.error("Unable to fetch UUIDs for Form.");
            return;
        }
        var uuidHash = {};
        for (var i = 0; i < data.length; i++) {
            var obj = data[i];
            if (typeof obj.uuid !== 'string') {
                console.error("Bad UUID when fetching UUIDs for form.");
            }
            uuidHash[obj.uuid] = true;
        }
        cb(uuidHash);
    });
}

/**
 * Fetches all of the data for a given form from Ona's
 * /api/v1/data/{{id}}.json endpoint.
 *
 * @param formId
 * @param cb - feeds callback the onaData object
 */
function fetchDataFromOna(formId, cb) {
    var options = {
        host: settings.ona.host,
        path: '/api/v1/data/' + formId + '.json',
        headers: {
            'Authorization': 'Token ' + settings.ona.apiToken
        }
    };
    http.request(options, function (response) {
        var str = '';

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {
            var onaData = JSON.parse(str);
            cb(onaData);
        });
    }).end();
}

/**
 * Iterates through the ona data.json array and filters out
 * all of the objects with a uuid currently contained in the
 * database.
 *
 * It also converts the _geolocation array into GeoJSON.
 *
 * with the name of `geo_location`.
 *
 * @param uuidHash
 * @param onaData
 */
function filterFreshDataToCJF(uuidHash, onaData) {
    var filteredCJF = [];
    for (var i = 0; i < onaData.length; i++) {
        var obj = onaData[i];
        // if we dont currently have data with this uuid
        if (!uuidHash[onaData._uuid]) {
            obj._geolocation = replaceYXWithGeoJSON(obj._geolocation);

            var cjf = {
                version: 1.0,
                cadasta_id: "12345", //this should be submitted or forwaded from CKAN API wrapper
                operation: "create", //create, update, delete...need to sort this out
                survey_id: null, //survey ID if it exists already.  If not exists, need to create survey first, and then load the data
                data: obj
            };

            filteredCJF.push(obj);
        }
    }
}

/***
 * Takes in an array like this [Y,X], return a GEOJSON snippet in its place
 * Output should be of the form:
 * {"type":"Point","coordinates":[32.531362,0.354736]}
 * @param input
 */
function replaceYXWithGeoJSON(input){
    return {"type":"Point","coordinates":[input[1],input[0]]};
}

function httpOrHttps(port) {
    if (port === 443) {
        return 'https://';
    }
    return 'http://';
}

module.exports = ONA;

