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
    "dijit/Menu", 
    "dijit/MenuItem",
    "mapper/widgets/Bookmarks"
    
    ], function(declare, lang, domConstruct, Evented, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Button, ToggleButton, Fieldset, 
        registry, on, Draw, GraphicsLayer, Graphic, InfoTemplate, RoiSelectorTmpl, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color, 
        Toolbar, Menu, MenuItem, Bookmarks) {
   
    var markerSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 10, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 1), new Color([0, 255, 0, 0.25]));

    var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASH, new Color([255, 0, 0]), 3);

    var polygonSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NONE, new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.25]));
     
    return declare("mapper.widgets.RoiSelector", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
        
        templateString : RoiSelectorTmpl,

        mapId: "",
        
        bookmarksUrl: "",
        
        iconClass: "roiIcon",
        
        buttonText : "ROI",
        
        visible: false,

        selection: null,
        
        constructor: function (opts, srcRefNode) {
            lang.mixin(this, opts);
            this.domNode = srcRefNode;
            this.draw = null;
        },
        
        _setSelectionAttr: function(val) {
            this._set("selection", val);
            this.emit("change", {
                bubbles: true,
                cancelable: false,
                selection: val
            });    
        },
        
        startup: function() {
            this.inherited(arguments);
            var customMap = registry.byId(this.get("mapId"));
            var self = this;
            customMap.mapLoadDeferred.then(function() {
                if ('_esriMap' in customMap) {
                    self.gLayer = new GraphicsLayer();
                    self.esriMap = customMap._esriMap;
                    self.esriMap.addLayer(self.gLayer);
                    self._setupDrawToolbar();
                } 
                else {
                    console.error("Identify tool cannot connect to map");
                    console.log(customMap);
                }
            });
            
            var bookmarksOpts = {
                mapId: this.get("mapId"),
                url: this.get("bookmarksUrl"),
                ddButtonId: 'bookmarkDDButton',
                drawOwnGraphics: false
            };
            
            this.bookmarks = new Bookmarks(bookmarksOpts, this.bookmarks_wrapper);
            this.bookmarks.startup();
            
            on(this.bookmarks, "graphic-change", function(ev) {
                self.gLayer.clear();
                self.gLayer.add(ev.graphic);    
                if (ev.graphic.geometry.type == "point") {
                    self.esriMap.centerAndZoom(ev.graphic.geometry, 14);            
                } else {
                    self.esriMap.setExtent(ev.graphic.geometry.getExtent().expand(3));            
                }
                
                self.set("selection", {"label": ev.title, "graphic": ev.graphic});
            });
        },
        
        _setupDrawToolbar : function() {
            var self = this;
            var draw = new Draw(self.esriMap);
            draw.on("draw-end", function(evt) {
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
                
                self.gLayer.clear();
                self.gLayer.add(gr);
                self.esriMap.enableMapNavigation();
                self.set("selection", {"label": "User drawn " + geom.type, "graphic": gr});
                
                draw.deactivate();
            });
            
            /*
             * Code for right click delete graphic popup 
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

            this.gLayer.on("mouse-over", dojo.hitch(this, function(evt) {
                this.selectedGraphic = evt.graphic;
                grActionsMenu.bindDomNode(evt.graphic.getDojoShape().getNode());
            }));
            
            this.gLayer.on("mouse-out", dojo.hitch(this, function(evt) {
                //this.selectedGraphic = null;
                grActionsMenu.unBindDomNode(evt.graphic.getDojoShape().getNode());
            }));
            */
           
            this.rectangle.on("click", function(ev) {
                self.esriMap.disableMapNavigation();
                draw.activate("extent");             
            });
            
            this.ellipse.on("click", function(ev) {
                self.esriMap.disableMapNavigation();
                draw.activate("ellipse");                
            });
            
            this.polygon.on("click", function(ev) {
                self.esriMap.disableMapNavigation();
                draw.activate("polygon");
            });
            
            this.clear.on("click", function(ev) {
                self.gLayer.clear();
                self.set("selection", null);
            });
        }
        
    });
});


