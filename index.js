/***
 *
 *The ONA Provider is responsible for validating and parsing incoming ONA API (.json) files.
 *
 * @constructor
 */

var jsonfile = require('jsonfile');
var http = require('http');
var pg = require('../cadasta-data-transformer/src/controllers/data_access.js');

var ONA =  {

}

/***
 * Register is used to link up each provider with the base ingestion engine instance.
 * This is required in order for this to work properly
 * @param ingestion_engine - an instance of the cadasta-ingestion-engine
 */
ONA.register = function(ingestion_engine){

    ingestion_engine.providers["ona"] = ONA;

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


ONA.registerTriggerForForm = function(formId) {

    //Though we have the form ID, Ona requires the string based
    //version of the form id.
    pg.query("SELECT id_string FROM survey WHERE id = " + formId + ";", function (data) {
        console.log('hi');
    });


    //Request URL:http://54.245.82.92/cadasta/forms/CJF-minimum/addservice
    //Request Method:POST

    // Form Data
    // csrfmiddlewaretoken:lQP203erhd9HoO40DoGs9kNlFcnnP3SN
    // service_name:generic_json
    // service_url:http://myurl.com/myroute

    // Response
    // {"status": "success", "message": "Successfully added service generic_json.", "restservice": "\n<li>CJF-minimum:JSON POST - http://myurl.com/myroute\n\n    &nbsp;-&nbsp;<a href=\"#\" data-url=\"/cadasta/forms/CJF-minimum/delservice\" data-id=\"4\" class=\"btn btn-mini btn-danger restserviceitem\">Delete</a>\n</li>\n"}

    // Build the post string from an object
    var postData = querystring.stringify({
        csrfmiddlewaretoken: "lQP203erhd9HoO40DoGs9kNlFcnnP3SN",
        service_name: "generic_json",
        service_url: "http://myurl.com/fromnode"
    });

    // An object of options to indicate where to post to
    var postOptions = {
        host: '54.245.82.92',
        port: '80',
        path: '/cadasta/forms/CJF-minimum/addservice',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };

    // Set up the request
    var postReq = http.request(postOptions, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
        });
    });
}

ONA.loadData = function(formId, formInstanceData) {

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


module.exports = ONA;

