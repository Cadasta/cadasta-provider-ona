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
var PythonShell = require('python-shell');
var path = require('path');
var fs = require('fs');
var request = require('request');

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

    // Build the post string from an object
    var postData = JSON.stringify({
        "xform": formId,
        "service_url": "http://api.cadasta.org/providers/ona/trigger/" + formId,
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



ONA.loadData = function(formId, formInstanceData) {

}

ONA.xlstoJson = function (file,cb) {

    // python-shell options
    var options = {
        scriptPath: path.join(__dirname + '/pyxform/pyxform/'), // location of script dir
        args: [file[0].path],
        mode: "text"
    };

    var formObj;

    PythonShell.run('xls2json.py', options, function (err, results) {
        if (err) throw err;

        var obj = "";

        // concat results into JSON string
        results.forEach(function (res) {
            obj += res;
        });

        formObj = JSON.parse(obj);  // parse JSON string

        cb(formObj);

    });

}


/**
 * Creates CJF to Load into Cadasta DB
 * @param formJSON
 * @param projectId
 * @param ONAresponse
 * @param cb
 */
function createCJF (formJSON, projectId, ONAresponse, cb) {

    var cjf = {};

    cjf.form = formJSON;
    cjf.form.formid = ONAresponse.formid;
    cjf.project_id = projectId;

    cb(cjf);

}

/**
 * Takes xls File and Loads to ONA api endpoint: http://54.245.82.92/api/v1/forms
 * @param formJSON
 * @param projectId
 * @param file
 * @param cb - returns CJF
 */
ONA.uploadFormtoONA = function (formJSON, projectId, file, cb) {

    // An object of options to indicate where to post to
    var postOptions = {
        'url':'http://54.245.82.92/api/v1/forms',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Token ' + settings.ona.apiToken
        }
    };

    var postReq = request.post(postOptions, function(err,res,body){

        body = JSON.parse(body);

        // handle ONA errors
        if(body.type == 'alert-error' || body.detail){

            cb({status:"ERROR", msg:body.text || body.detail})

        } else if (body.formid !== null){ // successful response

            // create CJF and return to ingestion_base
            createCJF(formJSON, projectId, body, function(cjf){
                cb({status:"OK", ona:cjf})
            });
        }
    });

    var form = postReq.form();
    // create alias for xls file
    form.append('xls_file', fs.createReadStream(file[0].path), {filename: file[0].originalFilename});

};





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

