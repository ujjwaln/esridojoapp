/**
 * @author narayanu
 */

define(["dojo/_base/declare", 
        "dojo/dom-construct",
        "dijit/registry",
        "dijit/Toolbar", 
        "dijit/form/Button", 
        "dijit/form/ToggleButton", 
        "dijit/_WidgetBase", 
        "dijit/_TemplatedMixin", 
        "dijit/_WidgetsInTemplateMixin",
        "mapper/widgets/maptools/Measure",
        "mapper/widgets/maptools/Identify",
        "esri/dijit/OverviewMap",
        "dojo/text!mapper/widgets/templates/MaptoolsTmpl.html"],

    //Measure, OverviewMap, Find, Identifier, Geocoder
    function(declare, domConstruct, registry, Toolbar, Button, ToggleButton, _WidgetBase, _TemplatedMixin, 
        _WidgetsInTemplateMixin, Measure, Identify, OverviewMap, MaptoolsTmpl) {
            
    return declare("mapper.widgets.Maptools", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

        templateString : MaptoolsTmpl,

        tocId: null,
        
        mapId: null,
        
        postCreate: function() {
        	this.inherited(arguments);
        	
        	this.identify.set("mapId", this.get("mapId"));
        	this.identify.set("tocId", this.get("tocId"));
        	
        	this.identify.onChange = dojo.hitch(this, function(checked) {
        		this.identify.set("identifying", checked);
				if (this.measure.get("measuring") && this.identify.get("identifying")) {
					this.measure.set("measuring", false);
				}
        	});
        	
        	this.measure.set("mapId", this.get("mapId"));
        	this.measure.onChange = dojo.hitch(this, function(checked) {
        		this.measure.set("measuring", checked);
        		if (this.measure.get("measuring") && this.identify.get("identifying")) {
					this.identify.set("identifying", false);
				}
        	});
        },
        
        overview : function() {
            if (this.overviewMap == null) {
                var map = registry.byId(this.get("mapId"))._esriMap;
                var overviewMapDijit = new OverviewMap({
                    map : map,
                    visible : true
                });

                //bottom-right, bottom-left, top-right or top-left.
                overviewMapDijit.attachTo = "bottom-right";
                overviewMapDijit.startup();

                this.overviewMap = overviewMapDijit;
            } else {
                this.overviewMap.destroy();
                this.overviewMap = null;
            }
        }
    });

});
