/**
 * @author narayanu
 *
 * BasemapToggler can use ArcGIS as well as Google basemaps
 *
 * description:
 *      To retrieve ArcGIS Online basemaps:
 *      1. Request http://www.arcgis.com/sharing/rest/community/groups
 *          ?q= title:"ArcGIS Online Basemaps" AND owner:esri_en
 *         Response describes the group, get id of group from results[0]
 *

 *
 *      3. Request http://www.arcgis."com/sharing/rest/content/items/8b3b470883a744aeb60e5fff0a319ce7/data?f=json
 *          returns basemap object
 *
 */

    define(["dojo/_base/declare", 
        "dojo/_base/lang", 
        "dojo/dom-construct", 
        "dijit/_WidgetBase",
        "dijit/_TemplatedMixin", 
        "dijit/_WidgetsInTemplateMixin",
        "dojo/text!mapper/widgets/templates/BasemapTogglerTmpl.html",
        "dijit/Menu", 
        "dijit/MenuItem",
        "dijit/form/HorizontalSlider",
        "esri/virtualearth/VETiledLayer",
        "mapper/utils/GMapsLayer",
        "dijit/registry"],

    function(declare, lang, domConstruct, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
        BasemapTogglerTmpl, Menu, MenuItem, HorizontalSlider, VETiledLayer, GMapsLayer, registry) {

    var google_roadmap_layer = null, google_hybrid_layer = null, menuItem = null, cm = null;

    return declare("mapper.widgets.BasemapToggler", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        
        templateString: BasemapTogglerTmpl, 
        
        title: "Basemaps",
        
        showBingBasemaps : true,
        
        bingMapsKey: "",
        
        opacity: 1,

        constructor : function(opts, srcRefNode) {
            //check if mapId has been set declaratively
            if (opts.hasOwnProperty('mapId')) {
                this.mapId = opts.mapId;
                this.custom_map = null;
            }
            //check if map is passed in explicitly in opts
            else if (opts.hasOwnProperty('map')) {
                this.custom_map = opts.map;
            }
            //otherwise throw an exception
            else {
                throw "BasemapToggler constructor options must specify map or mapId";
            }

            this.domNode = srcRefNode;
            this.opts = lang.mixin({
                showArcGISBasemaps : false,
                showGoogleBasemaps : false,
                showConEdBasemaps : false,
                showBingBasemaps: true,
                basemaps : [],
                bingMapsKey: "",
                selectedBasemap: "Bing Road"
            }, opts);

            //this.selectMenu = null;
            var valid_basemaps = [];

            //create Arcgis online basemaps
            if (this.opts.showArcGISBasemaps) {
                valid_basemaps = [
                    {
                        "name" : "ESRI Street Map",
                        "layer" : "streets",
                        "type" : "arcgisonline"
                    },
                    {
                        "name" : "ESRI Aerial",
                        "layer" : "hybrid",
                        "type" : "arcgisonline"
                    }
                    /*
                    {
                        "name" : "Light Gray Canvas",
                        "layer" : "gray",
                        "type" : "arcgisonline"
                    }
                    */
                ];
            }

            var bingMapsKey = this.opts.bingMapsKey;
            
            if (this.opts.showBingBasemaps && bingMapsKey.length > 0) {
                //create Bing basemaps
                var bingBasemapRoad = new esri.virtualearth.VETiledLayer({
                    bingMapsKey: bingMapsKey,
                    mapStyle: esri.virtualearth.VETiledLayer.MAP_STYLE_ROAD
                });
                valid_basemaps.push({
                    "name": "Bing Road",
                    "layer": bingBasemapRoad,
                    "type": "bing"
                });
                
                var bingBasemapAerial = new esri.virtualearth.VETiledLayer({
                    bingMapsKey: bingMapsKey,
                    mapStyle: esri.virtualearth.VETiledLayer.MAP_STYLE_AERIAL
                });
                valid_basemaps.push({
                    "name": "Bing Aerial",
                    "layer": bingBasemapAerial,
                    "type": "bing"
                });
                
                var bingBasemapHybrid = new esri.virtualearth.VETiledLayer({
                    bingMapsKey: bingMapsKey,
                    mapStyle: esri.virtualearth.VETiledLayer.MAP_STYLE_AERIAL_WITH_LABELS
                });
                valid_basemaps.push({
                    "name": "Bing Hybrid",
                    "layer": bingBasemapHybrid,
                    "type": "bing"
                });                
            }
       
            //create Google basemaps
            if (this.opts.showGoogleBasemaps) {
                //google_roadmap_layer = this._createGoogleBasemap("google_roadmap", "roadmap", "Google Roadmap", null);
                google_roadmap_layer = new GMapsLayer({
                    map_center : [-74, 40.7], // longitude, latitude
                    zoom : 12,
                    mapTypeId : "roadmap"
                });
                valid_basemaps.push({
                    "name" : "Google Roadmap",
                    "layer" : google_roadmap_layer,
                    "type" : "google"
                });

                //google_hybrid_layer = this._createGoogleBasemap("google_hybrid", "hybrid", "Google Hybrid", null);
                google_hybrid_layer = new GMapsLayer({
                    map_center : [-74, 40.7], // longitude, latitude
                    zoom : 12,
                    mapTypeId : "hybrid"
                });
                valid_basemaps.push({
                    "name" : "Google Aerial",
                    "layer" : google_hybrid_layer,
                    "type" : "google"
                });
            }

            //create named ConEdison basemaps
            if (this.opts.showConEdBasemaps) {
                /*
                var gaswebcachedlayer = "http://cmvpdev:6080/arcgis/rest/services/Gas/GasWebCached/MapServer";
                valid_basemaps.push({
                    "name" : "gaswebcached",
                    "layer" : gaswebcachedlayer,
                    "type" : "cachedmapservice"
                });
                */
                //var netmapcachedlayer = "http://cmvpdev:6080/arcgis/rest/services/netmap/LandbaseCached/MapServer";
                valid_basemaps.push({
                    "name" : "ConEd Roadmap",
                    "layer" : "http://arcgisnycwcsql/ArcGIS/rest/services/ae/mn_ae/MapServer",
                    "type" : "cachedmapservice"
                });
            }

            //here we add the basemaps that have been passed in by the AppController through
            //basemaps parameter in opts
            if (this.opts.basemaps.length > 0) {
                dojo.forEach(this.opts.basemaps, function(basemap) {
                    var lyr = new ArcGISTiledMapServiceLayer(basemap.url);
                    valid_basemaps.push({
                        "name" : basemap.label,
                        "layer" : lyr,
                        "type" : "cachedmapservice"
                    });
                });
            }
            
            this.valid_basemaps = valid_basemaps;
        },

        postCreate : function() {
            var self = this;
            this.selectedLayer = null;
            
            for (var i=0, il=this.valid_basemaps.length; i<il; i++) {
                var b = this.valid_basemaps[i];
                var menuItem = new MenuItem({
                    label : b.name,
                    layer : b,
                    onClick : function() {
                        //self.titlePane.set("title", this.layer.name);
                        //var layer = this.layer;
                        if (self.selectedLayer == null || 
                            (self.selectedLayer && this.layer.name !== self.selectedLayer.name)) {
                           
                           self.opacitySlider.set("value", 100);
                           this.layer.opacity = 1;
                           self._setBasemap(this.layer);
                        }
                    }
                });
                if (b.name.toLowerCase() === self.opts.selectedBasemap.toLowerCase()) {
                    self.selectedLayer = b;
                }
                this.selectMenu.addChild(menuItem);
            }
            
            setTimeout(function() {
                self._setBasemap(self.selectedLayer || self.valid_basemaps[0]);             
            }, 250);
            
            this.opacitySlider.on("change", dojo.hitch(this, function(newval) {
                this.set("opacity", newval/100.0); 
            }));
        },

        startup : function() {
            this.selectMenu.startup();                 
        },
        
        _setBasemap: function(layer) {
            var self = this;
            if (!cm) {
                cm = registry.byId(self.mapId);
            }
            cm.setBasemap(layer);
            self.selectedLayer = layer;
        },
        
        _setOpacityAttr: function(opacity) {
            this._set("opacity", opacity);
            if (cm) {
                cm.setBasemapOpacity(opacity);
            }
        }
        
    });
});
