/**
 * @author narayanu
 */

define([
    "dojo/_base/declare", 
    "dojo/dom-construct", 
    "dojox/form/BusyButton",
    "dijit/form/ValidationTextBox",
    "dijit/registry", 
    "dijit/_WidgetBase", 
    "dijit/_TemplatedMixin", 
    "dijit/_WidgetsInTemplateMixin", 
    "mapper/widgets/LayerSelectorTree", 
    "mapper/widgets/Resulter", 
    "mapper/widgets/maptools/RoiSelector", 
    "esri/tasks/QueryTask", 
    "esri/tasks/query",
    "dojo/text!mapper/widgets/templates/QueryToolTmpl.html"], 

    function(declare, domConstruct, BusyButton, ValidationTextBox, registry, _WidgetBase, _TemplatedMixin, 
        _WidgetsInTemplateMixin, LayerSelectorTree, Resulter, RoiSelector, QueryTask, Query, FindToolTmpl) {

    var queryTool = declare("mapper.widgets.QueryTool", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

        templateString : FindToolTmpl,

        mapId : null,

        tocId : null,

        roiSelectorId: null,
        
        buttonText : "Search",

        busy : false,

        postCreate : function() {
            this.inherited(arguments);
            this.spatialFilterGeoms = [];
        },

        _setBusyAttr : function(busy) {
            this.searchButton.set('isBusy', busy);
            this.searchButton.set('disabled', busy);
            if (busy) {
                this.searchButton.set('label', 'Please wait ...');
            } else {
                this.searchButton.set('label', this.get('buttonText'));
            }
        },

        startup : function() {
            this.inherited(arguments);
            var self = this;
            
            //var def = new Deferred();
            var lsNode = domConstruct.create('div', null, this.layerSelectorContainer, 'only');
            this.layerSelector = new LayerSelectorTree({
                mapId: this.get("mapId")
            }, lsNode);
            this.layerSelector.startup();
            
            this.roiSelector = registry.byId(this.get("roiSelectorId"));
            
            if (this.roiSelector != null) {
                this.roiSelector.on("change", function(ev) {
                    if (ev.selection != null) {
                        self.searchRegion.innerHTML = ev.selection.label;
                    } else {
                        self.searchRegion.innerHTML = "Entire map!";  
                    }
                });    
            }
            
            this.searchRegion.innerHTML = "Entire map!";
            
            this.searchButton.on("click", dojo.hitch(this, function(ev) {
                this.checkInputs();
            }));
        },
        
        checkInputs: function() {
            var searchGeom = this.roiSelector.get("selection").graphic.geometry || null;
            var obj = {
                searchText : this.findText.value,
                mapService : this.layerSelector.selectedMapService,
                layerIds : this.layerSelector.selectedLayerIds,
                geom : searchGeom
            };
            
            this.set('busy', true);
            try {
                this.doQuery(obj);
            } 
            catch(ex) {
                console.error(ex);
                this.set('busy', false);    
            }
        },

        doQuery : function(obj) {            
            var resulter = Resulter.getInstance({
                containerId : "tcResults",
                "mapId" : this.get("mapId")
            });
            
            var geomFilter = obj.geom;
            for (var j = 0, jl = obj.layerIds.length; j < jl; j++) {
                var layerId = obj.layerIds[j];
                var url = obj.mapService.url;
                
                //For LayerSelector
                var layerName = obj.mapService.layers.get(layerId).name;
                
                //For LayerSelectorTree
                //var layerName = obj.mapService.layerInfos;
                this.queryLayer(url, layerId, layerName, geomFilter, obj.searchText, resulter);
            }
        },
        
        queryLayer: function(url, layerId, layerName, geomFilter, searchText, resulter) {
                var qryTask = new esri.tasks.QueryTask(url + "/" + layerId);
                var qry = new esri.tasks.Query();
                if (geomFilter) {
                    qry.spatialRelationship = esri.tasks.Query.SPATIAL_REL_INTERSECTS;
                    qry.geometry = geomFilter;
                }
                
                qry.returnGeometry = true;
                qry.outFields = ['*']; //single quotes are important here, doesn't work otherwise
                //qry.outSpatialReference = { "wkid": 102100 };
                qry.text = searchText;

                var self = this;
                qryTask.on("complete", function(event) {
                    console.log(event);
                    var features = event.featureSet.features;
                    resulter.show();
                    resulter.addMapResults(layerName, features, url, layerId);
                    self.set("busy", false);
                });

                qryTask.on("error", function(error) {
                    //alert("There was an error executing this Find task");
                    console.error(error);
                    self.set("busy", false);
                });

                qryTask.execute(qry);
        }
        
    });
    
    return queryTool;
});
