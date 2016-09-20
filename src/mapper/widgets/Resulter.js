define(["dojo/_base/declare", 
    "dojo/_base/lang", 
    "dijit/_WidgetBase", 
    "dijit/layout/TabContainer", 
    "dijit/layout/ContentPane", 
    "dojox/grid/DataGrid", 
    "dojo/data/ItemFileReadStore", 
    "dijit/registry", 
    "esri/symbols/SimpleMarkerSymbol", 
    "esri/symbols/SimpleLineSymbol", 
    "esri/symbols/SimpleFillSymbol", 
    "esri/layers/GraphicsLayer", 
    "esri/graphic", 
    "dojo/_base/Color", 
    "esri/renderers/jsonUtils",
    "esri/geometry/jsonUtils",
    "dojo/Deferred",
    "esri/request",
    "esri/urlUtils"], 
    
    function(declare, lang, _WidgetBase, TabContainer, ContentPane, DataGrid, ItemFileReadStore, 
    	registry, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, GraphicsLayer, Graphic, 
    	Color, symJsonUtils, geomJsonUtils, Deferred, esriRequest, urlUtils) {

    //symbology for graphics
    var markerSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 10, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 1), new Color([0, 255, 0, 0.25]));

    var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASH, new Color([255, 0, 0]), 3);

    var polygonSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NONE, new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.25]));

    var _MapResultContent = declare([ContentPane], {

        constructor : function(opts) {
            this.inherited(arguments);
            this.title = opts.title || "Results " + String(opts.id);
            this.closable = opts.closable || true;
            this._map = opts.map;
            this._renderer = opts.renderer || null;
        
            this._gLayer = new GraphicsLayer();
            this._gLayer.visible = false;
            this._dgrid = null;
            
        },

		setResults : function(features) {

            //lets make sure results is not empty
            if (features.length <= 0) {
                console.log('features array should have atleast 1 value');
                return;
            };

            //examine first result value to find attribute names
            var attributeNames = [];
            for (var attr in features[0].attributes) {
                attributeNames.push({
                    'name' : attr,
                    'field' : attr,
                    'width' : '80px'
                });
            }

            var items = [];
            for (var i = 0; i < features.length; i++) {
                var res = lang.mixin({
                    id : i + 1
                }, features[i].attributes);
                
                items.push(res);
            }
                
            if (this._map != null) {
                if (this._renderer) {
                    this._gLayer.renderer = this._renderer;
                }
                for (var i = 0; i < features.length; i++) {
                    items[i].geom = features[i].geometry;
                    //var graphic = results[i].feature;
                    var graphic = new Graphic();
                    graphic.attributes = features[i].attributes;
                    graphic.geometry = features[i].geometry;
                    if (!this._renderer) {
                        switch (graphic.geometry && graphic.geometry.type) {
                            case "point":
                                graphic.setSymbol(markerSymbol);
                                break;
                            case "polyline":
                                graphic.setSymbol(lineSymbol);
                                break;
                            case "polygon":
                                graphic.setSymbol(polygonSymbol);
                                break;
                        }
                    }
                    this._gLayer.add(graphic);
                }
                this._map.addLayer(this._gLayer);
            }

            //data store setup
            var data = {
                items : items
            };
            var store = new ItemFileReadStore({
                data : data
            });
            var self = this;
            var dgrid = new DataGrid({
                id : "grid" + String(self.id),
                store : store,
                structure : [attributeNames],
                rowSelector : '20px',
                onRowClick : function(e) {
                    if (!self._map) {
                        return false;
                    }
                    var rowIndex = e.rowIndex;
                    var item = this.getItem(rowIndex);
                    var geom = geomJsonUtils.fromJson((item.geom)[0]);
                    if (geom.type == "point") {
                        var zoom = Math.max(18, self._map.getZoom());
                        self._map.centerAndZoom(geom, zoom);
                    } else {
                        var extent = geom.getExtent().expand(2);
                        self._map.setExtent(extent);
                    }
                }
            });
            this.set('content', dgrid);
            this._dgrid = dgrid;
        },

        destroy : function() {
            if (this._map != null)
                this._map.removeLayer(this._gLayer);

            this._dgrid.destroy();
            this.inherited(arguments);
        }
    });

	var getLayerData = function(url, id) {
		var def = new Deferred();
		if (!url || url.length < 1) {
		    def.reject("No url specified");
		    return def;
		}
		
	    var url = urlUtils.urlToObject(url + "/" + id + "?f=json");
	    var requestHandle = esriRequest({
	        "url": url.path,
	        "content": url.query,
	        callbackParamName: 'callback'
	    }, {
	        useProxy: false,
	        usePost: false                
	    });
	    
	    requestHandle.then(function(layerInfo, io) {
	        var layer = {};
	        for (var i = 0, il = layerInfo.fields.length; i < il; i++) {
	            if ((layerInfo.fields[i]).type == "esriFieldTypeOID") {
	                layer.idField = layerInfo.fields[i].name;
	            }
	        }
	        
	        layer.displayField = layerInfo.displayField;
	        layer.geometryType = layerInfo.geometryType;
	        layer.drawingInfo = layerInfo.drawingInfo;
	        layer.fields = layerInfo.fields;
	        
	        def.resolve(layer);
	    }, 
	    function(err) {
	    	console.error(err);
	    	def.reject(null);
	    });
	
	    return def;
	};

    var _resulter = declare('_resulter', [], {

        constructor : function(opts) {
            var _opts = lang.mixin({
                containerId : "tcResults",
                expandoPaneId : "epResults",
                map : null,
                mapId: null
            }, opts || {});
            var contentPaneId = _opts.containerId;
            var expandoPaneId = _opts.expandoPaneId;

            this._tabContainer = new TabContainer({}, contentPaneId);
            this._tabContainer.startup();
            this._numTabs = 0;
            this._expandoPane = registry.byId(expandoPaneId);
            this._expandoPaneTitle = this._expandoPane.get("title");
            //hide the title since we don't want to show it when pane is collapsed
            this._expandoPane.set("title", "");
            
            this._map = _opts.map;
            this._mapId = _opts.mapId;
            this._graphicsLayers = [];
        },

        select : function(indx) {
            var children = this._tabContainer.getChildren();
            if (children.length > indx) {
                this._tabContainer.selectChild(children[indx]);
                children[indx].onShow();
            }
        },

        setRenderer: function(mapServiceUrl, layerId) {
            var def = new Deferred();
            getLayerData(mapServiceUrl, layerId).then(function(layer) {
                var _renderer = null;
                if (layer.hasOwnProperty('drawingInfo') && layer.drawingInfo.hasOwnProperty('renderer')) {
                   _renderer = symJsonUtils.fromJson(layer.drawingInfo.renderer);
                }
                def.resolve(_renderer);
            },
            function(err) {
                console.log(err);
                
                //still resolving since setRenderer may get called with bad url, in that case
                //we will just use default symbology
                def.resolve(null);
            });    
            return def;
        },
        
        //should rename this to setResultGrid
        addMapResults : function(title, results, url, layerId) {
            
            if (this._map == null) {
                var cm = registry.byId(this._mapId);
                if ('_esriMap' in cm) {
                    this._map = cm._esriMap;    
                } else {
                    throw "Resulter could not connect to a map";
                }
            }
            
            title = title || ("Find Results " + this._numTabs > 0 ? " (" + String(this._numTabs) + ")" : "");            
            var rc = new _MapResultContent({
                _id : String(this._numTabs + 1),
                title : title,
                map : this._map
            });

            this._tabContainer.addChild(rc);
            
            var self = this;
            rc.onClose = function() {
                self._tabContainer.removeChild(this);
                this.destroy();
                self._numTabs--;

                if (self._numTabs == 0) {
                    self.hide();
                }
            };

            rc.onShow = function() {
                console.log('tab show', this);
                this._gLayer.setVisibility(true);
            };

            rc.onHide = function() {
                console.log('tab hide', this);
                this._gLayer.setVisibility(false);
            };

            this.setRenderer(url, layerId).then(function(renderer) {
                rc._renderer = renderer;
                rc.setResults(results);    
            }, function() {
                rc.setResults(results);    
            });
            
			
            rc.startup();
			this._numTabs++;
            
            if (this._numTabs === 1) {
                rc._gLayer.visible = true;
            }
        },

        addHtmlResults : function(title, html) {
            var self = this;
            if (this._numTabs > 0) {
                title = title + " (" + String(this._numTabs) + ")";
            }

            var cp = new ContentPane({
                title : title,
                style : "height:125px",
                content : html,
                closable : true
            });

            this._tabContainer.addChild(cp);
            //this._expandoPane.set("title", "");
            //this._tabContainer.selectChild(rc);

            cp.onClose = function() {
                self._tabContainer.removeChild(this);
                self._numTabs--;

                if (self._numTabs == 0) {
                    self.hide();
                }

                this.destroy();
            };

            this._numTabs++;
        },

        destroy : function() {
            this.inherited(arguments);
        },

        show : function() {
            if (!this._expandoPane._showing) {
                this._expandoPane.toggle();
                this._expandoPane.set("title", this._expandoPaneTitle);
            }
        },

        hide : function() {
            if (this._expandoPane._showing) {
                this._expandoPane.toggle();
                this._expandoPane.set("title", "");
            }
        }
    });

    var _instance = null;

    var resulter = declare("mapper.widgets.Resulter", [], {

        constructor : function() {
        },

        getInstance : function(opts) {
            if (!_instance)
                _instance = new _resulter(opts);

            return _instance;
        }
    });

    return new resulter();
    
});
