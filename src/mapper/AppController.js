/**
 * @author narayanu
 * 
 * summary:
 *      AppController is responsible for wiring up the application. It instantiates various widgets 
 *      using options (url)
 * 
 * configUrl:
 *      endpoint that returns configuration options as json
 */

define(["dojo/_base/declare", "dojo/request/xhr", "dojo/Deferred", "dojo/_base/lang", "mapper/widgets/CustomMap",
        "mapper/widgets/BasemapToggler", "mapper/widgets/TokenSecurity", "dijit/registry"], 
    function(declare, xhr, Deferred, lang, CustomMap, BasemapToggler, TokenSecurity, registry) {
        
    //summary:
    //      AppController class. Note that init is called within 
    //      the constructor itself.
    return declare("mapper.AppController", [], {
        
        constructor: function(configUrl) {
            this.configUrl = configUrl;
        },

        init: function() {
            var self = this;
            var def = new Deferred();
            this.readConfig(this.configUrl).then(
                function(data){
                    self.authenticate(data.dynamicMaps);
                    self.createChildren(data);        
                    def.resolve();
                }, 
                function(error){
                    throw "Error while reading application configuration " + error;
                    def.reject();
            });
            
            return def;
        },
                
        //summary:
        //      private function that accepts configUrl and returns a deferred that is resolved
        //      with configuration options object
        readConfig: function _(configUrl) {
            var def = new Deferred();
            xhr(configUrl, {
                jsonp : "callback",
                preventCache: false,
            })
            .then(function(data) {
                var obj = dojo.fromJson(data);
                def.resolve(obj);
            }, 
            function(error) {
                def.reject(error);
            });   
            
            return def;
        },
    
        authenticate: function(objs) {
            for (var i=0, il=objs.length; i<il; i++) {
                TokenSecurity.getInstance().checkTokenRequired(objs[i].url).then(function(status) {
                    if (status) {
                       TokenSecurity.getInstance().requestCredentials(); 
                    }
                }, function(error) {
                    console.error(error);
                });
            }    
        },
        
        createChildren: function(config) {
            var _config = lang.mixin({
                showArcGISBasemaps: true,
                showGoogleBasemaps: false,
                baseMaps: [],
                dynamicMaps: [],
                geometryService: null,
                geocodingService: null,
                serverVersion: 10.1,
                initialZoom: 5    
            }, config);
            
            //first initialize the map
            var customMap = new CustomMap(_config, dojo.byId("map1"));
            customMap.startup();
            
            var basemapOpts = lang.mixin({
                map : customMap
            }, this.opts);
            
            _basemapToggle = new BasemapToggler(basemapOpts, dojo.byId("basemapToggler1"));
            _basemapToggle.startup();
        }
    });
});
