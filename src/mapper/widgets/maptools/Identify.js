/**
 * @author narayanu
 */

define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom-construct",
    "dojo/dom-class",
    "dojo/_base/array",
    "dijit/form/ToggleButton",
    "esri/tasks/IdentifyTask",
    "esri/tasks/IdentifyParameters",
    "esri/InfoTemplate",
    "dijit/registry"], 
    
    function(declare, lang, domConstruct, domClass, array, ToggleButton, 
        IdentifyTask, IdentifyParameters, InfoTemplate, registry) {

        return  declare('mapper.widgets.maptools.Identify', [ToggleButton], {

            tocId: null,
            
            mapId: null,
        
            iconClass: "identifyIcon",

            identifying: false,
            
            _setIdentifyingAttr: function(identifying) {
            	this._set("identifying", identifying);
            	if (identifying) {
            		this.set("checked", true);
            		this.connectMapClickHandler();
            		
            	} else {
            		this.set("checked", false);
            		this.disConnectMapClickHandler();
            	}
            },
            
            connectMapClickHandler: function() {
                var customMap = registry.byId(this.get("mapId"));
                var self = this;
                customMap.mapLoadDeferred.then(function() {
                    if ('_esriMap' in customMap) {
                        self.esriMap = customMap._esriMap;
                        self.mapClickHandler = self.esriMap.on("click", function(mapEvent) {
                            self._doIdentify(self.esriMap, mapEvent);
                        });
                        
                        self.esriMap.setMapCursor("crosshair");
                    } 
                    else {
                        console.error("Identify tool cannot connect to map");
                        console.log(customMap);
                    }
                });
            },
            
            disConnectMapClickHandler: function() {
                if (this.mapClickHandler != null) {
                    this.mapClickHandler.remove();
                }
                if (this.esriMap) {
                    this.esriMap.setMapCursor("default");
                }
            },
            
            _doIdentify: function (map, ev) {
                var identifyDeferred = this._getIdentifyDeferred(map, ev);
                if (identifyDeferred !== null) {
                    map.infoWindow.setFeatures([identifyDeferred]);
                    map.infoWindow.show(ev.mapPoint);
                }
            },

            _getIdentifyDeferred: function (map, map_event) {
                //grab selections from the toc
                var tocWidget = registry.byId(this.get("tocId"));
                var tocs = tocWidget.getTocs();
                var layerIds = tocs[0]._getVisibleLayerIds();
                if (layerIds.length > 0) {
                    var identifyUrl = tocs[0].url;
                
                    //var mapServiceId = this.layerSelector.selectedMapService.id;
                    //var layerIds = this.layerSelector.selectedLayerIds;
                    //var identifyUrl = map.getLayer(mapServiceId).url;
                    
                    var identifyTask = new IdentifyTask(identifyUrl);
                    
                    var identifyParams = new IdentifyParameters();
                    identifyParams.tolerance = 3;
                    identifyParams.returnGeometry = true;
                    
                    identifyParams.layerIds = layerIds;
                    
                    if (this.visibleOnly) {
                       identifyParams.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;
                    } else {
                       identifyParams.layerOption = IdentifyParameters.LAYER_OPTION_ALL;
                    }
                    
                    identifyParams.width = map.width;
                    identifyParams.height = map.height;
                    identifyParams.geometry = map_event.mapPoint;
                    identifyParams.mapExtent = map.extent;
    
                    var deferred = identifyTask.execute(identifyParams).addCallback(function (response) {
                        // response is an array of identify result objects
                        // Let's return an array of features.
                        return array.map(response, function (result) {
                            var feature = result.feature;
                            var layerName = result.layerName;
                            feature.attributes.layerName = layerName;
    
                            var infoTemplate = new InfoTemplate();
                            infoTemplate.setTitle('<b>' + layerName + '</b>');
                            var template = "<table class='infoWindowTable'>", attr = null;
                            for (attr in feature.attributes) {
                                if (String(attr).toLowerCase() !== 'shape' && String(attr).toLowerCase() !== 'layername')
                                    template += "<tr><td class='name'>" + attr + "</td><td class='value'>${" + attr + "}</td></tr>";
                            };
                            
                            template += "</table>";
                            infoTemplate.setContent(template);
                            feature.setInfoTemplate(infoTemplate);
    
                            //console.log(feature);
                            return feature;
                        });
                    });
    
                    return deferred;
                    }
                
                return null;
            }
        });
});
