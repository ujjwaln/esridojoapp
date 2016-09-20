/**
 * @author narayanu
 */

define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom-construct",
    "dojo/dom-class",
    "dojo/_base/array",
    "dijit/form/DropDownButton",
    "esri/tasks/IdentifyTask",
    "esri/tasks/IdentifyParameters",
    "mapper/widgets/LayerSelectorTree",
    "esri/InfoTemplate",
    "dijit/registry"], 
    
    function(declare, lang, domConstruct, domClass, array, DropDownButton, 
        IdentifyTask, IdentifyParameters, LayerSelectorTree, InfoTemplate, registry) {

        return  declare('mapper.widgets.maptools.Identify', [DropDownButton], {

            tocId: null,
            
            mapId: null,
        
            iconClass: "identifyIcon",

            identifying: false,
            
            dropdownshown: false,
                    
            constructor: function (opts, srcRefNode) {
                lang.mixin(this, opts);
                this.domNode = srcRefNode;
                this.layerSelector = null;
                this.mapClickHandler = null;
            },

            postCreate: function () {
                this.inherited(arguments);
            },

            startup: function() {
                this.inherited(arguments);
                this.layerSelector = new LayerSelectorTree({mapId: this.get("mapId")});
                this.layerSelector.startup();
                
                this.set("dropDown", this.layerSelector);
                
                //this onBlur is firing when layer selector closes automatically
                //after mouse leave.
                this.onBlur = dojo.hitch(this, function() {
                    this.set("dropdownshown", false);
                });
                
                this.onClick = dojo.hitch(this, function(ev) {
                    
                    var identifying = this.get("identifying");
                    this.set("identifying", !identifying);
                    
                    var ddshown = this.get("dropdownshown");
                    this.set("dropdownshown", !ddshown);
                    
                    if (this.get("dropdownshown")) {
                        this.openDropDown();
                        this.connectMapClickHandler();
                        domClass.add(this, ["dijitDropDownButtonHover", "dijitHover"]);
                    }
                    else {
                        this.closeDropDown();
                        this.disConnectMapClickHandler();
                        domClass.remove(this, ["dijitDropDownButtonHover", "dijitHover"]);
                    }
                    
                    ev.preventDefault();
                    ev.stopPropagation();
                });
            },

            connectMapClickHandler: function() {
                var customMap = registry.byId(this.get("mapId"));
                var self = this;
                customMap.mapLoadDeferred.then(function() {
                    if ('_esriMap' in customMap) {
                        var esriMap = customMap._esriMap;
                        self.mapClickHandler = esriMap.on("click", function(mapEvent) {
                            self._doIdentify(esriMap, mapEvent);
                        });
                        
                    } else {
                        console.error("Identify tool cannot connect to map");
                        console.log(customMap);
                    }
                });
            },
            
            disConnectMapClickHandler: function() {
                if (this.mapClickHandler != null) {
                    this.mapClickHandler.remove();
                }
            },
            
            _doIdentify: function (map, ev) {
                var identifyDeferred = this._getIdentifyDeferred(map, ev);
                map.infoWindow.setFeatures([identifyDeferred]);
                map.infoWindow.show(ev.mapPoint);
            },

            _getIdentifyDeferred: function (map, map_event) {
                //grab selections from the 
                var mapServiceId = this.layerSelector.selectedMapService.id;
                var layerIds = this.layerSelector.selectedLayerIds;
                
                var identifyUrl = map.getLayer(mapServiceId).url;
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
        });
});
