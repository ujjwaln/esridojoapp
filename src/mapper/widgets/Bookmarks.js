define([
    "dojo/_base/declare", 
    "dojo/store/Memory", 
    "dojo/store/Observable", 
    "dijit/tree/ObjectStoreModel", 
    "dijit/Tree", 
    "dojo/dom-construct",
    "dojo/dom-class",
    "dojo/request/script", 
    "dojo/Deferred", 
    "dojo/promise/all", 
    "dojo/on",
    "dojo/Evented",
    "esri/layers/GraphicsLayer", 
    "esri/graphic", 
    "esri/Color", 
    "esri/symbols/SimpleFillSymbol", 
    "esri/symbols/SimpleLineSymbol", 
    "esri/tasks/query", 
    "esri/tasks/QueryTask", 
    "esri/symbols/jsonUtils", 
    "esri/InfoTemplate", 
    "dijit/registry", 
    "esri/request",
    "esri/urlUtils"], 
    
    function(declare, Memory, Observable, ObjectStoreModel, Tree, domConstruct, domClass, script, Deferred, all, on, 
        Evented, GraphicsLayer, Graphic, Color, SimpleFillSymbol, SimpleLineSymbol, Query, QueryTask, jsonUtils, 
        InfoTemplate, registry, esriRequest, urlUtils) {
    
    var BusyTreeNode = declare("mapper.widgets.BusyTreeNode", [Tree._TreeNode], {
        
        busy: false,
        
        constructor: function() {
            this.inherited(arguments);
        },
        
        _setBusyAttr: function(busy) {
            this._set("busy", busy);
            if (busy) {
                this.busyNode = domConstruct.toDom("<span class='busy-node-loading dijitInline'></span>");
                domConstruct.place(this.busyNode, this.rowNode, "last");
            } else {
                domConstruct.destroy(this.busyNode);
            }
        }
    });
    
    return declare("mapper.widgets.Bookmarks", [Tree, Evented], {

        mapId : "",

        url : "",

        opacity : 0.5,

        openOnClick : true,
        
        showRoot : true,
        
        maxFeaturesPerLayer: 100,
        
        ddButtonId: null,
    
        drawOwnGraphics: true,
         
        _createTreeNode : function(args) {
            return new BusyTreeNode(args);
        },
        
        getIconClass : function(item, opened) {
            //return "dijitNoIcon";
            var iconClass = (!item || this.model.mayHaveChildren(item)) ?
            (opened ? "dijitFolderOpened" : "dijitFolderClosed") : "dijitNoIcon";
            return iconClass;
        },

        getRowClass : function(item, opened) {
            if (item.type == 'feature')
                return "bookmark-tree-row-leaf";

            return "bookmark-tree-row-node";
        },

        onOpen : function(layer, node) {
            if (layer.type == "layer" && !layer.populated) {
                node.set("busy", true);
                this._getLayerFeatures(layer).then(function() {
                    node.set("busy", false);
                }, function(err) {
                    node.set("busy", false);
                });
            }
        },

        onClick : function(item, node) {
            var self = this;
            if (item.type == "feature") {
                if (!item.populated) {
                    self._getFeatureData(item).then(function() {
                        self._showGraphic(item.graphic, item.name);
                    });
                } 
                else {
                    self._showGraphic(item);
                }
                
                if (this.ddButton != null) {
                   this.ddButton.toggleDropDown();
                }
            }
        },
        
        _showGraphic: function(gr, title) {
            
            var infoTemplate = new InfoTemplate();
            var geom = gr.geometry;
            infoTemplate.setTitle(title);
            
            var self = this;
            infoTemplate.setContent(function(g) {
                var map = self.esriMap;
                return self._getInfoTemplateContent(g, map);
            });
            
            gr.infoTemplate = infoTemplate;
            
            if (this.get("drawOwnGraphics")) {
                this.graphicsLayer.clear();
                this.graphicsLayer.add(gr);
                
                if (gr.geometry.type == "point") {
                    this.esriMap.centerAndZoom(gr.geometry, 14);            
    
                } else {
                    this.esriMap.setExtent(gr.geometry.getExtent().expand(2));            
                }
                
                //self.graphicsLayer.infoTemplate = infoTemplate;    
            } 
            
            this.emit("graphic-change", {
                bubbles: true,
                cancelable: true,
                graphic: gr,
                title: title 
            });
        },
        
        postCreate : function() {
            var rootNode = {
                "name" : "Bookmarks",
                "id" : "-1",
                "parent" : "-2",
                "type" : "root"
            };
            
            var store = new Memory({
                data : [rootNode],
                getChildren : function(object) {
                    return this.query({
                        parent : object.id
                    });
                },
                idProperty: "id"
            });
            
            // Create the model
            var myModel = new ObjectStoreModel({
                store : Observable(store),
                query : {
                    id : "-1"
                },
                labelAttr : "name",
                labelType : "text"
            });
            
            var self = this;
            myModel.mayHaveChildren = function(item) {
                if (item.type == "feature") {
                    return false;
                }
                return true;
            };
            this.set("model", myModel);
            this.inherited(arguments); //important
        },

        startup : function() {
            this.inherited(arguments);
            this._populateGroupsAndLayers();
            
            //only create graphics layer if mapId has been supplied,
            //otherwise we will just emit an event with selected graphic
            //and leave the drawing to someone else
            this.esriMap = null;
            var mapId = this.get("mapId");
            if (!!mapId) {
                var cm = registry.byId(mapId);
                if (cm) {
                    cm.mapLoadDeferred.then(dojo.hitch(this, function() {
                        if (cm._esriMap != null) {
                            this.esriMap = cm._esriMap;
                            if (this.get("drawOwnGraphics")) {
                                this.graphicsLayer = new GraphicsLayer();
                                this.graphicsLayer.opacity = this.get("opacity");
                                this.esriMap.addLayer(this.graphicsLayer);                                
                            }
                        };
                    }));    
                }
            }
            
            //check if the bookmark widget has a dialogId specified. In this case
            //autoclose the dialog when the bookmark feature is clicked
            this.ddButton = null;
            if (this.get("ddButtonId") != null) {
                this.ddButton = registry.byId(this.get("ddButtonId"));
            }
        },
        
        // Get menu items corresponding to layer names in the Bookmarks MapService
        // such as Autoloops, Networks, Substation etc
        _populateGroupsAndLayers: function() {
            //tree should be updated via its datastore
            var store = this.get("model").store;
            var def = new Deferred();
            var url = urlUtils.urlToObject(this.get('url') + "?f=json");
            var requestHandle = esriRequest({
                "url" : url.path,
                "content" : url.query,
                callbackParamName : 'callback'
            }, {
                useProxy : false,
                usePost : false
            });
            
            var self = this;
            requestHandle.then(function(data, io) {
                for (var i = 0, il = data.layers.length; i < il; i++) {
                    
                    var item = {
                        "name" : data.layers[i].name,
                        "id" : data.layers[i].id,
                        "parent" : data.layers[i].parentLayerId,
                        "subLayerIds": data.layers[i].subLayerIds || [],
                        "type": data.layers[i].subLayerIds && data.layers[i].subLayerIds.length > 0 ? "group" : "layer",
                        "displayField" : "",
                        "populated" : false,
                        "geometryType" : null,
                        "drawingInfo" : null
                    };
                    
                    if (item.subLayerIds.length > 0) {
                        store.add(item);
                    } 
                    else {
                        self._getLayerData(item).then(function(layer) {
                            store.add(layer); 
                        });
                    }
                    
                }
                def.resolve();
            }, 
            function(error, io) {
                def.reject(error);
            });

            return def;
        },

        _getLayerData: function(layer) {
            var def = new Deferred();
            var url = urlUtils.urlToObject(this.get("url") + "/" + layer.id + "?f=json");
            var requestHandle = esriRequest({
                "url" : url.path,
                "content" : url.query,
                callbackParamName : 'callback'
            }, 
            {
                useProxy : false,
                usePost : false
            });
            requestHandle.then(function(layerInfo, io) {
                layer.displayField = layerInfo.displayField;
                var fields = layerInfo.fields;
                for (var i = 0, il = fields.length; i < il; i++) {
                    if ((fields[i]).type == "esriFieldTypeOID") {
                        layer.idField = fields[i].name;
                    }
                }
                layer.geometryType = layerInfo.geometryType;
                layer.drawingInfo = layerInfo.drawingInfo;
                def.resolve(layer);
            });
            return def;
        },
        
        //_getLayerFeatures will not return geometry because IE has 
        //trouble parsing a lot of geometry data
        _getLayerFeatures : function(layer) {
            var def = new Deferred();
            var queryUrl = this.get("url") + "/" + layer.id;
            var queryTask = new esri.tasks.QueryTask(queryUrl);            
            var query = new esri.tasks.Query();
            query.returnGeometry = false;
            query.outFields = [layer.idField, layer.displayField];
            
            if (this.esriMap != null) {
                query.outSpatialReference = this.esriMap.spatialReference;
            }
            query.where = (layer.idField || "OBJECTID") + " > 0";

            var self = this;
            queryTask.on("complete", function(event) {
                var features = event.featureSet.features;
                if (!features || !features.length) {
                    def.resolve();
                    return;
                }
                
                var store = self.get("model").store;
                for (var i=0, il=Math.min(features.length, self.get("maxFeaturesPerLayer")); i<il; i++) {
                    try {
                        var item = {
                            "id": String(layer.id) + "_" + String(features[i].attributes[layer.idField]),
                            "name": features[i].attributes[layer.displayField],
                            "parent": layer.id,
                            "type": "feature",
                            "populated": false,
                            "layer": layer,
                            "objectId": features[i].attributes[layer.idField]
                        };
                        store.add(item);
                    } 
                    catch (ex) {
                        console.error("Error while inserting feature", ex);
                        console.error(features[i]);
                    }
                }
                
                layer.populated = true;
                def.resolve();
            });

            queryTask.on("error", function(error) {
                console.log('error in queryTask', error);
                def.reject(error);
            });

            queryTask.execute(query);
            return def;
        },

        _getFeatureData : function(item) {
            var def = new Deferred();
            var queryUrl = this.get("url") + "/" + item.layer.id;
            var queryTask = new esri.tasks.QueryTask(queryUrl);
            
            //build query filter
            var query = new esri.tasks.Query();
            query.returnGeometry = true;
            query.outFields = ['*'];
            if (this.esriMap != null) {
                query.outSpatialReference = this.esriMap.spatialReference;
            }
            query.where = (item.layer.idField || "OBJECTID") + " = " + String(item.objectId);

            var self = this;
            queryTask.on("complete", function(event) {
                var features = event.featureSet.features;
                if (!features || !features.length) {
                    def.resolve();
                    return;
                }
                
                var store = self.get("model").store;
                var feature = features[0];
                
                item.geometry = feature.geometry;
                var parentItem = item.layer;
                var sym;
                if (parentItem.hasOwnProperty("drawingInfo")) {
                    var symJson = parentItem.drawingInfo.renderer.symbol;
                    sym = jsonUtils.fromJson(symJson);
                };
                var graphic = new Graphic(feature.geometry, sym, feature.attributes);
                item.graphic = graphic;
                item.populated = true;
                store.put(item);
               
                def.resolve();
            });

            queryTask.on("error", function(error) {
                console.log('error in queryTask', error);
                def.reject(error);
            });

            queryTask.execute(query);
            return def;
        },
        
        _getInfoTemplateContent : function(graphic, map, token) {
            var htm = "<table class='bookmarks-popup-table'>";
            var attrs = graphic.attributes;

            for (key in attrs) {
                if (key.indexOf('shape') == -1)
                    htm = htm + "<tr><td><b>" + key + "</b></td><td>" + attrs[key] + "</td></tr>";
            }
            htm += "</table>";

            var infoTemplateContentNode = domConstruct.toDom("<div class='info-template-root'></div>");
            var infoTemplateContentLink1 = domConstruct.create('a', {
                innerHTML : "Political Jurisdictions (Map)",
                style : {
                    cursor : "pointer",
                    display : "block"
                }
            }, infoTemplateContentNode, "only");

            var infoTemplateContentLink2 = domConstruct.create('a', {
                innerHTML : "Political Jurisdictions (csv)",
                style : {
                    cursor : "pointer",
                    display : "block"
                }
            }, infoTemplateContentNode, 1);

            on(infoTemplateContentLink1, 'click', function() {
                var poljuris = new PoliticalIntersections({
                    map : map,
                    outputFormat : "features"
                });
                poljuris.execute(graphic);
            });

            on(infoTemplateContentLink2, 'click', function() {
                var poljuris = new PoliticalIntersections({
                    outputFormat : "csv"
                });
                poljuris.execute(graphic);
            });

            var infoTemplateContentTable = domConstruct.toDom(htm);
            domConstruct.place(infoTemplateContentTable, infoTemplateContentNode, 2);

            return infoTemplateContentNode;
        }
    });
});
