'use strict';

var doctrine = require('doctrine'),
    fs = require('fs'),
    jsYaml = require('js-yaml'),
    path = require('path'),
    spec = require('swagger-tools').specs.v2;

/**
 *  Initializes the module. This is intended to be called only once.
 *  @param {object} app - Express application
 *  @param {object} config - Module configurations
 */
module.exports.init = function (app, config) {
    if (!config) {
        throw new Error('\'config\' is required.');
    }
    else if (!config.info) {
        throw new Error('\'config.info\' is required.');
    }
    else if (!config.apiPath) {
        throw new Error('\'config.apiPath\' is required.');
    }
    else if (!config.apiFiles) {
        throw new Error('\'config.apisFiles\' is required.');
    }

    // This is the Swagger object that conforms to the Swagger 2.0 specification.
    var swaggerObject = {
        swagger: '2.0',
        info: config.info,
        paths: {}
    };

    // Parse the API files and add the data to the Swagger object.
    for (var i = 0; i < config.apiFiles.length; i++) {
        var jsDocComments = parseApiFile(config.apiFiles[i]);
        var swaggerJsDocComments = filterJsDocComments(jsDocComments);
        addDataToSwaggerObject(swaggerObject, swaggerJsDocComments);
    }

    // Validate the Swagger object.
    var validSwaggerObject = module.exports.validateSwaggerObject2dot0(swaggerObject);
    if (validSwaggerObject === false) {
        throw new Error('Invalid Swagger object:\n' + JSON.stringify(swaggerObject));
    }

    // Add Express route to serve the Swagger JSON object.
    app.get(config.apiPath, function (req, res) {
        res.json(module.exports.swaggerObject);
    });

    // Expose the Swagger object so that the module consumer has access to it.
    module.exports.swaggerObject = swaggerObject;
};

// -- Parsing ----------------------------------------------------------------------------------------------------------

/**
 *  Parses the provided API file for JSDoc comments.
 *  @param {string} file - File to be parsed
 *  @returns {array} JSDoc comments as parsed by the 'doctrine' module
 */
function parseApiFile(file) {
    var fileExtension = path.extname(file);
    if (fileExtension !== '.js') {
        throw new Error('Unsupported extension \'' + fileExtension + '\'.');
    }

    var jsDocRegex = /\/\*\*([\s\S]*?)\*\//gm;
    var fileContent = fs.readFileSync(file, { encoding: 'utf8' });
    var regexResults = fileContent.match(jsDocRegex);

    var jsDocComments = [];
    if (regexResults) {
        for (var i = 0; i < regexResults.length; i++) {
            var jsDocComment = doctrine.parse(regexResults[i], { unwrap: true });
            jsDocComments.push(jsDocComment);
        }
    }

    return jsDocComments;
}

/**
 *  Filters JSDoc comments for those tagged with '@swagger'
 *  @param {array} JSDoc comments
 *  @returns {array} JSDoc comments tagged with '@swagger'
 */
function filterJsDocComments(jsDocComments) {
    var swaggerJsDocComments = [];

    for (var i = 0; i < jsDocComments.length; i++) {
        var jsDocComment = jsDocComments[i];
        for (var j = 0; j < jsDocComment.tags.length; j++) {
            var tag = jsDocComment.tags[j];
            if (tag.title === 'swagger') {
                swaggerJsDocComments.push(jsYaml.safeLoad(tag.description));
            }
        }
    }

    return swaggerJsDocComments;
}

/**
 *  Adds the data in the Swagger JSDoc comments to the swagger object.
 *  @param {object} Swagger object
 *  @param {array} JSDoc comments tagged with '@swagger'
 */
function addDataToSwaggerObject(swaggerObject, swaggerJsDocComments) {
    for (var i = 0; i < swaggerJsDocComments.length; i++) {
        var pathObject = swaggerJsDocComments[i];
        var propertyNames = Object.getOwnPropertyNames(pathObject);
        
        for (var j = 0; j < propertyNames.length; j++) {
            var propertyName = propertyNames[j];
            if(swaggerObject.paths.hasOwnProperty(propertyName)){
                for(var k in Object.keys(pathObject[propertyName])){
                    var childPropertyName = Object.keys(pathObject[propertyName])[k];
                    swaggerObject.paths[propertyName][childPropertyName] = pathObject[propertyName][childPropertyName];
                }
            }else{
                swaggerObject.paths[propertyName] = pathObject[propertyName];
            }
        }

    }
}

// -- Validation -------------------------------------------------------------------------------------------------------

/**
 *  Validates swagger object against Swagger 2.0 specs.
 *  @param {object} swaggerObject - Swagger object
 *  @returns {bool}
 */
module.exports.validateSwaggerObject2dot0 = function (swaggerObject) {
    spec.composeModel(swaggerObject, '#/definitions/ValidatedSchema', function (err, schema) {
        if (err) {
            throw err;
        }
    });
    return true;
};
