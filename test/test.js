/***
 * Tests for ONA provider
 */

var assert = require('chai').assert;
var chai = require('chai');
chai.use(require('chai-things'));

//This is for the API level testing
var should = require('chai').should(),
  superagent = require("superagent"),
  fs = require("fs"),
  path = require("path");

var ona_provider = require("../index.js");

describe('ONA Suite', function () {

  it('load method exists', function (done) {

    assert.isDefined(ona_provider.load);

    done();

  });

  it('uploads a ona .json file and returns cjf', function (done) {

    //Simulate a form upload with a file attachment
    var url = path.join(__dirname + '/data/basicsurvey-geo-data.json');

    ona_provider.load(url, function (err, response) {

      (response).should.have.property('cadasta_id');
      (response).should.have.property('operation');
      (response).should.have.property('version');
      (response).should.have.property('data');
      assert.typeOf(response.data, 'array', 'data should be an array of objects.');
      (response.data[0]).should.have.property('_geolocation');
      (response.data[0]._geolocation).should.have.property('type');

      done();

    });


  })


  it('should load an ONA file with no _geolocation fields and report an error', function (done) {

    //Simulate a form upload with a file attachment
    var url = path.join(__dirname + '/data/basicsurvey-geo-data-no-_geolocation.json');

    ona_provider.load(url, function (err, response) {

      (err).should.have.property("error");

      done();

    });


  })

})



