
define(['dojo/_base/declare', 'dojo/_base/lang', 'dijit/_WidgetBase', 'esri/arcgis/utils', 'esri/tasks/Geoprocessor', 
    'mapper/widgets/Resulter', "esri/tasks/FeatureSet"], 
    
    function(declare, lang, _WidgetBase, arcgisUtils, Geoprocessor, Resulter, FeatureSet) {

    var gp = null, 
        _opts = null,
        resulter = null,
        url = "http://cmvpdev:6080/arcgis/rest/services/APS/PoliticalIntersections/GPServer/Political%20Intersections";
   
    return declare('mapper.widgets.political_intersections', [_WidgetBase], {

        constructor : function(opts, srcRefNode) {
            _opts = lang.mixin({
                map: null,
                outputFormat: "features"
            }, opts || {});
            
            gp = new Geoprocessor(url);
            resulter = Resulter.getInstance({map: _opts.map});
        },

        execute : function(feature) {
            var fSet = new FeatureSet();
            var features = [];
            feature.attributes = [];
            fSet.fields = [];
            features.push(feature);
            fSet.features = features;
            
            var taskParams = {
                "Input_Feature" : fSet,
                "OutputFormat": _opts.outputFormat
            };
            
            if (_opts.map) {
                gp.setOutSpatialReference(_opts.map.spatialReference);
            }
            
            gp.execute(taskParams, gpResultAvailable, gpFailure);
            resulter.show();
        }
    });

    function gpResultAvailable(results, messages) {
        
        var csvs = results[0].value;
        var html = "";
        for (var i=0, il=csvs.length; i<il; i++) {
            html += "<li><a href='" + csvs[i].url + "'>" + csvs[i].url + "</a></li>";
        }
        if (csvs.length>0) {
            html = "<div style='padding:10px'><ul>" + html + "</ul></div><br/>";
            resulter.addHtmlResults("csv files", html);
        }
        
        for (var i=1, il=results.length; i<il; i++) {
            var value = results[i].value;
            if ('features' in value) {
                var spRef = results[i].value.spatialReference;
                var features = results[i].value.features;
                var resultsFset = [];
                for (var j=0; j<features.length; j++) {
                    var geom = features[j].geometry;
                    geom.setSpatialReference(spRef);
                    resultsFset.push({
                        feature: {
                            attributes: features[j].attributes,
                            geometry: geom
                        }
                    });
                }
                
                if (resultsFset.length > 0) {
                    resulter.addMapResults(results[i].paramName, resultsFset, null);
                }
                          
            }
        }
        
        setTimeout(function() {
            resulter.select(0);    
        }, 100);
        
    }

    function gpFailure(error) {
        console.error("Error occurred: ", error);
    }
});
