/**
 * @author narayanu
 */

define(['dojo/_base/declare', 'esri/toolbars/navigation', 'dijit/Toolbar', 'dijit/_WidgetBase', 'dijit/_TemplatedMixin', 
'dijit/_WidgetsInTemplateMixin', "dijit/registry", "dojo/ready", 'dojo/text!mapper/widgets/templates/NavTmpl.html',
'dijit/form/ToggleButton'], 

function(declare, Navigation, Toolbar, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, registry, ready, navTmpl, 
    ToggleButton) {
    
    return declare("mapper.widgets.Nav", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

        templateString : navTmpl,

        navbar : null,

        constructor : function(opts, srcRefNode) {
            //check if mapId has been set declaratively
            if (opts.hasOwnProperty('mapId')) {
                this.mapId = opts.mapId;
                this.id = "nav_" + String(this.mapId);
                this.customMap = null;
            }
            //check if map is passed in explicitly in opts
            else if (opts.hasOwnProperty('map')) {
                this.customMap = opts.map;
                this.id = "nav_" + String(opts.map.id);
            }
            //otherwise throw an exception
            else {
                throw "BasemapToggler constructor options must specify map or mapId";
            }

            this.domNode = srcRefNode;
        },

        postCreate : function() {
        },

        startup : function() {
            var self = this;

            //we need to make sure that custommap widget has loaded before getting esriMap for nav.
            var foo = {
                dojoReady : function() {
                    console.warn(this, "dojo dom and modules ready.");
                }
            };
            ready(foo, function() {
                if (self.customMap === null && self.mapId !== null) {
                    self.customMap = registry.byId(self.mapId);
                }
                if (self.customMap) {
                    self.customMap.mapLoadDeferred.then(function() {
                        var esrimap = self.customMap._esriMap;
                        //opts.map is the custom map object
                        //get the underlying esri map for nav control
                        self.navToolbar = new Navigation(esrimap);
                    });
                }
            });
        },

        navbarChange_zoomin : function() {
            //this.zoomout.set("focused", true);
            this.navToolbar.activate(Navigation.ZOOM_IN);
            this.checkMe(this.zoomin);
        },

        navbarChange_zoomout : function() {
            this.navToolbar.activate(Navigation.ZOOM_OUT);
            this.checkMe(this.zoomout);
        },

        navbarChange_zoomfullext : function() {
            this.navToolbar.zoomToFullExtent();
            this.checkMe(this.zoomfullextent);
        },

        navbarChange_zoomprev : function() {
            this.navToolbar.zoomToPrevExtent();
            this.checkMe(this.zoomprev);
        },

        navbarChange_zoomnext : function() {
            this.navToolbar.zoomToNextExtent();
            this.checkMe(this.zoomnext);
        },

        navbarChange_pan : function() {
            this.navToolbar.activate(Navigation.PAN);
            this.checkMe(this.pan);
        },

        navbarChange_deactivate : function() {
            this.navToolbar.deactivate();
        },
        
        checkMe: function(btn) {
            var buttons = [
                this.zoomout, this.zoomin, this.zoomfullext, this.zoomprev, 
                this.zoomnext, this.pan
            ];
            
            for (var i=0, il=buttons.length; i<il; i++) {
                if (btn.id != buttons[i].id)
                    buttons[i].set("checked", false);
            }
            
            btn.set("checked", true);
        }
    });
});
