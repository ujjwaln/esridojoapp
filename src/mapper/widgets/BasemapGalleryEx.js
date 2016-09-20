/**
 * @author narayanu
 *
 * BasemapGalleryEx adds Google maps capability to ESRI's BasemapGallery widget.
 *
 */

define([
    "dojo/_base/declare", 
    "dojo/_base/lang", 
    "dojo/dom-construct", 
    "dijit/_WidgetBase", 
    "dijit/_TemplatedMixin", 
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!mapper/widgets/templates/BasemapTogglerTmpl.html",
    "dijit/Menu", 
    "dijit/MenuItem",
    "esri/dijit/Basemap", 
    "esri/dijit/BasemapGallery", 
    "esri/dijit/BasemapLayer", 
    "dijit/form/HorizontalSlider",
    "dijit/registry"], 
    
 function(declare, lang, domConstruct, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
     BasemapTogglerTmpl, Menu, MenuItem, Basemap, BasemapGallery, BasemapLayer, HorizontalSlider, registry) {

    var _basemapGallery = null, selectMenu = null, bing_basemaps = [];

    return declare("mapper.widgets.BasemapGalleryEx", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

        templateString: BasemapTogglerTmpl, 
        
        showArcGISMaps : true,

        showConedMaps : false,

        showBingMaps : true,
        
        bingMapsKey: "",
        
        opacity: 1,
        
        mapId : null,

        _setShowBingMapsAttr : function(val) {
            bing_basemaps = [];
            if (val) {
                var basemapRoad = new esri.dijit.Basemap({
                    layers : [new esri.dijit.BasemapLayer({
                        type : "BingMapsRoad"
                    })],
                    id : "bmRoad",
                    title : "Bing Road"
                });
                bing_basemaps.push(basemapRoad);
                var basemapAerial = new esri.dijit.Basemap({
                    layers : [new esri.dijit.BasemapLayer({
                        type : "BingMapsAerial"
                    })],
                    id : "bmAerial",
                    title : "Bing Aerial"
                });
                bing_basemaps.push(basemapAerial);
                var basemapHybrid = new esri.dijit.Basemap({
                    layers : [new esri.dijit.BasemapLayer({
                        type : "BingMapsHybrid"
                    })],
                    id : "bmHybrid",
                    title : "Bing Hybrid"
                });
                bing_basemaps.push(basemapHybrid);
            }
        },

        startup : function() {
            var cm = registry.byId(this.get("mapId"));
            var map = cm._esriMap;
            var bmgOpts = {
                showArcGISBasemaps: this.get("showArcGISMaps"),
                basemaps : bing_basemaps,
                map : map,
                bingMapsKey: this.get("bingMapsKey")
            };
            
            
            _basemapGallery = new BasemapGallery(bmgOpts, domConstruct.create('div', {}, this.domNode));
            dojo.forEach(bing_basemaps, dojo.hitch(this, function(basemap) {            
                var menuItem = new MenuItem({
                    label : basemap.title,
                    onClick : function() {
                        _basemapGallery.select(basemap.id);
                    }
                });
                
                this.selectMenu.addChild(menuItem);
            }));
            
            this.opacitySlider.on("change", dojo.hitch(this, function(newval) {
                console.log(newval);
                this.set("opacity", newval/100.0); 
            }));
        },
        
        _setOpacityAttr: function(opacity) {
            this._set("opacity", opacity);
            if (!_basemapGallery)
                return;
                
            var basemap = _basemapGallery.getSelected();
            dojo.forEach(_basemapGallery.basemaps, function(basemap) {
                dojo.forEach(basemap.getLayers(), function(basemapLayer) {
                    basemapLayer.opacity = opacity;
                });    
            });
            
            _basemapGallery.select(basemap.id);
        }
    });
});
