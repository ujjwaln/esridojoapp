define([
    "dojo/_base/declare", 
    "dijit/_WidgetBase", 
    "dojo/store/Memory", 
    "dojo/store/Observable", 
    "dijit/tree/ObjectStoreModel", 
    "dijit/Tree", 
    "dojo/dom-construct", 
    "dojo/request/script", 
    "dojo/Deferred", 
    "dojo/promise/all", 
    "dojo/on", 
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
    "esri/urlUtils", 
    "mapper/widgets/political_intersections"], 
    
    function(declare, _WidgetBase, Memory, Observable, ObjectStoreModel, Tree, domConstruct, script, Deferred, all, on, 
        GraphicsLayer, Graphic, Color, SimpleFillSymbol, SimpleLineSymbol, Query, QueryTask, jsonUtils, InfoTemplate, registry, 
        esriRequest, urlUtils, PoliticalIntersections) {

    return declare("mapper.widgets.Bookmarks", [_WidgetBase], {

        mapId : "",

        url : "",

        opacity : 0.6,

        postCreate : function() {
            this.inherited(arguments);
            this.graphicsLayer = null;
            this.fillSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, 
                new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 2), 
                new Color([255, 255, 0, 0.25]));
            this.initializedDeferred = new Deferred();
        },

        _setMapIdAttr : function(mapId) {
            this._set("mapId", mapId);
            var cm = registry.byId(this.get("mapId"));
            cm.mapLoadDeferred.then(dojo.hitch(this, function() {
                if (cm._esriMap != null) {
                    this.esriMap = cm._esriMap;
                    this.graphicsLayer = new GraphicsLayer();
                    this.graphicsLayer.opacity = this.get("opacity");
                    this.esriMap.addLayer(this.graphicsLayer);
                    this.initializedDeferred.resolve();
                };
            }));
        },

        _setOpacityAttr : function(opacity) {
            this._set("opacity", opacity);
            if (!!this.graphicsLayer) {
                this.graphicsLayer.opacity = opacity;
            }
        },

        startup : function() {
            var self = this;
            this.initializedDeferred.then(dojo.hitch(this, function() {
                this._getLayers().then(function(layers) {
                    var memoryStore = new Memory({
                        data : layers,
                        getChildren : function(object) {
                            return this.query({
                                parent : object.id
                            });
                        }
                    });
                    
                    // Make the store observable
                    self.memoryStore = Observable(memoryStore);

                    // Create the model
                    var myModel = new ObjectStoreModel({
                        store : self.memoryStore,
                        query : {
                            id : "-1"
                        }
                    });

                    myModel.mayHaveChildren = function(item) {
                        if (item.type == "feature") {
                            return false;
                        }
                        return true;
                    };

                    // Create the Tree.
                    var tree = new Tree({
                        model : myModel,
                        openOnClick : true,
                        showRoot : false,

                        _createTreeNode : function(args) {
                            var treeNode = new Tree._TreeNode(args);
                            if (args.item.type == 'layer') {
                                var legendItem = args.item.legend;
                                var htm = "<div style='width:12px; height:12px; display: inline-block'>" + "<img src='data:" + 
                                        legendItem.contentType + ";base64," + legendItem.imageData + "' style='width:100%;height:100%'/></div>";
                                treeNode.iconNode.innerHTML = htm;
                            }
                            return treeNode;
                        },

                        getIconClass : function(item, opened) {
                            //return "dijitNoIcon";
                            // var iconClass = (!item || this.model.mayHaveChildren(item)) ?
                            // (opened ? "dijitFolderOpened" : "dijitFolderClosed") : "dijitNoIcon";
                            // return iconClass;
                        },

                        getRowClass : function(item, opened) {
                            if (item.type == 'feature')
                                return "bookmark-tree-row-leaf";

                            return "bookmark-tree-row-node";
                        },

                        onOpen : function(layer, node) {
                            console.log("onOpen", layer, node);
                            
                            if (layer.type == "layer" && !layer.populated) {
                                self._queryLayer(layer).then(function(layerData) {
                                    // Layer data will contain features that are sorted by County
                                    var features = layerData.features;
                                    var currentRegionID = 0;
                                    var currentRegionName = "";
                                    var currentRegionItem = null;

                                    for (var i = 0, il = features.length; i < il; i++) {
                                        var feature = features[i];
                                        var attributes = feature.attributes;

                                        if (feature.attributes["County"] != currentRegionName) {
                                            currentRegionName = feature.attributes["County"];
                                            currentRegionID += 1;
                                            currentRegionItem = {
                                                "name" : currentRegionName,
                                                "id" : (1 + layer.id) * 1000 + currentRegionID,
                                                "parent" : layer.id,
                                                "type" : "region"
                                            };
                                            self.memoryStore.add(currentRegionItem);
                                        };

                                        //var graphic = self._getGraphic(feature, layer);
                                        var sym = layer.drawingInfo.renderer.symbol;
                                        var sym1 = jsonUtils.fromJson(sym);
                                        sym = sym1 || self.fillSymbol;
                                        var item = {
                                            "name" : attributes[layer.displayField],
                                            "id" : (1 + layer.id) * 100000 + i,
                                            "parent" : currentRegionItem.id,
                                            "type" : "feature",
                                            "graphic" : feature.setSymbol(sym)
                                        };

                                        self.memoryStore.add(item);
                                    }

                                    layer.populated = true;
                                }, function(error) {
                                    console.error('Could not get layer data for', layer);
                                    layer.populated = false;
                                });
                            }
                        },

                        onClick : function(layer, node) {
                            if (layer.type == "feature") {
                                self.graphicsLayer.clear();
                                self.graphicsLayer.add(layer.graphic);
                                self.esriMap.setExtent(layer.graphic.geometry.getExtent().expand(2));

                                var infoTemplate = new InfoTemplate();
                                var geom = layer.graphic.geometry;
                                infoTemplate.setTitle(layer.name);

                                infoTemplate.setContent(function(graphic) {
                                    var map = self.esriMap;
                                    return self._getInfoTemplateContent(graphic, map);
                                });

                                self.graphicsLayer.infoTemplate = infoTemplate;
                            }
                        }
                    });

                    tree.placeAt(self.domNode);

                    tree.expandAll();
                });
            }));
        },

        // Get menu items corresponding to layer names in the Bookmarks MapService
        // such as Autoloops, Networks, Substation etc
        _getLayers : function() {
            var def = new Deferred();
            var layers = [];
            var url = urlUtils.urlToObject(this.url + "/legend?f=json");
            var requestHandle = esriRequest({
                "url" : url.path,
                "content" : url.query,
                callbackParamName : 'callback'
            }, {
                useProxy : false,
                usePost : false
            });
            requestHandle.then(function(data, io) {
                layers.push({
                        "name" : "Bookmarks",
                        "id" : "-1",
                        "parent" : "-2",
                        "type" : "root"
                });
                for (var i = 0, il = data.layers.length; i < il; i++) {
                    layers.push({
                        "name" : data.layers[i].layerName,
                        "id" : data.layers[i].layerId,
                        "parent" : "-1",
                        "type" : "layer",
                        "displayField" : "",
                        "populated" : false,
                        "geometryType" : null,
                        "drawingInfo" : null,
                        "legend" : data.layers[i].legend[0]
                    });
                }
                
                def.resolve(layers);
                
            }, function(error, io) {
                def.reject(error);
            });

            return def;
        },

        _getLayerData: function(layer) {
            var def = new Deferred();
            var url = urlUtils.urlToObject(this.url + "/" + layer.id + "?f=json");
            var requestHandle = esriRequest({
                "url" : url.path,
                "content" : url.query,
                callbackParamName : 'callback'
            }, {
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

                def.resolve();
            });
            return def;
        },
        
        _getLayerFeatures : function(layer) {
            var def = new Deferred();
            var parts = this.url.split("MapServer");
            var queryUrl = this.url + "/" + layer.id;
            var queryTask = new QueryTask(queryUrl);

            //build query filter
            var query = new Query();
            query.returnGeometry = true;
            //query.outFields = ["County", layer.displayField];
            query.outFields = ['*'];
            query.orderByFields = ["County", layer.displayField];
            query.outSpatialReference = this.esriMap.spatialReference;
            query.where = (layer.idField || "OBJECTID") + " > 0";

            //Can listen for complete event to process results
            //or can use the callback option in the queryTask.execute method.
            queryTask.on("complete", function(event) {
                var fset = event.featureSet;
                def.resolve(fset);
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
