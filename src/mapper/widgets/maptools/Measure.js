/* Measure widget creates a toggle button on startup which when clicked
 * creates a dialog containing esri measure widget tools
 */

define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom-construct",
    "dijit/form/ToggleButton",
    "dojox/layout/FloatingPane",
    "esri/dijit/Measurement",
    "dijit/registry",
    "dojo/on"], 
	
	function(declare, lang, domConstruct, ToggleButton, FloatingPane, ESRIMeasurement, registry, on) {

	return  declare('mapper.widgets.maptools.Measure', [ToggleButton], {

        mapId: null,
        
        iconClass: "measureIcon",
        
        measuring: false,
        
        constructor : function(opts, srcRefNode) {
            lang.mixin(this, opts);
            this.domNode = srcRefNode;
            this.floater = null;
        },
        
		_setMeasuringAttr: function(measuring) {
			this._set("measuring", measuring);
			if (measuring) {
				this.set("checked", true);
				this.startMeasure();
			} else {
				this.set("checked", false);
				this.endMeasure();
			}
		},
		
        startMeasure: function(){
            this.inherited(arguments);
            var node = document.createElement('div');
            dojo.body().appendChild(node);
            
            var style = "background-color:#ededed;border:1px solid #ccc;position: absolute;left: 300px;top: 100px;width: 300px;height: 200px; padding:1px";
            this.floater = new dojox.layout.FloatingPane({
                title:"Measure",
                dockable: false,
                maxable: false,
                closable: false,
                resizable: true,
                style: style
            }, node);

            this.floater.startup();
              
            on(this.floater.closeNode, "click", dojo.hitch(this, function(ev){
                this.endMeasure();      
                console.log("Floater mar gaya saala");
            }));
            
            //this.floater.startup();
            //this.floater.resize({ w:300, h:125 });
            var mapId = this.get("mapId");
            var cm = registry.byId(mapId);
            
            cm.removeClickHandlers();
            var esriMap = cm._esriMap;
            
            this.esriMeasure = new ESRIMeasurement({
                map : esriMap
            }, this.floater.containerNode);
            
            this.esriMeasure.startup();
        },
        
        endMeasure: function() {
            this.floater.destroy();
        }
        
	});
});
