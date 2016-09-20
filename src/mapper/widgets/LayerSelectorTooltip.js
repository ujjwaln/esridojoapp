/**
 * @author narayanu
 */

define(["dojo/_base/declare", 
        "dojo/_base/lang", 
        "dojo/Deferred",
        "dojo/Evented",
        "dojo/dom-construct",
        "dojo/store/Memory",
        "dojo/data/ObjectStore",
        "dijit/_WidgetBase",
        "dijit/_TemplatedMixin", 
        "dijit/_WidgetsInTemplateMixin",
        "dijit/registry", 
        "dijit/TooltipDialog", 
        "dijit/form/Select", 
        "dijit/form/CheckBox", 
        "dojox/form/CheckedMultiSelect",
        "dojo/store/Observable",
        "dijit/tree/ObjectStoreModel",
        "mapper/widgets/Toc",
        "dojo/text!mapper/widgets/templates/LayerSelectorTooltipTmpl.html"], 
        
    function(declare, lang, Deferred, Evented, domConstruct, Memory, ObjectStore, _WidgetBase, _TemplatedMixin, 
        _WidgetsInTemplateMixin, registry, TooltipDialog, Select, CheckBox, CheckedMultiSelect,
        Observable, ObjectStoreModel, Toc, LayerSelectorTooltipTmpl) {

    return declare("mapper.widgets.LayerSelectorTooltip", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {

        templateString : LayerSelectorTooltipTmpl,
        
        tocId : null,
        
        buttonText: "select layer",
        
        constructor : function(opts) {
            //this.domNode = srcRefNode;
            this.tocWidget = null;
            this.selectedMapService = null;
            this.selectedLayerIds = null;
            this.query = {query: {visibility: true, id: {test: function(item) {return item > 0;}}}};
            
            lang.mixin(this, {tocId: opts.tocId});
        },

        startSelection: function(){
            if (!this.selectedMapService) {
                this._createMapServiceSelector();
                
                this.inpVisibleOnly.on("change", dojo.hitch(this, function(checked) {
                    this.query = null;
                    if (checked) 
                        this.query = {query: {visibility: true, id: {test: function(item) {return item > 0;}}}};
                    this._createLayerSelector();
                }));
                
                this.okButton.on("click", dojo.hitch(this, function(ev) {
                    this.emit("finished", {
                       service: this.selectedMapService,
                       layers: this.selectedLayerIds
                    });
                    //this.destroySelection();
                }));
                
                this.cancelButton.on("click", dojo.hitch(this, function(ev) {
                    this.emit("finished", {
                       service: null,
                       layers: null
                    });
                    //this.destroySelection();
                }));          
            }
        },
        
        destroySelection: function() {
           //this.fsMapService.destroyRecursive(false);
           //this.ckLayers.destroyRecursive(false);
           this.ckLayers=null;
           this.fsMapService = null;
           this.mapServiceStore = null;
           this.selectedMapService = null;
        },
        
        _createMapServiceSelector : function() {
            if (!this.tocWidget)
                this.tocWidget = registry.byId(this.get("tocId"));
            
            if (!this.tocWidget) {
                throw "Toc widget is not set in LayerSelector";
            }
            
            //this.tocWidget.loaded.then(dojo.hitch(this, function() {
            
            this.mapServiceStore = new Memory({
                data : [],
                idProperty: "id"
            });
            
            //get a reference to 'this' for use 
            //within event handlers (closure)
            var self = this;            
            
            //if tocWidget already has tocs populated add the corresponding
            //mapServices to the filteringSelect Store
            var tocs = this.tocWidget.getTocs();
            for (var i=0, il=tocs.length; i<il; i++) {
                this.mapServiceStore.add({
                    id : String(tocs[i].layerId), //dijit.form.Select likes ID to be String
                    label : tocs[i].layerName,
                    value: tocs[i].layerId,
                    layers : tocs[i].observableMemStore,
                    selected: i==0 ? true : false
                });
            }
            
            //bind to the toc-created event
            this.tocWidget.on("toc-created", function(ev) {
                self.mapServiceStore.add({
                    id : String(ev.toc.layerId),
                    label : ev.toc.layerName,
                    value: ev.toc.layerId,
                    layers : ev.toc.memStore,
                    selected:  self.mapServiceStore.data.length == 0 ? true: false
                });
                ev.stopPropagation();
            });

            //set store property for the MapService FilteringSelect
            var os = new ObjectStore({ objectStore: this.mapServiceStore, labelProperty: "label"});
            this.fsMapService = new Select({
                "store": os,
                "name": "selectMapService"}, 
                
                domConstruct.create('select', null, this.fsMapServiceNode, 'only'));

            //set search attribute property of the filtering select
            //this.fsMapService.set("searchAttr", "name");
            this.fsMapService.onChange = function(mapServiceId) {
                self.selectedMapService = self.mapServiceStore.get(mapServiceId);
                self._createLayerSelector();
            };
            
            this.fsMapService.startup();
            
            this.selectedMapService = this.mapServiceStore.data[0];
            this.fsMapService.set("value", this.selectedMapService.id);
            
            this._createLayerSelector();
           
           // }));            
        },
        
        _createLayerSelector: function() {
            if (this.ckLayers) {
                this.ckLayers.destroyRecursive(false);
            }
            
            if (this.selectedMapService) {
                this.ckLayers = new CheckedMultiSelect({
                    "labelAttr" : "name",
                    "multiple": true
                }, domConstruct.create('div', null, this.ckLayersNode, 'only'));
                
                this.ckLayers.on("change", dojo.hitch(this, function(selectedLayerIds) {
                    this.selectedLayerIds = selectedLayerIds;
                }));
                
                this.ckLayers.setStore(this.selectedMapService.layers, null, this.query);
                this.ckLayers.startup();
            }
        },
    });
    
});
