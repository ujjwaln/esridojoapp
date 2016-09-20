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
    "mapper/widgets/LayerSelectorTree", 
    "mapper/widgets/Resulter", 
    "mapper/widgets/maptools/RoiSelector", 
    "esri/tasks/QueryTask", 
    "esri/tasks/query", 
    "dojo/text!mapper/widgets/templates/FindToolTmpl.html", 
    "dojo/ready"], 

    function(declare, lang, array, Deferred, domConstruct, domClass, on, Button, BusyButton, 
        registry, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, LayerSelectorTree, 
        Resulter, RoiSelector, QueryTask, Query, FindToolTmpl, ready) {

    return declare("mapper.widgets.maptools.QueryTool", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

        templateString : FindToolTmpl,

        mapId : null,

        tocId : null,

        buttonText : "Find",

        busy : false,

        constructor : function(opts, srcRefNode) {
            lang.mixin(this, opts);
            this.domNode = srcRefNode;
            this.spatialFilterGeoms = [];
        },

        postCreate : function() {
            this.inherited(arguments);
        },

        _setBusyAttr : function(busy) {
            this.doneButton.set('isBusy', busy);
            this.doneButton.set('disabled', busy);
            if (busy) {
                this.doneButton.set('label', 'Please wait ...');
            } else {
                this.doneButton.set('label', this.get('buttonText'));
            }
        },

        startup : function() {
            this.inherited(arguments);

            //var def = new Deferred();
            var lsNode = domConstruct.create('div', null, this.layerSelectorContainer, 'only');
            var layerSelector = new LayerSelectorTree({
                mapId: this.get("mapId")
            }, lsNode);

            var roiNode = domConstruct.create('div', null, this.roiSelectorContainer, 'only');
            var roiSelector = new RoiSelector({
                mapId : this.get("mapId")
            }, roiNode);

            var self = this;
            roiSelector.on("finished", function(data) {
                console.log(data.geoms);
                self.spatialFilterGeoms = data.geoms;
            });

            roiSelector.on("cancelled", function(geoms) {
            });

            this.doneButton.on("click", dojo.hitch(this, function(ev) {
                var data = {
                    searchText : this.findText.value,
                    mapService : layerSelector.selectedMapService,
                    layerIds : layerSelector.selectedLayerIds,
                    geoms : roiSelector.getGeoms()
                };

                this.set('busy', true);
                try {
                    this.doQuery(data);    
                } 
                //catch error not caught by query tasks onerror handler
                catch(ex) {
                    console.error(ex);
                    this.set('busy', false);    
                }
            }));

            layerSelector.startup();
            roiSelector.startup();
        },

        doQuery : function(obj) {
            /*
             obj = {
             searchText: this.findText.value,
             mapService: layerSelector.selectedMapService,
             layerIds: layerSelector.selectedLayerIds,
             geoms: this.spatialFilterGeoms
             };
             */
            console.log('doQuery', obj);
            var resulter = Resulter.getInstance({
                containerId : "tcResults",
                "mapId" : this.get("mapId")
            });
            
            var geomFilter = null;
            if (obj.geoms.length >= 1) {
                geomFilter = obj.geoms[0];
            }
            
            /*
            var geoms = obj.geoms || [];
            for (var i=0, il=geoms.length; i<il; i++) {
                var geom = geoms[i];
                var thisExtent = null;
                if (geom.type == "polygon") {
                    thisExtent = geom.getExtent(); 
                }
                if (geom.type == "extent") {
                    thisExtent = geom; 
                }
                if (!extent) {
                    extent = thisExtent;
                } else {
                    extent = extent.union(thisExtent);
                }
            }
            */
           
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
});
