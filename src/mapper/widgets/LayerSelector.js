/**
 * @author narayanu
 */

define(["dojo/_base/declare", "dojo/_base/lang", "dojo/Deferred", "dojo/Evented", "dojo/dom-construct", "dojo/dom-class",
"dojo/store/Memory", "dojo/data/ObjectStore", "dijit/_WidgetBase", "dijit/_TemplatedMixin", "dijit/_WidgetsInTemplateMixin", 
"dijit/form/Select", "dijit/form/CheckBox", "dijit/form/FilteringSelect", "dijit/Fieldset", "mapper/widgets/ListInput", 
"dojo/text!mapper/widgets/templates/LayerSelectorTmpl.html", "dijit/registry", "dojo/ready"], 
function(declare, lang, Deferred, Evented, domConstruct, domClass, Memory, ObjectStore, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
    Select, CheckBox, FilteringSelect, Fieldset, ListInput, LayerSelectorTmpl, registry, ready) {

    return declare("mapper.widgets.LayerSelector", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {

        templateString : LayerSelectorTmpl,

        tocId : null,

        buttonText : "Select Layer",

        numSelectedLayers: 0,
        
        _setNumSelectedLayersAttr: function(num) {
            this._set('numSelectedLayers', num);
            
            //show/hide the selected layers ListInput widget 
            if (num === 1)
                domClass.remove(this.selectedLayersContainer, 'dijitHidden');
            if (num === 0)
                domClass.add(this.selectedLayersContainer, 'dijitHidden');
                
            //emit a num-selected-layers-change event for the FindTool to bind to.
            //this is needed since ROI Selector will be hidden if num-layers > 1
            this.emit("num-selected-layers-change", {"count": num});
        },
        
        constructor : function(opts, srcRefNode) {
            this.domNode = srcRefNode;
            this.tocWidget = null;
            this.selectedMapService = null;
            this.selectedLayerIds = [];
        },

        startup : function() {
            if (this.get("tocId") === undefined || this.get("tocId") === null) {
                throw "Toc widget id must be specified for LayerSelector";
            }
            this.fsContainer.set("open", false);
            var self = this;
            this.fsContainer._onTitleClick = function() {
                if (self.fsContainer.get("open")) {
                    self.fsContainer.set("open", false);
                    self.hide();
                } else {
                    self.fsContainer.set("open", true);
                    self.show();
                }
            };
        },

        show : function() {
            this._createMapServiceSelector();
        },

        hide : function() {
            this.emit("finished", {
                service : this.selectedMapService,
                layers : this.selectedLayerIds
            });
        },

        destroy: function() {
            //this.fsMapService.destroyRecursive(false);
            //this.ckLayers.destroyRecursive(false);
            this.fsLayers = null;
            this.fsMapService = null;
            this.mapServiceStore = null;
            this.selectedMapService = null;
            this.inherited(arguments);
        },

        _createMapServiceSelector : function() {
            //_createMapServiceSelector can get called several times
            //by show. So check if we already have a reference to tocWidget
            if (!this.tocWidget)
                this.tocWidget = registry.byId(this.get("tocId"));

            if (!this.tocWidget) {
                throw "Toc widget is not set in LayerSelector";
            }

            //this.tocWidget.dataLoaded.then(dojo.hitch(this, function() {
                
                this.mapServiceStore = new Memory({
                    data : [],
                    idProperty : "id"
                });
    
                //get a reference to 'this' for use
                //within event handlers (closure)
                var self = this;
    
                //if tocWidget already has tocs populated add the corresponding
                //mapServices to the filteringSelect Store
                var tocs = this.tocWidget.getTocs();
                for (var i = 0, il = tocs.length; i < il; i++) {
                    this.mapServiceStore.add({
                        id : String(tocs[i].layerId), //dijit.form.Select likes ID to be String
                        label : tocs[i].layerName,
                        value : tocs[i].layerId,
                        layers : tocs[i].observableMemStore,
                        selected : i === 0 ? true : false,
                        url: tocs[i].url
                    });
                }
    
                //bind to the toc-created event
                this.tocWidget.on("toc-created", function(ev) {
                    self.mapServiceStore.add({
                        id : String(ev.toc.layerId),
                        label : ev.toc.layerName,
                        value : ev.toc.layerId,
                        layers : ev.toc.memStore,
                        selected : self.mapServiceStore.data.length === 0 ? true : false,
                        url: tocs[i].url
                    });
                    ev.stopPropagation();
                });
    
                //set store property for the MapService FilteringSelect
                var os = new ObjectStore({
                    objectStore : this.mapServiceStore,
                    labelProperty : "label"
                });
    
                this.fsMapService.setStore(os);
    
                //set search attribute property of the filtering select
                //this.fsMapService.set("searchAttr", "name");
                this.fsMapService.onChange = function(mapServiceId) {
                    self.selectedMapService = self.mapServiceStore.get(mapServiceId);
                    self._createLayerSelector();
                };
    
                this.selectedMapService = this.mapServiceStore.data[0];
                this.fsMapService.set("value", this.selectedMapService.id);
        },

        _createLayerSelector : function() {
            
            if (this.selectedMapService) {
                
                if (this.fsLayers) {
                    this.fsLayers.destroy();
                }
                
                this.fsLayers = new FilteringSelect({
                    "autocomplete" : true,
                    //"query": this.query, query doesn't work
                    "store": this.selectedMapService.layers,
                    "required": false
                }, domConstruct.create('div', null, this.fsLayersContainer, "only"));
                
                this.fsLayers.on("change", dojo.hitch(this, function(selectedLayerId) {
                    if (this.selectedLayerIds.indexOf(selectedLayerId) < 0) {
                        this.selectedLayerIds.push(selectedLayerId);
                        
                        var selectedItem = this.selectedMapService.layers.get(selectedLayerId);
                        liSelectedLayers.add(selectedItem);
                        
                        this.set("numSelectedLayers", this.selectedLayerIds.length);
                    }
                }));
                
                //this.fsLayers.setStore(this.selectedMapService.layers, null, this.query);
                this.fsLayers.startup();

                var liSelectedLayers = new ListInput({
                    "readOnlyItem" : true,
                    "readOnlyInput" : true,
                    "labelAttr" : "name"
                }, domConstruct.create('div', null, this.selectedLayersContainer, "only"));
                //hide initially
                domClass.add(this.selectedLayersContainer, 'dijitHidden');
                
                //somehow onChange is only called when items are added
                liSelectedLayers.onChange = dojo.hitch(this, function(newValue) {
                });

                liSelectedLayers.onRemove = dojo.hitch(this, function(item) {
                    var data = this.selectedMapService.layers.data;
                    for (var i = 0, il = data.length; i < il; i++) {
                        if (data[i].name === item.value) {
                            var idx = this.selectedLayerIds.indexOf(data[i].id);
                            this.selectedLayerIds.splice(idx, 1);
                        }
                    }
                    this.set("numSelectedLayers", this.selectedLayerIds.length); 
                });

                liSelectedLayers.startup();
            }
        }
    });
});
