/**
 * @author narayanu
 */
     
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/Deferred",
    
    "dojo/dom-construct",
    "dojo/on",
    "dijit/form/Button",
    "dojox/form/BusyButton",
    
    "dijit/registry",
    
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin", 
    "dijit/_WidgetsInTemplateMixin",
    "mapper/widgets/LayerSelectorTree",
    "mapper/widgets/Resulter",
    "mapper/widgets/maptools/RoiSelector",
    "esri/tasks/FindTask", 
    "esri/tasks/FindParameters",
    "dojo/text!mapper/widgets/templates/FindDialogTmpl.html",
    "dojo/ready"
    ], 
    
    function(declare, lang, array, Deferred, domConstruct, on, Button, BusyButton, registry, _WidgetBase, 
        _TemplatedMixin, _WidgetsInTemplateMixin, LayerSelectorTree, Resulter, RoiSelector, FindTask, FindParameters, FindDialogTmpl, ready) {

    return declare("mapper.widgets.maptools.FindTool", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

        templateString : FindDialogTmpl,
        
        mapId : null,
        
        buttonText: "Find",
        
        busy: false,
        
        constructor : function(opts, srcRefNode) {
            lang.mixin(this, opts);
            this.domNode = srcRefNode;
            this.spatialFilterGeoms = [];
        },

        postCreate: function() {
            this.inherited(arguments);
        },
        
        _setBusyAttr: function(busy) {
            this.doneButton.set('isBusy', busy);
            this.doneButton.set('disabled', busy);
            if (busy) {
                this.doneButton.set('label', 'Please wait ...');
            } else {
                this.doneButton.set('label', this.get('buttonText'));
            }       
        },
        
        startup: function(){
            this.inherited(arguments);
            
            //var def = new Deferred();
            var layerSelector = new LayerSelectorTree({mapId: this.get("mapId")}, this.layerSelectorNode);
            layerSelector.startup();
            
            this.doneButton.on("click", dojo.hitch(this, function(ev) {
                var data = {
                    searchText: this.findText.value,
                    mapService: layerSelector.selectedMapService,  
                    layerIds: layerSelector.selectedLayerIds
                };
                
                this.set('busy', true);
                this.doFind(data);
            }));
            
            //this.roiSelecter.set("mapId", this.get("mapId"));
            var roiSelector = new RoiSelector({mapId: this.get("mapId")});
            this.roiButton.on("click", function(ev) {
                roiSelector.show();
            });
            
            roiSelector.on("finished", function(data) {
                console.log(data.geoms);
            });
            
            roiSelector.on("cancelled", function(geoms) {
            });
            
            roiSelector.startup();
        },
        
        doFind: function(obj) {
            var findTask = new FindTask(obj.mapService.url);
            var findParams = new esri.tasks.FindParameters();
            findParams.returnGeometry = true;
            findParams.layerIds = obj.layerIds;
            findParams.contains = true;
            
            var wkid;
            try {
                var cm = registry.byId(this.get("mapId"));
                wkid = cm._esriMap.spatialReference.wkid;
            } catch(err) {
                console.error("could not get wkid for find task");
                console.error(err);
                wkid = 102100;
            }
            
            //if searchFields is not set, all fields are searched
            //findParams.searchFields = [];
            findParams.outSpatialReference = {wkid: wkid};
            findParams.searchText = obj.searchText;

            var resulter = Resulter.getInstance({containerId: "tcResults", "mapId": this.get("mapId")});
            var self = this;
            findTask.execute(findParams, function(results) {
                console.log("Find results", results);
                //Find results can have number of layers and each layer can have number of features
                //we need to first aggregate results by layerId
                var results_by_layerId = {};
                //need this to set the resulter tab pane title
                var layer_names_by_layerId = {};
                
                array.map(results, function(item) {
                    //from https://developers.arcgis.com/javascript/jsapi/findresult-amd.html
                    //each item will have the following properties.
                    /*
                     * displayFieldName String  The name of the layer's primary display field.
                     * feature Graphic The found feature
                     * foundFieldName  String  The name of the field that contains the search text
                     * layerId Number  Unique ID of the layer that contains the feature
                     * layerName   String  The layer name that contains the feature
                     * 
                     */
                    if (results_by_layerId.hasOwnProperty(item.layerId)) {
                        results_by_layerId[item.layerId].push(item.feature);
                    } else {
                        results_by_layerId[item.layerId] = [item.feature];   
                        layer_names_by_layerId[item.layerId]=[item.layerName];
                    };
                });
                
                for (var layerId in results_by_layerId) {
                    if (results_by_layerId.hasOwnProperty(layerId)) {
                        console.log(layerId, results_by_layerId[layerId]);
                        resulter.addMapResults(layer_names_by_layerId[layerId] + " Results", results_by_layerId[layerId]);
                    }
                }
                
                resulter.show();
                self.set("busy", false);
                
            }, function(err) {
                alert("There was an error executing this Find task");
                console.error(err);
                self.set("busy", false);
            });
        }
    });
});
