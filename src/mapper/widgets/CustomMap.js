/**
 * @author narayanu
 */

define([
    "dojo/_base/declare", 
    "dojo/_base/lang", 
    "dojo/Deferred", 
    "dijit/_WidgetBase", 
    "dijit/_TemplatedMixin", 
    "dijit/_WidgetsInTemplateMixin", 
    "esri/map", 
    "esri/layers/ArcGISTiledMapServiceLayer", 
    "esri/layers/ArcGISDynamicMapServiceLayer", 
    "mapper/utils/dom-tools", 
    "dojo/dom-construct", 
    "esri/IdentityManager", 
    "dojo/promise/all", 
    "dojo/Evented",
    "dojo/text!mapper/widgets/templates/CustomMapTmpl.html"],
    
    function(declare, lang, Deferred, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Map, 
        ArcGISTiledMapServiceLayer, ArcGISDynamicMapServiceLayer, domTools, domConstruct, 
        IdentityManager, all, Evented, customMapTmpl) {

    return declare("mapper.widgets.CustomMap", [_WidgetBase, _TemplatedMixin, Evented], {

        templateString: customMapTmpl,
        loading: false,
        dynamicMapServices: [],
        visibleLayerIds: null,
        scale: 0,
        zoom: 11,
        center:[-73, 40.73],
        logo : false,
        sliderOrientation : 'vertical',
        sliderPosition : 'bottom-left',
        isClickRecenter : false,
        displayGraphicsOnPan : true,
        showAttribution : false,
        sliderPosition: "top-left",
        autoResize: true,
        fitExtent: true,
        
        postCreate : function() {
            this.inherited(arguments);
            
            this.mapLoadDeferred = new Deferred();
            this.mapResizedDeferred = new Deferred();
            this._initialExtent = null;
            this._firstBasemapLoadHandler = null;
            this._esriMap = null;
            this.dynamicLayerObjects = [];
            this._customClickHandlers = [];
            this._currentBasemap = null;
            
            //give the mapNode div an ID since esri/map widget requires it
            domTools.getInstance().setNodeId(this.mapNode);
        },

        startup : function() {
            this.inherited(arguments);
            
            this._createEsriMap();
        },

        _createEsriMap : function() {
            
            if (!this._esriMap) {
 
                var esriOpts = {
                    logo : this.get("logo"),
                    sliderOrientation : this.get("sliderOrientation"),
                    sliderPosition : this.get("sliderPosition"),
                    isClickRecenter : this.get("isClickRecenter"),
                    displayGraphicsOnPan : this.get("displayGraphicsOnPan"),
                    showAttribution : this.get("showAttribution"),
                    sliderPosition: this.get("sliderPosition"),
                    autoResize: this.get("autoResize"),
                    fitExtent: this.get("fitExtent"),
                    center: this.get("center"),
                    zoom: this.get("zoom")
                };

                //create the esri map widget
                this._esriMap = new Map(this.mapNode.id, esriOpts);

                //initial load handler for the esri map widget
                this._esriMap.on('load', dojo.hitch(this, function() {
                    //console.log("map load " + this._esriMap.getScale());
                    //resolve mopLoadDeferred
                    this.mapLoadDeferred.resolve();
                }));

                //esri map basemap change event
                this._esriMap.on('basemap-change', dojo.hitch(this, function(obj) {
                	console.log('basemap-change');
                }));
                
                this._esriMap.on("zoom-end", dojo.hitch(this,function() {
                    this.set("scale", this._esriMap.getScale());
                    console.log("scale", this._esriMap.getScale());
                }));

				this._esriMap.on("update-start", dojo.hitch(this,function() {
					this.set("loading", true);
				}));
				
				this._esriMap.on("update-end", dojo.hitch(this,function() {
                    this.set("loading", false);
                }));

                this._firstBasemapLoadHandler = this._esriMap.on('layer-add-result', 
                    dojo.hitch(this, function(obj) {
                        this._firstBasemapLoadHandler.remove();
	                    this._firstBasemapLoadHandler = null;
	                    console.log("firstBasemapLoadHandler", this.opts);
	                    //this._esriMap.centerAndZoom(this.opts.center, this.opts.zoom);
	                    this._createDynamicMapServices();
                }));
            }
        },

        //summary:
        //      setBasemap is called by BasemapToggler, 
        //      TODO: convert into property
        setBasemap : function(basemap) {
            //basemap types: "cachedmapservice", "google", "arcgisonline"
            this._checkSpatialReference(basemap);
            this._unsetPreviousBasemaps(this._esriMap);

            switch (basemap.type.toLowerCase()) {
                case "cachedmapservice":
                    var layer = new ArcGISTiledMapServiceLayer(basemap.layer);
                    this._esriMap.addLayer(layer, 0);
                    this._currentBasemap = layer;
                    break;

                case "google":
                    this._esriMap.addLayer(basemap.layer, 0);
                    this._currentBasemap = basemap.layer;
                    break;

                case "arcgisonline":
                    this._esriMap.setBasemap(basemap.layer);
                    this._currentBasemap = basemap.layer;
                    break;

                case "bing":
                    var addedlayer = this._esriMap.addLayer(basemap.layer, 0);
                    this._currentBasemap = basemap.layer;
                    break;
                
                default:
                    console.error(basemap.type + " is not known to CustomMap widget");
            }
            
            //this._esriMap.emit("load", {});
        },

        _setLoadingAttr : function(loading) {
            this._set("loading", loading);
            if (loading) {
                domTools.getInstance().setStyle(this.loadingNode, "display", "");
            } else {
                domTools.getInstance().setStyle(this.loadingNode, "display", "none");
            }
        },
        
        _setScaleAttr: function(scale) {
          //var oldScale = this.get("scale");
          this._set("scale", scale);
          this.emit("scale-change", {
             bubbles: false,
             cancelable: false,
             scale: scale 
          });
          
          //console.log("Scale changed from " + oldScale + " to " + scale);
        },

        _basemapChangedHandler : function(obj) {
            var current = obj.current, previous = obj.previous;

            if (current.hasOwnProperty('layers') && current.layers[0].hasOwnProperty('scales')) {
                var basemapMinScale = current.layers[0].scales[current.layers[0].scales.length - 1];
                if (this._esriMap.getScale() < basemapMinScale) {
                    this.set("loading", true);
                    var self = this;
                    this._esriMap.setScale(basemapMinScale).then(function() {
                        console.log("changed map scale to match basemap scale");
                        self.set("loading", false);
                    }, function(error) {
                        console.error(error);
                        self.set("loading", false);
                    });
                };
            }
        },

        _checkSpatialReference : function(basemap) {
            if (!this._esriMap.hasOwnProperty("spatialReference")) {
                this._esriMap.spatialReference = basemap.spatialReference;
            }

            if (basemap.hasOwnProperty('spatialReference') && basemap.spatialReference.hasOwnProperty('wkid')) {
                if (basemap.spatialReference.wkid != this._esriMap.spatialReference.wkid) {
                    alert("Basemap has different spatial reference than the map, cannot change");
                }
            }
        },

        _createDynamicMapServices : function() {
            var def = new Deferred();
            var promises = [];

            for (var i = 0; i < this.dynamicMapServices.length; i++) {
                var url = this.dynamicMapServices[i].url;
                var label = this.dynamicMapServices[i].alias || 'Layer ' + String(i);
                var promise = this._addDynamicMapService(url, label);
                promises.push(promise);
            };

            var self = this;
            all(promises).then(function() {
                self._esriMap.setExtent(self._initialExtent).then(function() {
                    self.set("scale", self._esriMap.getScale());    
                    def.resolve();
                }, function(error) {
                    //extent may not have been set correctly, if self._initialExtent was not in 
                    //map's spatial reference
                    self.set("scale", self._esriMap.getScale());
                    console.error(error);
                    def.resolve();    
                });
                
            }, function(err) {
                console.log(err);
                def.reject();
            });

            return def;
        },

        //summary:
        //      unsetPreviousBasemaps removes all basemaps currently active in the map
        //      basemaps are identified by the property _basemapGalleryLayerType set
        //      to "basemap" or "reference" or by the declaredClass attribute
        _unsetPreviousBasemaps : function(map) {
            //make a copy of current map layerIds
            var layerIds = [];
            for (var i = 0, il = map.layerIds.length; i < il; i++) {
                layerIds.push(map.layerIds[i]);
            }

            for (var i = 0, il = layerIds.length; i < il; i++) {
                var layer = map.getLayer(layerIds[i]);
                if ((layer != null) && 
                       (layer._basemapGalleryLayerType == "basemap" || 
                        layer._basemapGalleryLayerType == "reference" ||
                        layer.declaredClass == "esri.layers.ArcGISTiledMapServiceLayer" ||
                        layer.declaredClass == "esri.virtualearth.VETiledLayer"
                        //if we are only adding google basemaps,
                        //one arcgis basemap still gets addded to the gallery
                        //this basemap doesn't get the _basemapGalleryLayerType reference
                        //set since it select hasn't been called yet
                        || layerIds.length == 1)
                    ) 
                {
                    map.removeLayer(layer);
                }
            }
        },

        _addDynamicMapService : function(url, label) {
            var def = new Deferred();
            var lyr = new ArcGISDynamicMapServiceLayer(url);
            var self = this;

            //!! lyr.loaded check is required for ID. If page is reloaded, lyr.loaded
            //is set to true instantly. In that case 'load' event is never fired
            if (lyr.loaded) {
                //self.setInitalExtentFromLayerExtent(lyr);
                console.log('addDynamicMapService', lyr);
                this.dynamicLayerObjects.push({
                    label: label,
                    layer: lyr
                });
                
                def.resolve(lyr);
            }

            lyr.on('load', dojo.hitch(this, function() {
                this.dynamicLayerObjects.push({
                    label: label,
                    layer: lyr
                });
                
                //self.setInitalExtentFromLayerExtent(lyr);
                console.log('addDynamicMapService', lyr);
                
                this.emit("dynamiclayeradded", {
                    bubbles : true,
                    cancelable : true,
                    layer : lyr,
                    label: label
                });
                
                this._setInitialExtentFromLayerExtent(lyr);
                console.log("Set map scale to make sure Toc renders with correct layers disabled");
                
                this.set("scale", this._esriMap.getScale());
                def.resolve();
            }));

            lyr.on('error', function(err) {
                alert('There was an error in loading layer ' + label + '. Please check token ');
                console.error(err);
                def.reject();
            });
            
            this._esriMap.addLayer(lyr);
            return def;
        },

        _setVisibleLayerIdsAttr: function(objs) {
            for (var i=0, il=objs.length; i<il; i++) {
                var layerId = objs[i].layerId;
                var visibleIds = objs[i].visibleLayerIds;
                console.log("setting visibility", layerId, visibleIds);
                
                var dynamicMapServiceLayer = this._esriMap.getLayer(layerId);
                if (visibleIds.length === 0) {
                    dynamicMapServiceLayer.setVisibleLayers([-1]);
                } else {
                    dynamicMapServiceLayer.setVisibleLayers(visibleIds);    
                }
            }
            
            //layer selectors can update themeselves using this event
            this.emit("visible-layer-ids-changed", {data: objs});
        },
        
        _setInitialExtentFromLayerExtent: function(lyr) {
            var initExtent = lyr.initialExtent;
            var fullExtent = lyr.fullExtent;
            var lyrExtent = null;
            
            //if fullExtent is defined give it priority
            lyrExtent = initExtent;
            if (initExtent) {
                lyrExtent = fullExtent;
            } 
            
            if (lyrExtent) {
                if (this._initialExtent) {
                    this._initialExtent.union(lyrExtent);    
                    //console.log('Current Extent Union: ', this._initialExtent, lyrExtent);
                }
                else {
                    this._initialExtent = lyrExtent;
                    //console.log('Current Extent Assigned: ', this._initialExtent, lyrExtent);
                }
            }
        },
        
        removeLayer : function(lyr_id) {
            this._esriMap.removeLayer(lyr_id);
            var idx = this.dynamicLayerIds.indexOf(lyr_id);
            this.dynamicLayerIds.splice(idx, 1);
            delete this.dynamicLayers[lyr.id];

            topic.publish("widgets.map.map.dynamic-layer-remove", {
                id : lyr.id
            });
        },

        //summary:
        //      resize is really important. it is called before the map is created
        //      by the ContentPane that contains the map,
        resize : function() {
            var width = domTools.getInstance().getStyle(this.containerNode, "width");
            var height = domTools.getInstance().getStyle(this.containerNode, "height");

            domTools.getInstance().setStyle(this.mapNode, "width", String(width) + "px");
            domTools.getInstance().setStyle(this.mapNode, "height", String(height) + "px");

            if (this._esriMap.layerIds.length > 0) {
            	this._esriMap.resize();
            }
                
           console.log("Custom map resized");     
           this.mapResizedDeferred.resolve();
        },
        
        //used by various toolbars to get exclusive rights to
        //the map click event
        addCustomClickHandler: function(handler) {
            this._customClickHandlers.push(handler);
        },
        
        removeClickHandlers: function(){
           var handles = this._customClickHandlers;
           for (var i=0; i<handles.length; i++) {
               dojo.disconnect(handles[i]);
           }
        },
        
        setBasemapOpacity: function(opacity) {
            console.log("opacity", opacity);            
            //make a copy of current map layerIds
            var layerIds = [];
            for (var i = 0, il = this._esriMap.layerIds.length; i < il; i++) {
                layerIds.push(this._esriMap.layerIds[i]);
            }

            for (var i = 0, il = layerIds.length; i < il; i++) {
                var layer = this._esriMap.getLayer(layerIds[i]);
                if ((layer != null) && 
                       (layer._basemapGalleryLayerType == "basemap" || 
                        layer._basemapGalleryLayerType == "reference" ||
                        layer.declaredClass == "esri.layers.ArcGISTiledMapServiceLayer" ||
                        layer.declaredClass == "esri.virtualearth.VETiledLayer"
                        || layerIds.length == 1)
                    ) 
                {
                    if (layer.opacity !== undefined || layer.opacity !== null) {
                        layer.opacity = opacity;
                        this._esriMap.removeLayer(layer);
                        this._esriMap.addLayer(layer, 0);
                    }
                }
            }
        }
    });
});

