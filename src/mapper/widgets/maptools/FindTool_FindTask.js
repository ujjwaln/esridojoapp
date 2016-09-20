/**
 * @author narayanu
 */
     
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/Deferred",
    "dojo/dom-construct",
    "dojo/dom-class",
    "dojo/on",
    "dijit/form/Button",
    "dojox/form/BusyButton",
    "dijit/registry",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin", 
    "dijit/_WidgetsInTemplateMixin",
    "mapper/widgets/LayerSelector",
    "mapper/widgets/Resulter",
    "mapper/widgets/maptools/RoiSelector",
    "esri/tasks/FindTask", 
    "esri/tasks/FindParameters",
    "dojo/text!mapper/widgets/templates/FindToolTmpl.html",
    "dojo/ready"
    ], 
    
    function(declare, lang, array, Deferred, domConstruct, domClass, on, Button, BusyButton, registry,
         _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, LayerSelector, Resulter, RoiSelector, FindTask, 
        FindParameters, FindToolTmpl, ready) {

    return declare("mapper.widgets.maptools.FindTool", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

        templateString : FindToolTmpl,
        
        mapId : null,
        
        tocId : null,
        
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
            var lsNode = domConstruct.create('div', null, this.layerSelectorContainer, 'only');
            var layerSelector = new LayerSelector({tocId: this.get("tocId")}, lsNode);
            
            var roiNode = domConstruct.create('div', null, this.roiSelectorContainer, 'only');
            var roiSelector = new RoiSelector({mapId: this.get("mapId")}, roiNode);
            
            layerSelector.on("num-selected-layers-change", dojo.hitch(this, function(ev) {
                if (ev.count == 2) {
                    domClass.add(this.roiSelectorContainer, 'dijitHidden');
                }
                if (ev.count < 2) {
                    domClass.remove(this.roiSelectorContainer, 'dijitHidden');
                }
            }));
            
            var self = this;
            roiSelector.on("finished", function(data) {
                console.log(data.geoms);
                self.spatialFilterGeoms = data.geoms;
            });
            
            roiSelector.on("cancelled", function(geoms) {
            });

            this.doneButton.on("click", dojo.hitch(this, function(ev) {
                var data = {
                    searchText: this.findText.value,
                    mapService: layerSelector.selectedMapService,  
                    layerIds: layerSelector.selectedLayerIds,
                    geoms: this.spatialFilterGeoms
                };
                
                this.set('busy', true);
                this.doFind(data);
            }));

            layerSelector.startup();
            roiSelector.startup();
        },
        
        doFind: function(obj) {
        	console.log(obj);
            var findTask;
            
            //adding exception handling here since find endpoint may not 
            //be supported? or url can be incorrect. want to make sure
            //busybutton returns to active state
            try {
                findTask = new FindTask(obj.mapService.url);
            } catch (e) {
                throw "Could not instantiate FindTask";
            }
            
            var findParams = new esri.tasks.FindParameters();
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
			findParams.returnGeometry = true;
            findParams.layerIds = obj.layerIds;
            findParams.contains = true;
            
            var resulter = Resulter.getInstance({containerId: "tcResults", "mapId": this.get("mapId")});
            var self = this;
            findTask.execute(findParams, function(results) {
                //console.log("Find results", results);
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
                        //console.log(layerId, results_by_layerId[layerId]);
                        
                        resulter.addMapResults(
                        	layer_names_by_layerId[layerId], 
                        	results_by_layerId[layerId],
                        	obj.mapService.url,
                        	layerId);
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
