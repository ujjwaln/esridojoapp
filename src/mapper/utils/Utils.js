
define(["dojo/_base/declare", "dijit/registry", "dojo/ready", "dojo/Deferred"], 
    
    function(declare, registry, ready, Deferred) {
  
    var instance = null;
    
    var Utils = declare("mapper.utils.Utils", [], {
        
        //summary:
        //      widgets that expect another widget to be instantiated before
        //      executing themselves can use this function to make sure the 
        //      dependency widget has been loaded.
        ensureWidgetLoaded: function(id) {
            var def = new Deferred();
            ready(function() {
                setTimeout(function() {
                    var widget = registry.byId(id);
                    def.resolve(widget);
                }, 5);
            });
            
            return def;
        }
    });
    
    if (!instance) {
        instance = new Utils();
    }
    
    return instance;
});
