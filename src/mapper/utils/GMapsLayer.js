/**
 * @author narayanu
 * 
 * summary:
 *      GMapsLayer makes an ESRI TiledMapServiceLayer out of google maps
 *
 */

define(["dojo/_base/declare", "dojo/on", "dojo/_base/array", "dojo/dom-construct", "dojo/dom-style", "dojo/number",
        "dojo/_base/lang", "esri/lang", "esri/domUtils", "esri/SpatialReference", "esri/geometry/Point", 
        "esri/layers/TiledMapServiceLayer", "esri/layers/TileInfo", "esri/geometry/webMercatorUtils", "esri/geometry/Extent"],

    function (declare, on, array, domConstruct, domStyle, number, lang, esriLang, domUtils, SpatialReference, Point,
              TiledMapServiceLayer, TileInfo, webMercatorUtils, Extent) {

        window.googleScriptLoader = {};
        
        window.webMercatorWkid = 102100;

        return declare("mapper.utils.GMapsLayer", [TiledMapServiceLayer], {

            /**********************
             * @see http://help.arcgis.com/en/webapi/javascript/arcgis/samples/exp_rasterlayer/javascript/RasterLayer.js
             * Internal Properties
             *
             * _map
             * _element
             * _context
             * _mapWidth
             * _mapHeight
             * _connects
             *
             **********************/
            // "-chains-" : {
            // constructor : "manual"
            // },

            constructor: function (opts) {
                // this.inherited(arguments);
                // ["http://some.server.com/path", options]);
                this._opts = lang.mixin({
                    apiOpts: {
                        sensor: false,
                        version: 3.15
                    },
                    map_center: [0, 0], // longitude, latitude
                    id: "google-basemap",
                    panControl: false,
                    mapTypeControl: false,
                    mapTypeId: "roadmap",
                    zoomControl: false,
                    streetViewControl: false,
                    tilt: 0 //Important, this stops the hybrid map from going into oblique view
                }, opts || {});
                
                this._opts.mapTypeId = String(this._opts.mapTypeId).toUpperCase();
                
                //check if we have the correct mapTypeId set
                if (!(this._opts.mapTypeId == "ROADMAP" ||
                    this._opts.mapTypeId == "SATELLITE" ||
                    this._opts.mapTypeId == "HYBRID"))
                        throw "Incorrect mapTypeId while creating GMapsLayer, should be one of 'roadmap', 'hybrid' or 'satellite'";
                
                this.id = this._opts.id;
                
                var zlevel = this._opts.zoom || this._map.getZoom();
                this._opts.zoom = (zlevel > -1) ? zlevel : 1;
                this._gmap = null;
                
                //all properties below are needed for this to work as a tilemapservicelayer
                this.url = "http://";
                this.tileInfo = new TileInfo({
                    rows: 256,
                    cols: 256,
                    dpi: 96,
                    origin: {
                        x: -20037508.342787,
                        y: 20037508.342787
                    },
                    spatialReference: {
                        wkid: webMercatorWkid
                    },
                    lods: [
                        {
                            level: 0,
                            resolution: 156543.033928,
                            scale: 591657527.591555
                        },
                        {
                            level: 1,
                            resolution: 78271.5169639999,
                            scale: 295828763.795777
                        },
                        {
                            level: 2,
                            resolution: 39135.7584820001,
                            scale: 147914381.897889
                        },
                        {
                            level: 3,
                            resolution: 19567.8792409999,
                            scale: 73957190.948944
                        },
                        {
                            level: 4,
                            resolution: 9783.93962049996,
                            scale: 36978595.474472
                        },
                        {
                            level: 5,
                            resolution: 4891.96981024998,
                            scale: 18489297.737236
                        },
                        {
                            level: 6,
                            resolution: 2445.98490512499,
                            scale: 9244648.868618
                        },
                        {
                            level: 7,
                            resolution: 1222.99245256249,
                            scale: 4622324.434309
                        },
                        {
                            level: 8,
                            resolution: 611.49622628138,
                            scale: 2311162.217155
                        },
                        {
                            level: 9,
                            resolution: 305.748113140558,
                            scale: 1155581.108577
                        },
                        {
                            level: 10,
                            resolution: 152.874056570411,
                            scale: 577790.554289
                        },
                        {
                            level: 11,
                            resolution: 76.4370282850732,
                            scale: 288895.277144
                        },
                        {
                            level: 12,
                            resolution: 38.2185141425366,
                            scale: 144447.638572
                        },
                        {
                            level: 13,
                            resolution: 19.1092570712683,
                            scale: 72223.819286
                        },
                        {
                            level: 14,
                            resolution: 9.55462853563415,
                            scale: 36111.909643
                        },
                        {
                            level: 15,
                            resolution: 4.77731426794937,
                            scale: 18055.954822
                        },
                        {
                            level: 16,
                            resolution: 2.38865713397468,
                            scale: 9027.977411
                        },
                        {
                            level: 17,
                            resolution: 1.19432856685505,
                            scale: 4513.988705
                        },
                        {
                            level: 18,
                            resolution: 0.597164283559817,
                            scale: 2256.994353
                        },
                        {
                            level: 19,
                            resolution: 0.298582141647617,
                            scale: 1128.497176
                        },
                        {
                            level: 20,
                            resolution: 0.149291070823808,
                            scale: 564.248588
                        }
                    ]
                });
                this.fullExtent = new Extent({
                    "xmin": -20037507.0671618,
                    "ymin": -19971868.8804086,
                    "xmax": 20037507.0671618,
                    "ymax": 19971868.8804086,
                    "spatialReference": {
                        "wkid": webMercatorWkid
                    }
                });              
                this.initialExtent = new Extent({
                    "xmin": -20037507.0671618,
                    "ymin": -19971868.8804086,
                    "xmax": 20037507.0671618,
                    "ymax": 19971868.8804086,
                    "spatialReference": {
                        "wkid": webMercatorWkid
                    }
                });
                this.spatialReference = new SpatialReference(webMercatorWkid);
                this.opacity = this._opts.opacity || 1;
                this.loaded = true;
                this.visible = true;
                this.type = "WebTiledLayer";
                //this is required for the Layer to work with basemapgallery widget
                this._basemapGalleryLayerType = 'basemap';
                // Event connections
                this._connects = [];
           
                this.onLoad(this);                
            },

            _setMap: function (map, container) {

                this._map = map;
                console.log("GmapsLayer _setMap", container);
                var element = domConstruct.create('div', null, container, "last");
                if (this.id) {
                    element.id = this.id;
                };
                var style = {
                    position: "absolute",
                    top: "0px",
                    bottom: "0px",
                    left: "0px",
                    right: "0px"
                    //border: "1px solid #000",
                    //width: (map.width || container.offsetWidth) + 'px',
                    //height: (map.height || container.offsetHeight) + 'px'
                };
                
                //apply styles to wrapper div
                dojo.style(element, style);
                this._element = element;

                var div = domConstruct.create('div', {}, element, "last");
                dojo.style(div, style);
                this._gmapDiv = div;
                
                //this._connects.push(dojo.connect(this, 'onVisibilityChange', this, this._visibilityChangeHandler));
                //this._connects.push(dojo.connect(this, 'onOpacityChange', this, this._opacityChangeHandler));
                if (!window.google) {
                    this._loadApi();
                } 
                else {
                    this._initGMap();
                }
                return element;
            },
            
           _unsetMap: function(map, layersDiv) {
              // see _setMap. Undocumented method, but probably should be public.
              array.forEach(this._connects, function(handler) {
                  handler.remove();
              });
              
              if (google && google.maps && google.maps.event) {
                if (this._gmapTypeChangeHandle) 
                  google.maps.event.removeListener(this._gmapTypeChangeHandle);
              }
              
              if (this._element) 
                this._element.parentNode.removeChild(this._element);
              dojo.destroy(this._element);
              
              this._element = null;
              this._connects = [];
            },
            
            _loadApi: function() {
                // this is the first instance that tries to load agsjs API on-demand
                googleScriptLoader.onGMapsApiLoad = function () {
                    //console.log('agsjs.onGMapsApiLoad');
                };

                dojo.connect(googleScriptLoader, 'onGMapsApiLoad', this, dojo.hitch(this, function() {
                    this._initGMap();
                }));

                var script = document.createElement('script');
                script.type = 'text/javascript';
                var pro = window.location.protocol;
                if (pro.toLowerCase().indexOf('http') == -1) {
                    pro = 'http:';
                }
                var src = pro + '//maps.googleapis.com/maps/api/js?callback=googleScriptLoader.onGMapsApiLoad';
                for (var x in this._opts.apiOptions) {
                    if (this._opts.apiOptions.hasOwnProperty(x)) {
                        src += '&' + x + '=' + this._opts.apiOptions[x];
                    }
                }
                script.src = src;                
                if (document.getElementsByTagName('head').length > 0) {
                    document.getElementsByTagName('head')[0].appendChild(script);
                } else {
                    document.body.appendChild(script);
                }
            },
            
            _getMapTypeGoogleId: function(mapType) {
                switch (mapType.toUpperCase()) {
                    case "ROADMAP":
                        return google.maps.MapTypeId.ROADMAP;
                    case "SATELLITE":
                        return google.maps.MapTypeId.SATELLITE;
                    case "HYBRID":
                        return google.maps.MapTypeId.HYBRID;
                    default:
                        return google.maps.MapTypeId.ROADMAP;  
                };
            },
            
            _initGMap: function () {
                window.google = window.google || {};
                if (window.google && google.maps) {
                    //overwrite the center and mapTypeId property in opts with the google LatLng object
                    if (!this._opts.center) {
                        var center = new google.maps.LatLng(this._opts.map_center[1], this._opts.map_center[0], true);
                        this._opts.center = center;
                    }
                    
                    if (this._map.extent) {
                        var center = this._esriPointToLatLng(this._map.extent.getCenter());
                        var level = this._map.getLevel();
                        this._opts.center = center;
                        this._opts.zoom = level;
                    }  
                        
                    this._opts.mapTypeId = this._getMapTypeGoogleId(this._opts.mapTypeId);
                    //console.log('Creating google map with opts', this._opts);
                    
                    if (this._gmap) {
                        this._gmap = null;
                    }
                    
                    this._gmap = new google.maps.Map(this._gmapDiv, this._opts);
                    
                    google.maps.event.addListenerOnce(this._gmap, 'idle', dojo.hitch(this, function () {
                        var self = this;
                        self._setupEventHandlers();
                        
                        //set the esri map object's initial extent and connect the extent change handler
                        /*
                        var esriExtent = this._map.extent || this._latLngBoundsToEsriExtent(this._gmap.getBounds());
                        this._map.setExtent(esriExtent).then(function() {
                            self._setupEventHandlers();
                        });
                        */
                    }));

                    this.onLoad();
                } 
            },
    
            _setupEventHandlers: function() {
                var extentChangeHandler = on(this._map, 'extent-change', 
                    dojo.hitch(this, function(args) {
                        var delta = args.delta,
                            extent = args.extent,
                            levelChange = args.levelChange,
                            lod = args.lod;
                            
                        //console.log(delta, extent, levelChange, lod);
                        if (this._gmap != null) {
                            if (levelChange) {
                                this._setExtent(extent);
                            } else {
                                this._gmap.setCenter(this._esriPointToLatLng(extent.getCenter()));
                            }
                        }
                    })
                );
                        
                var resizeHandler = on(this._map, 'resize', dojo.hitch(this, function (extent, height, width) {
                    dojo.style(this._gmapDiv, {
                        width: this._map.width + "px",
                        height: this._map.height + "px"
                    });
                    google.maps.event.trigger(this._gmap, 'resize');
                }));
                
                //hide dynamic layers when the map pan starts 
                var panStartHandle = on(this._map, 'pan-start', dojo.hitch(this, function() {
                    var lids = this._map.layerIds;
                    //console.log('pan-start', lids);
                    for (var i=0; i<lids.length; i++) {
                        this._map.getLayer(lids[i]).hide();
                    }
                }));
                
                //show dynamic layers when the map pan ends 
                var panEndHandle = on(this._map, 'pan-end', dojo.hitch(this, function() {
                    var lids = this._map.layerIds;
                    //console.log('pan-end', lids);
                    for (var i=0; i<lids.length; i++) {
                        this._map.getLayer(lids[i]).show();
                    }
                }));

                this._connects.push(extentChangeHandler);
                this._connects.push(resizeHandler);        
                this._connects.push(panStartHandle);
                this._connects.push(panEndHandle);    
            },
            
            onLoad: function () {
            },

            _setExtent: function (extent) {                
                 var center = this._esriPointToLatLng(extent.getCenter());
                 this._gmap.fitBounds(this._esriExtentToLatLngBounds(extent.expand(0.5)));
                 this._gmap.setCenter(center);
            },

            _mapTypeChangeHandler: function () {
                //this._checkZoomLevel();
                this.onMapTypeChange(this._gmap.getMapTypeId());
            },

            _esriPointToLatLng: function (pt) {
                var ll = webMercatorUtils.webMercatorToGeographic(pt);
                return new google.maps.LatLng(ll.y, ll.x);
            },

            _latLngToEsriPoint: function(ll) {
                var cp = new Point(ll.lng(), ll.lat(), new SpatialReference({ wkid: 4326 }));
                var utm = webMercatorUtils.geographicToWebMercator(cp);
                return utm;
            },
            
            _esriExtentToLatLngBounds: function (ext) {
                var llb = webMercatorUtils.webMercatorToGeographic(ext);
                return new google.maps.LatLngBounds(new google.maps.LatLng(llb.ymin, llb.xmin, true), 
                    new google.maps.LatLng(llb.ymax, llb.xmax, true));
            },

            _latLngBoundsToEsriExtent: function (bounds) {
                var ext = new esri.geometry.Extent(bounds.getSouthWest().lng(), bounds.getSouthWest().lat(),
                    bounds.getNorthEast().lng(), bounds.getNorthEast().lat());
                return webMercatorUtils.geographicToWebMercator(ext);
            }
        });
    });
