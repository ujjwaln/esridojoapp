/**
 * @author narayanu
 */

define(["dojo/_base/declare", 
        "dojo/_base/lang",
        "dojo/aspect",
        "dojo/Deferred",
        "dojo/Evented",
        "dojo/dom-construct",
        "dojo/dom-style",
        "dojo/store/Memory",
        "dojo/data/ObjectStore",
        "dojo/store/Observable",
        "dijit/_WidgetBase",
        "dijit/_TemplatedMixin", 
        "dijit/_WidgetsInTemplateMixin",
        "dijit/registry", 
        "dijit/TooltipDialog",
        "dijit/form/Select", 
        "dijit/form/CheckBox",
        "dijit/Tree",
        "dijit/tree/ObjectStoreModel",
        "dijit/Fieldset",
        "mapper/widgets/_TocTreeNode",
        "mapper/utils/dom-tools",
        "dojo/text!mapper/widgets/templates/LayerSelectorTreeTmpl.html"], 
        
    function(declare, lang, aspect, Deferred, Evented, domConstruct, domStyle, Memory, ObjectStore, Observable, _WidgetBase, 
    	_TemplatedMixin, _WidgetsInTemplateMixin, registry, TooltipDialog, Select, CheckBox, Tree, ObjectStoreModel, FieldSet,
    	_TocTreeNode, domTools, LayerSelectorTreeTmpl) {

    var _Toc = declare("mapper.widgets._Toc", [Tree], {
        
        layerInfos: null,
        
        constructor: function(opts, srcRefNode) {
            lang.mixin(this, opts);
            this.domNode = srcRefNode;
            this.dataLoaded = new Deferred();
        },
        
        startup: function() {
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
    
        getIconClass: function(item, opened) {
                //console.log(item, opened);
                return (!item || item.hasSubLayers) ? (opened ? "dijitFolderOpened" : "dijitFolderClosed") : "dijitHidden";
        },
            
        _getVisibleLayerIds: function() {
            var items = this.memStore.query({visibility: true});
            var visibleLayerIds = [];
            for (var i=0, il=items.length; i<il; i++) {
                if (items[i].id >= 0 && !items[i].hasSubLayers)
                    visibleLayerIds.push(items[i].id);
            }
            return visibleLayerIds;
        },
        
        _setLayerInfosAttr: function(obj) {
            var items = [];
            console.log(obj.layer);
            var layerRoot = {
                id: -1,
                parent: -2,
                name: "", //obj.label, not showing root node label since it will be shown in map service selector
                layerInfo: obj.layer,
                hasSubLayers: true,
                disabled: false,
                legend: null,
                visibility: 'defaultVisibility' in obj.layer ? obj.layer.defaultVisibility: true,
                minScale: 0,
                maxScale: 0,
            };
            items.push(layerRoot);
            
            var lis=obj.layer.layerInfos, li=null, item=null;
            var visibleLayers = obj.layer.visibleLayers;
            for (var i=0, il=lis.length; i<il; i++) {
                li = lis[i];
                item = {
                    id: li.id,
                    parent: li.parentLayerId,
                    name: li.name,
                    layerInfo: li,
                    hasSubLayers: li.subLayerIds && (li.subLayerIds.length > 0) ? true : false,
                    disabled: false,
                    legend: null,
                    visibility: 'defaultVisibility' in li ? li.defaultVisibility : false,
                    minScale: li.minScale,
                    maxScale: li.maxScale
                };
                //if a layer is currently visible in the map then set its
                //visible property to true. (current visibility overrides defaultVisibility)
                if (visibleLayers.indexOf(parseInt(li.id)) > -1) {
                    item.visibility = true;
                }
                items.push(item);
            };
            
            this.memStore = new Memory({
                data: items,
                getChildren : function(object) {
                    return this.query({
                        parent: object.id
                    });
                },
                idProperty: "id"
            });
            
            this.observableMemStore = new Observable(this.memStore);
            var objectStoreModel = new ObjectStoreModel({
                store : this.observableMemStore,
                query : {id : -1},
                labelAttr : "name",
                labelType : "text",
                mayHaveChildren: function(item) {
                    return item.hasSubLayers;
                }
            });
            
             //make sure layer groups are checked if they contain checked layers
            var items = this.memStore.query({visibility: true});
            for (var i=0, il=items.length; i<il; i++) {
                var parent = this.memStore.query({id: items[i].id});
                parent.visibility = true;
            }
            
            this.set('model', objectStoreModel);
            this.layerName = obj.label;
            this.layerId = obj.layer.id;
            
            //this.observableMemStore.add(layerRoot);
            this._set('layerInfos', obj.layer.layerInfos);
        },
        
        _createTreeNode: function(args) {
            var treeNode = new _TocTreeNode(args);
            var self = this;
            
            //when treenode is changed emit an event for 
            //parent toc to listen to
            treeNode.on('visibility-changed', function(event) {
                var visibleLayerIds = self._getVisibleLayerIds();
                event.stopPropagation();

                self.emit('layer-selector-visibility-changed', {
                   bubbles: true,
                   cancelable : true,
                   visibleLayerIds: visibleLayerIds
                });
                
            });
            
            return treeNode;
        }
    });
    
    return declare("mapper.widgets.LayerSelectorTree", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {

        templateString : LayerSelectorTreeTmpl,
        
        mapId : null,
        
        buttonText: "select layer",
        
        constructor : function(opts, srcRefNode) {
            //this.domNode = srcRefNode;
            lang.mixin(this, {mapId: opts.mapId});

            this.numTrees = 0;
            this._tocs = [];
            this.selectedMapService = null;
            this.selectedLayerIds = [];
            this.mapServiceStore = new Memory({
                data : [],
                idProperty: "id"
            });
            this.domNode = srcRefNode;
        },

        startup: function() {
            this.inherited(arguments);
        },
        
        _setMapIdAttr: function(mapId) {
            var customMap = registry.byId(mapId);
            customMap.on("dynamiclayeradded", dojo.hitch(this, function(obj) {
               this._addToc(obj);
               this._createMapServiceSelector();
            }));
            //add any existing dynamic maps
            var items = customMap.dynamicLayerObjects;    
            for (var i=0, il=items.length; i<il; i++) {
                this._addToc(items[i]);
                this._createMapServiceSelector();
            }
            
            this.customMap = customMap; 
        },
        
        _addToc: function(obj) {
            //check this toc hasn't already been added
            var exists = false;
            for (var i=0, il=this._tocs.length; i<il; i++) {
                if (this._tocs[i].layerId == obj.layer.id) {
                    exists = true;
                }
            }
            if (exists) return;
            
            var node = domTools.getInstance().createNodeWithUniqueId("div", this.tocContainer, "last");
            var _toc = new _Toc({'layerInfos': obj}, node);
            _toc.startup();

            var self = this;
            var layerId = obj.layer.id;
            _toc.on("layer-selector-visibility-changed", function(obj) {
                self.selectedLayerIds = obj.visibleLayerIds;
            });

            //set initial visibility in selecitons
            this._tocs.push(_toc);
            this.numTrees ++;
            
            this.mapServiceStore.add({
                id : String(_toc.layerId),
                label : _toc.layerName,
                value : _toc.layerId,
                url: obj.layer.url,
                layers: _toc.observableMemStore
            });
            
            //console.log(obj);
            //hide the newly created toc and show it only 
            //when corresponding map service is selected
            domStyle.set(_toc.domNode, "display", "none");
        },
        
        _createMapServiceSelector: function() {
            var os = new ObjectStore({ objectStore: this.mapServiceStore, labelProperty: "label"});
            if (this.selectMapService) {
                this.selectMapService.destroy();
            }
            
            this.selectMapService = new Select({
                "store": os, 
                "name": "selectMapService",
            }, domConstruct.create('select', null, this.selectContainer, 'only'));

            //set search attribute property of the filtering select
            //this.fsMapService.set("searchAttr", "name");
            var self = this;
            this.selectMapService.onChange = function(mapServiceId) {
                self.selectedMapService = self.mapServiceStore.get(mapServiceId);
                for (var i=0, il=self._tocs.length; i<il; i++) {
                    if (self._tocs[i].layerId == mapServiceId) {
                        domStyle.set(self._tocs[i].domNode, "display", "");
                        self.selectedLayerIds = self._tocs[i]._getVisibleLayerIds();
                    }
                    else {
                        //hide toc if corresponding mapService is not selected
                        domStyle.set(self._tocs[i].domNode, "display", "none");
                    }             
                }
            };
            
            if (self._tocs.length <= 1) {
                this.selectMapService.set("disabled", true);
                //domStyle.set(this.selectContainer, "display", "none");
            } else {
                this.selectMapService.set("disabled", false);
                //domStyle.set(this.selectContainer, "display", "");
            }
            
            this.selectMapService.set("value", this._tocs[0].layerId);
        },
        
        destroySelection: function() {
            this.emit("finished", {
               service: this.selectedMapService,
               layers: this.selectedLayerIds
            });
        }
    });
});
