/**
 * @author narayanu
 */

define([
    "dojo/_base/declare", 
    "dojo/_base/lang", 
    "dojo/dom-construct", 
    "dojo/Evented", 
    "dijit/_WidgetBase", 
    "dijit/_TemplatedMixin", 
    "dijit/_WidgetsInTemplateMixin",
    "dijit/form/Button", 
    "dijit/form/ToggleButton", 
    "dijit/Fieldset", 
    "dijit/registry", 
    "dojo/on", 
    "esri/toolbars/draw",
    "esri/layers/GraphicsLayer", 
    "esri/graphic",
    "esri/InfoTemplate",
    "dojo/text!mapper/widgets/templates/RoiSelectorTmpl.html",
    "esri/symbols/SimpleMarkerSymbol", 
    "esri/symbols/SimpleLineSymbol", 
    "esri/symbols/SimpleFillSymbol", 
    "dojo/_base/Color",
    "dijit/Toolbar",
    "dijit/Menu", "dijit/MenuItem",
    "dojo/domReady!"
    
    ], function(declare, lang, domConstruct, Evented, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Button, ToggleButton, Fieldset, 
        registry, on, Draw, GraphicsLayer, Graphic, InfoTemplate, RoiSelectorTmpl, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color, 
        Toolbar, Menu, MenuItem) {
   
    var markerSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 10, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 1), new Color([0, 255, 0, 0.25]));

    var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASH, new Color([255, 0, 0]), 3);

    var polygonSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NONE, new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.25]));
     
    return declare("mapper.widgets.maptools.RoiSelector", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
        
        templateString : RoiSelectorTmpl,

        mapId: "",
        
        iconClass: "roiIcon",
        
        buttonText : "ROI",
        
        visible: false,

        constructor: function (opts, srcRefNode) {
            lang.mixin(this, opts);
            this.domNode = srcRefNode;
            this.draw = null;
        },
        
        buildRendering: function() {
          this.inherited(arguments);
        },
        
        postCreate: function () {
            this.inherited(arguments);
        },

        startup: function() {
            this.inherited(arguments);
            var customMap = registry.byId(this.get("mapId"));
            var self = this;
            customMap.mapLoadDeferred.then(function() {
                if ('_esriMap' in customMap) {
                    self._setupDrawToolbar(customMap._esriMap);
                } else {
                    console.error("Identify tool cannot connect to map");
                    console.log(customMap);
                }
            });
        },
        
        _setupDrawToolbar : function(esriMap) {
            var draw = new Draw(esriMap);
            var gLayer = new GraphicsLayer();
            this.gLayer = gLayer;
            esriMap.addLayer(gLayer);
            var self = this;
            
            draw.on("draw-end", function(evt) {
                //gLayer.clear();
                var gr = new Graphic();
                var geom = evt.geometry;
                gr.geometry = geom;
                switch (geom.type) {
                    case "point":
                        gr.setSymbol(markerSymbol);
                        break;
                    case "polyline":
                        gr.setSymbol(lineSymbol);
                        break;
                    case "polygon":
                        gr.setSymbol(polygonSymbol);
                        break;
                    case "extent":
                        gr.setSymbol(polygonSymbol);
                        break;
                };
                
                //clearing previous graphics for now
                gLayer.clear();
                
                gLayer.add(gr);
                esriMap.enableMapNavigation();
                draw.deactivate();
            });
            
            this.selectedGraphic = null;
            
            var grActionsMenu = new Menu();
            grActionsMenu.addChild(new MenuItem({ 
                label: "Remove",
                onClick: dojo.hitch(this, function() {
                  if (this.selectedGraphic !== null) {
                    gLayer.remove(this.selectedGraphic);
                  }  
                })
            }));

            gLayer.on("mouse-over", dojo.hitch(this, function(evt) {
                this.selectedGraphic = evt.graphic;
                grActionsMenu.bindDomNode(evt.graphic.getDojoShape().getNode());
            }));
            
            gLayer.on("mouse-out", dojo.hitch(this, function(evt) {
                //this.selectedGraphic = null;
                grActionsMenu.unBindDomNode(evt.graphic.getDojoShape().getNode());
            }));
            
            this.rectangle.on("click", function(ev) {
                esriMap.disableMapNavigation();
                draw.activate("extent");             
            });
            
            this.ellipse.on("click", function(ev) {
                esriMap.disableMapNavigation();
                draw.activate("ellipse");                
            });
            
            this.polygon.on("click", function(ev) {
                esriMap.disableMapNavigation();
                draw.activate("polygon");
            });
            
            this.clear.on("click", function(ev) {
                esriMap.disableMapNavigation();
                gLayer.clear();    
            });
            
            /*
            this.finishButton.on("click", dojo.hitch(this, function(ev) {
                draw.deactivate();
                var geoms = [];
                for (var i=0, il=gLayer.graphics.length; i<il; i++) {
                    geoms.push(lang.clone(gLayer.graphics[i].geometry));
                };
                esriMap.removeLayer(gLayer);
                esriMap.enableMapNavigation();
                this.emit("finished", {geoms: geoms});
                this.hide();
            }));
            
            this.cancelButton.on("click", dojo.hitch(this, function(ev) {
                draw.deactivate();
                esriMap.removeLayer(gLayer);
                esriMap.enableMapNavigation();
                this.emit("cancelled", {});
                this.hide();
            }));
            */
        },

        getGeoms: function() {
            var geoms = [];
            for (var i=0; i<this.gLayer.graphics.length; i++) {
                geoms.push(this.gLayer.graphics[i].geometry);
            }
            return geoms;
        }
    });
});


