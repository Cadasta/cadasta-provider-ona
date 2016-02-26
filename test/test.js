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

      console.log(response.data[0]._geolocation);

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

  /**
   * Test Polygon ingestion
   */
  it('should load an ONA file with geo_location polygon data', function(done){
      var url = path.join(__dirname + '/data/shapesurvey-polygon-geo-data.json');
      ona_provider.load(url, function(err, response){
          (response).should.have.property('cadasta_id');
          (response).should.have.property('operation');
          (response).should.have.property('version');
          (response).should.have.property('data');
          assert.typeOf(response.data, 'array', 'data should be an array of objects.');
          (response.data[0]._geolocation).should.have.property('type');
          assert.equal(response.data[0]._geolocation.type, 'Polygon', 'type should be Polygon');
          assert.typeOf(response.data[0]._geolocation.coordinates, 'array', 'data should be an array of objects.');
          console.log(JSON.stringify(response.data[0]._geolocation))
          done();
      })
  })

  /**
   * Test LineString ingestion
   */
  it('should load an ONA file with geo_location linestring data', function(done){
      var url = path.join(__dirname + '/data/shapesurvey-geotrace-geo-data.json');
      ona_provider.load(url, function(err, response){
          (response).should.have.property('cadasta_id');
          (response).should.have.property('operation');
          (response).should.have.property('version');
          (response).should.have.property('data');
          assert.typeOf(response.data, 'array', 'data should be an array of objects.');
          (response.data[0]._geolocation).should.have.property('type');
          assert.equal(response.data[0]._geolocation.type, 'LineString', 'type should be Polygon');
          assert.typeOf(response.data[0]._geolocation.coordinates, 'array', 'data should be an array of objects.');
          console.log(JSON.stringify(response.data[0]._geolocation))
          done();
      })
  })

  /**
   * Test media ingestion
   */
  it('should load an ONA file with attached resources', function(done){
      var url = path.join(__dirname + '/data/mediasurvey-data.json');
      ona_provider.load(url, function(err, response){
          //console.log(JSON.stringify(response.data[0], null, '\t'));
          (response).should.have.property('cadasta_id');
          (response).should.have.property('operation');
          (response).should.have.property('version');
          (response).should.have.property('data');
          //console.log(response.data[0]);
          assert.typeOf(response.data, 'array', 'data should be an array of objects.');
          assert.typeOf(response.data[0]._attachments, 'array', 'attachments should be an array of objects.');
          assert.equal(response.data[0]._attachments[0].filename, 'bjohare/attachments/1455727386250.jpg', 'Wrong filename');
          assert.equal(response.data[0]._attachments[0].resource_type, 'party', 'resource type should be party');
          assert.equal(response.data[0]._attachments[0].resource_file_name, '1455727386250.jpg', 'wrong resource file name');
          done();
      })
  })
})



