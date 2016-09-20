define(["dojo/_base/declare", "dojo/_base/lang", "dojo/on", "dojo/store/Memory", "dojo/store/Observable", "dojo/dom-construct", "dijit/registry", "dijit/Tree", "dijit/_WidgetBase", "dijit/tree/ObjectStoreModel", "mapper/widgets/_TocTreeNode", "esri/request", "esri/urlUtils", "dojo/Deferred", "dojo/promise/all", "dojo/_base/json"], function(declare, lang, on, Memory, Observable, domConstruct, registry, Tree, _WidgetBase, ObjectStoreModel, _TocTreeNode, esriRequest, urlUtils, Deferred, all, dojoJson) {

    var _Toc = declare("mapper.widgets._Toc", [Tree], {

        layerInfos : null,

        scale : 0,

        rootExpanded : false,
/*
        _setRootExpandedAttr : function(val) {
            this._set("expandRootNode", val);
            if (val) {
                var rootItem = this.memStore.get(-1);
                if (rootItem) {
                    var rootNode = this.getNodesByItem(rootItem);
                    if (!rootNode[0].isExpanded) {
                        this._expandNode(rootNode[0]);
                    }
                }
            }
        },
*/
        postCreate: function() {
            this.inherited(arguments);
            
            var rootNode = {
                id : -2,
                parent : "fake",
                name : "Layers",
                layerInfo : null,
                hasSubLayers : true,
                disabled : false,
                legend : null,
                visibility : true,
                minScale : 0,
                maxScale : 0,
                expandable : true
            };
            
            this.memStore = new Memory({
                data : [rootNode],
                getChildren : function(object) {
                    return this.query({
                        parent : object.id
                    });
                },
                idProperty : "id"
            });
            
            this.observableMemStore = new Observable(this.memStore);
            
            var objectStoreModel = new ObjectStoreModel({
                store : this.observableMemStore,
                query : {
                    id : -2
                },
                labelAttr : "name",
                labelType : "text",
                mayHaveChildren : function(item) {
                    //console.log(item);
                    return item.expandable;
                }
            });
            
            this.set('model', objectStoreModel);
            this.set('showRoot', false);
            this.dataLoaded = new Deferred();
        },
        
        startup : function() {
            this.inherited(arguments);

            /* this hook to onOpen is needed to make sure expando icons
             * show up when we have legend content inside a leaf node
             */
            this.onOpen = dojo.hitch(this, function(item, node) {
                if (item.expandable) {
                    node.makeExpandable();
                }
            });
        },

        _getVisibleLayerIds : function() {
            var items = this.memStore.query({
                visibility : true
            });
            var visibleLayerIds = [];
            for (var i = 0, il = items.length; i < il; i++) {
                if (items[i].id >= 0 && !items[i].hasSubLayers)
                    visibleLayerIds.push(items[i].id);
            }
            return visibleLayerIds;
        },

        _setLayerInfosAttr : function(obj) {
            var layerRoot = {
                id : -1,
                parent : -2,
                name : obj.label,
                layerInfo : obj.layer,
                hasSubLayers : true,
                disabled : false,
                legend : null,
                visibility : obj.layer.hasOwnProperty('defaultVisibility') ? obj.layer.defaultVisibility : false,
                minScale : obj.layer.minScale,
                maxScale : obj.layer.maxScale,
                expandable : true
            };

            this.url = obj.layer.url;
            this.layerName = obj.label;
            this.layerId = obj.layer.id;
            this.observableMemStore.add(layerRoot);

            var lis = obj.layer.layerInfos, li = null, item = null;
            for (var i = 0, il = lis.length; i < il; i++) {
                li = lis[i];
                item = {
                    id : li.id,
                    parent : li.parentLayerId,
                    name : li.name,
                    layerInfo : li,
                    hasSubLayers : li.subLayerIds && (li.subLayerIds.length > 0) ? true : false,
                    disabled : false,
                    legend : null,
                    visibility : li.hasOwnProperty('defaultVisibility') ? li.defaultVisibility : false,
                    minScale : li.minScale,
                    maxScale : li.maxScale,
                    expandable : true
                };
                this.observableMemStore.add(item);
            }

            //make sure layer groups are checked if they contain checked layers
            var items = this.memStore.query({
                visibility : true
            });
            for (var i = 0, il = items.length; i < il; i++) {
                var parent = this.memStore.query({
                    id : items[i].id
                });
                parent.visibility = true;
            }

            this._set('layerInfos', obj);
        },

        setLegend : function(obj) {
            var self = this;
            var def = new Deferred();
            this._getLegendData(obj.layer.url).then(function(legendData) {
                for (var j = 0, jl = legendData.layers.length; j < jl; j++) {
                    var k = j;
                    self.observableMemStore.query({
                        id : legendData.layers[j].layerId
                    }).forEach(function(item) {
                        item.legend = legendData.layers[k].legend;
                        if (item.legend.length > 1 || item.id < 0) {
                            item.expandable = true;
                        } else {
                            item.expandable = false;
                        }
                        self.observableMemStore.put(item, {
                            overwrite : true
                        });
                    });
                }
                self.dataLoaded.resolve();
                def.resolve();
            }, function(error) {
                self.dataLoaded.resolve();
                console.error("Could not get legend data, ArcGIS server version > 10.0 needed for legend");
                def.reject(error);
            });

            return def;
        },

        _setScaleAttr : function(scale) {
            this._set("scale", scale);
            this.dataLoaded.then(dojo.hitch(this, function() {
                var items = this.memStore.query();
                for (var i = 0, il = items.length; i < il; i++) {
                    //if minScale or maxScale is non zero
                    items[i].disabled = false;
                    if (items[i].maxScale || items[i].minScale) {
                        if (items[i].maxScale && scale < items[i].maxScale) {
                            items[i].disabled = true;
                        }
                        if (items[i].minScale && scale > items[i].minScale) {
                            items[i].disabled = true;
                        }
                    }
                    var nodes = this.getNodesByItem(items[i]);
                    if (nodes.length == 1 && nodes[0] !== undefined) {
                        nodes[0].set("disabled", items[i].disabled);
                    }
                }

                //console.log("Applied scale " + scale);
                //console.log("Toc ", this);
            }));
        },

        _getLegendData : function(url) {
            var def = new Deferred();
            var url = urlUtils.urlToObject(url + "/legend?f=json");
            var requestHandle = esriRequest({
                "url" : url.path,
                "content" : url.query,
                callbackParamName : 'callback'
            }, {
                useProxy : false,
                usePost : false
            });

            requestHandle.then(function(response, io) {
                def.resolve(response);
            }, function(error, io) {
                def.reject(error);
            });

            return def;
        },

        _createTreeNode : function(args) {
            var treeNode = new _TocTreeNode(args);
            var self = this;

            //when treenode is changed emit an event for
            //parent toc to listen to
            treeNode.on('visibility-changed', function(event) {
                var visibleLayerIds = self._getVisibleLayerIds();
                event.stopPropagation();

                self.emit('layer-visibility-changed', {
                    bubbles : true,
                    cancelable : true,
                    visibleLayerIds : visibleLayerIds
                });

            });

            return treeNode;
        },

        getIconClass : function(item, opened) {
            //console.log(item, opened);
            return (!item || item.hasSubLayers) ? ( opened ? "dijitFolderOpened" : "dijitFolderClosed") : "dijitHidden";
        }
    });

    return declare("mapper.widgets.Toc", [_WidgetBase], {

        mapId : "",

        map : null,

        _setMapIdAttr : function(mapId) {
            this._set("mapId", mapId);
            this.customMap = registry.byId(mapId);
        },

        _setMapAttr : function(map) {
            this._set("map", map);
            this.customMap = map;
        },

        postCreate : function() {
            this.numTrees = 0;
            this._tocs = [];
            this.loaded = new Deferred();
        },

        startup : function() {
            if (this.customMap !== null) {
                this.customMap.on("dynamiclayeradded", dojo.hitch(this, function(obj) {
                    console.log("toc: dynamiclayeradded", obj);
                    var self = this;
                    this._createToc(obj).then(function() {
                        self.loaded.resolve();
                    });
                }));

                this.customMap.on("scale-change", dojo.hitch(this, function(obj) {
                    var self = this;
                    //make sure loaded deferred is resolved.
                    this.loaded.then(function() {
                        dojo.forEach(self._tocs, function(toc) {
                            toc.set("scale", obj.scale);
                        });
                    });
                }));

                for (var i = 0, il = this.customMap.dynamicLayerObjects.length; i < il; i++) {
                    this._createToc(this.customMap.dynamicLayerObjects[i]);
                }
            }
        },

        _createToc : function(obj) {
            var def = new Deferred();
            var node = domConstruct.create("div", {
                id : this.id + "_" + obj.layer.id,
                style : "width:100%"
            }, this.domNode, "last");
            var _toc = new _Toc({}, node);

            _toc.startup();
            _toc.set('layerInfos', obj);

            var self = this;
            _toc.setLegend(obj).then(function() {
                self._tocs.push(_toc);
                _toc.set("rootExpanded", true);

                self.emit("toc-created", {
                    toc : _toc
                });

                self.numTrees++;
                def.resolve();
            }, function(err) {
                self._tocs.push(_toc);
                _toc.set("rootExpanded", true);

                self.emit("toc-created", {
                    toc : _toc
                });
                self.numTrees++;
                def.reject(err);
            });

            _toc.on('layer-visibility-changed', function(obj) {
                var visibleLayerIds = obj.visibleLayerIds;
                self.customMap.set("visibleLayerIds", [{
                    visibleLayerIds : visibleLayerIds,
                    layerId : _toc.layerId
                }]);
            });

            return def;
        },

        getTocs : function() {
            return this._tocs || [];
        }
    });
});
